"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
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

type Look = "segmented" | "underline";
const LookContext = React.createContext<Look>("segmented");

export const Tabs = TabsPrimitive.Root;

export interface TabsListProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  variant?: Look;
}

export const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  function TabsList({ className, variant = "segmented", ...props }, ref) {
    return (
      <LookContext.Provider value={variant}>
        <TabsPrimitive.List
          ref={ref}
          data-variant={variant}
          className={cn(
            "inline-flex items-center",
            variant === "segmented"
              ? cn("h-9 gap-0.5 rounded-[10px] bg-foreground/[0.06] p-1 dark:bg-foreground/[0.08]", SQUIRCLE)
              : "h-10 w-full gap-5 border-b border-border",
            className,
          )}
          {...props}
        />
      </LookContext.Provider>
    );
  },
);

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  const look = React.useContext(LookContext);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-1.5 text-[13px] font-medium whitespace-nowrap transition-[color,background-color,box-shadow] duration-150",
        "hover:text-foreground disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
        look === "segmented"
          ? cn(
              "h-full rounded-[7px] px-2.5 text-foreground/70",
              "data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_rgb(0_0_0/0.04)]",
              "dark:data-[state=active]:bg-foreground/12 dark:data-[state=active]:shadow-none",
              SQUIRCLE,
            )
          : cn(
              "relative -mb-px h-full border-b-2 border-transparent px-0.5 text-muted-foreground",
              "data-[state=active]:border-primary data-[state=active]:text-foreground",
            ),
        FOCUS,
        className,
      )}
      {...props}
    />
  );
});

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return <TabsPrimitive.Content ref={ref} className={cn("mt-3 outline-none", FOCUS, "rounded-[10px]", className)} {...props} />;
});

export default Tabs;
