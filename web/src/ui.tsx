// Shared UI primitives — one card/button language across every panel.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

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

/** Numbered step in a section's flow — provided by <Step> in App.tsx so a panel can
 *  show its badge without knowing where it sits in the story. */
export type StepInfo = { n: number; label: string; info?: ReactNode };
export const StepContext = createContext<StepInfo | null>(null);

export function Step({ n, label, info, children }: StepInfo & { children: ReactNode }) {
  return (
    <StepContext.Provider value={{ n, label, info }}>
      <div data-step={n} className="scroll-mt-20">{children}</div>
    </StepContext.Provider>
  );
}

/** "What is this?" popover — plain-language explanation of what a card shows, where the
 *  numbers come from and what to do with them. Keyboard + hover friendly. */
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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        title={label}
        className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-[11px] font-bold text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        ?
      </button>
      {open && (
        <div role="dialog" className="vn-pop absolute right-0 top-6 z-30 w-72 rounded-lg border border-slate-200 bg-white p-3 text-[12px] leading-5 text-slate-700 shadow-xl">
          {children}
        </div>
      )}
    </div>
  );
}

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
    <section className={`vn-card p-3 text-sm ${className}`} aria-label={typeof title === "string" ? title : undefined}>
      {title !== undefined && (
        <div className="vn-card-hd">
          <div className="flex min-w-0 items-center gap-1.5">
            {step && <span className="vn-step" aria-label={`Step ${step.n}`}>{step.n}</span>}
            <span className="truncate text-[13.5px] font-bold tracking-tight text-slate-800">{title}</span>
            {tag && (
              <span className="whitespace-nowrap rounded bg-slate-100 px-1 py-px text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                {tag}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {right}
            {tip && <InfoTip>{tip}</InfoTip>}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}

/** Consistent empty/error state — an icon, a one-line reason, an optional retry. */
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
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-3 py-5 text-center">
      <span className={`text-lg ${tone === "error" ? "text-amber-500" : "text-slate-300"}`} aria-hidden="true">
        {tone === "error" ? "⚠" : "○"}
      </span>
      <span className="text-xs text-slate-500">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="mt-0.5 cursor-pointer rounded-md bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-300">
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
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`cursor-pointer rounded-md px-2 py-1 text-xs font-medium transition-colors ${
        active ? "bg-blue-700 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      } ${className}`}
    >
      {children}
    </button>
  );
}
