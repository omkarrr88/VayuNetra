// Shared UI primitives — one card/button language across every panel.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { IconAlert, IconCircle } from "./design/icons";

/** Cross-panel refresh signal: an officer action (approve/dispatch) changed enforcement state,
 *  so ward queues and intervention tracking refetch without a page reload. */
export const ENFORCEMENT_CHANGED = "vn:enforcement-changed";
export function notifyEnforcementChanged(): void {
  window.dispatchEvent(new CustomEvent(ENFORCEMENT_CHANGED));
}
/** Re-run `fn` whenever enforcement state changes (subscribe/unsubscribe on mount). */
export function useEnforcementChanged(fn: () => void): void {
  useEffect(() => {
    window.addEventListener(ENFORCEMENT_CHANGED, fn);
    return () => window.removeEventListener(ENFORCEMENT_CHANGED, fn);
  }, [fn]);
}

/** Numbered step in a section's flow — provided by <Step> so a panel can show its badge without
 *  knowing where it sits in the story. Console sections are full pages, so every step renders in
 *  order; the section header links to each one by its number. */
export type StepInfo = { n: number; label: string; info?: ReactNode };
export const StepContext = createContext<StepInfo | null>(null);

export function Step({ n, label, info, children }: StepInfo & { children: ReactNode }) {
  return (
    <StepContext.Provider value={{ n, label, info }}>
      <div data-step={n} style={{ scrollMarginTop: 80, minWidth: 0 }}>{children}</div>
    </StepContext.Provider>
  );
}

/** "What is this?" popover — plain-language explanation of what a card shows, where the
 *  numbers come from and what to do with it. Keyboard + hover friendly. */
export function InfoTip({ children, label = "What is this?" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        title={label}
        style={{
          width: 22, height: 22, display: "grid", placeItems: "center", borderRadius: "var(--r-full)",
          border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--muted)",
          fontSize: "var(--t-xs)", fontWeight: 800, cursor: "help",
          transition: "color var(--fast) var(--ease), border-color var(--fast) var(--ease)",
        }}
      >
        ?
      </button>
      {open && (
        <div
          role="dialog"
          className="vn-sheet vn-scroll-thin vn-overlay"
          style={{
            position: "absolute", right: 0, top: 28, zIndex: 40,
            // its own cap, so it still cannot run off a narrow screen now that the card's is lifted
            width: "19rem", maxWidth: "min(19rem, calc(100vw - 2rem))",
            maxHeight: "22rem", overflowY: "auto",
            borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--surface)",
            boxShadow: "var(--e-3)", padding: "var(--s-3)",
            fontSize: "var(--t-sm)", lineHeight: "var(--lh-body)", color: "var(--ink-2)",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** The one card in the product. Every console panel is one of these, so its frame, its type
 *  and its spacing come from the same place as the public site's. */
export function Panel({
  title,
  tag,
  right,
  info,
  children,
  className = "",
}: {
  title?: ReactNode;
  tag?: string;
  right?: ReactNode;
  info?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const step = useContext(StepContext);
  const tip = info ?? step?.info;
  return (
    <section
      className={`vn-panel ${className}`}
      aria-label={typeof title === "string" ? title : undefined}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--e-1)",
        padding: "var(--s-4)",
        fontSize: "var(--t-sm)",
        color: "var(--ink-2)",
      }}
    >
      {title !== undefined && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--s-2)", marginBottom: "var(--s-3)" }}>
          <div style={{ display: "flex", minWidth: 0, alignItems: "center", gap: "var(--s-2)" }}>
            {step && (
              <span
                aria-label={`Step ${step.n}`}
                style={{ display: "inline-grid", placeItems: "center", width: 20, height: 20, flex: "none", borderRadius: "var(--r-full)", background: "var(--primary)", color: "var(--primary-ink)", fontSize: "var(--t-2xs)", fontWeight: 800 }}
              >
                {step.n}
              </span>
            )}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "var(--t-md)", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--ink)" }}>
              {title}
            </span>
            {tag && (
              <span style={{ flex: "none", whiteSpace: "nowrap", borderRadius: "var(--r-full)", background: "var(--surface-3)", padding: "2px 8px", fontSize: "var(--t-2xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "var(--tracking-wide)", color: "var(--muted)" }}>
                {tag}
              </span>
            )}
          </div>
          <div style={{ display: "flex", flex: "0 1 auto", minWidth: 0, alignItems: "center", gap: "var(--s-2)" }}>
            {right}
            {tip && <InfoTip>{tip}</InfoTip>}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}

/** Consistent empty/error state — a mark, a one-line reason, an optional retry. */
export function EmptyState({
  message,
  onRetry,
  tone = "muted",
}: {
  message: string;
  onRetry?: () => void;
  tone?: "muted" | "error";
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--s-2)", borderRadius: "var(--r-md)", background: "var(--surface-2)", padding: "var(--s-5) var(--s-3)", textAlign: "center" }}>
      <span aria-hidden="true" style={{ fontSize: "var(--t-lg)", color: tone === "error" ? "var(--warn)" : "var(--faint)" }}>
        {tone === "error" ? <IconAlert /> : <IconCircle />}
      </span>
      <span style={{ fontSize: "var(--t-xs)", color: "var(--muted)" }}>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{ marginTop: 2, cursor: "pointer", borderRadius: "var(--r-sm)", border: "1px solid var(--line)", background: "var(--surface)", padding: "5px 12px", fontSize: "var(--t-xs)", fontWeight: 700, color: "var(--ink-2)" }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

/** Small option button used in every segmented control (horizons, layers, channels…). */
export function SegBtn({
  active,
  onClick,
  children,
  className = "",
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  /** Hover explanation — a segmented control often needs to say what it actually does. */
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={className}
      style={{
        cursor: "pointer", borderRadius: "var(--r-full)", padding: "5px 11px", minHeight: 28,
        fontSize: "var(--t-xs)", fontWeight: 700,
        border: `1px solid ${active ? "transparent" : "var(--line)"}`,
        background: active ? "var(--primary)" : "var(--surface-2)",
        color: active ? "var(--primary-ink)" : "var(--muted)",
        transition: "background var(--fast) var(--ease), color var(--fast) var(--ease)",
      }}
    >
      {children}
    </button>
  );
}
