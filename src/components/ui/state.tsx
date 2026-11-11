"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Inbox, Loader2 } from "lucide-react";
import { EmptyIllustration, type EmptyIllustrationName } from "@/components/ui/empty-states";
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

const ICON = {
  empty: Inbox,
  error: AlertTriangle,
  success: CheckCircle2,
  loading: Loader2,
} as const;

const TINT = {
  empty: "bg-muted text-muted-foreground",
  error: "bg-destructive-soft text-destructive",
  success: "bg-success-soft text-success",
  loading: "bg-muted text-muted-foreground",
} as const;

export type StateKind = keyof typeof ICON;

export interface StateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  kind?: StateKind;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Replace the default icon. */
  icon?: React.ReactNode;
  /** For an empty state: the drawn, gently animated scene to show (Empty States). Default "inbox"; "search" for no matches. */
  scene?: EmptyIllustrationName;
  /** The primary action — one. */
  action?: React.ReactNode;
  /** A quieter second action, a link to docs. */
  secondaryAction?: React.ReactNode;
  /** Draw a dashed frame — for an empty region inside a page. */
  framed?: boolean;
  size?: "sm" | "md";
}

export function State({
  kind = "empty",
  title,
  description,
  icon,
  scene,
  action,
  secondaryAction,
  framed = false,
  size = "md",
  className,
  ...rest
}: StateProps) {
  const Icon = ICON[kind];
  const live = kind === "error" ? { role: "alert" as const } : kind === "loading" ? { role: "status" as const, "aria-live": "polite" as const } : {};
  return (
    <div
      data-state-kind={kind}
      {...live}
      className={cn(
        "flex flex-col items-center text-center",
        size === "sm" ? "gap-2 px-4 py-6" : "gap-3 px-6 py-10",
        framed && cn("rounded-[14px] border border-dashed border-input", SQUIRCLE),
        className,
      )}
      {...rest}
    >
      {kind === "empty" && !icon ? (
        <EmptyIllustration name={scene ?? "inbox"} size={size === "sm" ? 112 : 148} />
      ) : (
        <span className={cn("grid place-items-center rounded-[12px]", size === "sm" ? "size-9" : "size-11", TINT[kind], SQUIRCLE)}>
          {icon ?? <Icon aria-hidden className={cn(size === "sm" ? "size-4" : "size-5", kind === "loading" && "motion-safe:animate-spin")} />}
        </span>
      )}
      <div className="grid max-w-[40ch] gap-1">
        <p className={cn("font-semibold text-foreground", size === "sm" ? "text-[13px]" : "text-[15px]")}>{title}</p>
        {description && <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {(action || secondaryAction) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Render lines of text-shaped bars. */
  lines?: number;
}

export function Skeleton({ className, lines, ...rest }: SkeletonProps) {
  if (lines) {
    return (
      <div aria-hidden className={cn("grid gap-2", className)} {...rest}>
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className="h-3 rounded-full bg-foreground/[0.07] motion-safe:animate-skeleton"
            style={{ width: i === lines - 1 && lines > 1 ? "62%" : "100%" }}
          />
        ))}
      </div>
    );
  }
  return <div aria-hidden className={cn("rounded-[8px] bg-foreground/[0.07] motion-safe:animate-skeleton", className)} {...rest} />;
}

export default State;
