"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  OctagonAlert,
  X,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const SQUIRCLE = "[corner-shape:squircle]";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const SOFT = { type: "spring", stiffness: 300, damping: 30 } as const;

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

export type AlertTone =
  "neutral" | "info" | "success" | "warning" | "destructive";

const TONE: Record<
  AlertTone,
  { box: string; icon: string; Icon: React.ElementType }
> = {
  neutral: {
    box: "bg-muted/60 ring-border",
    icon: "text-muted-foreground",
    Icon: Info,
  },
  info: { box: "bg-info-soft ring-info/25", icon: "text-info", Icon: Info },
  success: {
    box: "bg-success-soft ring-success/25",
    icon: "text-success",
    Icon: CheckCircle2,
  },
  warning: {
    box: "bg-warning-soft ring-warning/30",
    icon: "text-warning",
    Icon: AlertTriangle,
  },
  destructive: {
    box: "bg-destructive-soft ring-destructive/25",
    icon: "text-destructive",
    Icon: OctagonAlert,
  },
};

export interface AlertProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  /** What kind of notice it is. Default `info`. */
  tone?: AlertTone;
  /** The headline, one short line. */
  title?: React.ReactNode;
  /** Replace the tone's icon, or pass `false` for none. */
  icon?: React.ReactNode | false;
  /** One action: a button or a link, shown under the text on small screens and beside it on wide ones. */
  action?: React.ReactNode;
  /** Adds a close button. Called after it is pressed. */
  onDismiss?: () => void;
  /** Label for the close button. Default "Dismiss". */
  dismissLabel?: string;
  /** Controls whether it shows. Leave it out and a dismissed alert hides itself. */
  open?: boolean;
  /** `sm` for tight spots: inside a card, under a field. Default `md`. */
  size?: "sm" | "md";
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  function Alert(
    {
      tone = "info",
      title,
      icon,
      action,
      onDismiss,
      dismissLabel = "Dismiss",
      open,
      size = "md",
      role,
      className,
      children,
      ...props
    },
    ref,
  ) {
    const reduce = useReducedMotion();
    const [inner, setInner] = React.useState(true);
    const shown = open ?? inner;
    const T = TONE[tone];
    const urgent = tone === "warning" || tone === "destructive";
    const sm = size === "sm";

    return (
      <AnimatePresence initial={false}>
        {shown && (
          <motion.div
            key="alert"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: -4 }}
            transition={reduce ? { duration: 0.12 } : SOFT}
            className="overflow-hidden"
          >
            <div
              ref={ref}
              role={role ?? (urgent ? "alert" : "status")}
              data-tone={tone}
              className={cn(
                "@container flex w-full gap-3 rounded-[12px] text-foreground ring-1 ring-inset",
                sm ? "px-3 py-2.5 text-[12.5px]" : "px-3.5 py-3 text-[13.5px]",
                T.box,
                SQUIRCLE,
                className,
              )}
              {...props}
            >
              {icon !== false && (
                <span
                  aria-hidden
                  className={cn(
                    "shrink-0 [&_svg]:shrink-0",
                    sm ? "mt-px [&_svg]:size-4" : "mt-0.5 [&_svg]:size-[18px]",
                    T.icon,
                  )}
                >
                  {icon ?? <T.Icon />}
                </span>
              )}

              <div className="flex min-w-0 flex-1 flex-col gap-2.5 @min-[520px]:flex-row @min-[520px]:items-center @min-[520px]:justify-between @min-[520px]:gap-4">
                <div className="min-w-0 leading-snug">
                  {title && <p className="m-0 font-medium">{title}</p>}
                  {children && (
                    <div
                      className={cn("text-muted-foreground", title && "mt-0.5")}
                    >
                      {children}
                    </div>
                  )}
                </div>
                {action && (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {action}
                  </div>
                )}
              </div>

              {onDismiss && (
                <button
                  type="button"
                  aria-label={dismissLabel}
                  onClick={() => {
                    if (open === undefined) setInner(false);
                    onDismiss();
                  }}
                  className={cn(
                    "-mt-0.5 -mr-1 grid size-7 shrink-0 cursor-pointer place-items-center self-start rounded-[8px] text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground",
                    FOCUS,
                    SQUIRCLE,
                  )}
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  },
);

export default Alert;
