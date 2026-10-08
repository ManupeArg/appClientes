-- ============================================================
-- MSP · Migración 002
-- Ejecutar UNA sola vez sobre la base que ya está en uso:
--   Supabase → SQL Editor → New query → pegar todo → Run
--
-- Qué hace:
--   1. Unidades de negocio (Venenos / Limpieza) en productos, remitos y cuenta corriente
--   2. Los pagos se aplican a un remito concreto (no al cliente en general)
--   3. Cantidades y stock pasan a ser números enteros
--   4. Fecha de remitos y pagos automática (hora Argentina) y no editable
--   5. Reactiva productos/clientes que quedaron ocultos por el bug de "guardar"
-- ============================================================

-- ------------------------------------------------------------
-- 0. Fecha de hoy en hora Argentina
-- ------------------------------------------------------------
create or replace function public.hoy_ar()
returns date language sql stable as $$
  select (now() at time zone 'America/Argentina/Cordoba')::date;
$$;

-- ------------------------------------------------------------
-- 1. Unidades de negocio
-- ------------------------------------------------------------
create table if not exists public.unidades_negocio (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  color text not null default '#1f5eff',
  orden int not null default 0,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

insert into public.unidades_negocio (nombre, color, orden) values
  ('Venenos', '#c77800', 1),
  ('Limpieza', '#1f5eff', 2)
on conflict (nombre) do nothing;

alter table public.productos add column if not exists unidad_negocio_id uuid references public.unidades_negocio(id);
alter table public.remitos add column if not exists unidad_negocio_id uuid references public.unidades_negocio(id);
alter table public.cuenta_corriente add column if not exists unidad_negocio_id uuid references public.unidades_negocio(id);

create index if not exists productos_unidad on public.productos (unidad_negocio_id);
create index if not exists remitos_unidad on public.remitos (unidad_negocio_id);
create index if not exists cc_unidad on public.cuenta_corriente (cliente_id, unidad_negocio_id);

-- ------------------------------------------------------------
-- 2. Pagos aplicados a un remito
-- ------------------------------------------------------------
alter table public.pagos add column if not exists remito_id uuid references public.remitos(id);
create index if not exists pagos_remito on public.pagos (remito_id);

-- ------------------------------------------------------------
-- 3. Cantidades enteras
-- ------------------------------------------------------------
drop view if exists public.productos_stock_bajo;   -- se vuelve a crear más abajo
alter table public.remito_items alter column cantidad type integer using round(cantidad)::integer;
alter table public.productos alter column stock type integer using round(stock)::integer;
alter table public.productos alter column stock_minimo type integer using round(stock_minimo)::integer;
alter table public.movimientos_stock alter column cantidad type integer using round(cantidad)::integer;

-- ------------------------------------------------------------
-- 4. Fechas automáticas en hora Argentina
-- ------------------------------------------------------------
alter table public.remitos alter column fecha set default public.hoy_ar();
alter table public.pagos alter column fecha set default public.hoy_ar();
alter table public.cuenta_corriente alter column fecha set default public.hoy_ar();

-- ------------------------------------------------------------
-- 5. Vistas
-- ------------------------------------------------------------
drop view if exists public.saldos_clientes;
create view public.saldos_clientes with (security_invoker = true) as
select
  c.id as cliente_id,
  c.nombre,
  c.tipo_precio,
  c.activo,
  coalesce(sum(cc.debe), 0) as total_debe,
  coalesce(sum(cc.haber), 0) as total_haber,
  coalesce(sum(cc.debe) - sum(cc.haber), 0) as saldo
from public.clientes c
left join public.cuenta_corriente cc on cc.cliente_id = c.id
group by c.id;

-- Saldo de cada cliente separado por unidad de negocio
create or replace view public.saldos_clientes_unidad with (security_invoker = true) as
select
  cc.cliente_id,
  cc.unidad_negocio_id,
  u.nombre as unidad_nombre,
  coalesce(sum(cc.debe), 0) as total_debe,
  coalesce(sum(cc.haber), 0) as total_haber,
  coalesce(sum(cc.debe) - sum(cc.haber), 0) as saldo
from public.cuenta_corriente cc
left join public.unidades_negocio u on u.id = cc.unidad_negocio_id
group by cc.cliente_id, cc.unidad_negocio_id, u.nombre;

-- Cada remito con lo pagado y lo pendiente
create or replace view public.remitos_saldo with (security_invoker = true) as
select
  r.*,
  coalesce(p.pagado, 0) as pagado,
  case when r.estado = 'anulado' then 0 else r.total - coalesce(p.pagado, 0) end as saldo,
  case
    when r.estado = 'anulado' then 'anulado'
    when coalesce(p.pagado, 0) >= r.total then 'pagado'
    when coalesce(p.pagado, 0) > 0 then 'parcial'
    else 'pendiente'
  end as estado_pago
from public.remitos r
left join (
  select remito_id, sum(monto) as pagado from public.pagos where not anulado and remito_id is not null group by remito_id
) p on p.remito_id = r.id;

create view public.productos_stock_bajo with (security_invoker = true) as
select p.id, p.codigo, p.nombre, p.unidad, p.stock, p.stock_minimo, p.unidad_negocio_id, u.nombre as unidad_negocio
from public.productos p
left join public.unidades_negocio u on u.id = p.unidad_negocio_id
where p.activo and p.alerta_stock and p.stock <= p.stock_minimo
order by (p.stock - p.stock_minimo), p.nombre;

-- ------------------------------------------------------------
-- 6. Triggers y funciones (reemplazan a las anteriores)
-- ------------------------------------------------------------

-- Remito → cuenta corriente (con unidad de negocio); anulación bloqueada si tiene pagos
create or replace function public.remito_cuenta_corriente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.estado = 'emitido' and (new.total <> old.total or new.unidad_negocio_id is distinct from old.unidad_negocio_id) then
      update public.cuenta_corriente
        set debe = new.total, unidad_negocio_id = new.unidad_negocio_id
        where remito_id = new.id and tipo = 'remito';
      if not found then
        insert into public.cuenta_corriente (cliente_id, fecha, tipo, descripcion, debe, remito_id, unidad_negocio_id)
        values (new.cliente_id, new.fecha, 'remito', 'Remito N° ' || new.numero, new.total, new.id, new.unidad_negocio_id);
      end if;
    end if;

    if new.estado = 'anulado' and old.estado = 'emitido' then
      if exists (select 1 from public.pagos where remito_id = new.id and not anulado) then
        raise exception 'El remito tiene pagos registrados. Anulá primero los pagos.';
      end if;

      insert into public.cuenta_corriente (cliente_id, fecha, tipo, descripcion, haber, remito_id, unidad_negocio_id)
      values (new.cliente_id, public.hoy_ar(), 'anulacion_remito', 'Anulación remito N° ' || new.numero, new.total, new.id, new.unidad_negocio_id);

      insert into public.movimientos_stock (producto_id, cantidad, tipo, referencia_id, descripcion, usuario_id)
      select producto_id, cantidad, 'anulacion_remito', new.id, 'Anulación remito N° ' || new.numero, new.usuario_id
      from public.remito_items where remito_id = new.id;

      update public.productos p set stock = p.stock + i.cantidad
      from public.remito_items i where i.remito_id = new.id and i.producto_id = p.id;
    end if;
  end if;
  return new;
end $$;

-- Pago → cuenta corriente; valida remito y que no supere lo pendiente
create or replace function public.pago_cuenta_corriente()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
  pendiente numeric;
begin
  if tg_op = 'INSERT' then
    if new.remito_id is not null then
      select * into r from public.remitos where id = new.remito_id;
      if not found then raise exception 'Remito inexistente'; end if;
      if r.cliente_id <> new.cliente_id then raise exception 'El remito no pertenece a este cliente'; end if;
      if r.estado = 'anulado' then raise exception 'El remito está anulado'; end if;
      select r.total - coalesce(sum(monto), 0) into pendiente
      from public.pagos where remito_id = new.remito_id and not anulado and id <> new.id;
      if new.monto > pendiente + 0.01 then
        raise exception 'El pago (%) supera lo pendiente del remito (%)', new.monto, pendiente;
      end if;
      insert into public.cuenta_corriente (cliente_id, fecha, tipo, descripcion, haber, pago_id, remito_id, unidad_negocio_id)
      values (new.cliente_id, new.fecha, 'pago',
              'Pago remito N° ' || r.numero || ' (' || new.medio || ')' || coalesce(' · ' || new.referencia, ''),
              new.monto, new.id, new.remito_id, r.unidad_negocio_id);
    else
      insert into public.cuenta_corriente (cliente_id, fecha, tipo, descripcion, haber, pago_id)
      values (new.cliente_id, new.fecha, 'pago', 'Pago a cuenta (' || new.medio || ')' || coalesce(' · ' || new.referencia, ''), new.monto, new.id);
    end if;
  elsif tg_op = 'UPDATE' and new.anulado and not old.anulado then
    insert into public.cuenta_corriente (cliente_id, fecha, tipo, descripcion, debe, pago_id, remito_id, unidad_negocio_id)
    select new.cliente_id, public.hoy_ar(), 'anulacion_pago', 'Anulación de pago', new.monto, new.id, new.remito_id,
           (select unidad_negocio_id from public.remitos where id = new.remito_id);
  end if;
  return new;
end $$;

-- Crear remito: unidad de negocio obligatoria, fecha automática, cantidades enteras
drop function if exists public.crear_remito(uuid, date, text, numeric, text, jsonb);
create or replace function public.crear_remito(
  p_cliente_id uuid,
  p_unidad_negocio_id uuid,
  p_tipo_precio text,
  p_descuento numeric,
  p_observaciones text,
  p_items jsonb  -- [{producto_id, cantidad, precio_unitario}]
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  rid uuid;
  it jsonb;
  prod public.productos%rowtype;
  cant integer;
begin
  if not public.es_usuario_activo() then raise exception 'No autorizado'; end if;
  if p_unidad_negocio_id is null then raise exception 'Elegí la unidad de negocio'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'El remito no tiene ítems'; end if;

  insert into public.remitos (cliente_id, fecha, unidad_negocio_id, tipo_precio, descuento, observaciones, usuario_id)
  values (p_cliente_id, public.hoy_ar(), p_unidad_negocio_id, p_tipo_precio, coalesce(p_descuento, 0), p_observaciones, auth.uid())
  returning id into rid;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into prod from public.productos where id = (it->>'producto_id')::uuid;
    if not found then raise exception 'Producto inexistente'; end if;
    if prod.unidad_negocio_id is not null and prod.unidad_negocio_id <> p_unidad_negocio_id then
      raise exception 'El producto "%" pertenece a otra unidad de negocio', prod.nombre;
    end if;
    cant := (it->>'cantidad')::integer;
    if cant <= 0 then raise exception 'La cantidad de "%" debe ser mayor a 0', prod.nombre; end if;
    insert into public.remito_items (remito_id, producto_id, descripcion, cantidad, precio_unitario, subtotal)
    values (rid, prod.id, prod.nombre, cant, (it->>'precio_unitario')::numeric,
            round(cant * (it->>'precio_unitario')::numeric, 2));
  end loop;

  update public.remitos set total = subtotal - descuento where id = rid;
  return rid;
end $$;

-- Ajuste de stock con enteros
drop function if exists public.ajustar_stock(uuid, numeric, text, text);
create or replace function public.ajustar_stock(p_producto_id uuid, p_cantidad integer, p_tipo text, p_descripcion text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_usuario_activo() then raise exception 'No autorizado'; end if;
  update public.productos set stock = stock + p_cantidad where id = p_producto_id;
  insert into public.movimientos_stock (producto_id, cantidad, tipo, descripcion, usuario_id)
  values (p_producto_id, p_cantidad, p_tipo, p_descripcion, auth.uid());
end $$;

-- Asignar unidad de negocio a varios productos de una vez
create or replace function public.asignar_unidad_productos(p_ids uuid[], p_unidad_negocio_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.es_usuario_activo() then raise exception 'No autorizado'; end if;
  update public.productos set unidad_negocio_id = p_unidad_negocio_id where id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end $$;

-- Completar la unidad de negocio en remitos viejos (cuando todos sus productos son de la misma unidad)
create or replace function public.completar_unidad_remitos()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.es_admin() then raise exception 'Solo administradores'; end if;
  with calc as (
    select r.id, min(p.unidad_negocio_id::text)::uuid as unidad
    from public.remitos r
    join public.remito_items i on i.remito_id = r.id
    join public.productos p on p.id = i.producto_id
    where r.unidad_negocio_id is null
    group by r.id
    having count(distinct p.unidad_negocio_id) = 1 and bool_and(p.unidad_negocio_id is not null)
  )
  update public.remitos r set unidad_negocio_id = calc.unidad from calc where calc.id = r.id;
  get diagnostics n = row_count;

  -- propagar a la cuenta corriente
  update public.cuenta_corriente cc set unidad_negocio_id = r.unidad_negocio_id
  from public.remitos r where cc.remito_id = r.id and cc.unidad_negocio_id is null and r.unidad_negocio_id is not null;
  return n;
end $$;

-- ------------------------------------------------------------
-- 7. Seguridad de la tabla nueva
-- ------------------------------------------------------------
alter table public.unidades_negocio enable row level security;
drop policy if exists unidades_select on public.unidades_negocio;
create policy unidades_select on public.unidades_negocio for select using (public.es_usuario_activo());
drop policy if exists unidades_write on public.unidades_negocio;
create policy unidades_write on public.unidades_negocio for all using (public.es_admin()) with check (public.es_admin());

-- ------------------------------------------------------------
-- 8. Reparación: productos y clientes ocultos por el bug de "Guardar cambios"
--    (el formulario los marcaba como inactivos sin querer)
-- ------------------------------------------------------------
update public.productos set activo = true where not activo;
update public.clientes set activo = true where not activo;
