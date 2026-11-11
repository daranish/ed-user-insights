"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
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

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(function Label({ className, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(
        "text-[13px] leading-none font-medium text-foreground select-none",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});

interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
}

const FieldContext = React.createContext<FieldContextValue | null>(null);

export function useFieldProps<T extends { id?: string; "aria-describedby"?: string; "aria-invalid"?: unknown; required?: boolean }>(
  props: T,
): T {
  const field = React.useContext(FieldContext);
  if (!field) return props;
  return {
    ...props,
    id: props.id ?? field.id,
    "aria-describedby": [field.describedBy, props["aria-describedby"]].filter(Boolean).join(" ") || undefined,
    "aria-invalid": props["aria-invalid"] ?? (field.invalid || undefined),
    required: props.required ?? (field.required || undefined),
  };
}

export interface FieldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  label: React.ReactNode;
  /** One line under the control. Replaced by `error` when there is one. */
  hint?: React.ReactNode;
  /** Marks the control invalid and is announced with it. */
  error?: React.ReactNode;
  /** Adds "Optional" beside the label; the rarer case gets the mark. */
  optional?: boolean;
  required?: boolean;
  /** Put the label beside the control instead of above — for checkboxes and switches. */
  inline?: boolean;
  children: React.ReactNode;
}

export function Field({
  label,
  hint,
  error,
  optional,
  required = false,
  inline = false,
  className,
  children,
  ...rest
}: FieldProps) {
  const id = React.useId();
  const msgId = `${id}-msg`;
  const message = error ?? hint;
  const value = React.useMemo<FieldContextValue>(
    () => ({ id, describedBy: message ? msgId : undefined, invalid: Boolean(error), required }),
    [id, msgId, message, error, required],
  );

  const labelEl = (
    <Label htmlFor={id} className="flex items-center gap-1.5">
      {label}
      {optional && <span className="font-normal text-muted-foreground">Optional</span>}
    </Label>
  );

  return (
    <FieldContext.Provider value={value}>
      {inline ? (
        <div className={cn("grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-1", className)} {...rest}>
          {children}
          {labelEl}
          {message && (
            <p id={msgId} className={cn("col-start-2 text-[12px] leading-snug", error ? "text-destructive" : "text-muted-foreground")}>
              {message}
            </p>
          )}
        </div>
      ) : (
        <div className={cn("grid gap-1.5", className)} {...rest}>
          {labelEl}
          {children}
          {message && (
            <p id={msgId} className={cn("text-[12px] leading-snug", error ? "text-destructive" : "text-muted-foreground")}>
              {message}
            </p>
          )}
        </div>
      )}
    </FieldContext.Provider>
  );
}

export default Field;
