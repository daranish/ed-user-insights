"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { useFieldProps } from "@/components/ui/field";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

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

const SIZE = {
  sm: { root: "h-4 w-7 p-[2px]", thumb: "size-3 data-[state=checked]:translate-x-3" },
  md: { root: "h-5 w-[34px] p-[3px]", thumb: "size-[14px] data-[state=checked]:translate-x-[14px]" },
  lg: { root: "h-6 w-10 p-[3px]", thumb: "size-[18px] data-[state=checked]:translate-x-4" },
} as const;

export interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  size?: ControlSize;
}

export const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitive.Root>, SwitchProps>(
  function Switch({ className, size = "md", ...props }, ref) {
    const fieldProps = useFieldProps(props);
    return (
      <SwitchPrimitive.Root
        ref={ref}
        className={cn(
          "peer inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150",
          "bg-foreground/15 hover:bg-foreground/20 data-[state=checked]:bg-primary data-[state=checked]:hover:bg-primary/90",
          "disabled:cursor-not-allowed disabled:opacity-50",
          FOCUS,
          "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          SIZE[size].root,
          className,
        )}
        {...fieldProps}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "pointer-events-none block rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-transform duration-150 ease-out",
            "dark:data-[state=checked]:bg-primary-foreground",
            SIZE[size].thumb,
          )}
        />
      </SwitchPrimitive.Root>
    );
  },
);

export default Switch;
