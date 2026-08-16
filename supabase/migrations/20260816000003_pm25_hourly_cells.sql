-- Hourly PM2.5 per cell over a trailing window — feeds the map time-scrub
-- ("play the last 24 hours"). SQL aggregation keeps it to cells×hours rows.
create or replace function pm25_hourly_cells(p_city text, p_hours integer default 24)
returns table (h3_cell text, hour timestamptz, pm25 double precision, n bigint)
language sql stable as $$
  select h3_cell, date_trunc('hour', ts) as hour, avg(value)::double precision, count(*)
  from measurements
  where city_id = p_city and variable = 'pm25'
    and ts >= now() - make_interval(hours => p_hours)
  group by 1, 2 order by 2, 1;
$$;
grant execute on function pm25_hourly_cells(text, integer) to anon, authenticated, service_role;
