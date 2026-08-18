# connectors/ — city-agnostic data ingestion

City-agnostic connectors that map each raw source → the **canonical measurement**
(`core/schemas/canonical.py`) → `measurements`. A city is just a config (`core/config/cities/*.yml`).
Spec: ARCHITECTURE.md §7.1, PRD §11.

| Connector | Notes |
|---|---|
| `caaqms`, `openaq` | ground AQI, hourly + backfill |
| `earth_engine` (s5p, modis/viirs, s2) | satellite features (daily precompute) |
| `open_meteo` | weather + AQ forecast (no key) |
| `seasonal_calendars` | stubble / Diwali / winter-inversion windows (forecast feature) |
| `osm`, `worldpop`, `registry` | roads/land-use/industrial/hospitals + population → `emission_sources` |
| `mobility` (GTFS + traffic proxy) | time-of-day proxy from OSM roads → mobility feature |

Each connector is independent and writes via the schema — no cross-connector calls.
