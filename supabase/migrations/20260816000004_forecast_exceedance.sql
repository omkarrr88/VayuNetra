-- Calibrated exceedance probabilities on every served forecast.
-- Split-conformal predictive distribution: residuals from a chronological calibration
-- tail of the training window, applied to the median forecast → P(PM2.5 > band).
-- Bands follow CPCB PM2.5 categories: Very Poor > 120, Severe > 250 µg/m³.
alter table forecasts add column if not exists p_over_120 double precision;
alter table forecasts add column if not exists p_over_250 double precision;
alter table forecasts add column if not exists calibration_n integer;
comment on column forecasts.p_over_120 is 'P(PM2.5 > 120 µg/m³) at horizon — split-conformal, calibrated on held-out residuals';
comment on column forecasts.p_over_250 is 'P(PM2.5 > 250 µg/m³) at horizon — split-conformal, calibrated on held-out residuals';
comment on column forecasts.calibration_n is 'number of held-out residuals the exceedance probabilities were calibrated on';
