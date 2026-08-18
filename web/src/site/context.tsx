// City + navigation state for the public site. The console keeps its own state exactly as it was;
// this only serves the public pages, so nothing here can change officer behaviour.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api";
import { navigate } from "../router";

export type City = { city_id: string; name: string; state?: string; center?: [number, number]; bbox?: unknown; languages?: string[] };

/** Delhi opens the app: deterministic on stage, no permission prompt, longest record. */
export const DEFAULT_CITY = "delhi";

/** The city in the URL: '/city/<id>' (shareable home), else '?city=', else Delhi. */
export function cityFromUrl(): string {
  const p = window.location.pathname;
  if (p.startsWith("/city/")) return decodeURIComponent(p.split("/")[2] || DEFAULT_CITY);
  return new URLSearchParams(window.location.search).get("city") || DEFAULT_CITY;
}

type Ctx = { city: string; name: string; cities: City[]; setCity: (id: string) => void; path: string };
const SiteCtx = createContext<Ctx>({ city: DEFAULT_CITY, name: "Delhi", cities: [], setCity: () => {}, path: "/" });
export const useSite = () => useContext(SiteCtx);

export function SiteProvider({ path, children }: { path: string; children: ReactNode }) {
  const [cities, setCities] = useState<City[]>([]);
  const [city, setCityState] = useState<string>(cityFromUrl);

  useEffect(() => { api<City[]>("/cities").then(setCities).catch(() => setCities([])); }, []);
  useEffect(() => { setCityState(cityFromUrl()); }, [path]);

  /** Switching city keeps you on the page you are on: home gets the pretty '/city/<id>' URL,
   *  every other page carries '?city=' so links stay shareable. */
  const setCity = (id: string) => {
    setCityState(id);
    const p = window.location.pathname;
    if (p.startsWith("/city")) navigate(`/city/${id}`);
    else navigate(`${p}?city=${id}`);
  };

  const name = cities.find((c) => c.city_id === city)?.name ?? city.charAt(0).toUpperCase() + city.slice(1);
  return <SiteCtx.Provider value={{ city, name, cities, setCity, path }}>{children}</SiteCtx.Provider>;
}
