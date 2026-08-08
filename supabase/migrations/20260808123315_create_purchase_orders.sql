-- Owner-protected supplier orders with partial stock receiving.
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  order_number text not null check (char_length(order_number) between 3 and 80),
  supplier_id text check (supplier_id is null or char_length(supplier_id) <= 120),
  supplier_name text not null check (char_length(supplier_name) between 2 and 180),
  supplier_phone text check (supplier_phone is null or char_length(supplier_phone) <= 80),
  supplier_email text check (supplier_email is null or char_length(supplier_email) <= 180),
  project_id text check (project_id is null or char_length(project_id) <= 160),
  project_name text check (project_name is null or char_length(project_name) <= 240),
  issue_date date not null default current_date,
  expected_date date,
  currency text not null default 'GHS' check (char_length(currency) between 3 and 8),
  status text not null default 'Draft'
    check (status in ('Draft', 'Ordered', 'Partially Received', 'Received', 'Cancelled')),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  subtotal numeric(16, 2) not null default 0 check (subtotal >= 0),
  tax_percent numeric(8, 3) not null default 0 check (tax_percent between 0 and 100),
  shipping numeric(16, 2) not null default 0 check (shipping >= 0),
  total numeric(16, 2) not null default 0 check (total >= 0),
  posted_cost numeric(16, 2) not null default 0 check (posted_cost >= 0),
  delivery_location text check (delivery_location is null or char_length(delivery_location) <= 500),
  notes text check (notes is null or char_length(notes) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, order_number)
);

create index purchase_orders_owner_updated_idx
  on public.purchase_orders (owner_id, updated_at desc);
create index purchase_orders_owner_status_expected_idx
  on public.purchase_orders (owner_id, status, expected_date)
  where status in ('Draft', 'Ordered', 'Partially Received');
create index purchase_orders_owner_supplier_idx
  on public.purchase_orders (owner_id, supplier_id, updated_at desc)
  where supplier_id is not null;
create index purchase_orders_owner_project_idx
  on public.purchase_orders (owner_id, project_id, updated_at desc)
  where project_id is not null;

alter table public.purchase_orders enable row level security;

create policy "Owners can read their purchase orders"
  on public.purchase_orders for select
  to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners can create their purchase orders"
  on public.purchase_orders for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "Owners can update their purchase orders"
  on public.purchase_orders for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "Owners can delete their purchase orders"
  on public.purchase_orders for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on table public.purchase_orders from anon, public;
grant select, insert, update, delete on table public.purchase_orders to authenticated;
grant all on table public.purchase_orders to service_role;
