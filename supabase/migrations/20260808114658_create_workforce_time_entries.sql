create table public.workforce_time_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  member_id text not null check (char_length(member_id) between 1 and 120),
  member_name text not null check (char_length(member_name) between 2 and 180),
  project_id text check (project_id is null or char_length(project_id) between 1 and 160),
  project_name text check (project_name is null or char_length(project_name) between 1 and 240),
  clock_in timestamptz not null,
  clock_out timestamptz,
  break_started_at timestamptz,
  break_minutes integer not null default 0 check (break_minutes between 0 and 10080),
  hourly_rate numeric(12,2) not null default 0 check (hourly_rate between 0 and 100000000),
  status text not null default 'active' check (status in ('active', 'break', 'completed')),
  note text check (note is null or char_length(note) <= 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workforce_time_entries_clock_order check (clock_out is null or clock_out >= clock_in),
  constraint workforce_time_entries_state check (
    (status = 'active' and clock_out is null and break_started_at is null)
    or (status = 'break' and clock_out is null and break_started_at is not null)
    or (status = 'completed' and clock_out is not null and break_started_at is null)
  )
);

create index workforce_time_entries_owner_clock_idx
  on public.workforce_time_entries (owner_id, clock_in desc);
create index workforce_time_entries_owner_member_clock_idx
  on public.workforce_time_entries (owner_id, member_id, clock_in desc);
create index workforce_time_entries_owner_project_idx
  on public.workforce_time_entries (owner_id, project_id, clock_in desc)
  where project_id is not null;
create unique index workforce_time_entries_one_open_shift_idx
  on public.workforce_time_entries (owner_id, member_id)
  where status in ('active', 'break');

alter table public.workforce_time_entries enable row level security;

create policy "Owners can read their workforce time entries"
  on public.workforce_time_entries for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can create their workforce time entries"
  on public.workforce_time_entries for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Owners can update their workforce time entries"
  on public.workforce_time_entries for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Owners can delete their workforce time entries"
  on public.workforce_time_entries for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on table public.workforce_time_entries from anon, public;
grant select, insert, update, delete on table public.workforce_time_entries to authenticated;
grant all on table public.workforce_time_entries to service_role;
