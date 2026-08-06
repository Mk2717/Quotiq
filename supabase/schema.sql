create table if not exists public.workspace_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business jsonb not null default '{}'::jsonb,
  customers jsonb not null default '[]'::jsonb,
  estimates jsonb not null default '[]'::jsonb,
  invoices jsonb not null default '[]'::jsonb,
  projects jsonb not null default '[]'::jsonb,
  inventory jsonb not null default '[]'::jsonb,
  expenses jsonb not null default '[]'::jsonb,
  team jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.workspace_snapshots enable row level security;
drop policy if exists "Users read own workspace" on public.workspace_snapshots;
drop policy if exists "Users insert own workspace" on public.workspace_snapshots;
drop policy if exists "Users update own workspace" on public.workspace_snapshots;
create policy "Users read own workspace" on public.workspace_snapshots for select using (auth.uid()=user_id);
create policy "Users insert own workspace" on public.workspace_snapshots for insert with check (auth.uid()=user_id);
create policy "Users update own workspace" on public.workspace_snapshots for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
