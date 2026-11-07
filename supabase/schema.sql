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

-- Market comparison and AI review (safe to run again).
alter table public.listings
  add column if not exists card_hash      text,
  add column if not exists card_text      text,
  add column if not exists ad_type        text,
  add column if not exists issues         text,
  add column if not exists price_note     text,
  add column if not exists market_median  numeric,
  add column if not exists market_count   integer,
  add column if not exists below_pct      integer,
  add column if not exists flagged        boolean not null default false,
  add column if not exists ai_verdict     text,
  add column if not exists ai_reason      text,
  add column if not exists ai_model       text,
  add column if not exists ai_check_key   text;

-- Permanent record of every machine and price seen. Never cleaned up, unlike listings.
-- A new row is added only when a machine first appears or its price or hours change;
-- otherwise last_seen moves forward on its latest row.
create table if not exists public.listing_history (
  id          bigint generated always as identity primary key,
  listing_id  text not null,
  url         text not null,
  source      text not null,
  make        text,
  model       text,
  model_key   text not null,
  model_label text not null,
  wheeled     boolean not null default false,
  year        integer,
  price_eur   numeric,
  hours       integer,
  location    text,
  ad_type     text,
  price_note  text,
  title       text not null,
  card_text   text,
  first_seen  timestamptz not null,
  last_seen   timestamptz not null
);

create index if not exists listing_history_listing_idx on public.listing_history (listing_id, last_seen desc);
create index if not exists listing_history_model_idx on public.listing_history (model_key, wheeled, last_seen desc);

alter table public.listing_history enable row level security;

-- Scraper settings: a single row, changed from the app.
create table if not exists public.scraper_settings (
  id         integer primary key default 1 check (id = 1),
  settings   jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.scraper_settings enable row level security;
