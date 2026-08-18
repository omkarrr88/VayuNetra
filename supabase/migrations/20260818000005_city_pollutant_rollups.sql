-- Per-city hourly and daily rollups over ALL index pollutants — what the public city page's
-- pollutant chips, hourly AQI graph and AQI calendar read. Aggregating in SQL keeps a year of
-- calendar to ~365 rows per pollutant instead of streaming every reading through PostgREST.

-- hourly city means for the trailing window, one row per (hour, pollutant)
create or replace function city_pollutants_hourly(p_city text, p_hours integer default 24)
returns table (hour timestamptz, pollutant text, value double precision, unit text, n bigint)
language sql stable as $$
  select date_trunc('hour', ts) as hour,
         variable as pollutant,
         avg(value)::double precision as value,
         min(unit) as unit,
         count(*) as n
  from measurements
  where city_id = p_city
    and variable in ('pm25','pm10','no2','so2','co','o3','nh3')
    and ts >= now() - make_interval(hours => p_hours)
  group by 1, 2
  order by 1, 2;
$$;
grant execute on function city_pollutants_hourly(text, integer) to anon, authenticated, service_role;

-- daily city means per pollutant over a day window; PM2.5 falls back to the archived rollup so the
-- calendar keeps its history after retention prunes raw rows
create or replace function city_pollutants_daily(p_city text, p_days integer default 365)
returns table (day date, pollutant text, value double precision, n bigint)
language sql stable as $$
  with raw as (
    select date_trunc('day', ts)::date as day, variable as pollutant,
           avg(value)::double precision as value, count(*)::bigint as n
    from measurements
    where city_id = p_city
      and variable in ('pm25','pm10','no2','so2','co','o3','nh3')
      and ts >= (now() - make_interval(days => p_days))
    group by 1, 2
  ),
  rolled as (
    select r.day, 'pm25'::text as pollutant,
           (sum(r.pm25 * r.n) / nullif(sum(r.n), 0))::double precision as value,
           sum(r.n)::bigint as n
    from pm25_daily_rollup r
    where r.city_id = p_city
      and r.day >= (now() - make_interval(days => p_days))::date
      and r.day not in (select day from raw where pollutant = 'pm25')
    group by 1
  )
  select * from raw
  union all
  select * from rolled
  order by 1, 2;
$$;
grant execute on function city_pollutants_daily(text, integer) to anon, authenticated, service_role;
