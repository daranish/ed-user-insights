import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
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

const TONE = {
  neutral: "bg-muted text-foreground/80",
  primary: "bg-primary text-primary-foreground",
  outline: "text-foreground/80 ring-1 ring-inset ring-border",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  destructive: "bg-destructive-soft text-destructive dark:text-[color-mix(in_oklab,var(--destructive)_72%,white)]",
  info: "bg-info-soft text-info",
} as const;

const DOT: Record<keyof typeof TONE, string> = {
  neutral: "bg-muted-foreground",
  primary: "bg-primary-foreground",
  outline: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning-fill",
  destructive: "bg-destructive",
  info: "bg-info",
};

export type BadgeTone = keyof typeof TONE;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: "sm" | "md";
  /** A leading dot in the tone's colour. */
  dot?: boolean;
  /** Render the child (a link, say) with badge styling. */
  asChild?: boolean;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { tone = "neutral", size = "md", dot = false, asChild = false, className, children, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp
      ref={ref}
      data-tone={tone}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 font-medium whitespace-nowrap",
        size === "sm" ? "h-[18px] rounded-[6px] px-1.5 text-[11px]" : "h-[21px] rounded-[7px] px-2 text-[12px]",
        "[&_svg]:size-3 [&_svg]:shrink-0",
        TONE[tone],
        SQUIRCLE,
        className,
      )}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {dot && <span aria-hidden className={cn("size-1.5 rounded-full", DOT[tone])} />}
          {children}
        </>
      )}
    </Comp>
  );
});

export default Badge;
