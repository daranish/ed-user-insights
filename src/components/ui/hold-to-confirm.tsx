"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const FONT_STACK =
  'var(--font-sans, "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif)';

const SQUIRCLE = "[corner-shape:squircle]";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

export interface HoldToConfirmProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children"> {
  /** The action, e.g. "Hold to delete". */
  label: string;
  /** While held. Default "Keep holding…". */
  holdingLabel?: string;
  /** After it fires. Default "Done". */
  confirmedLabel?: string;
  /** How long to hold, in milliseconds. Default 1500. */
  duration?: number;
  /** Destructive fills red. Default "default". */
  tone?: "default" | "destructive";
  /** Called once the hold completes. Return a promise to show a spinner while it runs. */
  onConfirm: () => void | Promise<void>;
  /** sm 32px, md 36px, lg 40px. Default md. */
  size?: "sm" | "md" | "lg";
}

const H = { sm: "h-8 px-3 text-[12.5px] rounded-[9px]", md: "h-9 px-3.5 text-[13px] rounded-[10px]", lg: "h-10 px-4 text-[14px] rounded-[11px]" } as const;

export const HoldToConfirm = React.forwardRef<HTMLButtonElement, HoldToConfirmProps>(function HoldToConfirm(
  { label, holdingLabel = "Keep holding…", confirmedLabel = "Done", duration = 1500, tone = "default", onConfirm, size = "md", disabled, className, style, ...rest },
  ref,
) {
  const reduce = useReducedMotion();
  const [p, setP] = React.useState(0);
  const [phase, setPhase] = React.useState<"idle" | "holding" | "busy" | "done">("idle");
  const raf = React.useRef(0);
  const start = React.useRef(0);
  const from = React.useRef(0);
  const hintId = React.useId();

  React.useEffect(() => () => cancelAnimationFrame(raf.current), []);
  React.useEffect(() => {
    if (phase !== "done") return;
    const t = setTimeout(() => {
      setPhase("idle");
      setP(0);
    }, 1800);
    return () => clearTimeout(t);
  }, [phase]);

  const fire = async () => {
    setPhase("busy");
    try {
      await onConfirm();
      setPhase("done");
    } catch {
      setPhase("idle");
      setP(0);
    }
  };

  const begin = () => {
    if (disabled || phase === "busy" || phase === "done") return;
    cancelAnimationFrame(raf.current);
    setPhase("holding");
    start.current = performance.now() - p * duration;
    const tick = (now: number) => {
      const next = Math.min(1, (now - start.current) / duration);
      setP(next);
      if (next >= 1) {
        fire();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const release = () => {
    if (phase !== "holding") return;
    cancelAnimationFrame(raf.current);
    setPhase("idle");
    from.current = p;
    const t0 = performance.now();
    const drain = (now: number) => {
      const next = Math.max(0, from.current - ((now - t0) / duration) * 3);
      setP(next);
      if (next > 0) raf.current = requestAnimationFrame(drain);
    };
    raf.current = requestAnimationFrame(drain);
  };

  const left = Math.max(0, ((1 - p) * duration) / 1000);
  const words =
    phase === "busy" ? label : phase === "done" ? confirmedLabel : phase === "holding" ? (reduce ? `Hold ${left.toFixed(1)}s` : holdingLabel) : label;
  const danger = tone === "destructive";

  return (
    <span style={{ fontFamily: FONT_STACK }} className="inline-flex flex-col items-center gap-1.5">
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        aria-describedby={hintId}
        aria-busy={phase === "busy" || undefined}
        {...rest}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          begin();
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            begin();
          } else if (e.key === " " || e.key === "Enter") e.preventDefault();
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") release();
        }}
        onBlur={release}
        onContextMenu={(e) => e.preventDefault()}
        style={style}
        className={cn(
          FOCUS,
          "relative isolate inline-flex min-w-[11rem] cursor-pointer touch-none items-center justify-center gap-2 overflow-hidden font-medium select-none [-webkit-touch-callout:none]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          danger ? "bg-destructive-soft text-destructive dark:text-[color-mix(in_oklab,var(--color-destructive)_70%,var(--color-foreground))] ring-1 ring-destructive/25 ring-inset" : "bg-foreground/[0.06] text-foreground ring-1 ring-border ring-inset",
          phase === "done" && (danger ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"),
          H[size],
          SQUIRCLE,
          className,
        )}
      >
        <span
          aria-hidden
          style={{ transform: `scaleX(${reduce ? (phase === "done" ? 1 : 0) : p})` }}
          className={cn("absolute inset-0 -z-10 origin-left", danger ? "bg-destructive" : "bg-primary")}
        />
        <span className="relative inline-flex items-center gap-2">
          {phase === "busy" && <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />}
          {phase === "done" && <Check aria-hidden className="size-4" />}
          <span className="tabular-nums">{words}</span>
        </span>
        {!reduce && phase !== "done" && (
          <span
            aria-hidden
            style={{ clipPath: `inset(0 ${100 - p * 100}% 0 0)` }}
            className={cn("absolute inset-0 grid place-items-center", danger ? "text-destructive-foreground" : "text-primary-foreground")}
          >
            <span className="inline-flex items-center gap-2">
              {phase === "busy" && <Loader2 className="size-4 motion-safe:animate-spin" />}
              <span className="tabular-nums">{words}</span>
            </span>
          </span>
        )}
        <span className="sr-only" aria-live="polite">
          {phase === "done" ? confirmedLabel : ""}
        </span>
      </button>
      <span id={hintId} className="text-[11.5px] text-muted-foreground">
        {phase === "done" ? " " : "Press and hold"}
      </span>
    </span>
  );
});

export default HoldToConfirm;
