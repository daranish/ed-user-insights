"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const SQUIRCLE = "[corner-shape:squircle]";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const CONTROL = {
  sm: "h-8 rounded-[9px] px-2.5 text-[13px]",
  md: "h-9 rounded-[10px] px-3 text-[13px]",
  lg: "h-10 rounded-[11px] px-3.5 text-[14px]",
} as const;

type ControlSize = keyof typeof CONTROL;

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

const VARIANT = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 dark:hover:bg-secondary/70",
  outline: "bg-card text-foreground ring-1 ring-inset ring-input hover:bg-accent",
  ghost: "text-foreground hover:bg-accent",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:bg-destructive/60 dark:hover:bg-destructive/70",
  link: "h-auto! px-0! text-foreground underline-offset-4 hover:underline",
} as const;

export type ButtonVariant = keyof typeof VARIANT;

const ICON_SIZE: Record<ControlSize, string> = {
  sm: "size-8 rounded-[9px]",
  md: "size-9 rounded-[10px]",
  lg: "size-10 rounded-[11px]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** How much attention the action deserves. Default `primary`. */
  variant?: ButtonVariant;
  /** Matches Input and Select of the same size. Default `md`. */
  size?: ControlSize;
  /** Square, for a single icon. Give it an `aria-label` — or use IconButton, which requires one. */
  icon?: boolean;
  /** Shows a spinner in place of the leading icon and marks the button busy. */
  loading?: boolean;
  /** Render the child element (a link, say) with the button's styling instead of a `<button>`. */
  asChild?: boolean;
  /** `rounded` is the squircle that matches inputs; `pill` is fully round, for marketing pages and toolbars of pills. Default `rounded`. */
  shape?: "rounded" | "pill";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    icon = false,
    loading = false,
    asChild = false,
    shape = "rounded",
    disabled,
    className,
    children,
    onClick,
    type,
    ...rest
  },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  const busy = loading && !asChild;

  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? "button")}
      data-variant={variant}
      data-shape={shape}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      disabled={disabled}
      onClick={busy ? (e: React.MouseEvent<HTMLButtonElement>) => e.preventDefault() : onClick}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 font-medium whitespace-nowrap select-none",
        "transition-[background-color,color,box-shadow,opacity] duration-150",
        "disabled:pointer-events-none disabled:opacity-50 aria-disabled:cursor-progress",
        "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        icon ? ICON_SIZE[size] : CONTROL[size],
        VARIANT[variant],
        FOCUS,
        shape === "pill" ? "rounded-full" : SQUIRCLE,
        className,
      )}
      {...rest}
    >
      {asChild ? (
        children
      ) : (
        <>
          {busy && <Loader2 aria-hidden className="motion-safe:animate-spin" />}
          {busy && icon ? null : children}
        </>
      )}
    </Comp>
  );
});

export interface IconButtonProps extends Omit<ButtonProps, "icon" | "aria-label"> {
  /** Required: an icon-only button has no other name. Also shown as the tooltip text by callers. */
  label: string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = "ghost", ...rest },
  ref,
) {
  return <Button ref={ref} icon variant={variant} aria-label={label} {...rest} />;
});

export default Button;
