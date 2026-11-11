"use client";

import * as React from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarDays, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

interface BaseProps {
  placeholder?: string;
  size?: ControlSize;
  disabled?: boolean;
  clearable?: boolean;
  /** date-fns format for the button text. Default "d MMM yyyy". */
  displayFormat?: string;
  /** Dates that cannot be picked: `{ before: new Date() }`, `[{ dayOfWeek: [0, 6] }]`… */
  disabledDays?: React.ComponentProps<typeof Calendar>["disabled"];
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

function Trigger({
  text,
  empty,
  size,
  onClear,
  className,
  ...props
}: {
  text: string;
  empty: boolean;
  size: ControlSize;
  onClear?: () => void;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <div className="relative w-full">
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full min-w-0 cursor-pointer items-center gap-2 text-left",
            CONTROL[size],
            FIELD,
            SQUIRCLE,
            empty && "text-muted-foreground",
            onClear && !empty && "pr-9",
            className,
          )}
          {...props}
        >
          <CalendarDays aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{text}</span>
        </button>
      </PopoverTrigger>
      {onClear && !empty && (
        <button
          type="button"
          aria-label="Clear date"
          onClick={onClear}
          className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-[6px] text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

export interface DatePickerProps extends BaseProps {
  value?: Date;
  defaultValue?: Date;
  onValueChange?: (date: Date | undefined) => void;
}

export function DatePicker({
  value,
  defaultValue,
  onValueChange,
  placeholder = "Pick a date",
  size = "md",
  disabled,
  clearable = false,
  displayFormat = "d MMM yyyy",
  disabledDays,
  className,
  ...aria
}: DatePickerProps) {
  const fieldProps = useFieldProps(aria);
  const [inner, setInner] = React.useState(defaultValue);
  const [open, setOpen] = React.useState(false);
  const date = value ?? inner;
  const set = (d: Date | undefined) => {
    if (value === undefined) setInner(d);
    onValueChange?.(d);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Trigger
        text={date ? format(date, displayFormat) : placeholder}
        empty={!date}
        size={size}
        disabled={disabled}
        onClear={clearable ? () => set(undefined) : undefined}
        className={className}
        {...fieldProps}
      />
      <PopoverContent align="start" aria-label="Choose a date" className="w-auto p-2">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          disabled={disabledDays}
          onSelect={(d) => {
            set(d);
            if (d) setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export interface DateRangePreset {
  label: string;
  range: () => DateRange;
}

export interface DateRangePickerProps extends BaseProps {
  value?: DateRange;
  defaultValue?: DateRange;
  onValueChange?: (range: DateRange | undefined) => void;
  /** Shortcuts shown beside the calendar: "Last 7 days", "This month". */
  presets?: DateRangePreset[];
  /** Months shown side by side on wider screens. Default 2. */
  numberOfMonths?: number;
}

export function DateRangePicker({
  value,
  defaultValue,
  onValueChange,
  placeholder = "Pick a range",
  size = "md",
  disabled,
  clearable = false,
  displayFormat = "d MMM yyyy",
  disabledDays,
  presets,
  numberOfMonths = 2,
  className,
  ...aria
}: DateRangePickerProps) {
  const fieldProps = useFieldProps(aria);
  const [inner, setInner] = React.useState(defaultValue);
  const [open, setOpen] = React.useState(false);
  const range = value ?? inner;
  const set = (r: DateRange | undefined) => {
    if (value === undefined) setInner(r);
    onValueChange?.(r);
  };

  const sameYear = range?.from && range?.to && range.from.getFullYear() === range.to.getFullYear();
  const text = range?.from
    ? range.to
      ? `${format(range.from, sameYear ? "d MMM" : displayFormat)} – ${format(range.to, displayFormat)}`
      : `${format(range.from, displayFormat)} – …`
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Trigger
        text={text}
        empty={!range?.from}
        size={size}
        disabled={disabled}
        onClear={clearable ? () => set(undefined) : undefined}
        className={className}
        {...fieldProps}
      />
      <PopoverContent align="start" aria-label="Choose a date range" className="flex w-auto flex-col gap-2 p-2 sm:flex-row">
        {presets && presets.length > 0 && (
          <div className="flex gap-1 overflow-x-auto border-border pb-2 sm:w-36 sm:flex-col sm:border-r sm:pr-2 sm:pb-0">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  set(p.range());
                  setOpen(false);
                }}
                className="cursor-pointer rounded-[8px] px-2.5 py-1.5 text-left text-[13px] whitespace-nowrap text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
        <Calendar
          mode="range"
          selected={range}
          defaultMonth={range?.from}
          numberOfMonths={numberOfMonths}
          disabled={disabledDays}
          onSelect={(r) => {
            set(r);
            if (r?.from && r?.to && r.from.getTime() !== r.to.getTime()) setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export type { DateRange };
export default DatePicker;
