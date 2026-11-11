"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useFieldProps } from "@/components/ui/field";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const SQUIRCLE = "[corner-shape:squircle]";

const CONTROL = {
  sm: "h-8 rounded-[9px] px-2.5 text-[13px]",
  md: "h-9 rounded-[10px] px-3 text-[13px]",
  lg: "h-10 rounded-[11px] px-3.5 text-[14px]",
} as const;

type ControlSize = keyof typeof CONTROL;

const FIELD =
  "bg-card text-foreground ring-1 ring-inset ring-input outline-none transition-[box-shadow,background-color] " +
  "placeholder:text-muted-foreground hover:ring-foreground/25 " +
  "focus-visible:ring-2 focus-visible:ring-ring " +
  "aria-invalid:ring-destructive/60 aria-invalid:focus-visible:ring-destructive/50 " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:ring-input";

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

export interface SelectProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root> {
  placeholder?: string;
  size?: ControlSize;
  /** Classes for the trigger. */
  className?: string;
  /** Accessible name when there is no Field or label around it. */
  "aria-label"?: string;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  children: React.ReactNode;
}

export function Select({ placeholder, size = "md", className, children, ...props }: SelectProps) {
  const { id, "aria-describedby": describedBy, "aria-invalid": invalid, "aria-label": ariaLabel, required, ...root } =
    useFieldProps(props);
  return (
    <SelectPrimitive.Root required={required} {...root}>
      <SelectTrigger
        id={id}
        size={size}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        aria-label={ariaLabel}
        className={className}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </SelectPrimitive.Root>
  );
}

export const SelectRoot = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export const SelectGroup = SelectPrimitive.Group;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & { size?: ControlSize }
>(function SelectTrigger({ className, size = "md", children, ...props }, ref) {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 text-left",
        "data-[placeholder]:text-muted-foreground [&>span]:truncate",
        CONTROL[size],
        FIELD,
        SQUIRCLE,
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(function SelectContent({ className, children, position = "popper", sideOffset = 6, ...props }, ref) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        sideOffset={sideOffset}
        style={{ zIndex: LAYER.popover }}
        className={cn(
          "relative max-h-[min(var(--radix-select-content-available-height),320px)] min-w-[max(var(--radix-select-trigger-width),160px)] overflow-hidden",
          "rounded-[12px] bg-popover text-popover-foreground shadow-float ring-1 ring-border",
          "motion-safe:data-[state=open]:animate-pop-in motion-safe:data-[state=closed]:animate-pop-out",
          "data-[side=top]:[--pop-y:4px]",
          SQUIRCLE,
          className,
        )}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex h-6 cursor-default items-center justify-center text-muted-foreground">
          <ChevronUp className="size-4" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex h-6 cursor-default items-center justify-center text-muted-foreground">
          <ChevronDown className="size-4" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

export interface SelectItemProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> {
  /** A second line, for when the names alone do not tell options apart. */
  hint?: React.ReactNode;
}

export const SelectItem = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Item>, SelectItemProps>(
  function SelectItem({ className, children, hint, ...props }, ref) {
    return (
      <SelectPrimitive.Item
        ref={ref}
        className={cn(
          "relative flex w-full cursor-pointer items-start rounded-[8px] py-1.5 pr-8 pl-2.5 text-[13px] outline-none select-none",
          "data-[highlighted]:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          className,
        )}
        {...props}
      >
        <span className="grid gap-0.5">
          <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
          {hint && <span className="text-[12px] text-foreground/65">{hint}</span>}
        </span>
        <span className="absolute top-2 right-2.5 flex size-4 items-center justify-center">
          <SelectPrimitive.ItemIndicator>
            <Check className="size-4" />
          </SelectPrimitive.ItemIndicator>
        </span>
      </SelectPrimitive.Item>
    );
  },
);

export const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(function SelectLabel({ className, ...props }, ref) {
  return (
    <SelectPrimitive.Label
      ref={ref}
      className={cn("px-2.5 pt-2 pb-1 text-[12px] font-semibold text-muted-foreground", className)}
      {...props}
    />
  );
});

export const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(function SelectSeparator({ className, ...props }, ref) {
  return <SelectPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
});

export default Select;
