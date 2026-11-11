"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
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

const ProviderPresent = React.createContext(false);

export function TooltipProvider({
  delayDuration = 400,
  skipDelayDuration = 500,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <ProviderPresent.Provider value={true}>
      <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={skipDelayDuration} {...props} />
    </ProviderPresent.Provider>
  );
}

export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent({ className, sideOffset = 6, style, ...props }, ref) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        collisionPadding={12}
        style={{ zIndex: 90, ...style }}
        className={cn(
          "pointer-events-none rounded-[7px] bg-primary px-2 py-1 text-[12px] leading-snug font-medium whitespace-nowrap text-primary-foreground",
          "shadow-[0_8px_20px_-8px_rgb(0_0_0/0.4)]",
          "motion-safe:data-[state=delayed-open]:animate-pop-in motion-safe:data-[state=instant-open]:animate-fade-in motion-safe:data-[state=closed]:animate-fade-out",
          "data-[side=bottom]:[--pop-y:-3px] data-[side=top]:[--pop-y:3px]",
          SQUIRCLE,
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
});

export interface TooltipProps {
  /** The label. Keep it to a few words — it is a name, not documentation. */
  label: React.ReactNode;
  /** The shortcut, shown dimmed after the label: "Zoom in ⌘+". */
  keys?: string;
  side?: "top" | "bottom" | "left" | "right";
  /** Delay before the first tooltip in a group, in ms. Used when no provider is present. */
  delay?: number;
  /** Start shown, until the pointer leaves it: for docs and previews. */
  defaultOpen?: boolean;
  children: React.ReactElement;
}

export function Tooltip({ label, keys, side = "top", delay = 400, defaultOpen, children }: TooltipProps) {
  const hasProvider = React.useContext(ProviderPresent);
  const tip = (
    <TooltipPrimitive.Root defaultOpen={defaultOpen}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipContent side={side}>
        {label}
        {keys && <span className="ml-1.5 opacity-70">{keys}</span>}
      </TooltipContent>
    </TooltipPrimitive.Root>
  );
  return hasProvider ? tip : <TooltipProvider delayDuration={delay}>{tip}</TooltipProvider>;
}

export default Tooltip;
