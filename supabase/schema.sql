-- ============================================================
-- MSP · Esquema de base de datos (Supabase / PostgreSQL)
-- Ejecutar completo en: Supabase → SQL Editor → New query → Run
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. Perfiles de usuario (admin / vendedor)
-- ------------------------------------------------------------
create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  email text not null,
  rol text not null default 'vendedor' check (rol in ('admin', 'vendedor')),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Al registrarse un usuario en Auth se le crea el perfil.
-- El PRIMER usuario del sistema queda como admin; el resto como vendedor.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cantidad int;
begin
  select count(*) into cantidad from public.perfiles;
  insert into public.perfiles (id, nombre, email, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.email,
    case when cantidad = 0 then 'admin' else 'vendedor' end
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin' and activo);
$$;

create or replace function public.es_usuario_activo()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and activo);
$$;

-- ------------------------------------------------------------
-- 2. Clientes
-- ------------------------------------------------------------
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cuit text,
  telefono text,
  email text,
  direccion text,
  localidad text,
  tipo_precio text not null default 'minorista' check (tipo_precio in ('minorista', 'mayorista')),
  notas text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. Productos (2 precios + stock + mínimo para alerta)
-- ------------------------------------------------------------
create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  nombre text not null,
  descripcion text,
  categoria text,
  unidad text not null default 'u',
  precio_minorista numeric(14,2) not null default 0,
  precio_mayorista numeric(14,2) not null default 0,
  costo numeric(14,2),
  stock numeric(14,2) not null default 0,
  stock_minimo numeric(14,2) not null default 0,
  alerta_stock boolean not null default true,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Movimientos de stock: cada cambio queda registrado (trazabilidad)
create table if not exists public.movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  cantidad numeric(14,2) not null,          -- positivo = entra, negativo = sale
  tipo text not null check (tipo in ('remito', 'anulacion_remito', 'compra', 'ajuste', 'inicial')),
  referencia_id uuid,                        -- remito_id si aplica
  descripcion text,
  usuario_id uuid references public.perfiles(id),
  creado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. Remitos (ventas) e ítems
-- ------------------------------------------------------------
create sequence if not exists public.remito_numero_seq start 1;

create table if not exists public.remitos (
  id uuid primary key default gen_random_uuid(),
  numero int not null default nextval('public.remito_numero_seq') unique,
  cliente_id uuid not null references public.clientes(id),
  fecha date not null default current_date,
  tipo_precio text not null default 'minorista' check (tipo_precio in ('minorista', 'mayorista')),
  subtotal numeric(14,2) not null default 0,
  descuento numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  estado text not null default 'emitido' check (estado in ('emitido', 'anulado')),
  observaciones text,
  usuario_id uuid references public.perfiles(id),
  creado_en timestamptz not null default now(),
  anulado_en timestamptz
);

create table if not exists public.remito_items (
  id uuid primary key default gen_random_uuid(),
  remito_id uuid not null references public.remitos(id) on delete cascade,
  producto_id uuid not null references public.productos(id),
  descripcion text not null,
  cantidad numeric(14,2) not null check (cantidad > 0),
  precio_unitario numeric(14,2) not null,
  subtotal numeric(14,2) not null
);

-- ------------------------------------------------------------
-- 5. Pagos
-- ------------------------------------------------------------
create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id),
  fecha date not null default current_date,
  monto numeric(14,2) not null check (monto > 0),
  medio text not null default 'efectivo' check (medio in ('efectivo', 'transferencia', 'tarjeta', 'cheque', 'otro')),
  referencia text,
  observaciones text,
  anulado boolean not null default false,
  usuario_id uuid references public.perfiles(id),
  creado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 6. Cuenta corriente (un renglón por cada remito / pago)
--    debe  = lo que el cliente nos debe (remito)
--    haber = lo que el cliente pagó
-- ------------------------------------------------------------
create table if not exists public.cuenta_corriente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  fecha date not null default current_date,
  tipo text not null check (tipo in ('remito', 'pago', 'anulacion_remito', 'anulacion_pago', 'ajuste')),
  descripcion text not null,
  debe numeric(14,2) not null default 0,
  haber numeric(14,2) not null default 0,
  remito_id uuid references public.remitos(id) on delete cascade,
  pago_id uuid references public.pagos(id) on delete cascade,
  creado_en timestamptz not null default now()
);

