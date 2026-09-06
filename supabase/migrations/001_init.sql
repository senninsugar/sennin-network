create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Sennin User',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  icon text not null default '◈',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  path text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, path)
);

create table if not exists public.apps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  name text not null,
  description text not null default '',
  icon text not null default '◈',
  version integer not null default 1,
  author_name text not null default 'Sennin Developer',
  downloads bigint not null default 0,
  status text not null default 'draft' check (status in ('draft','published','private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_files (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  version integer not null,
  path text not null,
  content text not null,
  created_at timestamptz not null default now(),
  unique(app_id, version, path)
);

create index if not exists projects_owner_idx on public.projects(owner_id);
create index if not exists project_files_project_idx on public.project_files(project_id);
create index if not exists apps_status_idx on public.apps(status);
create index if not exists apps_owner_idx on public.apps(owner_id);
create index if not exists app_files_app_version_idx on public.app_files(app_id, version);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Sennin User'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_files enable row level security;
alter table public.apps enable row level security;
alter table public.app_files enable row level security;

revoke all on public.profiles from anon;
revoke all on public.projects from anon;
revoke all on public.project_files from anon;
revoke all on public.apps from anon;
revoke all on public.app_files from anon;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.project_files to authenticated;
grant select on public.apps to anon, authenticated;
grant select on public.app_files to anon, authenticated;

create policy "profile owner read" on public.profiles
for select to authenticated using (id = auth.uid());

create policy "profile owner update" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "profile owner insert" on public.profiles
for insert to authenticated with check (id = auth.uid());

create policy "project owner all" on public.projects
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "project files owner all" on public.project_files
for all to authenticated
using (exists(select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()))
with check (exists(select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

create policy "published apps public read" on public.apps
for select to anon, authenticated using (status = 'published');

create policy "published app files public read" on public.app_files
for select to anon, authenticated
using (exists(select 1 from public.apps a where a.id = app_id and a.status = 'published'));

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on tables from authenticated;

alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists website text not null default '';

alter table public.apps add column if not exists rating numeric(3,2) not null default 0;
alter table public.apps add column if not exists rating_count integer not null default 0;

create table if not exists public.app_reviews (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(app_id, user_id)
);

create table if not exists public.app_install_consents (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_version integer not null default 1,
  accepted_at timestamptz not null default now(),
  unique(app_id, user_id)
);

alter table public.app_reviews enable row level security;
alter table public.app_install_consents enable row level security;

revoke all on public.app_reviews from anon;
revoke all on public.app_install_consents from anon;
grant select, insert, update on public.app_reviews to authenticated;
grant select, insert, update on public.app_install_consents to authenticated;

create policy "published reviews readable" on public.app_reviews
for select to anon, authenticated
using (exists(select 1 from public.apps a where a.id = app_id and a.status = 'published'));

create policy "review owner write" on public.app_reviews
for insert to authenticated
with check (user_id = auth.uid());

create policy "review owner update" on public.app_reviews
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "install consent owner" on public.app_install_consents
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
