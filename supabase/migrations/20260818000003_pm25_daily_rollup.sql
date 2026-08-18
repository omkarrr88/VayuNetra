-- Daily PM2.5 per cell, kept forever, so raw readings can be archived out of the free-tier
-- database after the retention window without the trend / "past air" views losing history.
-- Filled by scripts/archive_measurements.py before it prunes; pm25_daily_trend reads the
-- union of live raw rows and the rollup (a day is taken from raw when raw has it).

create table if not exists pm25_daily_rollup (
  city_id  text not null,
  h3_cell  text not null,
  day      date not null,
  pm25     double precision not null,
  n        integer not null,
  primary key (city_id, h3_cell, day)
);
alter table pm25_daily_rollup enable row level security;
do $$ begin
  create policy "public read" on pm25_daily_rollup for select using (true);
exception when duplicate_object then null; end $$;

create or replace function pm25_daily_trend(
  p_city text,
  p_days integer default 90,
  p_cell text default null
)
returns table (day date, pm25 double precision, n bigint)
language sql
stable
as $$
  with raw as (
    select date_trunc('day', ts)::date as day,
           avg(value)::double precision as pm25,
           count(*)::bigint as n
    from measurements
    where city_id = p_city
      and variable = 'pm25'
      and ts >= now() - make_interval(days => p_days)
      and (p_cell is null or h3_cell = p_cell)
    group by 1
  ),
  rolled as (
    select r.day,
           (sum(r.pm25 * r.n) / nullif(sum(r.n), 0))::double precision as pm25,
           sum(r.n)::bigint as n
    from pm25_daily_rollup r
    where r.city_id = p_city
      and r.day >= (now() - make_interval(days => p_days))::date
      and (p_cell is null or r.h3_cell = p_cell)
      and r.day not in (select day from raw)
    group by 1
  )
  select * from raw
  union all
  select * from rolled
  order by 1;
$$;

grant execute on function pm25_daily_trend(text, integer, text) to anon, authenticated, service_role;
