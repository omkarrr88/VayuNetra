import { useEffect, useRef, useState, cloneElement, type ReactElement } from "react";

/** Charts sized in PIXELS, measured from the parent box.
 *
 *  This used to hand recharts `width="100%" height="100%"` through a ResponsiveContainer. On the
 *  Impact page that produced a wrapper carrying `width: 1286px` inline and a *computed* width of
 *  0 — recharts had measured correctly, but the percentage resolved to nothing, so the bars were in
 *  the DOM inside a zero-width SVG and the card showed a blank gap. A window resize did not recover
 *  it either.
 *
 *  Measuring here and passing explicit numbers removes the percentage entirely, so there is no
 *  chain for a 0 to come from. The chart still tracks its container: the ResizeObserver re-measures
 *  and re-renders on every layout change.
 */
export default function SizedChart({ children, minHeight = 0 }: { children: ReactElement; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = Math.floor(el.clientWidth);
      const h = Math.floor(el.clientHeight);
      setBox((prev) => (prev && prev.w === w && prev.h === h ? prev : w > 0 && h > 0 ? { w, h } : null));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="h-full w-full" style={minHeight ? { minHeight } : undefined}>
      {box ? cloneElement(children, { width: box.w, height: box.h } as Partial<unknown>) : null}
    </div>
  );
}
