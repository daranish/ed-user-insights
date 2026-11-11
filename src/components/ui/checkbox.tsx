"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { useFieldProps } from "@/components/ui/field";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

export interface CheckboxProps extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {}

export const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  function Checkbox({ className, ...props }, ref) {
    const fieldProps = useFieldProps(props);
    return (
      <CheckboxPrimitive.Root
        ref={ref}
        className={cn(
          "peer grid size-4 shrink-0 cursor-pointer place-items-center rounded-[5px] bg-card ring-1 ring-inset ring-input transition-colors",
          "hover:ring-foreground/35",
          "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:ring-primary",
          "data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground data-[state=indeterminate]:ring-primary",
          "aria-invalid:ring-destructive/70 disabled:cursor-not-allowed disabled:opacity-50",
          FOCUS,
          "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
        {...fieldProps}
      >
        <CheckboxPrimitive.Indicator className="grid place-items-center">
          {fieldProps.checked === "indeterminate" ? (
            <Minus className="size-3" strokeWidth={3} aria-hidden />
          ) : (
            <Check className="size-3" strokeWidth={3} aria-hidden />
          )}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    );
  },
);

export default Checkbox;
