-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
create table if not exists public.listings (
  id          text primary key,
  url         text not null,
  source      text not null,
  title       text not null,
  description text not null default '',
  make        text,
  model       text,
  model_key   text not null,
  model_label text not null,
  wheeled     boolean not null default false,
  price_eur   numeric,
  year        integer,
  hours       integer,
  location    text,
  lat         double precision,
  lng         double precision,
  image_url   text,
  first_seen  timestamptz not null,
  last_seen   timestamptz not null
);

create index if not exists listings_last_seen_idx on public.listings (last_seen);

-- Only the server (secret key) accesses this table; block the public/publishable key.
alter table public.listings enable row level security;
