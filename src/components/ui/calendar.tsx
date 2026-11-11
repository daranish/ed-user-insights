"use client";

import * as React from "react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

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

export type CalendarProps = DayPickerProps;

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-1 text-[13px]", className)}
      classNames={{
        months: "relative flex flex-col gap-4 sm:flex-row",
        month: "grid gap-3",
        month_caption: "flex h-8 items-center justify-center",
        caption_label: "text-[13px] font-semibold",
        nav: "absolute inset-x-0 top-0 flex h-8 items-center justify-between",
        button_previous:
          "grid size-8 cursor-pointer place-items-center rounded-[8px] text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        button_next:
          "grid size-8 cursor-pointer place-items-center rounded-[8px] text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        month_grid: "border-collapse",
        weekdays: "flex",
        weekday: "w-9 pb-1 text-center text-[11px] font-medium text-muted-foreground",
        week: "mt-0.5 flex",
        day: "group/day relative size-9 p-0 text-center",
        day_button: cn(
          "relative grid size-9 cursor-pointer place-items-center rounded-[9px] tabular-nums transition-colors",
          "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          "group-data-[selected=true]/day:bg-primary group-data-[selected=true]/day:text-primary-foreground",
          "group-data-[selected=true]/day:hover:bg-primary/90",
        ),
        today:
          "[&>button]:after:absolute [&>button]:after:bottom-1 [&>button]:after:left-1/2 [&>button]:after:size-1 [&>button]:after:-translate-x-1/2 [&>button]:after:rounded-full [&>button]:after:bg-current",
        selected: "",
        range_start: "bg-accent rounded-l-[9px]",
        range_middle: "bg-accent [&>button]:rounded-none [&>button]:bg-transparent! [&>button]:text-foreground!",
        range_end: "bg-accent rounded-r-[9px]",
        outside: "text-muted-foreground",
        disabled: "text-muted-foreground/40 [&>button]:cursor-not-allowed [&>button]:hover:bg-transparent",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? <ChevronLeft className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />,
      }}
      {...props}
    />
  );
}

export default Calendar;
