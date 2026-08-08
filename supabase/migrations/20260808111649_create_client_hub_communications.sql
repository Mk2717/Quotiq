create table public.client_communications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id text not null check (char_length(customer_id) between 1 and 120),
  customer_name text not null check (char_length(customer_name) between 1 and 180),
  channel text not null check (channel in ('whatsapp', 'email', 'phone', 'sms', 'meeting', 'note')),
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound', 'internal')),
  subject text check (subject is null or char_length(subject) <= 240),
  body text not null check (char_length(body) between 1 and 5000),
  status text not null default 'logged' check (status in ('opened', 'sent', 'replied', 'no_answer', 'logged')),
  occurred_at timestamptz not null default now(),
  follow_up_at timestamptz,
  follow_up_completed_at timestamptz,
  related_type text not null default 'general'
    check (related_type in ('general', 'estimate', 'invoice', 'project', 'lead')),
  related_id text check (related_id is null or char_length(related_id) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_message_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'email', 'sms')),
  subject text check (subject is null or char_length(subject) <= 240),
  body text not null check (char_length(body) between 5 and 3000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_communications_owner_customer_time_idx
  on public.client_communications (owner_id, customer_id, occurred_at desc);
create index client_communications_owner_time_idx
  on public.client_communications (owner_id, occurred_at desc);
create index client_communications_follow_up_idx
  on public.client_communications (owner_id, follow_up_at)
  where follow_up_at is not null and follow_up_completed_at is null;
create index client_message_templates_owner_active_idx
  on public.client_message_templates (owner_id, active, updated_at desc);
create unique index client_message_templates_owner_name_idx
  on public.client_message_templates (owner_id, lower(name));

alter table public.client_communications enable row level security;
alter table public.client_message_templates enable row level security;

create policy "Owners can read their client communications"
  on public.client_communications for select
  to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners can create their client communications"
  on public.client_communications for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "Owners can update their client communications"
  on public.client_communications for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "Owners can delete their client communications"
  on public.client_communications for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can read their message templates"
  on public.client_message_templates for select
  to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners can create their message templates"
  on public.client_message_templates for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "Owners can update their message templates"
  on public.client_message_templates for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "Owners can delete their message templates"
  on public.client_message_templates for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on table public.client_communications from anon, public;
revoke all on table public.client_message_templates from anon, public;
grant select, insert, update, delete on table public.client_communications to authenticated;
grant select, insert, update, delete on table public.client_message_templates to authenticated;
grant all on table public.client_communications to service_role;
grant all on table public.client_message_templates to service_role;
