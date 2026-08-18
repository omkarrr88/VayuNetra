// The public app's navigation — the shared TopNav, filled with the public pages and a door to the
// operations console.
import { navigate } from "../router";
import { TopNav, type NavItem } from "../shell/TopNav";
import { useSite } from "./context";

export const SITE_PAGES: { path: string; label: string; hint: string }[] = [
  { path: "/city", label: "Overview", hint: "This city's air right now" },
  { path: "/map", label: "Live map", hint: "Every 1 km cell, coloured by PM2.5" },
  { path: "/forecast", label: "Forecast", hint: "Next 72 hours and what is causing it" },
  { path: "/rankings", label: "Rankings", hint: "All ten cities, live" },
  { path: "/about", label: "How it works", hint: "Scales, methods and sources" },
];

export function isActivePage(pagePath: string, current: string): boolean {
  return current.startsWith(pagePath);
}

/** Keeps the chosen city when moving between app pages. */
export function hrefFor(pagePath: string, city: string): string {
  return pagePath === "/city" ? `/city/${city}` : `${pagePath}?city=${city}`;
}

const ITEMS: NavItem[] = SITE_PAGES.map((p) => ({ id: p.path, label: p.label, hint: p.hint }));

export function SiteNav() {
  const { city, cities, setCity, path } = useSite();
  const active = SITE_PAGES.find((p) => isActivePage(p.path, path))?.path ?? "/city";
  return (
    <TopNav
      subtitle="AIR INTELLIGENCE"
      navLabel="Site sections"
      items={ITEMS}
      activeId={active}
      onSelect={(id) => navigate(hrefFor(id, city))}
      city={city}
      cities={cities}
      onCity={setCity}
      action={{ label: "Operations", title: "The officer console — enforcement worklist, simulator, agent pipeline", onClick: () => navigate(`/console?city=${city}`) }}
    />
  );
}
