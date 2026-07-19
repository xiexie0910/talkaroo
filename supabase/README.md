# Supabase

Apply migrations in [`migrations/`](migrations/) in the Supabase SQL Editor (or via the Supabase CLI) before running the app:

1. [`20260719000000_init.sql`](migrations/20260719000000_init.sql) — profiles, practice sessions, turns, coach results
2. [`20260719010000_practice_session_summaries.sql`](migrations/20260719010000_practice_session_summaries.sql) — post-session recap storage

These tables support **live practice + coach + end-of-session recap** (not a history UI).

All tables use RLS so users only see their own rows.
