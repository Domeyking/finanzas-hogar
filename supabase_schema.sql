-- ─────────────────────────────────────────────
-- Finanzas en pareja — Supabase schema
-- Pega esto en SQL Editor > New query > Run
-- ─────────────────────────────────────────────

create table if not exists public.gastos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  user_name   text not null,
  fecha       date not null default current_date,
  descripcion text not null,
  monto       numeric(12,0) not null check (monto >= 0),
  categoria   text not null,
  fuente      text not null default 'Tarjeta de crédito',
  notas       text,
  email_id    text unique,
  created_at  timestamptz default now()
);

-- Migración para bases existentes
alter table public.gastos add column if not exists email_id text unique;
alter table public.gastos drop constraint if exists gastos_monto_check;
alter table public.gastos add constraint gastos_monto_check check (monto >= 0);

-- Habilitar Row Level Security
alter table public.gastos enable row level security;

-- Ambos usuarios pueden ver TODOS los gastos del hogar
create policy "Ver todos los gastos"
  on public.gastos for select
  using (auth.role() = 'authenticated');

-- Cada usuario solo puede insertar sus propios gastos
create policy "Insertar propios gastos"
  on public.gastos for insert
  with check (auth.uid() = user_id);

-- Cada usuario solo puede borrar sus propios gastos
create policy "Borrar propios gastos"
  on public.gastos for delete
  using (auth.uid() = user_id);

-- Cada usuario solo puede editar sus propios gastos
create policy "Editar propios gastos"
  on public.gastos for update
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- Categorías (compartidas entre la pareja)
-- ─────────────────────────────────────────────

create table if not exists public.categorias (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  parent_id   uuid references public.categorias(id) on delete cascade,
  color       text not null default '#888780',
  icono       text,
  orden       integer not null default 0,
  activa      boolean not null default true,
  created_at  timestamptz default now()
);

create index if not exists categorias_parent_idx on public.categorias(parent_id);
create index if not exists categorias_orden_idx  on public.categorias(orden);

alter table public.categorias enable row level security;

create policy "Ver categorías"
  on public.categorias for select
  using (auth.role() = 'authenticated');

create policy "Insertar categorías"
  on public.categorias for insert
  with check (auth.role() = 'authenticated');

create policy "Editar categorías"
  on public.categorias for update
  using (auth.role() = 'authenticated');

create policy "Borrar categorías"
  on public.categorias for delete
  using (auth.role() = 'authenticated');
