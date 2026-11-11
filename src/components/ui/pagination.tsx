"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

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

export function pageItems(page: number, pageCount: number, siblings = 1): Array<number | "gap"> {
  const slots = siblings * 2 + 5;
  if (pageCount <= slots) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const left = Math.max(page - siblings, 1);
  const right = Math.min(page + siblings, pageCount);
  const showLeftGap = left > 3;
  const showRightGap = right < pageCount - 2;
  if (!showLeftGap) {
    const count = siblings * 2 + 3;
    return [...Array.from({ length: count }, (_, i) => i + 1), "gap", pageCount];
  }
  if (!showRightGap) {
    const count = siblings * 2 + 3;
    return [1, "gap", ...Array.from({ length: count }, (_, i) => pageCount - count + i + 1)];
  }
  return [1, "gap", ...Array.from({ length: right - left + 1 }, (_, i) => left + i), "gap", pageCount];
}

export interface PaginationProps extends Omit<React.HTMLAttributes<HTMLElement>, "onChange"> {
  /** 1-based. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Total rows — with `pageSize`, shows "41–60 of 473". */
  total?: number;
  pageSize?: number;
  /** Pages either side of the current one. Default 1. */
  siblings?: number;
  /** Hide the numbers and show "Page 3 of 24" — for narrow spaces. */
  compact?: boolean;
  /** What is being paged, for the nav's name: "Invoices". */
  label?: string;
}

const CELL = cn(
  "inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-[9px] px-2 text-[13px] font-medium tabular-nums transition-colors",
  "text-foreground/80 hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
  FOCUS,
  SQUIRCLE,
);

export function Pagination({
  page,
  pageCount,
  onPageChange,
  total,
  pageSize,
  siblings = 1,
  compact = false,
  label = "Pagination",
  className,
  ...rest
}: PaginationProps) {
  const reduce = useReducedMotion();
  const marker = React.useId();
  const last = React.useRef(page);
  const dir = page >= last.current ? 1 : -1;
  React.useEffect(() => {
    last.current = page;
  }, [page]);

  const go = (p: number) => onPageChange(Math.min(Math.max(1, p), Math.max(1, pageCount)));
  const from = total !== undefined && pageSize ? Math.min((page - 1) * pageSize + 1, total) : null;
  const to = total !== undefined && pageSize ? Math.min(page * pageSize, total) : null;
  const move = reduce ? { duration: 0 } : SPRING;
  const roll = reduce ? { duration: 0 } : { duration: 0.18, ease: [0.2, 0, 0, 1] as const };

  return (
    <nav aria-label={label} className={cn("flex flex-wrap items-center justify-between gap-3", className)} {...rest}>
      {from !== null ? (
        <p className="text-[13px] text-muted-foreground tabular-nums" aria-live="polite">
          {total === 0 ? "No results" : <><span className="text-foreground">{from}–{to}</span> of {total!.toLocaleString()}</>}
        </p>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-1">
        <button type="button" className={cn(CELL, "gap-1 pl-1.5")} onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="size-4" aria-hidden />
          <span className="max-sm:sr-only">Previous</span>
        </button>
        <span className={cn("px-2 text-[13px] text-muted-foreground tabular-nums", !compact && "sm:hidden")}>
          Page <span className="text-foreground">{page}</span> of {pageCount}
        </span>
        {!compact && (
          <ul className="flex items-center gap-1 max-sm:hidden">
            {pageItems(page, pageCount, siblings).map((it, i) =>
              it === "gap" ? (
                <li key={`slot-${i}`} aria-hidden className="grid h-8 w-6 place-items-center text-[13px] text-muted-foreground">
                  …
                </li>
              ) : (
                <li key={`slot-${i}`}>
                  <button
                    type="button"
                    onClick={() => go(it)}
                    aria-current={it === page ? "page" : undefined}
                    aria-label={`Page ${it}`}
                    className={cn(
                      CELL,
                      "relative isolate",
                      it === page && "text-primary-foreground hover:bg-transparent hover:text-primary-foreground",
                    )}
                  >
                    {it === page && (
                      <motion.span
                        layoutId={marker}
                        transition={move}
                        aria-hidden
                        className={cn("absolute inset-0 -z-10 rounded-[9px] bg-primary", SQUIRCLE)}
                      />
                    )}
                    <span className="inline-grid overflow-hidden">
                    <AnimatePresence initial={false} mode="popLayout" custom={dir}>
                      <motion.span
                        key={it}
                        custom={dir}
                        variants={{
                          enter: (d: number) => ({ y: reduce ? 0 : 10 * d, opacity: 0 }),
                          center: { y: 0, opacity: 1 },
                          exit: (d: number) => ({ y: reduce ? 0 : -10 * d, opacity: 0 }),
                        }}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={roll}
                        className="inline-block"
                      >
                        {it}
                      </motion.span>
                    </AnimatePresence>
                    </span>
                  </button>
                </li>
              ),
            )}
          </ul>
        )}
        <button type="button" className={cn(CELL, "gap-1 pr-1.5")} onClick={() => go(page + 1)} disabled={page >= pageCount} aria-label="Next page">
          <span className="max-sm:sr-only">Next</span>
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}

export default Pagination;
