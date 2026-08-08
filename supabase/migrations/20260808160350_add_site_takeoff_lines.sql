alter table public.site_measurements
  add column if not exists takeoff_lines jsonb not null default '[]'::jsonb,
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision,
  add column if not exists location_accuracy_m numeric(12,2),
  add column if not exists location_captured_at timestamptz;

alter table public.site_measurements
  add constraint site_measurements_takeoff_lines_array
    check (jsonb_typeof(takeoff_lines) = 'array' and jsonb_array_length(takeoff_lines) <= 100),
  add constraint site_measurements_location_latitude_check
    check (location_lat is null or location_lat between -90 and 90),
  add constraint site_measurements_location_longitude_check
    check (location_lng is null or location_lng between -180 and 180),
  add constraint site_measurements_location_accuracy_check
    check (location_accuracy_m is null or location_accuracy_m between 0 and 100000);

comment on column public.site_measurements.takeoff_lines is
  'Owner-protected itemized field takeoff lines generated from map and precision calculators.';

comment on column public.site_measurements.location_accuracy_m is
  'Browser-reported horizontal GPS accuracy radius in metres at capture time.';
