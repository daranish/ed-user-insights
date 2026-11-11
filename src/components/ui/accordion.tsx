"use client";

import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
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

type Variant = "flat" | "card";
const VariantContext = React.createContext<Variant>("flat");

export type AccordionProps = React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root> & { variant?: Variant };

export const Accordion = React.forwardRef<React.ElementRef<typeof AccordionPrimitive.Root>, AccordionProps>(
  function Accordion({ className, variant = "flat", ...props }, ref) {
    return (
      <VariantContext.Provider value={variant}>
        <AccordionPrimitive.Root
          ref={ref as never}
          className={cn(
            "w-full",
            variant === "card" && cn("divide-y divide-border rounded-[18px] bg-card px-4 ring-1 ring-border", SQUIRCLE),
            variant === "flat" && "divide-y divide-border border-y border-border",
            className,
          )}
          {...(props as React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root>)}
        />
      </VariantContext.Provider>
    );
  },
);

export interface AccordionItemProps extends Omit<React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>, "title"> {
  title: React.ReactNode;
  /** A short line under the title, visible while closed. */
  subtitle?: React.ReactNode;
  /** Heading level for the title. Default 3. */
  level?: 2 | 3 | 4 | 5 | 6;
}

export const AccordionItem = React.forwardRef<React.ElementRef<typeof AccordionPrimitive.Item>, AccordionItemProps>(
  function AccordionItem({ className, title, subtitle, level = 3, children, ...props }, ref) {
    const H = `h${level}` as "h3";
    return (
      <AccordionPrimitive.Item ref={ref} className={cn("group", className)} {...props}>
        <AccordionPrimitive.Header asChild>
          <H className="flex">
            <AccordionPrimitive.Trigger
              className={cn(
                "flex flex-1 cursor-pointer items-start justify-between gap-4 rounded-[8px] py-3.5 text-left",
                "text-[14px] font-medium text-foreground transition-colors hover:text-foreground/80",
                "disabled:cursor-not-allowed disabled:opacity-50",
                FOCUS,
              )}
            >
              <span className="grid gap-0.5">
                {title}
                {subtitle && <span className="text-[13px] font-normal text-muted-foreground">{subtitle}</span>}
              </span>
              <ChevronDown
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
              />
            </AccordionPrimitive.Trigger>
          </H>
        </AccordionPrimitive.Header>
        <AccordionPrimitive.Content
          className={cn(
            "overflow-hidden text-[13px] leading-relaxed text-muted-foreground",
            "motion-safe:data-[state=open]:animate-accordion-down motion-safe:data-[state=closed]:animate-accordion-up",
          )}
        >
          <div className="pb-4">{children}</div>
        </AccordionPrimitive.Content>
      </AccordionPrimitive.Item>
    );
  },
);

export default Accordion;
