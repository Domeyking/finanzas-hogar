-- ─────────────────────────────────────────────
-- Happy Life — Supabase schema (multi-tenant)
-- Pega esto en SQL Editor > New query > Run
-- ─────────────────────────────────────────────

-- ─────────────────────────────────────────────
-- Cuentas (hogar, equipo, proyecto, etc.)
-- ─────────────────────────────────────────────

create table if not exists public.cuentas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  descripcion text,
  owner_id    uuid references auth.users(id) on delete cascade not null,
  created_at  timestamptz default now()
);

create table if not exists public.cuenta_miembros (
  id          uuid primary key default gen_random_uuid(),
  cuenta_id   uuid references public.cuentas(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  role        text not null default 'member' check (role in ('owner','member')),
  joined_at   timestamptz default now(),
  unique (cuenta_id, user_id)
);

create table if not exists public.invitaciones (
  id          uuid primary key default gen_random_uuid(),
  cuenta_id   uuid references public.cuentas(id) on delete cascade not null,
  codigo      text not null unique,
  created_by  uuid references auth.users(id) on delete cascade not null,
  used_by     uuid references auth.users(id) on delete set null,
  used_at     timestamptz,
  created_at  timestamptz default now()
);

create index if not exists cuenta_miembros_user_idx on public.cuenta_miembros(user_id);
create index if not exists cuenta_miembros_cuenta_idx on public.cuenta_miembros(cuenta_id);
create index if not exists invitaciones_codigo_idx on public.invitaciones(codigo);

-- Helper: ¿está este usuario en esta cuenta?
create or replace function public.user_in_cuenta(p_cuenta uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.cuenta_miembros
    where cuenta_id = p_cuenta and user_id = auth.uid()
  )
$$;

alter table public.cuentas enable row level security;
alter table public.cuenta_miembros enable row level security;
alter table public.invitaciones enable row level security;

-- cuentas: miembros pueden ver, owner puede editar/borrar, cualquiera puede crear
drop policy if exists "Ver cuentas propias" on public.cuentas;
create policy "Ver cuentas propias"
  on public.cuentas for select
  using (public.user_in_cuenta(id) or auth.uid() = owner_id);

drop policy if exists "Crear cuenta" on public.cuentas;
create policy "Crear cuenta"
  on public.cuentas for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Editar cuenta (owner)" on public.cuentas;
create policy "Editar cuenta (owner)"
  on public.cuentas for update
  using (auth.uid() = owner_id);

drop policy if exists "Borrar cuenta (owner)" on public.cuentas;
create policy "Borrar cuenta (owner)"
  on public.cuentas for delete
  using (auth.uid() = owner_id);

-- cuenta_miembros: cada uno ve los miembros de sus cuentas
drop policy if exists "Ver miembros de mi cuenta" on public.cuenta_miembros;
create policy "Ver miembros de mi cuenta"
  on public.cuenta_miembros for select
  using (public.user_in_cuenta(cuenta_id));

drop policy if exists "Insertar como miembro" on public.cuenta_miembros;
create policy "Insertar como miembro"
  on public.cuenta_miembros for insert
  with check (auth.uid() = user_id);

drop policy if exists "Borrarse a sí mismo" on public.cuenta_miembros;
create policy "Borrarse a sí mismo"
  on public.cuenta_miembros for delete
  using (auth.uid() = user_id);

-- invitaciones: miembros de la cuenta crean, cualquiera puede leer por código para canjear
drop policy if exists "Ver invitaciones de mi cuenta" on public.invitaciones;
create policy "Ver invitaciones de mi cuenta"
  on public.invitaciones for select
  using (public.user_in_cuenta(cuenta_id) or auth.role() = 'authenticated');

drop policy if exists "Crear invitación (miembro)" on public.invitaciones;
create policy "Crear invitación (miembro)"
  on public.invitaciones for insert
  with check (public.user_in_cuenta(cuenta_id) and auth.uid() = created_by);

drop policy if exists "Marcar invitación como usada" on public.invitaciones;
create policy "Marcar invitación como usada"
  on public.invitaciones for update
  using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- Gastos
-- ─────────────────────────────────────────────

create table if not exists public.gastos (
  id           uuid primary key default gen_random_uuid(),
  cuenta_id    uuid references public.cuentas(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade not null,
  user_name    text not null,
  fecha        date not null default current_date,
  descripcion  text not null,
  monto        numeric(12,0) not null check (monto >= 0),
  categoria    text not null,
  subcategoria text,
  fuente       text not null default 'Tarjeta de crédito',
  notas        text,
  email_id     text unique,
  created_at   timestamptz default now()
);

alter table public.gastos add column if not exists cuenta_id    uuid references public.cuentas(id) on delete cascade;
alter table public.gastos add column if not exists subcategoria text;
alter table public.gastos add column if not exists email_id     text unique;
alter table public.gastos drop constraint if exists gastos_monto_check;
alter table public.gastos add constraint gastos_monto_check check (monto >= 0);

create index if not exists gastos_cuenta_idx on public.gastos(cuenta_id);

alter table public.gastos enable row level security;

drop policy if exists "Ver todos los gastos" on public.gastos;
drop policy if exists "Insertar propios gastos" on public.gastos;
drop policy if exists "Borrar propios gastos" on public.gastos;
drop policy if exists "Editar propios gastos" on public.gastos;

drop policy if exists "Ver gastos de mi cuenta" on public.gastos;
create policy "Ver gastos de mi cuenta"
  on public.gastos for select
  using (cuenta_id is null or public.user_in_cuenta(cuenta_id));

drop policy if exists "Insertar gastos en mi cuenta" on public.gastos;
create policy "Insertar gastos en mi cuenta"
  on public.gastos for insert
  with check (auth.uid() = user_id and (cuenta_id is null or public.user_in_cuenta(cuenta_id)));

drop policy if exists "Editar gastos de mi cuenta" on public.gastos;
create policy "Editar gastos de mi cuenta"
  on public.gastos for update
  using (public.user_in_cuenta(cuenta_id));

drop policy if exists "Borrar propios gastos en mi cuenta" on public.gastos;
create policy "Borrar propios gastos en mi cuenta"
  on public.gastos for delete
  using (auth.uid() = user_id and public.user_in_cuenta(cuenta_id));

-- ─────────────────────────────────────────────
-- Categorías
-- ─────────────────────────────────────────────

create table if not exists public.categorias (
  id          uuid primary key default gen_random_uuid(),
  cuenta_id   uuid references public.cuentas(id) on delete cascade,
  nombre      text not null,
  parent_id   uuid references public.categorias(id) on delete cascade,
  color       text not null default '#888780',
  icono       text,
  orden       integer not null default 0,
  activa      boolean not null default true,
  created_at  timestamptz default now()
);

alter table public.categorias add column if not exists cuenta_id uuid references public.cuentas(id) on delete cascade;

create index if not exists categorias_cuenta_idx on public.categorias(cuenta_id);
create index if not exists categorias_parent_idx on public.categorias(parent_id);
create index if not exists categorias_orden_idx  on public.categorias(orden);

alter table public.categorias enable row level security;

drop policy if exists "Ver categorías" on public.categorias;
drop policy if exists "Insertar categorías" on public.categorias;
drop policy if exists "Editar categorías" on public.categorias;
drop policy if exists "Borrar categorías" on public.categorias;

drop policy if exists "Ver categorías de mi cuenta" on public.categorias;
create policy "Ver categorías de mi cuenta"
  on public.categorias for select
  using (cuenta_id is null or public.user_in_cuenta(cuenta_id));

drop policy if exists "Insertar categorías en mi cuenta" on public.categorias;
create policy "Insertar categorías en mi cuenta"
  on public.categorias for insert
  with check (cuenta_id is null or public.user_in_cuenta(cuenta_id));

drop policy if exists "Editar categorías de mi cuenta" on public.categorias;
create policy "Editar categorías de mi cuenta"
  on public.categorias for update
  using (cuenta_id is null or public.user_in_cuenta(cuenta_id));

drop policy if exists "Borrar categorías de mi cuenta" on public.categorias;
create policy "Borrar categorías de mi cuenta"
  on public.categorias for delete
  using (cuenta_id is null or public.user_in_cuenta(cuenta_id));

-- ─────────────────────────────────────────────
-- Reglas de categoría (aprendizaje)
-- ─────────────────────────────────────────────

create table if not exists public.reglas_categoria (
  id          uuid primary key default gen_random_uuid(),
  cuenta_id   uuid references public.cuentas(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  keyword     text not null,
  categoria   text not null,
  created_at  timestamptz default now(),
  unique (cuenta_id, keyword)
);

alter table public.reglas_categoria add column if not exists cuenta_id uuid references public.cuentas(id) on delete cascade;

create index if not exists reglas_cuenta_idx on public.reglas_categoria(cuenta_id);

alter table public.reglas_categoria enable row level security;

drop policy if exists "Ver reglas de mi cuenta" on public.reglas_categoria;
create policy "Ver reglas de mi cuenta"
  on public.reglas_categoria for select
  using (cuenta_id is null or public.user_in_cuenta(cuenta_id));

drop policy if exists "Insertar/actualizar reglas en mi cuenta" on public.reglas_categoria;
create policy "Insertar/actualizar reglas en mi cuenta"
  on public.reglas_categoria for insert
  with check (cuenta_id is null or public.user_in_cuenta(cuenta_id));

drop policy if exists "Editar reglas de mi cuenta" on public.reglas_categoria;
create policy "Editar reglas de mi cuenta"
  on public.reglas_categoria for update
  using (cuenta_id is null or public.user_in_cuenta(cuenta_id));

drop policy if exists "Borrar reglas de mi cuenta" on public.reglas_categoria;
create policy "Borrar reglas de mi cuenta"
  on public.reglas_categoria for delete
  using (cuenta_id is null or public.user_in_cuenta(cuenta_id));

-- ─────────────────────────────────────────────
-- Relación por ID (FK) — fuente de verdad de la categoría.
-- Se declara aquí, al final, porque depende de que la tabla
-- categorias ya exista. Las columnas de texto categoria/subcategoria
-- quedan como caché. (Ver migracion_categoria_id.sql para el backfill.)
-- ─────────────────────────────────────────────
alter table public.gastos
  add column if not exists categoria_id    uuid references public.categorias(id) on delete set null;
alter table public.gastos
  add column if not exists subcategoria_id uuid references public.categorias(id) on delete set null;
create index if not exists gastos_categoria_id_idx    on public.gastos(categoria_id);
create index if not exists gastos_subcategoria_id_idx on public.gastos(subcategoria_id);

alter table public.reglas_categoria
  add column if not exists categoria_id uuid references public.categorias(id) on delete cascade;
