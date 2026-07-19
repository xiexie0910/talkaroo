# Supabase

Apply [`migrations/20260719000000_init.sql`](migrations/20260719000000_init.sql) in the Supabase SQL Editor (or via the Supabase CLI) before running the app.

Tables:

- `profiles` — one row per auth user (auto-created on signup)
- `practice_sessions` — each Live practice run
- `turns` — partner/user transcripts
- `coach_results` — Learning HUD JSON per turn

All tables use RLS so users only see their own rows.
