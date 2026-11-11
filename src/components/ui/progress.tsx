"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const SPRING = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.8,
} as const;

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

export type ProgressTone = "default" | "chart" | "success" | "warning" | "destructive";

const FILL: Record<ProgressTone, string> = {
  default: "bg-foreground",
  chart: "bg-[var(--chart-1)]",
  success: "bg-success",
  warning: "bg-warning-fill",
  destructive: "bg-destructive",
};

interface Shared {
  /** Done so far. Leave out, or pass null, while it is not known. */
  value?: number | null;
  /** Default 100. */
  max?: number;
  /** What is progressing: "Uploading contract.pdf". Shown and used as the accessible name. */
  label?: React.ReactNode;
  /** Show the value as text. */
  showValue?: boolean;
  /** Words for the value: `(v, max) => \`${v} of ${max} seats\``. Default a percentage. */
  formatValue?: (value: number, max: number) => string;
  /** Default grey; colour only when it means something. */
  tone?: ProgressTone;
}

const pct = (v: number, max: number) =>
  Math.round((Math.min(Math.max(v, 0), max) / max) * 100);
function words(
  value: number | null | undefined,
  max: number,
  formatValue?: Shared["formatValue"],
) {
  if (value == null) return "In progress";
  const text = formatValue ? formatValue(value, max) : `${pct(value, max)}%`;
  return value > max ? `${text} (over the limit)` : text;
}

export interface ProgressProps
  extends Shared, Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** A line under the bar: "3 of 12 files", "About 2 minutes left". */
  description?: React.ReactNode;
  /** Bar height. Default `md`. */
  size?: "sm" | "md" | "lg";
}

const HEIGHT = { sm: "h-1", md: "h-1.5", lg: "h-2.5" } as const;

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  function Progress(
    {
      value,
      max = 100,
      label,
      showValue = false,
      formatValue,
      tone = "default",
      description,
      size = "md",
      className,
      ...props
    },
    ref,
  ) {
    const reduce = useReducedMotion();
    const id = React.useId();
    const known = value != null;
    const width = known ? pct(value, max) : 0;
    const text = words(value, max, formatValue);

    return (
      <div
        ref={ref}
        className={cn("flex w-full min-w-0 flex-col gap-1.5", className)}
        {...props}
      >
        {(label || showValue) && (
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            {label && (
              <span id={`${id}-l`} className="min-w-0 truncate font-medium">
                {label}
              </span>
            )}
            {showValue && (
              <span
                aria-hidden
                className={cn(
                  "shrink-0 text-muted-foreground tabular-nums",
                  known && value > max && "text-destructive",
                )}
              >
                {text}
              </span>
            )}
          </div>
        )}
        <div
          role="progressbar"
          aria-labelledby={label ? `${id}-l` : undefined}
          aria-label={label ? undefined : "Progress"}
          aria-describedby={description ? `${id}-d` : undefined}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={known ? Math.min(Math.max(value, 0), max) : undefined}
          aria-valuetext={text}
          aria-busy={!known || undefined}
          className={cn(
            "relative w-full overflow-hidden rounded-full bg-foreground/10",
            HEIGHT[size],
          )}
        >
          {known ? (
            <motion.div
              className={cn("h-full rounded-full", FILL[tone])}
              initial={false}
              animate={{ width: `${width}%` }}
              transition={reduce ? { duration: 0 } : SPRING}
            />
          ) : reduce ? (
            <div
              className={cn("h-full w-1/3 rounded-full opacity-60", FILL[tone])}
            />
          ) : (
            <motion.div
              className={cn(
                "absolute inset-y-0 w-2/5 rounded-full",
                FILL[tone],
              )}
              initial={{ left: "-40%" }}
              animate={{ left: "100%" }}
              transition={{
                duration: 1.3,
                repeat: Infinity,
                ease: [0.45, 0, 0.55, 1],
              }}
            />
          )}
        </div>
        {description && (
          <p id={`${id}-d`} className="m-0 text-[12px] text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    );
  },
);

export default Progress;
