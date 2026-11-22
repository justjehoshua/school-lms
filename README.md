# School LMS

React + TypeScript + Vite + Tailwind + Supabase.

## Stage 1 status
Scaffold, design primitives, Supabase client, auth (sign in, sign out, password reset),
role-based route guards, and role dashboards with sidebar navigation.

## Run it
```bash
npm install
cp .env.example .env      # add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```
Without `.env` the app still loads and shows a setup banner.

## Security notes
- Only the anon key belongs in the frontend. Never put the service-role key in any `VITE_` variable.
- Route guards are a UX convenience. Access control is enforced by Row Level Security (Stage 2).
- Students sign in with a registration number, mapped to `<regno>@VITE_STUDENT_EMAIL_DOMAIN`.
  Admin provisioning (Stage 3) must create accounts with that same address, from a Supabase Edge
  Function that holds the service-role key server-side.

## Roadmap
2. Database migrations, RLS, storage policies
3. Admin: accounts, classes, subjects, assignments
4. Live teacher and student dashboards
5. Schemes of work
6. Lesson editor and slide editor
7. Slideshow viewer, publishing and scheduling
8. Progress and exercises
9. Tests and deployment

## Stage 2: database (apply in order)
Supabase dashboard > SQL Editor, run each file from `supabase/migrations/` in order:
`001_core_schema.sql`, `002_helper_functions.sql`, `003_rls_policies.sql`, `004_exercise_marking.sql`, `005_storage.sql`.
Then create your first admin with `supabase/seed.sql`. Security checks to run by hand: `supabase/tests.sql`.
(With the Supabase CLI instead: `supabase link`, then `supabase db push`.)

## Stage 3b: accounts (Edge Function)
Creating logins needs the service-role key, so it runs on the server in `supabase/functions/admin-users/index.ts`.
Deploy it from the Supabase dashboard: Edge Functions > Deploy a new function > Via Editor, name it exactly
`admin-users`, paste the file, Deploy. If you later see "Invalid JWT", open the function's settings and turn off
"Verify JWT with legacy secret" (the function checks the caller itself).
