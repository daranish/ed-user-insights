"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

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

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

const SIDE = {
  right: cn(
    "inset-y-2 right-2 w-[calc(100vw-16px)] max-w-[420px] rounded-[18px]",
    "motion-safe:data-[state=open]:animate-sheet-in-right motion-safe:data-[state=closed]:animate-sheet-out-right",
  ),
  left: cn(
    "inset-y-2 left-2 w-[calc(100vw-16px)] max-w-[420px] rounded-[18px]",
    "motion-safe:data-[state=open]:animate-sheet-in-left motion-safe:data-[state=closed]:animate-sheet-out-left",
  ),
  bottom: cn(
    "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-[20px]",
    "motion-safe:data-[state=open]:animate-sheet-in-bottom motion-safe:data-[state=closed]:animate-sheet-out-bottom",
  ),
} as const;

export interface DrawerContentProps extends Omit<React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, "title"> {
  side?: keyof typeof SIDE;
  title: React.ReactNode;
  description?: React.ReactNode;
  hideTitle?: boolean;
  /** Classes for the scrolling body. Pass "p-0" for content that brings its own padding, such as a Sidebar. */
  bodyClassName?: string;
  /** Draw the panel in place, with no scrim or portal: for docs and previews.
      Pair with `<Drawer open modal={false}>`. */
  inline?: boolean;
}

export const DrawerContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DrawerContentProps>(
  function DrawerContent({ side = "right", title, description, hideTitle, bodyClassName, inline = false, className, children, style, ...props }, ref) {
    const Wrap = inline ? React.Fragment : DialogPrimitive.Portal;
    return (
      <Wrap>
        {!inline && <DialogPrimitive.Overlay
          style={{ zIndex: LAYER.dialog }}
          onMouseDown={(e) => e.preventDefault()}
          className="fixed inset-0 bg-black/30 dark:bg-black/60 motion-safe:data-[state=open]:animate-fade-in motion-safe:data-[state=closed]:animate-fade-out"
        />}
        <DialogPrimitive.Content
          ref={ref}
          style={inline ? style : { zIndex: LAYER.dialog, ...style }}
          {...(inline
            ? {
                onOpenAutoFocus: (e: Event) => e.preventDefault(),
                onInteractOutside: (e: Event) => e.preventDefault(),
              }
            : null)}
          {...(description ? null : { "aria-describedby": props["aria-describedby"] })}
          className={cn(
            "flex flex-col bg-card text-card-foreground shadow-overlay ring-1 ring-border outline-none [corner-shape:squircle]",
            inline
              ? side === "bottom"
                ? "relative w-full rounded-t-[20px] motion-safe:data-[state=open]:animate-sheet-in-bottom"
                : "relative h-full w-full rounded-[18px] motion-safe:data-[state=open]:animate-fade-in"
              : cn("fixed", SIDE[side]),
            className,
          )}
          {...props}
        >
          {side === "bottom" && <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-foreground/15" />}
          <div className={cn("flex shrink-0 items-start justify-between gap-4 px-5 pt-5 pb-3", hideTitle && "sr-only")}>
            <div className="grid gap-1">
              <DialogPrimitive.Title className="text-[15px] leading-snug font-medium tracking-[-0.01em]">{title}</DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="text-[13px] leading-relaxed text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className={cn(
                "-mt-1 -mr-1.5 grid size-8 shrink-0 cursor-pointer place-items-center rounded-[9px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                FOCUS,
              )}
            >
              <X className="size-4" aria-hidden />
            </DialogPrimitive.Close>
          </div>
          <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 pb-5", bodyClassName)}>{children}</div>
        </DialogPrimitive.Content>
      </Wrap>
    );
  },
);

export function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "sticky bottom-0 -mx-5 -mb-5 mt-5 flex flex-col-reverse gap-2 border-t border-border bg-card px-5 py-3.5 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

export default Drawer;
