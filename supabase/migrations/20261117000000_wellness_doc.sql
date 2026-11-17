-- One private row that holds all Wellness data, with a revision number
-- so the app and Claude never overwrite each other's changes.
create table if not exists public.wellness_doc (
  id integer primary key default 1 check (id = 1),
  doc jsonb not null,
  rev bigint not null default 1,
  updated_at timestamptz not null default now()
);

-- Only the Wellness function (service role) can touch it.
alter table public.wellness_doc enable row level security;
revoke all on public.wellness_doc from anon, authenticated;
