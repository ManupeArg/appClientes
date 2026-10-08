-- ============================================================
-- MSP · Migración 003 — Pagos imputados a remitos + pagos a cuenta + plazos/vencimientos
-- Requiere haber corrido migration_002.sql antes. Se puede correr más de una vez.
--   Supabase → SQL Editor → New query → pegar todo → Run
--
--  · Un pago se registra al cliente y se IMPUTA a uno o varios remitos (tabla pago_imputaciones).
--    Lo que no se imputa queda "a cuenta" y se puede imputar más adelante.
--  · Cada remito muestra cuánto se le imputó y cuánto le falta.
--  · Cada cliente tiene un plazo en días; el remito vence a fecha + plazo y se marca "vencido".
-- ============================================================

-- ------------------------------------------------------------
-- 1. Plazos y vencimientos
-- ------------------------------------------------------------
alter table public.clientes add column if not exists plazo_dias int not null default 0;
alter table public.remitos add column if not exists vencimiento date;

-- ------------------------------------------------------------
-- 2. Imputaciones de pagos a remitos
-- ------------------------------------------------------------
create table if not exists public.pago_imputaciones (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid not null references public.pagos(id) on delete cascade,
  remito_id uuid not null references public.remitos(id),
  monto numeric(14,2) not null check (monto > 0),
  creado_en timestamptz not null default now(),
  unique (pago_id, remito_id)
);
create index if not exists imput_remito on public.pago_imputaciones (remito_id);

alter table public.cuenta_corriente add column if not exists imputacion_id uuid references public.pago_imputaciones(id) on delete set null;

-- Migrar los pagos que tenían remito_id (versión anterior) a imputaciones
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pagos' and column_name = 'remito_id') then
    insert into public.pago_imputaciones (pago_id, remito_id, monto)
    select id, remito_id, monto from public.pagos where remito_id is not null
    on conflict (pago_id, remito_id) do nothing;
    -- los renglones de CC de esos pagos pasan a colgar de su imputación
    update public.cuenta_corriente cc set imputacion_id = i.id
    from public.pago_imputaciones i
    where cc.pago_id = i.pago_id and cc.remito_id = i.remito_id and cc.tipo = 'pago' and cc.imputacion_id is null;
  end if;
end $$;

-- Soltar vistas que dependen de pagos.remito_id y sacar la columna
drop view if exists public.saldos_clientes;
drop view if exists public.remitos_saldo;
drop view if exists public.pagos_saldo;
alter table public.pagos drop column if exists remito_id;
drop trigger if exists trg_pago_cc on public.pagos;

-- ------------------------------------------------------------
-- 3. Vistas
-- ------------------------------------------------------------
create view public.remitos_saldo with (security_invoker = true) as
select
  r.*,
  coalesce(p.pagado, 0) as pagado,
  case when r.estado = 'anulado' then 0 else r.total - coalesce(p.pagado, 0) end as saldo,
  case
    when r.estado = 'anulado' then 'anulado'
    when coalesce(p.pagado, 0) >= r.total then 'pagado'
    when coalesce(p.pagado, 0) > 0 then 'parcial'
    else 'pendiente'
  end as estado_pago,
  (r.estado = 'emitido' and r.total - coalesce(p.pagado, 0) > 0 and r.vencimiento is not null and r.vencimiento < public.hoy_ar()) as vencido
from public.remitos r
left join (
  select i.remito_id, sum(i.monto) as pagado
  from public.pago_imputaciones i join public.pagos pg on pg.id = i.pago_id
  where not pg.anulado group by i.remito_id
) p on p.remito_id = r.id;

-- Cada pago con lo imputado y lo que queda a cuenta
create view public.pagos_saldo with (security_invoker = true) as
select
  pg.*,
  coalesce(i.imputado, 0) as imputado,
  case when pg.anulado then 0 else pg.monto - coalesce(i.imputado, 0) end as a_cuenta
from public.pagos pg
left join (select pago_id, sum(monto) as imputado from public.pago_imputaciones group by pago_id) i on i.pago_id = pg.id;

create view public.saldos_clientes with (security_invoker = true) as
select
  c.id as cliente_id,
  c.nombre,
  c.tipo_precio,
  c.activo,
  c.plazo_dias,
  coalesce(cc.total_debe, 0) as total_debe,
  coalesce(cc.total_haber, 0) as total_haber,
  coalesce(cc.total_debe, 0) - coalesce(cc.total_haber, 0) as saldo,
  coalesce(v.vencido, 0) as saldo_vencido,
  coalesce(ac.a_cuenta, 0) as a_cuenta
