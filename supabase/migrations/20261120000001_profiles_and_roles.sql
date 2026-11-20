-- public.profiles.is_active determines student access to paid test content.
-- It is written only by trusted server code (e.g. payment webhooks, service role, or admin).
-- Clients (authenticated/anon) are never granted update permissions on is_active.

-- a) Table: public.profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  university text not null default 'Wellspring University',
  level int check (level in (200, 300, 400)),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- b) Table: public.user_roles
create table public.user_roles (
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'editor')),
  primary key (user_id, role)
);

-- c) Trigger: create profile on auth.users insert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- d) Function: public.is_admin()
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

-- e) Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

-- f) Policies: SELECT only own row for authenticated users
create policy "Users can select own profile"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Users can select own user_roles"
  on public.user_roles
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- g) Column-level protection and UPDATE policy on public.profiles
revoke update on public.profiles from authenticated, anon;
grant update (full_name, university, level) on public.profiles to authenticated;

create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- h) Revoke all permissions from anon
revoke all on public.profiles from anon;
revoke all on public.user_roles from anon;
