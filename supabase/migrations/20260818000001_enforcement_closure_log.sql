-- Officer closure + immutable audit trail for enforcement actions.
-- 'closed' completes the loop (proposed → approved → dispatched → closed) with the field
-- finding recorded; every status change is appended to enforcement_status_log with the
-- acting officer's name and time, so "who did what, when" is answerable for any action.

alter table enforcement_recs drop constraint if exists chk_enforcement_status;
alter table enforcement_recs add constraint chk_enforcement_status check (
  status in ('proposed','approved','dispatched','dismissed','closed')
);
alter table enforcement_recs add column if not exists closed_at timestamptz;
alter table enforcement_recs add column if not exists closure_finding text
  check (closure_finding in ('violation_found','compliant','inaccessible','not_applicable'));
alter table enforcement_recs add column if not exists closure_note text;

create table if not exists enforcement_status_log (
  id            bigserial primary key,
  rec_id        bigint not null references enforcement_recs(id) on delete cascade,
  city_id       text not null,
  from_status   text,
  to_status     text not null,
  actor         text,                     -- officer name as entered in the console (no auth in the demo)
  note          text,
  finding       text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_status_log_rec on enforcement_status_log (rec_id, created_at desc);
create index if not exists idx_status_log_city on enforcement_status_log (city_id, created_at desc);

alter table enforcement_status_log enable row level security;
do $$ begin
  create policy "public read" on enforcement_status_log for select using (true);
exception when duplicate_object then null; end $$;
-- writes: service role only (the API), never the anon key
