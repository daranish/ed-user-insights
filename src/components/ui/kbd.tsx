"use client";

import * as React from "react";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const FONT_STACK =
  'var(--font-sans, "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif)';

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

const SPOKEN: Record<string, string> = {
  "⌘": "Command",
  "⌥": "Option",
  "⇧": "Shift",
  "⌃": "Control",
  "↵": "Enter",
  "⏎": "Enter",
  "⌫": "Backspace",
  "⎋": "Escape",
  "⇥": "Tab",
  "↑": "Up",
  "↓": "Down",
  "←": "Left",
  "→": "Right",
};

const MAC: Record<string, string> = { mod: "⌘", cmd: "⌘", command: "⌘", alt: "⌥", option: "⌥", shift: "⇧", ctrl: "⌃", control: "⌃" };
const OTHER: Record<string, string> = { mod: "Ctrl", cmd: "Ctrl", command: "Ctrl", alt: "Alt", option: "Alt", shift: "Shift", ctrl: "Ctrl", control: "Ctrl" };
const COMMON: Record<string, string> = {
  enter: "↵", return: "↵", esc: "Esc", escape: "Esc", backspace: "⌫", delete: "Del", tab: "Tab", space: "Space",
  up: "↑", down: "↓", left: "←", right: "→", arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→",
};

function useIsMac(enabled: boolean) {
  const [mac, setMac] = React.useState(false);
  React.useEffect(() => {
    if (!enabled || typeof navigator === "undefined") return;
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const p = nav.userAgentData?.platform ?? nav.platform ?? nav.userAgent;
    setMac(/mac|iphone|ipad|ipod/i.test(p));
  }, [enabled]);
  return mac;
}

function toKeys(keys: string | string[], mac: boolean, platformAware: boolean) {
  const list = Array.isArray(keys) ? keys : keys.split(/\s*\+\s*(?=.)/);
  return list.map((k) => {
    const low = k.toLowerCase();
    if (platformAware && (mac ? MAC[low] : OTHER[low])) return mac ? MAC[low] : OTHER[low];
    if (COMMON[low]) return COMMON[low];
    return k.length === 1 ? k.toUpperCase() : k;
  });
}

const SIZE = {
  sm: "h-[18px] min-w-[18px] px-1 text-[10.5px] rounded-[5px]",
  md: "h-[22px] min-w-[22px] px-1.5 text-[11.5px] rounded-[6px]",
} as const;

const VARIANT = {
  default: "bg-card text-foreground/80 ring-1 ring-inset ring-border shadow-[inset_0_-1px_0_var(--color-border)]",
  outline: "text-foreground/75 ring-1 ring-inset ring-border",
  ghost: "bg-foreground/[0.06] text-foreground/75",
} as const;

export interface KbdProps extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  /** The shortcut: "mod+k", "shift+enter", or the keys as a list, ["⌘", "K"]. */
  keys: string | string[];
  /** Draw `mod` as ⌘ on a Mac and Ctrl elsewhere (and alt, shift, ctrl the same way). Default true. */
  platformAware?: boolean;
  /** sm for menus and tooltips, md for prose and settings. Default md. */
  size?: "sm" | "md";
  /** default is a keycap, outline a hairline only, ghost a soft fill for dark tooltips. */
  variant?: "default" | "outline" | "ghost";
  /** Drawn between keys. Default none: keycaps side by side read as a chord. Pass "+" or "then". */
  separator?: React.ReactNode;
}

export const Kbd = React.forwardRef<HTMLElement, KbdProps>(function Kbd(
  { keys, platformAware = true, size = "md", variant = "default", separator, className, style, ...rest },
  ref,
) {
  const mac = useIsMac(platformAware);
  const caps = toKeys(keys, mac, platformAware);
  const spoken = caps.map((k) => SPOKEN[k] ?? k).join(" ");

  return (
    <kbd
      ref={ref}
      {...rest}
      style={{ fontFamily: FONT_STACK, ...style }}
      className={cn("inline-flex items-center gap-1 align-baseline font-normal not-italic", className)}
    >
      <span className="sr-only">{spoken}</span>
      {caps.map((k, i) => (
        <React.Fragment key={`${k}-${i}`}>
          {i > 0 && separator != null && (
            <span aria-hidden className="text-[11px] text-muted-foreground">
              {separator}
            </span>
          )}
          <kbd
            aria-hidden
            className={cn(
              "inline-flex items-center justify-center leading-none font-medium tabular-nums select-none",
              SQUIRCLE,
              SIZE[size],
              VARIANT[variant],
            )}
          >
            {k}
          </kbd>
        </React.Fragment>
      ))}
    </kbd>
  );
});

export default Kbd;
