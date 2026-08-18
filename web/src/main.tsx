import { AqiScaleProvider } from "./aqiScale";
import React, { lazy, Suspense, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import Landing from "./Landing";
import ErrorBoundary from "./ErrorBoundary";
import { upgradeLegacyHash } from "./router";
import "./index.css";

// The console pulls in MapLibre + Deck.gl + Recharts (~1.5 MB). Landing needs
// none of it, so the console is code-split out and only fetched at /console.
const App = lazy(() => import("./App"));

// Old '#/console' QR codes and bookmarks land on the clean path.
upgradeLegacyHash();

function ConsoleFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
      <span className="animate-pulse">Loading console…</span>
    </div>
  );
}

/** Path router: "/console" → ops console, anything else → landing page. */
function Root() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const on = () => setPath(window.location.pathname);
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  if (path.startsWith("/console")) {
    return (
      <Suspense fallback={<ConsoleFallback />}>
        <AqiScaleProvider><App /></AqiScaleProvider>
      </Suspense>
    );
  }
  return <Landing />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>,
);
