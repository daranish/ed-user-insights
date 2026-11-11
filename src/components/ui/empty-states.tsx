"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const SQUIRCLE = "[corner-shape:squircle]";

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["figure", "title", "body", "sub", "dense", "meta", "chip", "micro"] }],
      shadow: [{ shadow: ["float", "overlay"] }],
    },
  },
});

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type EmptyIllustrationName = "projects" | "search" | "inbox" | "chart" | "agent" | "locked" | "404";

export const EMPTY_ILLUSTRATIONS: readonly EmptyIllustrationName[] = [
  "projects",
  "search",
  "inbox",
  "chart",
  "agent",
  "locked",
  "404",
] as const;

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: React.ReactNode;
}

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** One of the seven drawn scenes, or your own node. */
  illustration: EmptyIllustrationName | React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** The one action that fills the space. Drawn as the primary button. */
  primaryAction?: EmptyStateAction;
  /** A quieter way forward: docs, an import, a link home. */
  secondaryAction?: EmptyStateAction;
  /** "md" (default) for a page; "sm" for a panel or a card. */
  size?: "sm" | "md";
  /** Draw a dashed frame: for an empty region inside a page. */
  framed?: boolean;
  /** Play the scene's loop. Default true; always still under reduced motion. */
  animate?: boolean;
  /** Heading level for the title. Default 2. */
  headingLevel?: 2 | 3 | 4;
}

const C = {
  paper: "var(--card)",
  ground: "var(--muted)",
  line: "color-mix(in oklab, var(--foreground) 16%, transparent)",
  soft: "color-mix(in oklab, var(--foreground) 9%, transparent)",
  mid: "color-mix(in oklab, var(--foreground) 30%, transparent)",
  ink: "var(--foreground)",
  knock: "var(--background)",
};

type Scene = (p: { play: boolean }) => React.ReactNode;

const loop = (play: boolean, values: Record<string, number[]>, duration = 3.2, delay = 0) =>
  play
    ? {
        animate: values,
        transition: { duration, delay, repeat: Infinity, ease: "easeInOut" as const },
      }
    : {};

const Floor = () => <ellipse cx="100" cy="128" rx="74" ry="7" fill={C.soft} />;

