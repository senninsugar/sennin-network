create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username varchar(30) not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.apps (
  id uuid primary key default gen_random_uuid(),

  owner_id uuid not null
    references public.users(id)
    on delete cascade,

  name varchar(60) not null,

  description varchar(500) not null default '',

  icon varchar(20) not null default '🧩',

  version varchar(30) not null default '1.0.0',

  category varchar(40) not null default 'Other',

  size integer not null default 0,

  installs integer not null default 0,

  published boolean not null default false,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);

create table if not exists public.app_files (
  id uuid primary key default gen_random_uuid(),

  app_id uuid not null
    references public.apps(id)
    on delete cascade,

  file_name varchar(255) not null,

  content text not null default '',

  created_at timestamptz not null default now(),

  unique(app_id, file_name)
);

create table if not exists public.installations (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.users(id)
    on delete cascade,

  app_id uuid not null
    references public.apps(id)
    on delete cascade,

  installed_at timestamptz not null default now(),

  unique(user_id, app_id)
);

create index if not exists apps_owner_id_idx
on public.apps(owner_id);

create index if not exists apps_published_idx
on public.apps(published);

create index if not exists apps_category_idx
on public.apps(category);

create index if not exists installations_user_id_idx
on public.installations(user_id);

create index if not exists installations_app_id_idx
on public.installations(app_id);

create index if not exists app_files_app_id_idx
on public.app_files(app_id);

alter table public.users enable row level security;
alter table public.apps enable row level security;
alter table public.app_files enable row level security;
alter table public.installations enable row level security;
