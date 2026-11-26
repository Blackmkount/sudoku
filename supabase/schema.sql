-- ─────────────────────────────────────────────────────────────
--  Azulejo · base de datos en Supabase
--  Pega este archivo completo en SQL Editor → New query → Run.
--  Se puede ejecutar más de una vez sin romper nada.
-- ─────────────────────────────────────────────────────────────

-- Partida guardada de cada jugador (privada)
create table if not exists public.saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb not null,
  updated_at timestamptz not null default now(),
  constraint saves_state_size check (pg_column_size(state) < 500000)
);

-- Perfil público para el ranking
create table if not exists public.players (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  avatar       text not null default '🦉' check (char_length(avatar) <= 16),
  points       integer not null default 0 check (points between 0 and 100000),
  levels_done  integer not null default 0 check (levels_done between 0 and 1000),
  updated_at   timestamptz not null default now()
);
create index if not exists players_points_idx on public.players (points desc, updated_at asc);

alter table public.saves   enable row level security;
alter table public.players enable row level security;

-- Cada jugador solo puede leer y escribir su propia partida
drop policy if exists "saves: leer la propia"      on public.saves;
drop policy if exists "saves: crear la propia"     on public.saves;
drop policy if exists "saves: actualizar la propia" on public.saves;
create policy "saves: leer la propia"       on public.saves for select to authenticated using ((select auth.uid()) = user_id);
create policy "saves: crear la propia"      on public.saves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "saves: actualizar la propia" on public.saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- El ranking lo ve cualquiera; cada jugador solo edita su fila
drop policy if exists "players: ver ranking"        on public.players;
drop policy if exists "players: crear el propio"     on public.players;
drop policy if exists "players: actualizar el propio" on public.players;
create policy "players: ver ranking"         on public.players for select to anon, authenticated using (true);
create policy "players: crear el propio"      on public.players for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "players: actualizar el propio" on public.players for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select on public.players to anon, authenticated;
grant insert, update on public.players to authenticated;
grant select, insert, update on public.saves to authenticated;
