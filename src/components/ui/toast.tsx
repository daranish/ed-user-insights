"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const SQUIRCLE = "[corner-shape:squircle]";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const LAYER = {
  dialog: 70,
  popover: 75,
  toast: 80,
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

export type ToastTone = "neutral" | "success" | "warning" | "error" | "info";

export interface ToastOptions {
  description?: React.ReactNode;
  tone?: ToastTone;
  /** Milliseconds. Default 5000; errors default to staying until dismissed. */
  duration?: number;
  /** One follow-up action. Keep the label to a verb: "Undo", "Retry", "View". */
  action?: { label: string; onClick: () => void };
  id?: string;
}

interface ToastRecord extends ToastOptions {
  id: string;
  title: React.ReactNode;
  open: boolean;
}

let records: ToastRecord[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let counter = 0;

function push(title: React.ReactNode, opts: ToastOptions = {}) {
  const id = opts.id ?? `t${++counter}`;
  const next: ToastRecord = { ...opts, id, title, open: true };
  records = [...records.filter((r) => r.id !== id), next].slice(-4);
  emit();
  return id;
}

function close(id: string) {
  records = records.map((r) => (r.id === id ? { ...r, open: false } : r));
  emit();
  setTimeout(() => {
    records = records.filter((r) => r.id !== id || r.open);
    emit();
  }, 300);
}

export const toast = Object.assign(push, {
  success: (title: React.ReactNode, o?: ToastOptions) => push(title, { ...o, tone: "success" }),
  warning: (title: React.ReactNode, o?: ToastOptions) => push(title, { ...o, tone: "warning" }),
  error: (title: React.ReactNode, o?: ToastOptions) => push(title, { ...o, tone: "error" }),
  info: (title: React.ReactNode, o?: ToastOptions) => push(title, { ...o, tone: "info" }),
  dismiss: close,
});

function useToasts() {
  return React.useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => records,
    () => records,
  );
}

const ICON: Record<ToastTone, React.ReactNode> = {
  neutral: null,
  success: <CheckCircle2 className="size-4 text-success" aria-hidden />,
  warning: <AlertTriangle className="size-4 text-warning" aria-hidden />,
  error: <XCircle className="size-4 text-destructive" aria-hidden />,
  info: <Info className="size-4 text-info" aria-hidden />,
};

export interface ToasterProps {
  /** Where the stack sits. Default bottom-right; bottom-center on narrow screens. */
  position?: "bottom-right" | "bottom-center" | "top-right" | "top-center";
}

export function Toaster({ position = "bottom-right" }: ToasterProps) {
  const list = useToasts();
  const top = position.startsWith("top");

  return (
    <ToastPrimitive.Provider swipeDirection="right" label="Notifications">
      {list.map((t) => {
        const tone = t.tone ?? "neutral";
        return (
          <ToastPrimitive.Root
            key={t.id}
            open={t.open}
            onOpenChange={(o) => !o && close(t.id)}
            duration={t.duration ?? (tone === "error" ? Infinity : 5000)}
            type={tone === "error" ? "foreground" : "background"}
            className={cn(
              "group pointer-events-auto relative flex w-full items-start gap-2.5 rounded-[18px] bg-popover py-3 pr-9 pl-3.5 text-popover-foreground shadow-float ring-1 ring-border",
              "motion-safe:data-[state=open]:animate-toast-in motion-safe:data-[state=closed]:animate-toast-out",
              "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform",
              SQUIRCLE,
            )}
          >
            {ICON[tone] && <span className="mt-px shrink-0">{ICON[tone]}</span>}
            <div className="grid min-w-0 flex-1 gap-0.5">
              <ToastPrimitive.Title className="text-[13px] leading-snug font-medium">{t.title}</ToastPrimitive.Title>
              {t.description && (
                <ToastPrimitive.Description className="text-[13px] leading-snug text-muted-foreground">
                  {t.description}
                </ToastPrimitive.Description>
              )}
              {t.action && (
                <ToastPrimitive.Action altText={t.action.label} asChild>
                  <button
                    type="button"
                    onClick={t.action.onClick}
                    className={cn(
                      "mt-1.5 w-fit cursor-pointer rounded-[7px] text-[13px] font-medium text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground",
                      FOCUS,
                    )}
                  >
                    {t.action.label}
                  </button>
                </ToastPrimitive.Action>
              )}
            </div>
            <ToastPrimitive.Close
              aria-label="Dismiss"
              className={cn(
                "absolute top-2.5 right-2.5 grid size-6 cursor-pointer place-items-center rounded-[7px] text-muted-foreground opacity-70 transition hover:bg-accent hover:text-foreground hover:opacity-100",
                FOCUS,
              )}
            >
              <X className="size-3.5" aria-hidden />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}
      <ToastPrimitive.Viewport
        style={{ zIndex: LAYER.toast }}
        className={cn(
          "pointer-events-none fixed flex w-[calc(100vw-32px)] max-w-[380px] flex-col gap-2 outline-none",
          top ? "top-4" : "bottom-4",
          position.endsWith("center") ? "left-1/2 -translate-x-1/2" : "right-4 max-sm:left-1/2 max-sm:right-auto max-sm:-translate-x-1/2",
          top ? "flex-col-reverse" : "",
        )}
      />
    </ToastPrimitive.Provider>
  );
}

export default Toaster;
