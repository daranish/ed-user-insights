"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Check, ChevronsUpDown, Search } from "lucide-react";
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

export interface ComboboxOption {
  value: string;
  label: string;
  /** A second line, to tell same-named options apart. */
  hint?: string;
  /** Extra words that should match: an email for a person, a code for a country. */
  keywords?: string[];
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface Base {
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  size?: ControlSize;
  disabled?: boolean;
  /** Offer to create the typed text when nothing matches. */
  onCreate?: (text: string) => void;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

export type ComboboxProps = Base &
  (
    | { multiple?: false; value?: string; defaultValue?: string; onValueChange?: (value: string | undefined) => void }
    | { multiple: true; value?: string[]; defaultValue?: string[]; onValueChange?: (value: string[]) => void }
  );

export function Combobox(props: ComboboxProps) {
  const {
    options,
    placeholder = "Select…",
    searchPlaceholder = "Search",
    emptyText = "Nothing matches.",
    size = "md",
    disabled,
    onCreate,
    className,
    id,
    "aria-label": ariaLabel,
    "aria-describedby": describedBy,
    "aria-invalid": invalid,
  } = props;
  const field = useFieldProps({ id, "aria-describedby": describedBy, "aria-invalid": invalid });
  const multiple = props.multiple === true;
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [inner, setInner] = React.useState<string[]>(() => {
    const d = props.defaultValue;
    return d === undefined ? [] : Array.isArray(d) ? d : [d];
  });
  const selected: string[] =
    props.value === undefined ? inner : Array.isArray(props.value) ? props.value : props.value ? [props.value] : [];

  const commit = (next: string[]) => {
    if (props.value === undefined) setInner(next);
    if (props.multiple) props.onValueChange?.(next);
    else (props.onValueChange as ((v: string | undefined) => void) | undefined)?.(next[0]);
  };

  const pick = (v: string) => {
    if (multiple) {
      commit(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
      setQuery("");
    } else {
      commit(selected[0] === v ? [] : [v]);
      setOpen(false);
    }
  };

  const byValue = React.useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  const exact = options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase());

  const triggerText = multiple
    ? null
    : selected[0]
      ? (byValue.get(selected[0])?.label ?? selected[0])
      : placeholder;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            "flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 text-left",
            multiple && selected.length > 0 ? "h-auto! min-h-9 flex-wrap py-1 pl-1.5" : "",
            CONTROL[size],
            FIELD,
            SQUIRCLE,
            !multiple && !selected[0] && "text-muted-foreground",
            className,
          )}
          {...field}
        >
          {multiple ? (
            selected.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              <span className="flex flex-1 flex-wrap gap-1">
                {selected.map((v) => (
                  <span
                    key={v}
                    className="inline-flex h-6 items-center rounded-[7px] bg-muted px-2 text-[12px] font-medium text-foreground"
                  >
                    {byValue.get(v)?.label ?? v}
                  </span>
                ))}
              </span>
            )
          ) : (
            <span className="truncate">{triggerText}</span>
          )}
          <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" aria-label={ariaLabel ?? searchPlaceholder} className="w-[max(var(--radix-popover-trigger-width),220px)] p-0">
        <CommandPrimitive
          className="flex flex-col"
          filter={(value, search, keywords) => {
            const hay = `${value} ${(keywords ?? []).join(" ")}`.toLowerCase();
            return search
              .toLowerCase()
              .split(/\s+/)
              .every((w) => hay.includes(w))
              ? 1
              : 0;
          }}
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <CommandPrimitive.Input
              value={query}
              onValueChange={setQuery}
              placeholder={searchPlaceholder}
              onKeyDown={(e) => {
                if (multiple && e.key === "Backspace" && !query && selected.length) {
                  commit(selected.slice(0, -1));
                }
              }}
              className="h-10 w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          <CommandPrimitive.List className="max-h-64 overflow-y-auto p-1">
            {!(onCreate && query.trim()) && (
              <CommandPrimitive.Empty className="px-3 py-6 text-center text-[13px] text-muted-foreground">
                {emptyText}
              </CommandPrimitive.Empty>
            )}
            {options.map((o) => {
              const on = selected.includes(o.value);
              return (
                <CommandPrimitive.Item
                  key={o.value}
                  value={o.label}
                  keywords={[o.value, ...(o.keywords ?? []), o.hint ?? ""]}
                  disabled={o.disabled}
                  onSelect={() => pick(o.value)}
                  className={cn(
                    "relative flex cursor-pointer items-center gap-2.5 rounded-[8px] py-1.5 pr-8 pl-2.5 text-[13px] outline-none select-none",
                    "data-[selected=true]:bg-accent data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
                  )}
                >
                  {o.icon && <span className="flex shrink-0 [&_svg]:size-4">{o.icon}</span>}
                  <span className="grid min-w-0 gap-0.5">
                    <span className="truncate">{o.label}</span>
                    {o.hint && <span className="truncate text-[12px] text-foreground/65">{o.hint}</span>}
                  </span>
                  {on && <Check aria-hidden className="absolute right-2.5 size-4" />}
                </CommandPrimitive.Item>
              );
            })}
            {onCreate && query.trim() && !exact && (
              <CommandPrimitive.Item
                value={`__create__${query}`}
                forceMount
                onSelect={() => {
                  onCreate(query.trim());
                  setQuery("");
                }}
                className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[13px] outline-none data-[selected=true]:bg-accent"
              >
                Create <span className="font-medium">“{query.trim()}”</span>
              </CommandPrimitive.Item>
            )}
          </CommandPrimitive.List>
        </CommandPrimitive>
      </PopoverContent>
    </Popover>
  );
}

export default Combobox;
