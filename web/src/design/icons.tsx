// Inline stroke icons — the console's replacement for emoji-as-icons. Every icon
// is a 24px viewBox, stroke = currentColor, so it inherits the surrounding text
// colour in both themes and scales with font-size (1em by default).
import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number | string; title?: string };

function make(name: string, paths: string[]) {
  function Icon({ size = "1em", title, style, ...rest }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={title ? undefined : true}
        role={title ? "img" : undefined}
        style={{ display: "inline-block", verticalAlign: "-0.125em", flexShrink: 0, ...style }}
        {...rest}
      >
        {title && <title>{title}</title>}
        {paths.map((d, i) => <path key={i} d={d} />)}
      </svg>
    );
  }
  Icon.displayName = name;
  return Icon;
}

export const IconCamera = make("IconCamera", ["M4 8h3l2-3h6l2 3h3v11H4V8Z", "M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"]);
export const IconFlame = make("IconFlame", ["M12 3c1.2 3 4.5 4.6 4.5 8.7A4.5 4.5 0 0 1 7.5 11.7c0-1.3.4-2.3 1-3.2.5.9 1 1.4 1.9 1.9 0-2.9.3-5.2 1.6-7.4Z"]);
export const IconScale = make("IconScale", ["M12 3v18M5 21h14M4 8h16", "M6 8l-3 6a3 3 0 0 0 6 0L6 8Z", "M18 8l-3 6a3 3 0 0 0 6 0l-3-6Z"]);
export const IconCone = make("IconCone", ["M9.5 4h5l4 15H5.5l4-15Z", "M7.6 11h8.8M6.3 16h11.4M3 19h18"]);
export const IconPhone = make("IconPhone", ["M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"]);
export const IconMegaphone = make("IconMegaphone", ["M3 10v4l10 4V6L3 10Z", "M13 6l8-2v16l-8-2", "M6 14v5h3"]);
export const IconZap = make("IconZap", ["M13 2 4 14h7l-1 8 9-12h-7l1-8Z"]);
export const IconAlert = make("IconAlert", ["M12 3 2 21h20L12 3Z", "M12 10v4M12 17v.5"]);
export const IconCheck = make("IconCheck", ["M5 12l5 5L20 7"]);
export const IconX = make("IconX", ["M6 6l12 12M18 6 6 18"]);
export const IconCircle = make("IconCircle", ["M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z"]);
export const IconPin = make("IconPin", ["M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10Z", "M12 13.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"]);
export const IconSiren =make("IconSiren", ["M7 19V12a5 5 0 0 1 10 0v7", "M4 19h16v2H4z", "M12 3v2M4.9 6.9l1.4 1.4M19.1 6.9l-1.4 1.4"]);
