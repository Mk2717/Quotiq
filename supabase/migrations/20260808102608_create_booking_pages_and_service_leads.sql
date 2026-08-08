create table public.booking_pages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^q-[a-z0-9]{16,40}$'),
  business_name text not null check (char_length(business_name) between 2 and 160),
  business_phone text check (business_phone is null or char_length(business_phone) <= 80),
  business_email text check (business_email is null or char_length(business_email) <= 180),
  service_area text check (service_area is null or char_length(service_area) <= 240),
  welcome_message text not null default 'Tell us about the work you need and we will contact you with the next steps.'
    check (char_length(welcome_message) between 10 and 500),
  services text[] not null default array[
    'Electrical',
    'Security / CCTV',
    'Solar',
    'Starlink / Networking',
    'Plumbing',
    'HVAC',
    'Construction / Building',
    'Painting',
    'Roofing',
    'Cleaning / Maintenance',
    'Other'
  ]::text[] check (cardinality(services) between 1 and 30),
  accent_color text not null default '#2563eb' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_pages_id_owner_unique unique (id, owner_id)
);

create table public.service_leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  booking_page_id uuid not null,
  source text not null default 'booking_page'
    check (source in ('booking_page', 'manual', 'referral', 'phone', 'website')),
  customer_name text not null check (char_length(customer_name) between 2 and 160),
  phone text check (phone is null or char_length(phone) <= 80),
  email text check (email is null or char_length(email) <= 180),
  service_type text not null check (char_length(service_type) between 2 and 120),
  site_address text not null check (char_length(site_address) between 3 and 320),
  preferred_date date,
  preferred_time text check (preferred_time is null or char_length(preferred_time) <= 80),
  budget_range text check (budget_range is null or char_length(budget_range) <= 100),
  urgency text not null default 'normal' check (urgency in ('normal', 'soon', 'urgent')),
  details text check (details is null or char_length(details) <= 4000),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'site_visit', 'quoted', 'won', 'lost')),
  follow_up_at timestamptz,
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 4000),
  request_fingerprint text check (request_fingerprint is null or request_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_leads_contact_required check (
    nullif(btrim(coalesce(phone, '')), '') is not null
    or nullif(btrim(coalesce(email, '')), '') is not null
  ),
  constraint service_leads_booking_owner_fkey
    foreign key (booking_page_id, owner_id)
    references public.booking_pages(id, owner_id)
    on delete cascade
);

create index service_leads_owner_status_created_idx
  on public.service_leads (owner_id, status, created_at desc);
create index service_leads_booking_owner_idx
  on public.service_leads (booking_page_id, owner_id);
create index service_leads_owner_follow_up_idx
  on public.service_leads (owner_id, follow_up_at)
  where follow_up_at is not null and status not in ('won', 'lost');
create index service_leads_rate_limit_idx
  on public.service_leads (booking_page_id, request_fingerprint, created_at desc)
  where request_fingerprint is not null;

alter table public.booking_pages enable row level security;
alter table public.service_leads enable row level security;

create policy "Owners can read their booking page"
  on public.booking_pages for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can create their booking page"
  on public.booking_pages for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Owners can update their booking page"
  on public.booking_pages for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Owners can delete their booking page"
  on public.booking_pages for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can read their service leads"
  on public.service_leads for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can create their service leads"
  on public.service_leads for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Owners can update their service leads"
  on public.service_leads for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Owners can delete their service leads"
  on public.service_leads for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on table public.booking_pages from anon, public;
revoke all on table public.service_leads from anon, public;
grant select, insert, update, delete on table public.booking_pages to authenticated;
grant select, insert, update, delete on table public.service_leads to authenticated;
grant all on table public.booking_pages to service_role;
grant all on table public.service_leads to service_role;
