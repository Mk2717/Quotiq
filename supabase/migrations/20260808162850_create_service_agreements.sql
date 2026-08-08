-- Owner-protected customer equipment, recurring service agreements and maintenance visits.
create table public.service_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id text not null check (char_length(customer_id) between 1 and 160),
  customer_name text not null check (char_length(customer_name) between 1 and 180),
  name text not null check (char_length(name) between 2 and 200),
  type text not null check (char_length(type) between 2 and 120),
  manufacturer text check (manufacturer is null or char_length(manufacturer) <= 120),
  model text check (model is null or char_length(model) <= 120),
  serial_number text check (serial_number is null or char_length(serial_number) <= 160),
  site_address text check (site_address is null or char_length(site_address) <= 500),
  installed_on date,
  warranty_until date,
  status text not null default 'Active'
    check (status in ('Active', 'Needs service', 'Out of service', 'Retired')),
  notes text check (notes is null or char_length(notes) <= 2500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_agreements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  agreement_number text not null check (char_length(agreement_number) between 3 and 80),
  customer_id text not null check (char_length(customer_id) between 1 and 160),
  customer_name text not null check (char_length(customer_name) between 1 and 180),
  asset_ids jsonb not null default '[]'::jsonb
    check (jsonb_typeof(asset_ids) = 'array' and jsonb_array_length(asset_ids) <= 100),
  plan_name text not null check (char_length(plan_name) between 3 and 200),
  trade text not null check (char_length(trade) between 2 and 120),
  status text not null default 'Active'
    check (status in ('Draft', 'Active', 'Paused', 'Expired', 'Cancelled')),
  start_date date not null,
  end_date date,
  next_visit_date date,
  renewal_date date,
  interval_days integer not null default 90 check (interval_days between 1 and 3650),
  billing_cycle text not null default 'Per visit'
    check (billing_cycle in ('Per visit', 'Monthly', 'Quarterly', 'Yearly')),
  price numeric(16, 2) not null default 0 check (price >= 0),
  auto_invoice boolean not null default false,
  assigned_member_id text check (assigned_member_id is null or char_length(assigned_member_id) <= 160),
  assigned_member_name text check (assigned_member_name is null or char_length(assigned_member_name) <= 180),
  scope jsonb not null default '[]'::jsonb
    check (jsonb_typeof(scope) = 'array' and jsonb_array_length(scope) between 1 and 100),
  completed_visits integer not null default 0 check (completed_visits between 0 and 10000),
  included_visits integer not null default 1 check (included_visits between 1 and 1000),
  notes text check (notes is null or char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, agreement_number)
);

create table public.service_visits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  agreement_id uuid not null references public.service_agreements(id) on delete cascade,
  scheduled_for date not null,
  status text not null default 'Scheduled'
    check (status in ('Scheduled', 'In progress', 'Completed', 'Skipped')),
  completed_at timestamptz,
  technician_name text check (technician_name is null or char_length(technician_name) <= 180),
  checklist jsonb not null default '[]'::jsonb
    check (jsonb_typeof(checklist) = 'array' and jsonb_array_length(checklist) <= 100),
  notes text check (notes is null or char_length(notes) <= 3000),
  invoice_id text check (invoice_id is null or char_length(invoice_id) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index service_assets_owner_customer_idx on public.service_assets (owner_id, customer_id, updated_at desc);
create index service_assets_owner_warranty_idx on public.service_assets (owner_id, warranty_until)
  where warranty_until is not null and status = 'Active';
create index service_agreements_owner_updated_idx on public.service_agreements (owner_id, updated_at desc);
create index service_agreements_owner_next_visit_idx on public.service_agreements (owner_id, next_visit_date)
  where status = 'Active' and next_visit_date is not null;
create index service_agreements_owner_renewal_idx on public.service_agreements (owner_id, renewal_date)
  where status = 'Active' and renewal_date is not null;
create index service_visits_owner_schedule_idx on public.service_visits (owner_id, scheduled_for, status);
create index service_visits_agreement_idx on public.service_visits (agreement_id, scheduled_for desc);

alter table public.service_assets enable row level security;
alter table public.service_agreements enable row level security;
alter table public.service_visits enable row level security;

create policy "Owners can read their service assets" on public.service_assets for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners can create their service assets" on public.service_assets for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "Owners can update their service assets" on public.service_assets for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners can delete their service assets" on public.service_assets for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can read their service agreements" on public.service_agreements for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners can create their service agreements" on public.service_agreements for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "Owners can update their service agreements" on public.service_agreements for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners can delete their service agreements" on public.service_agreements for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can read their service visits" on public.service_visits for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners can create their service visits" on public.service_visits for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "Owners can update their service visits" on public.service_visits for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners can delete their service visits" on public.service_visits for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on table public.service_assets, public.service_agreements, public.service_visits from anon, public;
grant select, insert, update, delete on table public.service_assets, public.service_agreements, public.service_visits to authenticated;
grant all on table public.service_assets, public.service_agreements, public.service_visits to service_role;

comment on table public.service_agreements is 'Owner-protected recurring maintenance contracts with visit and billing rules.';
comment on table public.service_visits is 'Scheduled and completed service visits linked to a recurring agreement.';