const SCENES: Record<EmptyIllustrationName, Scene> = {
  projects: ({ play }) => (
    <>
      <Floor />
      <g transform="rotate(-8 70 70)">
        <rect x="38" y="34" width="62" height="78" rx="9" fill={C.ground} stroke={C.line} />
        <rect x="47" y="46" width="30" height="5" rx="2.5" fill={C.line} />
      </g>
      <g transform="rotate(6 128 70)">
        <rect x="104" y="30" width="62" height="80" rx="9" fill={C.ground} stroke={C.line} />
        <rect x="113" y="42" width="34" height="5" rx="2.5" fill={C.line} />
        <rect x="113" y="52" width="22" height="5" rx="2.5" fill={C.soft} />
      </g>
      <motion.g style={{ transformOrigin: "100px 82px" }} {...loop(play, { scale: [1, 1.04, 1] }, 2.8)}>
        <rect x="68" y="46" width="64" height="74" rx="10" fill={C.paper} stroke={C.mid} strokeDasharray="4 4" />
        <circle cx="100" cy="83" r="13" fill={C.ink} />
        <path d="M100 77v12M94 83h12" stroke={C.knock} strokeWidth="2.4" strokeLinecap="round" />
      </motion.g>
    </>
  ),

  search: ({ play }) => (
    <>
      <Floor />
      <rect x="40" y="26" width="120" height="96" rx="12" fill={C.paper} stroke={C.line} />
      {[44, 64, 84, 104].map((y, i) => (
        <g key={y} opacity={1 - i * 0.2}>
          <rect x="52" y={y - 4} width="10" height="10" rx="3" fill={C.soft} />
          <rect x="68" y={y - 2} width={60 - i * 8} height="5" rx="2.5" fill={C.soft} />
        </g>
      ))}
      <motion.g {...loop(play, { x: [0, 26, 8, 0], y: [0, 10, 24, 0] }, 5.6)}>
        <circle cx="96" cy="60" r="20" fill={C.knock} fillOpacity="0.7" stroke={C.ink} strokeWidth="3.5" />
        <path d="M110.5 74.5l14 14" stroke={C.ink} strokeWidth="5" strokeLinecap="round" />
        <path d="M89 56a9 9 0 0 1 9-6" stroke={C.mid} strokeWidth="2" strokeLinecap="round" fill="none" />
      </motion.g>
    </>
  ),

  inbox: ({ play }) => (
    <>
      <Floor />
      <path d="M44 74l14-36h84l14 36v38a8 8 0 0 1-8 8H52a8 8 0 0 1-8-8z" fill={C.ground} stroke={C.line} />
      <path d="M44 74h34l6 12h32l6-12h34" fill="none" stroke={C.line} />
      <rect x="64" y="48" width="72" height="5" rx="2.5" fill={C.soft} />
      <rect x="70" y="58" width="60" height="5" rx="2.5" fill={C.soft} />
      <motion.g {...loop(play, { y: [0, -6, 0] }, 3)}>
        <circle cx="100" cy="30" r="13" fill={C.ink} />
        <path d="M94 30l4.5 4.5L107 26" fill="none" stroke={C.knock} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
    </>
  ),

  chart: ({ play }) => (
    <>
      <Floor />
      <rect x="36" y="22" width="128" height="100" rx="12" fill={C.paper} stroke={C.line} />
      {[46, 66, 86].map((y) => (
        <path key={y} d={`M52 ${y}h96`} stroke={C.soft} strokeDasharray="2 4" />
      ))}
      <path d="M52 106h96" stroke={C.line} />
      {[0, 1, 2, 3, 4].map((i) => {
        const lo = 16 + ((i * 7) % 14);
        const hi = 30 + ((i * 11) % 22);
        return (
          <motion.rect
            key={i}
            x={57 + i * 18}
            width="13"
            rx="3.5"
            fill={i === 3 ? C.ink : C.soft}
            initial={{ y: 106 - lo, height: lo }}
            {...loop(play, { y: [106 - lo, 106 - hi, 106 - lo], height: [lo, hi, lo] }, 3.4, i * 0.25)}
          />
        );
      })}
    </>
  ),

  agent: ({ play }) => (
    <>
      <Floor />
      {[
        [56, 36],
        [146, 52],
        [62, 108],
      ].map(([x, y], i) => (
        <g key={i}>
          <path d={`M100 74L${x} ${y}`} stroke={C.line} strokeWidth="1.5" strokeDasharray="3 4" />
          <rect x={x - 15} y={y - 12} width="30" height="24" rx="8" fill={C.paper} stroke={C.mid} strokeDasharray="3 3" />
          <motion.circle
            r="2.6"
            fill={C.ink}
            initial={{ cx: 100, cy: 74, opacity: 0 }}
            {...loop(play, { cx: [100, x], cy: [74, y], opacity: [0, 1, 0] }, 2.4, i * 0.6)}
          />
        </g>
      ))}
      <rect x="80" y="56" width="40" height="36" rx="12" fill={C.ink} />
      <circle cx="93" cy="74" r="3" fill={C.knock} />
      <circle cx="107" cy="74" r="3" fill={C.knock} />
      <motion.path
        d="M140 22l2.4 5.6 5.6 2.4-5.6 2.4-2.4 5.6-2.4-5.6-5.6-2.4 5.6-2.4z"
        fill={C.mid}
        style={{ transformOrigin: "140px 30px" }}
        {...loop(play, { rotate: [0, 90], scale: [0.8, 1.1, 0.8] }, 4)}
      />
    </>
  ),

  locked: ({ play }) => (
    <>
      <Floor />
      <rect x="52" y="22" width="96" height="100" rx="12" fill={C.ground} stroke={C.line} />
      {[38, 50, 62].map((y, i) => (
        <rect key={y} x="66" y={y} width={68 - i * 14} height="5" rx="2.5" fill={C.soft} />
      ))}
      <motion.g style={{ transformOrigin: "100px 92px" }} {...loop(play, { rotate: [0, 0, -5, 4, 0, 0] }, 3.6)}>
        <path d="M88 82v-8a12 12 0 0 1 24 0v8" fill="none" stroke={C.ink} strokeWidth="5" strokeLinecap="round" />
        <rect x="80" y="80" width="40" height="32" rx="8" fill={C.ink} />
        <circle cx="100" cy="93" r="4" fill={C.knock} />
        <path d="M100 95v7" stroke={C.knock} strokeWidth="3" strokeLinecap="round" />
      </motion.g>
    </>
  ),

  "404": ({ play }) => (
    <>
      <Floor />
      <path d="M30 104c26 0 30-34 58-34" fill="none" stroke={C.mid} strokeWidth="3" strokeLinecap="round" />
      <motion.path
        d="M30 104c26 0 30-34 58-34"
        fill="none"
        stroke={C.ink}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="6 8"
        {...loop(play, { strokeDashoffset: [0, -28] }, 1.6)}
        transition={play ? { duration: 1.6, repeat: Infinity, ease: "linear" } : undefined}
      />
      <path d="M118 70c22 0 28 30 52 30" fill="none" stroke={C.line} strokeWidth="3" strokeLinecap="round" strokeDasharray="1 7" />
      <circle cx="30" cy="104" r="5" fill={C.ink} />
      <g>
        <path d="M103 28v76" stroke={C.mid} strokeWidth="3" strokeLinecap="round" />
        <path d="M84 34h38l7 8-7 8H84z" fill={C.paper} stroke={C.line} />
        <text x="103" y="45.5" textAnchor="middle" fontSize="11" fontWeight="600" fill={C.ink} fontFamily="ui-monospace, monospace">
          404
        </text>
      </g>
    </>
  ),
};

