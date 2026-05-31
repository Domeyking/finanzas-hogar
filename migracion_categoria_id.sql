-- ════════════════════════════════════════════════════════════════
-- Migración: relacionar gastos y reglas con categorías por ID (FK)
-- en vez de por nombre (texto). Soluciona el bug de que renombrar
-- una categoría cambiaba la categoría de los gastos existentes.
--
-- Seguro de correr varias veces (idempotente). Lo que no matchee
-- queda en NULL — no se corrompe ningún dato.
-- ════════════════════════════════════════════════════════════════

-- ── 1. Nuevas columnas FK en gastos ──
alter table public.gastos
  add column if not exists categoria_id    uuid references public.categorias(id) on delete set null;
alter table public.gastos
  add column if not exists subcategoria_id uuid references public.categorias(id) on delete set null;

create index if not exists gastos_categoria_id_idx    on public.gastos(categoria_id);
create index if not exists gastos_subcategoria_id_idx on public.gastos(subcategoria_id);

-- ── 2. Backfill de categoría principal ──
-- Match por nombre + misma cuenta (null-safe) + es categoría raíz.
update public.gastos g
set categoria_id = c.id
from public.categorias c
where g.categoria_id is null
  and c.parent_id is null
  and c.nombre = g.categoria
  and c.cuenta_id is not distinct from g.cuenta_id;

-- ── 3. Backfill de subcategoría ──
-- La sub debe colgar de la categoría ya resuelta (parent_id = categoria_id).
update public.gastos g
set subcategoria_id = c.id
from public.categorias c
where g.subcategoria_id is null
  and g.subcategoria is not null
  and g.categoria_id is not null
  and c.parent_id = g.categoria_id
  and c.nombre = g.subcategoria
  and c.cuenta_id is not distinct from g.cuenta_id;

-- ── 4. reglas_categoria: agregar y backfillear categoria_id ──
alter table public.reglas_categoria
  add column if not exists categoria_id uuid references public.categorias(id) on delete cascade;

update public.reglas_categoria r
set categoria_id = c.id
from public.categorias c
where r.categoria_id is null
  and c.parent_id is null
  and c.nombre = r.categoria
  and c.cuenta_id is not distinct from r.cuenta_id;

-- ── 5. Verificación (opcional, solo lectura) ──
-- Gastos que NO pudieron matchear su categoría (deberían ser 0 si las
-- categorías estaban sembradas en cada cuenta):
--   select count(*) from public.gastos where categoria is not null and categoria_id is null;