from public.clientes c
left join (select cliente_id, sum(debe) as total_debe, sum(haber) as total_haber from public.cuenta_corriente group by cliente_id) cc on cc.cliente_id = c.id
left join (select cliente_id, sum(saldo) as vencido from public.remitos_saldo where vencido group by cliente_id) v on v.cliente_id = c.id
left join (select cliente_id, sum(a_cuenta) as a_cuenta from public.pagos_saldo where not anulado group by cliente_id) ac on ac.cliente_id = c.id;

-- ------------------------------------------------------------
-- 4. Triggers
-- ------------------------------------------------------------

-- Pago nuevo → renglón "a cuenta" (sin remito ni unidad). Anulación → contra-asiento de todo lo acreditado.
create or replace function public.pago_cuenta_corriente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.cuenta_corriente (cliente_id, fecha, tipo, descripcion, haber, pago_id)
    values (new.cliente_id, new.fecha, 'pago', 'Pago a cuenta (' || new.medio || ')' || coalesce(' · ' || new.referencia, ''), new.monto, new.id);
  elsif tg_op = 'UPDATE' and new.anulado and not old.anulado then
    insert into public.cuenta_corriente (cliente_id, fecha, tipo, descripcion, debe, pago_id, remito_id, unidad_negocio_id)
    select cc.cliente_id, public.hoy_ar(), 'anulacion_pago', 'Anulación de pago', cc.haber, new.id, cc.remito_id, cc.unidad_negocio_id
    from public.cuenta_corriente cc where cc.pago_id = new.id and cc.tipo = 'pago' and cc.haber > 0;
  end if;
  return new;
end $$;

create trigger trg_pago_cc after insert or update on public.pagos
  for each row execute function public.pago_cuenta_corriente();

-- Imputación → mueve esa parte del "a cuenta" al remito, repartida por unidad de negocio
create or replace function public.imputacion_cuenta_corriente()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  pg public.pagos%rowtype;
  r public.remitos%rowtype;
  pendiente numeric;
  disponible numeric;
begin
  if tg_op = 'INSERT' then
    select * into pg from public.pagos where id = new.pago_id;
    if pg.anulado then raise exception 'El pago está anulado'; end if;
    select * into r from public.remitos where id = new.remito_id;
    if not found then raise exception 'Remito inexistente'; end if;
    if r.cliente_id <> pg.cliente_id then raise exception 'El remito no es de este cliente'; end if;
    if r.estado = 'anulado' then raise exception 'El remito está anulado'; end if;

    select r.total - coalesce(sum(i.monto), 0) into pendiente
    from public.pago_imputaciones i join public.pagos p2 on p2.id = i.pago_id
    where i.remito_id = new.remito_id and not p2.anulado and i.id <> new.id;
    if new.monto > pendiente + 0.01 then
      raise exception 'Se intenta imputar % al remito N° % pero solo le faltan %', new.monto, r.numero, pendiente;
    end if;

    select pg.monto - coalesce(sum(monto), 0) into disponible
    from public.pago_imputaciones where pago_id = new.pago_id and id <> new.id;
    if new.monto > disponible + 0.01 then
      raise exception 'El pago solo tiene % sin imputar y se intenta imputar %', disponible, new.monto;
    end if;

    -- renglones por unidad del remito
    insert into public.cuenta_corriente (cliente_id, fecha, tipo, descripcion, haber, pago_id, remito_id, imputacion_id, unidad_negocio_id)
    select pg.cliente_id, pg.fecha, 'pago',
           'Pago remito N° ' || r.numero || ' (' || pg.medio || ')' || coalesce(' · ' || pg.referencia, ''),
           x.importe, pg.id, r.id, new.id, x.unidad_negocio_id
    from public.repartir_por_unidad(r.id, new.monto) x where x.importe <> 0;

    -- descontar del renglón "a cuenta"
    update public.cuenta_corriente set haber = haber - new.monto
    where pago_id = new.pago_id and tipo = 'pago' and remito_id is null;
    delete from public.cuenta_corriente where pago_id = new.pago_id and tipo = 'pago' and remito_id is null and haber <= 0.001;
    return new;

  elsif tg_op = 'DELETE' then
    select * into pg from public.pagos where id = old.pago_id;
    delete from public.cuenta_corriente where imputacion_id = old.id;
    if found and not pg.anulado then
      update public.cuenta_corriente set haber = haber + old.monto
      where pago_id = old.pago_id and tipo = 'pago' and remito_id is null;
      if not found then
        insert into public.cuenta_corriente (cliente_id, fecha, tipo, descripcion, haber, pago_id)
        values (pg.cliente_id, pg.fecha, 'pago', 'Pago a cuenta (' || pg.medio || ')' || coalesce(' · ' || pg.referencia, ''), old.monto, pg.id);
      end if;
    end if;
    return old;
  end if;
  return null;
