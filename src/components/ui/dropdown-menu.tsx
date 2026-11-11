"use client";

import * as React from "react";
import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight } from "lucide-react";
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

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
export const DropdownMenuGroup = MenuPrimitive.Group;
export const DropdownMenuSub = MenuPrimitive.Sub;
export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

const SURFACE = cn(
  "min-w-[180px] overflow-hidden rounded-[12px] bg-popover p-1 text-popover-foreground shadow-float ring-1 ring-border",
  "motion-safe:data-[state=open]:animate-pop-in motion-safe:data-[state=closed]:animate-pop-out",
  "data-[side=top]:[--pop-y:4px]",
  SQUIRCLE,
);

const ITEM =
  "relative flex cursor-pointer items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[13px] outline-none select-none " +
  "data-[highlighted]:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50 " +
  "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Content> & {  inline?: boolean }
>(function DropdownMenuContent({ className, sideOffset = 6, inline = false, style, ...props }, ref) {
  const Wrap = inline ? React.Fragment : MenuPrimitive.Portal;
  return (
    <Wrap>
      <MenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        collisionPadding={8}
        style={{ zIndex: LAYER.popover, ...style }}
        className={cn(SURFACE, className)}
        {...props}
      />
    </Wrap>
  );
});

export interface DropdownMenuItemProps extends React.ComponentPropsWithoutRef<typeof MenuPrimitive.Item> {
  /** Red text and icon. For actions that cannot be undone from here. */
  danger?: boolean;
  /** Shown dimmed on the right. Display only — wire the key yourself. */
  shortcut?: string;
  inset?: boolean;
}

export const DropdownMenuItem = React.forwardRef<React.ElementRef<typeof MenuPrimitive.Item>, DropdownMenuItemProps>(
  function DropdownMenuItem({ className, danger, shortcut, inset, children, ...props }, ref) {
    return (
      <MenuPrimitive.Item
        ref={ref}
        className={cn(
          ITEM,
          inset && "pl-8",
          danger && "text-destructive data-[highlighted]:bg-destructive-soft [&_svg]:text-destructive",
          className,
        )}
        {...props}
      >
        {children}
        {shortcut && <span className="ml-auto pl-4 text-[12px] tracking-wide text-muted-foreground">{shortcut}</span>}
      </MenuPrimitive.Item>
    );
  },
);

export const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.CheckboxItem>
>(function DropdownMenuCheckboxItem({ className, children, ...props }, ref) {
  return (
    <MenuPrimitive.CheckboxItem ref={ref} className={cn(ITEM, "pl-8", className)} {...props}>
      <span className="absolute left-2.5 flex size-4 items-center justify-center">
        <MenuPrimitive.ItemIndicator>
          <Check className="text-foreground!" />
        </MenuPrimitive.ItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
});

export const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.RadioItem>
>(function DropdownMenuRadioItem({ className, children, ...props }, ref) {
  return (
    <MenuPrimitive.RadioItem ref={ref} className={cn(ITEM, "pl-8", className)} {...props}>
      <span className="absolute left-2.5 flex size-4 items-center justify-center">
        <MenuPrimitive.ItemIndicator>
          <span className="block size-1.5 rounded-full bg-foreground" />
        </MenuPrimitive.ItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  );
});

export const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Label> & { inset?: boolean }
>(function DropdownMenuLabel({ className, inset, ...props }, ref) {
  return (
    <MenuPrimitive.Label
      ref={ref}
      className={cn("px-2.5 pt-2 pb-1 text-[12px] font-medium text-muted-foreground", inset && "pl-8", className)}
      {...props}
    />
  );
});

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Separator>
>(function DropdownMenuSeparator({ className, ...props }, ref) {
  return <MenuPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
});

export const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.SubTrigger>
>(function DropdownMenuSubTrigger({ className, children, ...props }, ref) {
  return (
    <MenuPrimitive.SubTrigger ref={ref} className={cn(ITEM, "data-[state=open]:bg-accent", className)} {...props}>
      {children}
      <ChevronRight className="ml-auto" aria-hidden />
    </MenuPrimitive.SubTrigger>
  );
});

export const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.SubContent>
>(function DropdownMenuSubContent({ className, style, ...props }, ref) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.SubContent
        ref={ref}
        style={{ zIndex: LAYER.popover, ...style }}
        className={cn(SURFACE, "[--pop-y:0px]", className)}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
});

export default DropdownMenu;
