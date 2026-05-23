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
  monto       numeric(12,0) not null check (monto > 0),
  categoria   text not null,
  fuente      text not null default 'Tarjeta de crédito',
  notas       text,
  created_at  timestamptz default now()
);

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