create index if not exists cc_cliente_fecha on public.cuenta_corriente (cliente_id, fecha, creado_en);
create index if not exists remitos_cliente on public.remitos (cliente_id, fecha);
create index if not exists pagos_cliente on public.pagos (cliente_id, fecha);
create index if not exists mov_stock_producto on public.movimientos_stock (producto_id, creado_en);

-- Vista con el saldo de cada cliente
create or replace view public.saldos_clientes with (security_invoker = true) as
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

-- ------------------------------------------------------------
-- 7. Configuración (destinatarios de alertas, datos del negocio)
-- ------------------------------------------------------------
create table if not exists public.configuracion (
  clave text primary key,
  valor jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now()
);

insert into public.configuracion (clave, valor) values
  ('negocio', '{"nombre": "MSP", "cuit": "", "direccion": "", "telefono": "", "email": ""}'),
  ('alertas_stock', '{"emails": [], "activo": true}')
on conflict (clave) do nothing;

-- Registro de alertas enviadas (para no repetir el mismo aviso y ver historial)
create table if not exists public.alertas_enviadas (
  id uuid primary key default gen_random_uuid(),
  enviado_en timestamptz not null default now(),
  destinatarios text[] not null,
  productos jsonb not null,
  ok boolean not null default true,
  error text
);

-- ------------------------------------------------------------
-- 8. Triggers: stock y cuenta corriente automáticos
-- ------------------------------------------------------------

-- 8a. Al insertar un ítem de remito: baja stock y registra movimiento
create or replace function public.remito_item_baja_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r public.remitos%rowtype;
begin
  select * into r from public.remitos where id = new.remito_id;
  update public.productos set stock = stock - new.cantidad where id = new.producto_id;
  insert into public.movimientos_stock (producto_id, cantidad, tipo, referencia_id, descripcion, usuario_id)
  values (new.producto_id, -new.cantidad, 'remito', new.remito_id, 'Remito N° ' || r.numero, r.usuario_id);
  return new;
end $$;

drop trigger if exists trg_remito_item_stock on public.remito_items;
create trigger trg_remito_item_stock
  after insert on public.remito_items
  for each row execute function public.remito_item_baja_stock();

-- 8b. Recalcular totales del remito cuando cambian sus ítems
create or replace function public.recalcular_remito()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rid uuid := coalesce(new.remito_id, old.remito_id);
  st numeric(14,2);
begin
  select coalesce(sum(subtotal), 0) into st from public.remito_items where remito_id = rid;
  update public.remitos set subtotal = st, total = st - descuento where id = rid;
  return null;
end $$;

drop trigger if exists trg_recalcular_remito on public.remito_items;
create trigger trg_recalcular_remito
  after insert or update or delete on public.remito_items
  for each row execute function public.recalcular_remito();

-- 8c. Cuenta corriente: el remito genera DEBE; al anularlo se revierte y vuelve el stock
create or replace function public.remito_cuenta_corriente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    -- Cambió el total (por ítems o descuento): actualizar el renglón de la CC
    if new.estado = 'emitido' and new.total <> old.total then
      update public.cuenta_corriente set debe = new.total where remito_id = new.id and tipo = 'remito';
      if not found then
        insert into public.cuenta_corriente (cliente_id, fecha, tipo, descripcion, debe, remito_id)
        values (new.cliente_id, new.fecha, 'remito', 'Remito N° ' || new.numero, new.total, new.id);
      end if;
    end if;

    -- Anulación
    if new.estado = 'anulado' and old.estado = 'emitido' then
      insert into public.cuenta_corriente (cliente_id, fecha, tipo, descripcion, haber, remito_id)
      values (new.cliente_id, current_date, 'anulacion_remito', 'Anulación remito N° ' || new.numero, new.total, new.id);

      -- devolver stock
      insert into public.movimientos_stock (producto_id, cantidad, tipo, referencia_id, descripcion, usuario_id)
      select producto_id, cantidad, 'anulacion_remito', new.id, 'Anulación remito N° ' || new.numero, new.usuario_id
      from public.remito_items where remito_id = new.id;

      update public.productos p set stock = p.stock + i.cantidad
      from public.remito_items i where i.remito_id = new.id and i.producto_id = p.id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_remito_cc on public.remitos;
create trigger trg_remito_cc
  after update on public.remitos
  for each row execute function public.remito_cuenta_corriente();

