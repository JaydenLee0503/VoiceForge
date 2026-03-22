# Supabase Setup

1. Create a new Supabase project.
2. In `Project Settings > API`, copy:
   - `Project URL`
   - `anon public` key
3. In `Authentication > Providers > Anonymous`, enable anonymous sign-ins.
4. In `SQL Editor`, run [`supabase/schema.sql`](/D:/Projects/VoiceForge/supabase/schema.sql).
5. In local `.env`, add:
   - `VITE_SUPABASE_URL=...`
   - `VITE_SUPABASE_ANON_KEY=...`
6. Restart the app with `npm run dev`.
7. Finish a session and verify:
   - a row appears in `Table Editor > sessions`
   - a file appears in `Storage > session-recordings`