export interface EmptyIllustrationProps extends React.SVGAttributes<SVGSVGElement> {
  name: EmptyIllustrationName;
  /** Width in px. Height follows (5:3.5). Default 200. */
  size?: number;
  /** Play the loop while in view. Default true. */
  animate?: boolean;
}

export function EmptyIllustration({ name, size = 200, animate = true, className, ...rest }: EmptyIllustrationProps) {
  const reduce = useReducedMotion();
  const ref = React.useRef<SVGSVGElement>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Scene = SCENES[name];
  return (
    <svg
      ref={ref}
      viewBox="0 0 200 140"
      width={size}
      height={(size * 140) / 200}
      aria-hidden="true"
      focusable="false"
      className={cn("block max-w-full shrink-0 overflow-visible", className)}
      fill="none"
      {...rest}
    >
      <Scene play={animate && !reduce && inView} />
    </svg>
  );
}

function ActionEl({ action, primary }: { action: EmptyStateAction; primary?: boolean }) {
  const variant = primary ? "primary" : "outline";
  return action.href ? (
    <Button asChild variant={variant}>
      <a href={action.href} onClick={action.onClick}>
        {action.icon}
        {action.label}
      </a>
    </Button>
  ) : (
    <Button variant={variant} onClick={action.onClick}>
      {action.icon}
      {action.label}
    </Button>
  );
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState(
  {
    illustration,
    title,
    description,
    primaryAction,
    secondaryAction,
    size = "md",
    framed = false,
    animate = true,
    headingLevel = 2,
    className,
    ...rest
  },
  ref,
) {
  const H = `h${headingLevel}` as "h2" | "h3" | "h4";
  const sm = size === "sm";
  const art =
    typeof illustration === "string" && illustration in SCENES ? (
      <EmptyIllustration name={illustration as EmptyIllustrationName} size={sm ? 148 : 200} animate={animate} />
    ) : (
      <div aria-hidden>{illustration}</div>
    );

  return (
    <div
      ref={ref}
      className={cn(
        "flex w-full flex-col items-center text-center",
        sm ? "gap-3 px-4 py-6" : "gap-4 px-6 py-10",
        framed && cn("rounded-[16px] border border-dashed border-border", SQUIRCLE),
        className,
      )}
      {...rest}
    >
      {art}
      <div className={cn("grid max-w-[38ch] gap-1.5", sm && "gap-1")}>
        <H className={cn("m-0 font-semibold tracking-[-0.015em] text-foreground", sm ? "text-[14px]" : "text-[16px]")}>{title}</H>
        {description && (
          <p className={cn("m-0 text-muted-foreground text-pretty", sm ? "text-[12.5px]" : "text-[13.5px] leading-[1.5]")}>
            {description}
          </p>
        )}
      </div>
      {(primaryAction || secondaryAction) && (
        <div className={cn("flex flex-wrap items-center justify-center gap-2", !sm && "mt-1")}>
          {primaryAction && <ActionEl action={primaryAction} primary />}
          {secondaryAction && <ActionEl action={secondaryAction} />}
        </div>
      )}
    </div>
  );
});

export default EmptyState;
