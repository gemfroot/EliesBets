import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function SvgWrap({
  children,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Compact sport glyph for mobile nav (replaces emoji). */
export function SportNavIcon({
  slug,
  className = "h-[1.125rem] w-[1.125rem] shrink-0 text-zinc-300",
}: {
  slug: string;
  className?: string;
}) {
  switch (slug) {
    case "football":
    case "soccer":
    case "futsal":
      return (
        <SvgWrap className={className} aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
        </SvgWrap>
      );
    case "basketball":
      return (
        <SvgWrap className={className} aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
        </SvgWrap>
      );
    case "tennis":
      return (
        <SvgWrap className={className} aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 12c-2-4-2-8 0-9s4 1 4 5-2 7-4 4z" />
        </SvgWrap>
      );
    case "ice-hockey":
    case "hockey":
      return (
        <SvgWrap className={className} aria-hidden>
          <path d="M4 17l4-10h4l4 10M8 7l-2 12M16 7l2 12" />
        </SvgWrap>
      );
    case "american-football":
      return (
        <SvgWrap className={className} aria-hidden>
          <ellipse cx="12" cy="12" rx="10" ry="6" />
          <path d="M2 12h20M12 6v12" />
        </SvgWrap>
      );
    case "baseball":
      return (
        <SvgWrap className={className} aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M7 7c2 2 8 8 10 10M17 7c-2 2-8 8-10 10" />
        </SvgWrap>
      );
    case "counter-strike":
    case "esports":
      return (
        <SvgWrap className={className} aria-hidden>
          <rect x="6" y="9" width="12" height="8" rx="1" />
          <path d="M9 9V7a3 3 0 0 1 6 0v2M8 21h8" />
        </SvgWrap>
      );
    case "mma":
    case "boxing":
      return (
        <SvgWrap className={className} aria-hidden>
          <path d="M8 8h8v8H8zM6 6l2 2M18 6l-2 2M6 18l2-2M18 18l-2-2" />
        </SvgWrap>
      );
    case "volleyball":
      return (
        <SvgWrap className={className} aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a9 9 0 0 0 0 18M12 3a9 9 0 0 1 0 18M3 12h18" />
        </SvgWrap>
      );
    case "handball":
      return (
        <SvgWrap className={className} aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 12l6-6M12 12l-6 6M12 12l6 6M12 12l-6-6" />
        </SvgWrap>
      );
    case "rugby":
      return (
        <SvgWrap className={className} aria-hidden>
          <ellipse cx="12" cy="12" rx="10" ry="6" />
          <path d="M7 12h10" />
        </SvgWrap>
      );
    case "cricket":
      return (
        <SvgWrap className={className} aria-hidden>
          <path d="M5 19L19 5M8 8l8 8M10 6l2-2 2 2-2 2-2-2z" />
        </SvgWrap>
      );
    case "darts":
      return (
        <SvgWrap className={className} aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        </SvgWrap>
      );
    case "snooker":
      return (
        <SvgWrap className={className} aria-hidden>
          <circle cx="8" cy="8" r="5" />
          <circle cx="16" cy="16" r="5" />
        </SvgWrap>
      );
    default:
      return (
        <SvgWrap className={className} aria-hidden>
          <path d="M12 3l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L5.7 22l2.3-7-6-4.6h7.6L12 3z" />
        </SvgWrap>
      );
  }
}
