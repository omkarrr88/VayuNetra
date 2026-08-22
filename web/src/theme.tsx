import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";
const KEY = "vayunetra-theme";
const Ctx = createContext<{ theme: Theme; setTheme: (t: Theme) => void; toggle: () => void }>({
  theme: "light", setTheme: () => {}, toggle: () => {},
});

function initial(): Theme {
  try {
    const q = new URLSearchParams(window.location.search).get("theme");
    if (q === "dark" || q === "light") return q;
    const s = localStorage.getItem(KEY);
    if (s === "dark" || s === "light") return s;
  } catch { /* ignore */ }
  return "light";   // judges see the familiar light console; dark is one click away
}

/** Light/dark theme for the whole app. Applied as `data-theme` on <html> so CSS variables in
 *  index.css switch every surface at once; persisted per browser, `?theme=dark` deep-links it. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initial);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
  }, [theme]);
  return <Ctx.Provider value={{ theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") }}>{children}</Ctx.Provider>;
}

export function useTheme() { return useContext(Ctx); }

/** Sun/moon switch for the header. */
export function ThemeToggle({ dark = true }: { dark?: boolean }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      aria-label="Toggle dark theme"
      aria-pressed={theme === "dark"}
      className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${dark ? "text-slate-300 hover:bg-white/10 hover:text-white" : "text-slate-600 hover:bg-slate-100"}`}
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
          <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      )}
    </button>
  );
}
