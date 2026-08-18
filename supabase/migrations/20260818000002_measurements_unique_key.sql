-- One row per reading. The hourly ingest re-fetches overlapping windows and appended
-- every time, so the same (cell, station, variable, ts, source) reading was stored ~8×
-- in the busiest weeks (up to 42×) — most of the table's size and every inflated
-- "n readings" count. Dedupe keeping the newest row, then enforce the key so
-- writers can upsert with ON CONFLICT DO NOTHING.

update measurements set station_id = '' where station_id is null;
alter table measurements alter column station_id set default '';
alter table measurements alter column station_id set not null;

delete from measurements
where id in (
  select id from (
    select id, row_number() over (
      partition by city_id, h3_cell, station_id, variable, ts, source order by id desc
    ) as rn
    from measurements
  ) t
  where t.rn > 1
);

create unique index if not exists uq_measurements_reading
  on measurements (city_id, h3_cell, station_id, variable, ts, source);
