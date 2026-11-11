"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const TYPE = {
  title: 15,
  body: 13.5,
  sub: 13,
  dense: 12.5,
  meta: 11.5,
  chip: 11,
  micro: 10.5,
  figure: 27,
} as const;

const SQUIRCLE = "[corner-shape:squircle]";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** A short note after the label: "2 months free". Keep it to a few words. */
  hint?: string;
}

export interface SegmentedControlProps<T extends string>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group. Required — "radio group" alone says nothing. */
  label: string;
  size?: "sm" | "md";
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className,
  ...rest
}: SegmentedControlProps<T>) {
  const reduce = useReducedMotion();
  const id = React.useId();
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  function move(from: number, step: number) {
    const next = (from + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      {...rest}
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[10px] bg-muted p-1",
        SQUIRCLE,
        className,
      )}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(i, 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(i, -1);
              }
            }}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-[6px] font-medium whitespace-nowrap transition-colors",
              size === "sm" ? "h-6 px-2.5" : "h-8 px-3",
              on
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
              SQUIRCLE,
              FOCUS,
            )}
            style={{ fontSize: size === "sm" ? TYPE.chip : TYPE.dense }}
          >
            {on && (
              <motion.span
                layoutId={`${id}-thumb`}
                aria-hidden="true"
                transition={reduce ? { duration: 0 } : SPRING}
                className={cn(
                  "absolute inset-0 rounded-[6px] bg-card shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_rgb(0_0_0/0.04)] dark:shadow-none",
                  SQUIRCLE,
                )}
              />
            )}
            <span className="relative">{o.label}</span>
            {o.hint && (
              <span
                className={cn(
                  "relative",
                  on ? "text-muted-foreground" : "text-muted-foreground",
                )}
                style={{ fontSize: TYPE.micro }}
              >
                {o.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