-- 8d. Pagos: generan HABER; anular un pago lo revierte
create or replace function public.pago_cuenta_corriente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.cuenta_corriente (cliente_id, fecha, tipo, descripcion, haber, pago_id)
    values (new.cliente_id, new.fecha, 'pago', 'Pago (' || new.medio || ')' || coalesce(' · ' || new.referencia, ''), new.monto, new.id);
  elsif tg_op = 'UPDATE' and new.anulado and not old.anulado then
    insert into public.cuenta_corriente (cliente_id, fecha, tipo, descripcion, debe, pago_id)
    values (new.cliente_id, current_date, 'anulacion_pago', 'Anulación de pago', new.monto, new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_pago_cc on public.pagos;
create trigger trg_pago_cc
  after insert or update on public.pagos
  for each row execute function public.pago_cuenta_corriente();

-- 8e. Ajustes manuales de stock (compra, inventario, etc.)
create or replace function public.ajustar_stock(p_producto_id uuid, p_cantidad numeric, p_tipo text, p_descripcion text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_usuario_activo() then raise exception 'No autorizado'; end if;
  update public.productos set stock = stock + p_cantidad where id = p_producto_id;
  insert into public.movimientos_stock (producto_id, cantidad, tipo, descripcion, usuario_id)
  values (p_producto_id, p_cantidad, p_tipo, p_descripcion, auth.uid());
end $$;

-- 8f. Crear remito completo en una sola llamada (transaccional)
create or replace function public.crear_remito(
  p_cliente_id uuid,
  p_fecha date,
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
begin
  if not public.es_usuario_activo() then raise exception 'No autorizado'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'El remito no tiene ítems'; end if;

  insert into public.remitos (cliente_id, fecha, tipo_precio, descuento, observaciones, usuario_id)
  values (p_cliente_id, p_fecha, p_tipo_precio, coalesce(p_descuento, 0), p_observaciones, auth.uid())
  returning id into rid;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into prod from public.productos where id = (it->>'producto_id')::uuid;
    if not found then raise exception 'Producto inexistente'; end if;
    insert into public.remito_items (remito_id, producto_id, descripcion, cantidad, precio_unitario, subtotal)
    values (
      rid,
      prod.id,
      prod.nombre,
      (it->>'cantidad')::numeric,
      (it->>'precio_unitario')::numeric,
      round((it->>'cantidad')::numeric * (it->>'precio_unitario')::numeric, 2)
    );
  end loop;

  -- Forzar generación del renglón de cuenta corriente con el total final
  update public.remitos set total = subtotal - descuento where id = rid;
  return rid;
end $$;

-- Productos con stock bajo (para la alerta diaria)
create or replace view public.productos_stock_bajo with (security_invoker = true) as
select id, codigo, nombre, unidad, stock, stock_minimo
from public.productos
where activo and alerta_stock and stock <= stock_minimo
order by (stock - stock_minimo), nombre;

-- ------------------------------------------------------------
-- 9. Seguridad (RLS): solo usuarios logueados y activos; admin para borrar/config
-- ------------------------------------------------------------
alter table public.perfiles enable row level security;
alter table public.clientes enable row level security;
alter table public.productos enable row level security;
alter table public.movimientos_stock enable row level security;
alter table public.remitos enable row level security;
alter table public.remito_items enable row level security;
alter table public.pagos enable row level security;
alter table public.cuenta_corriente enable row level security;
alter table public.configuracion enable row level security;
alter table public.alertas_enviadas enable row level security;

-- perfiles
drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles for select using (public.es_usuario_activo());
drop policy if exists perfiles_update_admin on public.perfiles;
create policy perfiles_update_admin on public.perfiles for update using (public.es_admin());
drop policy if exists perfiles_update_propio on public.perfiles;
create policy perfiles_update_propio on public.perfiles for update using (id = auth.uid());

-- tablas operativas: leer/insertar/actualizar cualquier usuario activo; borrar solo admin
do $$
declare t text;
begin
  foreach t in array array['clientes','productos','movimientos_stock','remitos','remito_items','pagos','cuenta_corriente','alertas_enviadas'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select using (public.es_usuario_activo())', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (public.es_usuario_activo())', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('create policy %I_update on public.%I for update using (public.es_usuario_activo())', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format('create policy %I_delete on public.%I for delete using (public.es_admin())', t, t);
  end loop;
end $$;

-- configuración: leer todos, modificar solo admin
drop policy if exists config_select on public.configuracion;
create policy config_select on public.configuracion for select using (public.es_usuario_activo());
drop policy if exists config_write on public.configuracion;
create policy config_write on public.configuracion for all using (public.es_admin()) with check (public.es_admin());
