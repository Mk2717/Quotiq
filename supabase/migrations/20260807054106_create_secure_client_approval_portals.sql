create extension if not exists pgcrypto with schema extensions;

create table public.client_portals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  estimate_id text not null check (char_length(estimate_id) between 1 and 120),
  estimate_number text not null check (char_length(estimate_number) between 1 and 120),
  customer_id text,
  customer_name text not null check (char_length(customer_name) between 1 and 180),
  customer_email text,
  project_name text not null check (char_length(project_name) between 1 and 240),
  currency text not null default 'GHS' check (char_length(currency) between 3 and 8),
  total numeric(14,2) not null default 0 check (total >= 0),
  deposit_percent numeric(5,2) not null default 0 check (deposit_percent between 0 and 100),
  share_token_hash text not null unique check (share_token_hash ~ '^[0-9a-f]{64}$'),
  estimate_payload jsonb not null check (jsonb_typeof(estimate_payload) = 'object'),
  business_payload jsonb not null check (jsonb_typeof(business_payload) = 'object'),
  status text not null default 'pending' check (
    status in ('pending','accepted','changes_requested','declined','expired','revoked')
  ),
  response_name text,
  response_email text,
  response_message text,
  signature_text text,
  responded_at timestamptz,
  expires_at timestamptz not null,
  last_viewed_at timestamptz,
  view_count integer not null default 0 check (view_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_portal_events (
  id bigint generated always as identity primary key,
  portal_id uuid not null references public.client_portals(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (
    event_type in ('created','viewed','accepted','changes_requested','declined','revoked','expired')
  ),
  actor_name text,
  actor_email text,
  message text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index client_portals_owner_id_idx on public.client_portals(owner_id);
create index client_portals_owner_estimate_idx on public.client_portals(owner_id, estimate_id, created_at desc);
create unique index client_portals_one_active_link_idx
  on public.client_portals(owner_id, estimate_id)
  where status in ('pending','changes_requested');
create index client_portals_expiry_idx on public.client_portals(expires_at)
  where status in ('pending','changes_requested');
create index client_portal_events_portal_created_idx
  on public.client_portal_events(portal_id, created_at desc);
create index client_portal_events_owner_created_idx
  on public.client_portal_events(owner_id, created_at desc);

alter table public.client_portals enable row level security;
alter table public.client_portal_events enable row level security;

create policy "Owners can view their client portals"
  on public.client_portals for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners can create their client portals"
  on public.client_portals for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "Owners can update their client portals"
  on public.client_portals for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "Owners can delete their client portals"
  on public.client_portals for delete to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners can view their portal audit events"
  on public.client_portal_events for select to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on table public.client_portals from anon;
revoke all on table public.client_portal_events from anon;
revoke all on table public.client_portals from authenticated;
revoke all on table public.client_portal_events from authenticated;
grant select, insert, update, delete on table public.client_portals to authenticated;
grant select on table public.client_portal_events to authenticated;
grant all on table public.client_portals to service_role;
grant all on table public.client_portal_events to service_role;
grant usage, select on sequence public.client_portal_events_id_seq to service_role;
