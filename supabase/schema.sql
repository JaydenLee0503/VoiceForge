create extension if not exists pgcrypto;

create table if not exists public.sessions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_type text not null check (session_type in ('scenario', 'custom_practice', 'debate')),
  scenario_id text not null,
  scenario_title text not null,
  scenario_focus text not null,
  scenario_description text not null,
  duration_seconds integer not null default 0,
  raw_transcript text,
  display_transcript text,
  transcript_turns jsonb not null default '[]'::jsonb,
  custom_practice_settings jsonb,
  generated_questions jsonb,
  presence_summary jsonb,
  verbal_metrics jsonb,
  final_feedback jsonb,
  session_payload jsonb not null,
  video_assets jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists sessions_user_id_completed_at_idx
on public.sessions (user_id, completed_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_sessions_updated_at on public.sessions;

create trigger set_sessions_updated_at
before update on public.sessions
for each row
execute function public.set_updated_at();

alter table public.sessions enable row level security;

drop policy if exists "Users can read their own sessions" on public.sessions;
create policy "Users can read their own sessions"
on public.sessions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own sessions" on public.sessions;
create policy "Users can insert their own sessions"
on public.sessions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own sessions" on public.sessions;
create policy "Users can update their own sessions"
on public.sessions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own sessions" on public.sessions;
create policy "Users can delete their own sessions"
on public.sessions
for delete
to authenticated
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('session-recordings', 'session-recordings', false)
on conflict (id) do nothing;

drop policy if exists "Users can read their own session recordings" on storage.objects;
create policy "Users can read their own session recordings"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'session-recordings'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can upload their own session recordings" on storage.objects;
create policy "Users can upload their own session recordings"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'session-recordings'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update their own session recordings" on storage.objects;
create policy "Users can update their own session recordings"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'session-recordings'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'session-recordings'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete their own session recordings" on storage.objects;
create policy "Users can delete their own session recordings"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'session-recordings'
  and (storage.foldername(name))[1] = auth.uid()::text
);
