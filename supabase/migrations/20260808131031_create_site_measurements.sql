create table if not exists public.site_measurements (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  project_id text,
  project_name text,
  customer_id text,
  customer_name text,
  mode text not null,
  trade_tool text not null,
  points jsonb not null default '[]'::jsonb,
  center_lat double precision not null,
  center_lng double precision not null,
  zoom smallint not null default 17,
  distance_m numeric(16,3) not null default 0,
  perimeter_m numeric(16,3) not null default 0,
  area_m2 numeric(18,3) not null default 0,
  waste_percent numeric(7,3) not null default 0,
  depth_m numeric(9,4) not null default 0,
  quantity numeric(18,3) not null default 0,
  unit text not null,
  description text not null,
  unit_rate numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_measurements_id_length check (char_length(id) between 3 and 120),
  constraint site_measurements_name_length check (char_length(name) between 2 and 200),
  constraint site_measurements_mode_check check (mode in ('distance','area')),
  constraint site_measurements_points_array check (jsonb_typeof(points) = 'array' and jsonb_array_length(points) between 2 and 500),
  constraint site_measurements_latitude_check check (center_lat between -90 and 90),
  constraint site_measurements_longitude_check check (center_lng between -180 and 180),
  constraint site_measurements_zoom_check check (zoom between 2 and 20),
  constraint site_measurements_nonnegative_check check (distance_m >= 0 and perimeter_m >= 0 and area_m2 >= 0 and waste_percent between 0 and 100 and depth_m between 0 and 100 and quantity >= 0 and unit_rate >= 0)
);

create index if not exists site_measurements_owner_updated_idx on public.site_measurements (owner_id, updated_at desc);
create index if not exists site_measurements_owner_project_idx on public.site_measurements (owner_id, project_id) where project_id is not null;

alter table public.site_measurements enable row level security;

revoke all on table public.site_measurements from anon;
revoke all on table public.site_measurements from authenticated;
grant select, insert, update, delete on table public.site_measurements to authenticated;

create policy "Owners can view site measurements"
  on public.site_measurements for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can create site measurements"
  on public.site_measurements for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Owners can update site measurements"
  on public.site_measurements for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Owners can delete site measurements"
  on public.site_measurements for delete to authenticated
  using ((select auth.uid()) = owner_id);
