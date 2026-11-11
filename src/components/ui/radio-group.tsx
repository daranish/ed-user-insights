"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { useFieldProps } from "@/components/ui/field";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const SQUIRCLE = "[corner-shape:squircle]";

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

type Variant = "plain" | "card";
const VariantContext = React.createContext<Variant>("plain");

const ArrowContext = React.createContext<React.MutableRefObject<number> | null>(null);
const ARROWS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

export interface RadioGroupProps extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> {
  variant?: Variant;
}

export const RadioGroup = React.forwardRef<React.ElementRef<typeof RadioGroupPrimitive.Root>, RadioGroupProps>(
  function RadioGroup({ className, variant = "plain", ...props }, ref) {
    const fieldProps = useFieldProps(props);
    const arrow = React.useRef(0);
    React.useEffect(() => {
      const down = (e: KeyboardEvent) => {
        arrow.current = ARROWS.includes(e.key) ? performance.now() : 0;
      };
      window.addEventListener("keydown", down, true);
      return () => window.removeEventListener("keydown", down, true);
    }, []);
    return (
      <ArrowContext.Provider value={arrow}>
      <VariantContext.Provider value={variant}>
        <RadioGroupPrimitive.Root
          ref={ref}
          className={cn("grid", variant === "card" ? "gap-2" : "gap-2.5", className)}
          {...fieldProps}
        />
      </VariantContext.Provider>
      </ArrowContext.Provider>
    );
  },
);

export interface RadioGroupItemProps
  extends Omit<React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>, "children"> {
  /** The option's name. Omit it to render the bare dot and label it yourself. */
  label?: React.ReactNode;
  /** One line of consequence under the label. */
  hint?: React.ReactNode;
  /** Right-aligned detail in the card variant: a price, a count. */
  aside?: React.ReactNode;
}

function Dot() {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-4 shrink-0 place-items-center rounded-full bg-card ring-1 ring-inset ring-input transition-colors",
        "group-hover:ring-foreground/35 group-data-[state=checked]:bg-primary group-data-[state=checked]:ring-primary",
      )}
    >
      <span className="size-1.5 scale-0 rounded-full bg-primary-foreground transition-transform duration-150 group-data-[state=checked]:scale-100" />
    </span>
  );
}

export const RadioGroupItem = React.forwardRef<React.ElementRef<typeof RadioGroupPrimitive.Item>, RadioGroupItemProps>(
  function RadioGroupItem({ className, label, hint, aside, onFocus, ...props }, ref) {
    const variant = React.useContext(VariantContext);
    const arrow = React.useContext(ArrowContext);
    const hintId = React.useId();
    const handleFocus = (e: React.FocusEvent<HTMLButtonElement>) => {
      onFocus?.(e);
      const viaArrow = arrow && arrow.current > 0 && performance.now() - arrow.current < 400;
      if (viaArrow && e.currentTarget.getAttribute("aria-checked") !== "true") e.currentTarget.click();
    };

    if (!label) {
      return (
        <RadioGroupPrimitive.Item
          ref={ref}
          className={cn("group cursor-pointer rounded-full disabled:cursor-not-allowed disabled:opacity-50", FOCUS, className)}
          onFocus={handleFocus}
          {...props}
        >
          <Dot />
        </RadioGroupPrimitive.Item>
      );
    }

    return (
      <RadioGroupPrimitive.Item
        ref={ref}
        aria-describedby={hint ? hintId : undefined}
        onFocus={handleFocus}
        className={cn(
          "group flex cursor-pointer items-start gap-2.5 text-left disabled:cursor-not-allowed disabled:opacity-50",
          variant === "card"
            ? cn(
                "w-full rounded-[12px] bg-card px-3.5 py-3 ring-1 ring-inset ring-border transition-[box-shadow,background-color]",
                "hover:bg-accent/50 data-[state=checked]:ring-[1.5px] data-[state=checked]:ring-primary",
                SQUIRCLE,
              )
            : "rounded-[6px]",
          FOCUS,
          className,
        )}
        {...props}
      >
        <span className="pt-px">
          <Dot />
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="text-[13px] leading-[1.3] font-medium text-foreground">{label}</span>
          {hint && (
            <span id={hintId} className="text-[12px] leading-snug text-muted-foreground">
              {hint}
            </span>
          )}
        </span>
        {aside && variant === "card" && (
          <span className="shrink-0 text-[13px] font-medium tabular-nums text-foreground">{aside}</span>
        )}
      </RadioGroupPrimitive.Item>
    );
  },
);

export default RadioGroup;
