// The public site: one shell, five pages, and a door to the operations console. The console itself
// is untouched — it keeps its own top bar, icon rail and every behaviour it had.
import { lazy, Suspense, useEffect, useState } from "react";
import { Loading, Text } from "../design/ui";
import { SiteProvider } from "./context";
import { SiteNav } from "./nav";
import { SiteFooter } from "./footer";
import HomePage from "./home";
import ForecastPage from "./forecastPage";
import RankingsPage from "./rankingsPage";
import AboutPage from "./aboutPage";

// MapLibre + deck.gl are ~1.3 MB and only the map page needs them.
const MapPage = lazy(() => import("./mapPage"));

/** When the backend is asleep the app serves bundled fixtures — say so rather than pretending. */
function FallbackNotice() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const off = () => setOn(false);
    const fire = () => setOn(true);
    window.addEventListener("api-fallback", fire);
    window.addEventListener("api-live", off);
    return () => { window.removeEventListener("api-fallback", fire); window.removeEventListener("api-live", off); };
  }, []);
  if (!on) return null;
  return (
    <div role="status" style={{ background: "var(--warn-soft)", borderBottom: "1px solid var(--line)" }}>
      <div style={{ margin: "0 auto", maxWidth: 1360, padding: "6px var(--s-5)", textAlign: "center" }}>
        <Text size="xs" weight={600} style={{ color: "var(--warn)" }}>
          The backend is waking up — showing the last captured snapshot until it answers.
        </Text>
      </div>
    </div>
  );
}

function Page({ path }: { path: string }) {
  if (path.startsWith("/map")) {
    return (
      <Suspense fallback={<div className="vn-page"><Loading lines={5} label="Loading the map" /></div>}>
        <MapPage />
      </Suspense>
    );
  }
  if (path.startsWith("/forecast")) return <ForecastPage />;
  if (path.startsWith("/rankings")) return <RankingsPage />;
  if (path.startsWith("/about")) return <AboutPage />;
  return <HomePage />;
}

export default function Site({ path }: { path: string }) {
  // The city lives in the URL, so a page change can also be a city change — keying the main
  // element on both replays the entrance animation and guarantees a clean remount.
  const key = `${path}${window.location.search}`;
  return (
    <SiteProvider path={path}>
      <div className="vn" style={{ minHeight: "100dvh", background: "var(--canvas)", display: "flex", flexDirection: "column" }}>
        <SiteNav />
        <FallbackNotice />
        <main key={key} className="vn-fade" style={{ flex: 1, minWidth: 0, overflowX: "clip" }}>
          <Page path={path} />
        </main>
        <SiteFooter />
      </div>
    </SiteProvider>
  );
}
