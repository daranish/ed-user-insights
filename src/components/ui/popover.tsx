"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const SQUIRCLE = "[corner-shape:squircle]";

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

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {  inline?: boolean }
>(function PopoverContent({ className, align = "center", sideOffset = 6, inline = false, style, ...props }, ref) {
  const Wrap = inline ? React.Fragment : PopoverPrimitive.Portal;
  return (
    <Wrap>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        style={{ zIndex: LAYER.popover, ...style }}
        className={cn(
          "w-72 rounded-[18px] bg-popover p-3.5 text-popover-foreground shadow-float ring-1 ring-border outline-none",
          "motion-safe:data-[state=open]:animate-pop-in motion-safe:data-[state=closed]:animate-pop-out",
          "data-[side=top]:[--pop-y:4px]",
          SQUIRCLE,
          className,
        )}
        {...props}
      />
    </Wrap>
  );
});

export default Popover;
