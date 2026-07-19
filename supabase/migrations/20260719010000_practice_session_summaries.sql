-- Post-session recap: one structured summary per practice session

create table public.practice_session_summaries (
  practice_session_id uuid primary key
    references public.practice_sessions (id) on delete cascade,
  recap jsonb not null,
  next_scenario_id text not null,
  created_at timestamptz not null default now()
);

alter table public.practice_session_summaries enable row level security;

create policy "practice_session_summaries_select_own"
  on public.practice_session_summaries for select
  using (
    exists (
      select 1 from public.practice_sessions ps
      where ps.id = practice_session_summaries.practice_session_id
        and ps.user_id = auth.uid()
    )
  );

create policy "practice_session_summaries_insert_own"
  on public.practice_session_summaries for insert
  with check (
    exists (
      select 1 from public.practice_sessions ps
      where ps.id = practice_session_summaries.practice_session_id
        and ps.user_id = auth.uid()
    )
  );
