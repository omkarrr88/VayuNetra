import { AqiScaleProvider } from "./aqiScale";
import { ThemeProvider } from "./theme";
import React, { lazy, Suspense, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import Landing from "./Landing";
import ErrorBoundary from "./ErrorBoundary";
import { upgradeLegacyHash } from "./router";
import "./index.css";

// The console pulls in MapLibre + Deck.gl + Recharts and every officer panel. The public site
// needs none of that up front, so the console is code-split and only fetched at /console.
const App = lazy(() => import("./App"));
const Site = lazy(() => import("./site/Site"));

// Old '#/console' QR codes and bookmarks land on the clean path.
upgradeLegacyHash();

function Booting({ what }: { what: string }) {
  return (
    <div className="vn" style={{ display: "grid", placeItems: "center", height: "100%", width: "100%", background: "var(--canvas)" }}>
      <span className="vn-fade" style={{ fontSize: "var(--t-sm)", color: "var(--muted)" }}>Loading {what}…</span>
    </div>
  );
}

// The app's own paths. Anything else is the front page.
const APP_PATHS = ["/city", "/map", "/forecast", "/rankings", "/about"];

/**
 * Path router — three separate things, deliberately:
 *   /                    → the front page (what VayuNetra is)
 *   /city/<id>, /map, /forecast, /rankings, /about
 *                        → the public app (what the air is)
 *   /console…            → the operations console (what to do about it)
 * '/city/<id>' stays a first-class public URL, so every QR code and shared link keeps working.
 */
function Root() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const on = () => setPath(window.location.pathname);
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);

  const isConsole = path.startsWith("/console");
  const isApp = APP_PATHS.some((p) => path.startsWith(p));

  // The landing page is its own thing: light theme, no console chrome, no providers it never uses.
  if (!isConsole && !isApp) return <Landing />;

  return (
    <ThemeProvider>
      <AqiScaleProvider>
        <Suspense fallback={<Booting what={isConsole ? "the console" : "VayuNetra"} />}>
          {isConsole ? <App /> : <Site path={path} />}
        </Suspense>
      </AqiScaleProvider>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>,
);
