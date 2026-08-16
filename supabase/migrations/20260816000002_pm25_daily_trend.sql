-- Daily PM2.5 aggregation for the history/trend view. Aggregating in SQL keeps
-- a 365-day request to ~365 rows instead of streaming tens of thousands of raw
-- readings through PostgREST (which capped out and returned only 2 days).
create or replace function pm25_daily_trend(
  p_city text,
  p_days integer default 90,
  p_cell text default null
)
returns table (day date, pm25 double precision, n bigint)
language sql
stable
as $$
  select date_trunc('day', ts)::date as day,
         avg(value)::double precision as pm25,
         count(*) as n
  from measurements
  where city_id = p_city
    and variable = 'pm25'
    and ts >= now() - make_interval(days => p_days)
    and (p_cell is null or h3_cell = p_cell)
  group by 1
  order by 1;
$$;

grant execute on function pm25_daily_trend(text, integer, text) to anon, authenticated, service_role;