end $$;

drop trigger if exists trg_imputacion_cc on public.pago_imputaciones;
create trigger trg_imputacion_cc after insert or delete on public.pago_imputaciones
  for each row execute function public.imputacion_cuenta_corriente();

-- Remito: anulación bloqueada si tiene imputaciones de pagos vigentes
create or replace function public.remito_cuenta_corriente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.estado = 'emitido' and new.total <> old.total then
      perform public.rearmar_cc_remito(new.id);
    end if;

    if new.estado = 'anulado' and old.estado = 'emitido' then
      if exists (select 1 from public.pago_imputaciones i join public.pagos p on p.id = i.pago_id where i.remito_id = new.id and not p.anulado) then
        raise exception 'El remito tiene pagos imputados. Primero quitá esas imputaciones (quedan a cuenta del cliente).';
      end if;

      insert into public.cuenta_corriente (cliente_id, fecha, tipo, descripcion, haber, remito_id, unidad_negocio_id)
      select new.cliente_id, public.hoy_ar(), 'anulacion_remito', 'Anulación remito N° ' || new.numero, x.importe, new.id, x.unidad_negocio_id
      from public.repartir_por_unidad(new.id, new.total) x where x.importe <> 0;

      insert into public.movimientos_stock (producto_id, cantidad, tipo, referencia_id, descripcion, usuario_id)
      select producto_id, cantidad, 'anulacion_remito', new.id, 'Anulación remito N° ' || new.numero, new.usuario_id
      from public.remito_items where remito_id = new.id;

      update public.productos p set stock = p.stock + i.cantidad
      from public.remito_items i where i.remito_id = new.id and i.producto_id = p.id;
    end if;
  end if;
  return new;
end $$;

-- ------------------------------------------------------------
-- 5. Funciones para la app
-- ------------------------------------------------------------

