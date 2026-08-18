-- Citizen complaint loop (Sameer-2.0 pattern): a photographed pollution report
-- enters the enforcement funnel as a candidate source, with SLA tracking from
-- receipt to resolution.
create table if not exists citizen_reports (
  id            bigint generated always as identity primary key,
  city_id       text not null references cities(city_id),
  h3_cell       text,
  lat           double precision not null,
  lng           double precision not null,
  category      text not null check (category in
                  ('waste_burning','construction_dust','industrial_smoke','vehicle_smoke','other')),
  description   text,
  photo_url     text,
  status        text not null default 'received' check (status in
                  ('received','verified','actioned','resolved','rejected')),
  sla_hours     integer not null default 72,
  source_id     bigint references emission_sources(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create index if not exists idx_citizen_reports_city_status
  on citizen_reports (city_id, status, created_at desc);

alter table citizen_reports enable row level security;

-- Public may read reports (transparency is the point of SLA tracking);
-- all writes go through the service role, server-side.
drop policy if exists citizen_reports_public_read on citizen_reports;
create policy citizen_reports_public_read
  on citizen_reports for select using (true);
