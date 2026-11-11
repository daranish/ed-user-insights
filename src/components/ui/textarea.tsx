"use client";

import * as React from "react";
import { useFieldProps } from "@/components/ui/field";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const SQUIRCLE = "[corner-shape:squircle]";

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

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Grow with the content. Default true. */
  autoGrow?: boolean;
  /** Rows before it starts scrolling when `autoGrow` is on. Default 8. */
  maxRows?: number;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { autoGrow = true, rows = 3, maxRows = 8, maxLength, className, onChange, ...props },
  ref,
) {
  const fieldProps = useFieldProps(props);
  const el = React.useRef<HTMLTextAreaElement>(null);
  React.useImperativeHandle(ref, () => el.current as HTMLTextAreaElement);
  const [length, setLength] = React.useState(() => String(props.value ?? props.defaultValue ?? "").length);
  const counterId = React.useId();

  const fit = React.useCallback(() => {
    const t = el.current;
    if (!t || !autoGrow) return;
    const cs = getComputedStyle(t);
    const line = parseFloat(cs.lineHeight) || 20;
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, line * maxRows + pad)}px`;
  }, [autoGrow, maxRows]);

  React.useLayoutEffect(() => {
    fit();
    if (props.value !== undefined) setLength(String(props.value).length);
  }, [fit, props.value]);

  const near = maxLength !== undefined && length >= maxLength * 0.8;

  return (
    <div className="relative">
      <textarea
        ref={el}
        rows={rows}
        maxLength={maxLength}
        onChange={(e) => {
          setLength(e.target.value.length);
          fit();
          onChange?.(e);
        }}
        className={cn(
          "block w-full min-w-0 resize-none rounded-[10px] px-3 py-2 text-[13px] leading-[1.5]",
          !autoGrow && "resize-y",
          near && "pb-6",
          FIELD,
          SQUIRCLE,
          className,
        )}
        {...fieldProps}
        aria-describedby={[fieldProps["aria-describedby"], near ? counterId : null].filter(Boolean).join(" ") || undefined}
      />
      {near && (
        <span
          id={counterId}
          aria-live="polite"
          className={cn(
            "pointer-events-none absolute right-2.5 bottom-1.5 text-[11px] tabular-nums",
            length >= maxLength! ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {maxLength! - length} left
        </span>
      )}
    </div>
  );
});

export default Textarea;