-- Crear remito con vencimiento según el plazo del cliente
create or replace function public.crear_remito(
  p_cliente_id uuid,
  p_tipo_precio text,
  p_descuento numeric,
  p_observaciones text,
  p_items jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  rid uuid;
  it jsonb;
  prod public.productos%rowtype;
  cant integer;
  plazo int;
begin
  if not public.es_usuario_activo() then raise exception 'No autorizado'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'El remito no tiene ítems'; end if;
  select plazo_dias into plazo from public.clientes where id = p_cliente_id;

  insert into public.remitos (cliente_id, fecha, vencimiento, tipo_precio, descuento, observaciones, usuario_id)
  values (p_cliente_id, public.hoy_ar(),
          case when coalesce(plazo, 0) > 0 then public.hoy_ar() + plazo else null end,
          p_tipo_precio, coalesce(p_descuento, 0), p_observaciones, auth.uid())
  returning id into rid;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into prod from public.productos where id = (it->>'producto_id')::uuid;
    if not found then raise exception 'Producto inexistente'; end if;
    cant := (it->>'cantidad')::integer;
    if cant <= 0 then raise exception 'La cantidad de "%" debe ser mayor a 0', prod.nombre; end if;
    insert into public.remito_items (remito_id, producto_id, descripcion, cantidad, precio_unitario, subtotal, unidad_negocio_id)
    values (rid, prod.id, prod.nombre, cant, (it->>'precio_unitario')::numeric,
            round(cant * (it->>'precio_unitario')::numeric, 2), prod.unidad_negocio_id);
  end loop;

  update public.remitos set total = subtotal - descuento where id = rid;
  perform public.rearmar_cc_remito(rid);
  return rid;
end $$;

-- Registrar un pago e imputarlo (todo o en parte) en una sola transacción
-- p_imputaciones: [{remito_id, monto}] (puede ser [] → queda todo a cuenta)
create or replace function public.crear_pago(
  p_cliente_id uuid,
  p_monto numeric,
  p_medio text,
  p_referencia text,
  p_observaciones text,
  p_imputaciones jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
  it jsonb;
begin
  if not public.es_usuario_activo() then raise exception 'No autorizado'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto debe ser mayor a 0'; end if;

  insert into public.pagos (cliente_id, fecha, monto, medio, referencia, observaciones, usuario_id)
  values (p_cliente_id, public.hoy_ar(), p_monto, coalesce(p_medio, 'efectivo'), p_referencia, p_observaciones, auth.uid())
  returning id into pid;

  for it in select * from jsonb_array_elements(coalesce(p_imputaciones, '[]'::jsonb)) loop
    if (it->>'monto')::numeric > 0 then
      insert into public.pago_imputaciones (pago_id, remito_id, monto)
      values (pid, (it->>'remito_id')::uuid, round((it->>'monto')::numeric, 2));
    end if;
  end loop;
  return pid;
end $$;

-- Imputar (más tarde) un pago a cuenta a uno o varios remitos
create or replace function public.imputar_pago(p_pago_id uuid, p_imputaciones jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare it jsonb; n int := 0; previo numeric;
begin
  if not public.es_usuario_activo() then raise exception 'No autorizado'; end if;
  for it in select * from jsonb_array_elements(coalesce(p_imputaciones, '[]'::jsonb)) loop
    if (it->>'monto')::numeric > 0 then
      -- si ya había una imputación de este pago a este remito, se suma (se quita y se vuelve a crear)
      previo := 0;
      delete from public.pago_imputaciones where pago_id = p_pago_id and remito_id = (it->>'remito_id')::uuid
        returning monto into previo;
      insert into public.pago_imputaciones (pago_id, remito_id, monto)
      values (p_pago_id, (it->>'remito_id')::uuid, round(coalesce(previo, 0) + (it->>'monto')::numeric, 2));
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- Quitar una imputación: la plata vuelve a quedar a cuenta del cliente
create or replace function public.quitar_imputacion(p_imputacion_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_usuario_activo() then raise exception 'No autorizado'; end if;
  delete from public.pago_imputaciones where id = p_imputacion_id;
end $$;

-- Recalcular por unidad (versión con imputaciones)
create or replace function public.recalcular_unidades_remitos()
returns int language plpgsql security definer set search_path = public as $$
declare n int; rid uuid; im record; pg public.pagos%rowtype; r public.remitos%rowtype;
begin
  if not public.es_admin() then raise exception 'Solo administradores'; end if;

  update public.remito_items i set unidad_negocio_id = p.unidad_negocio_id
  from public.productos p where p.id = i.producto_id and i.unidad_negocio_id is null and p.unidad_negocio_id is not null;
  get diagnostics n = row_count;

  for rid in
    select distinct remito_id from public.cuenta_corriente where remito_id is not null and unidad_negocio_id is null
  loop
    perform public.rearmar_cc_remito(rid);
    select * into r from public.remitos where id = rid;
    for im in select i.* from public.pago_imputaciones i join public.pagos p on p.id = i.pago_id where i.remito_id = rid and not p.anulado loop
      select * into pg from public.pagos where id = im.pago_id;
      delete from public.cuenta_corriente where imputacion_id = im.id;
      insert into public.cuenta_corriente (cliente_id, fecha, tipo, descripcion, haber, pago_id, remito_id, imputacion_id, unidad_negocio_id)
      select pg.cliente_id, pg.fecha, 'pago',
             'Pago remito N° ' || r.numero || ' (' || pg.medio || ')' || coalesce(' · ' || pg.referencia, ''),
             x.importe, pg.id, rid, im.id, x.unidad_negocio_id
      from public.repartir_por_unidad(rid, im.monto) x where x.importe <> 0;
    end loop;
  end loop;
  return n;
end $$;

-- ------------------------------------------------------------
-- 6. Seguridad
-- ------------------------------------------------------------
alter table public.pago_imputaciones enable row level security;
drop policy if exists imput_select on public.pago_imputaciones;
create policy imput_select on public.pago_imputaciones for select using (public.es_usuario_activo());
drop policy if exists imput_insert on public.pago_imputaciones;
create policy imput_insert on public.pago_imputaciones for insert with check (public.es_usuario_activo());
drop policy if exists imput_delete on public.pago_imputaciones;
create policy imput_delete on public.pago_imputaciones for delete using (public.es_usuario_activo());
