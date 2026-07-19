-- Talkaroo: profiles + practice sessions (RLS-enabled)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- practice_sessions
-- ---------------------------------------------------------------------------
create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  live_session_id text not null unique,
  scenario_id text not null,
  title_ko text,
  title_en text,
  status text not null default 'active'
    check (status in ('active', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index practice_sessions_user_id_started_at_idx
  on public.practice_sessions (user_id, started_at desc);

alter table public.practice_sessions enable row level security;

create policy "practice_sessions_select_own"
  on public.practice_sessions for select
  using (auth.uid() = user_id);

create policy "practice_sessions_insert_own"
  on public.practice_sessions for insert
  with check (auth.uid() = user_id);

create policy "practice_sessions_update_own"
  on public.practice_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- turns
-- ---------------------------------------------------------------------------
create table public.turns (
  id uuid primary key default gen_random_uuid(),
  practice_session_id uuid not null
    references public.practice_sessions (id) on delete cascade,
  client_turn_id text,
  role text not null check (role in ('user', 'partner')),
  transcript text not null,
  created_at timestamptz not null default now()
);

create index turns_practice_session_id_created_at_idx
  on public.turns (practice_session_id, created_at);

alter table public.turns enable row level security;

create policy "turns_select_own"
  on public.turns for select
  using (
    exists (
      select 1 from public.practice_sessions ps
      where ps.id = turns.practice_session_id
        and ps.user_id = auth.uid()
    )
  );

create policy "turns_insert_own"
  on public.turns for insert
  with check (
    exists (
      select 1 from public.practice_sessions ps
      where ps.id = turns.practice_session_id
        and ps.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- coach_results
-- ---------------------------------------------------------------------------
create table public.coach_results (
  id uuid primary key default gen_random_uuid(),
  turn_id uuid not null references public.turns (id) on delete cascade,
  practice_session_id uuid not null
    references public.practice_sessions (id) on delete cascade,
  mode text not null check (mode in ('partner_assist', 'learner_improve')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index coach_results_practice_session_id_created_at_idx
  on public.coach_results (practice_session_id, created_at);

alter table public.coach_results enable row level security;

create policy "coach_results_select_own"
  on public.coach_results for select
  using (
    exists (
      select 1 from public.practice_sessions ps
      where ps.id = coach_results.practice_session_id
        and ps.user_id = auth.uid()
    )
  );

create policy "coach_results_insert_own"
  on public.coach_results for insert
  with check (
    exists (
      select 1 from public.practice_sessions ps
      where ps.id = coach_results.practice_session_id
        and ps.user_id = auth.uid()
    )
  );
