"use client";

import * as React from "react";
import { Eye, EyeOff, Search, X } from "lucide-react";
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

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Matches Button and Select of the same size. Default `md`. */
  size?: ControlSize;
  /** Inside the well, before the text: an icon or a prefix like "$". */
  leading?: React.ReactNode;
  /** Inside the well, after the text: a unit, a shortcut hint, a button. */
  trailing?: React.ReactNode;
  /** Classes for the well when adornments are used; `className` goes on the input. */
  wrapperClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = "md", leading, trailing, className, wrapperClassName, type = "text", ...props },
  ref,
) {
  const fieldProps = useFieldProps(props);
  const inner = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(ref, () => inner.current as HTMLInputElement);

  if (!leading && !trailing) {
    return (
      <input
        ref={inner}
        type={type}
        className={cn("w-full min-w-0", CONTROL[size], FIELD, SQUIRCLE, "file:mr-2 file:border-0 file:bg-transparent file:font-medium", className)}
        {...fieldProps}
      />
    );
  }

  return (
    <div
      onPointerDown={(e) => {
        if (e.target !== inner.current && !(e.target as HTMLElement).closest("button")) {
          e.preventDefault();
          inner.current?.focus();
        }
      }}
      className={cn(
        "flex w-full min-w-0 cursor-text items-center gap-2 bg-card text-foreground ring-1 ring-inset ring-input transition-[box-shadow]",
        "hover:ring-foreground/25 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring",
        "has-[input[aria-invalid=true]]:ring-destructive/60 has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        CONTROL[size],
        SQUIRCLE,
        wrapperClassName,
      )}
    >
      {leading && <span className="flex shrink-0 items-center text-muted-foreground">{leading}</span>}
      <input
        ref={inner}
        type={type}
        className={cn(
          "h-full w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed",
          className,
        )}
        {...fieldProps}
      />
      {trailing && <span className="flex shrink-0 items-center text-muted-foreground">{trailing}</span>}
    </div>
  );
});

export interface PasswordInputProps extends Omit<InputProps, "type" | "trailing"> {}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(props, ref) {
  const [shown, setShown] = React.useState(false);
  return (
    <Input
      ref={ref}
      type={shown ? "text" : "password"}
      autoComplete={props.autoComplete ?? "current-password"}
      trailing={
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          className="-mr-1 grid size-6 cursor-pointer place-items-center rounded-[6px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {shown ? <EyeOff /> : <Eye />}
        </button>
      }
      {...props}
    />
  );
});

export interface SearchInputProps extends Omit<InputProps, "type" | "leading" | "value" | "defaultValue" | "onChange"> {
  value?: string;
  defaultValue?: string;
  /** Called with the text on every keystroke, and with "" when cleared. */
  onValueChange?: (value: string) => void;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, defaultValue = "", onValueChange, onKeyDown, placeholder = "Search", ...props },
  ref,
) {
  const [inner, setInner] = React.useState(defaultValue);
  const current = value ?? inner;
  const set = (v: string) => {
    if (value === undefined) setInner(v);
    onValueChange?.(v);
  };
  const local = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(ref, () => local.current as HTMLInputElement);

  return (
    <Input
      ref={local}
      type="search"
      role="searchbox"
      placeholder={placeholder}
      value={current}
      onChange={(e) => set(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && current) {
          e.preventDefault();
          set("");
        }
        onKeyDown?.(e);
      }}
      leading={<Search />}
      trailing={
        current ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              set("");
              local.current?.focus();
            }}
            className="-mr-1 grid size-6 cursor-pointer place-items-center rounded-[6px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X />
          </button>
        ) : undefined
      }
      className="[&::-webkit-search-cancel-button]:hidden"
      {...props}
    />
  );
});

export default Input;
