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

-- Every scrape, automatic or manual. The next automatic scrape is due one interval after the
-- latest started_at, so the schedule survives restarts, crashes and redeploys.
create table if not exists public.scrape_runs (
  id          bigint generated always as identity primary key,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  trigger     text not null,                    -- auto | manual
  status      text not null default 'running',  -- running | done | failed
  listings    integer,
  message     text
);

create index if not exists scrape_runs_started_idx on public.scrape_runs (started_at desc);

alter table public.scrape_runs enable row level security;

-- Knowledge base: what the buyer told us about kinds of machines. A note reaches the AI only for ads it
-- matches, so the main prompt does not grow. Add notes with `npm run knowledge` or the Table Editor.
create table if not exists public.machine_knowledge (
  id             bigint generated always as identity primary key,
  model_key      text not null,    -- wanted model from lib/config.ts, e.g. yanmar-55
  wheeled        boolean,          -- true: wheeled only, false: not wheeled, empty: both
  model_contains text,             -- narrows the model: b55w matches "B 55W-2" and "B55 W-1"
  max_price_eur  numeric,          -- the note does not apply above this price
  note           text not null,    -- what the AI and the app show, in plain words
  created_at     timestamptz not null default now()
);

alter table public.machine_knowledge enable row level security;

-- Comments as well as interesting marks, on one ad or on similar machines (safe to run again).
alter table public.machine_knowledge
  add column if not exists interesting boolean not null default false,  -- shows as a deal and gets an AI review
  add column if not exists listing_id  text;                            -- set: only this ad. Not linked to listings, so a comment outlives an expired ad
