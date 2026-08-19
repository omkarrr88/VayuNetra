// Defer a card's data until the reader is close to it.
//
// The console used to be a tabbed rail: exactly one card was mounted, so exactly one card fetched.
// Full scrolling pages mount every card at once, and the enforcement page went from a handful of
// requests to twenty-one — all racing on a free-tier API while the reader looks at the first screen.
//
// `Deferred` renders its children only once the slot is within `margin` of the viewport, and shows a
// skeleton of the right height until then. The card's own header renders immediately, so the page's
// structure, its step numbers and its scroll height are unchanged — only the request moves.
//
// The margin is generous on purpose: anything a reader could reach in one flick has already loaded,
// so this is never felt as a delay.
import { useEffect, useRef, useState, type ReactNode } from "react";

export function useNearViewport<T extends Element>(margin = 700, armAfter = 600, loadBy = 3500) {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (near) return;                      // once shown, stay shown
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setNear(true); return; }

    // Observing is armed AFTER a beat, not immediately. At first paint the cards above this one are
    // still loading, so the page is a fraction of its real height and every slot looks visible —
    // which is exactly how the first attempt at this deferred nothing at all.
    //
    // And a hard backstop: whatever the observer decides, the card loads by `loadBy`. A reader who
    // never scrolls must never be left looking at a skeleton, and a test that asserts content
    // without scrolling must still find it. The point is only to keep these requests off the first
    // screen's critical path, not to withhold them.
    const hit = (entries: IntersectionObserverEntry[]) => {
      if (entries.some((e) => e.isIntersecting)) setNear(true);
    };
    let io: IntersectionObserver | null = null;
    const arm = window.setTimeout(() => {
      io = new IntersectionObserver(hit, { rootMargin: `${margin}px 0px ${margin}px 0px` });
      if (ref.current) io.observe(ref.current);
    }, armAfter);
    const backstop = window.setTimeout(() => setNear(true), loadBy);

    return () => { window.clearTimeout(arm); window.clearTimeout(backstop); io?.disconnect(); };
  }, [near, margin, armAfter, loadBy]);

  return { ref, near };
}

export function Deferred({ minHeight = 220, margin = 700, loadBy = 3500, children }: {
  /** Reserve the card's approximate height so the scrollbar does not jump when it arrives. */
  minHeight?: number;
  margin?: number;
  /** Load regardless by this point, so nobody is ever left with a skeleton. */
  loadBy?: number;
  children: ReactNode;
}) {
  const { ref, near } = useNearViewport<HTMLDivElement>(margin, 600, loadBy);
  return (
    <div ref={ref} style={{ minWidth: 0 }}>
      {near ? children : <div className="vn-skeleton" style={{ height: minHeight }} aria-hidden="true" />}
    </div>
  );
}
