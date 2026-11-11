"use client";

import * as React from "react";
import { OTPInput, REGEXP_ONLY_DIGITS, type SlotProps } from "input-otp";
import { useFieldProps } from "@/components/ui/field";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const SQUIRCLE = "[corner-shape:squircle]";

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

function OtpSlot({ char, hasFakeCaret, isActive, invalid }: SlotProps & { invalid?: boolean }) {
  return (
    <div
      className={cn(
        "relative grid aspect-square min-w-0 max-w-11 flex-1 place-items-center rounded-[10px] bg-card text-[16px] font-medium tabular-nums ring-1 ring-inset ring-input transition-shadow",
        isActive && "ring-2 ring-ring",
        invalid && "ring-destructive/60",
        SQUIRCLE,
      )}
    >
      {char}
      {hasFakeCaret && (
        <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="h-5 w-px bg-foreground motion-safe:animate-pulse" />
        </span>
      )}
    </div>
  );
}

export interface OtpInputProps {
  length?: number;
  value?: string;
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
  /** Digits only (default) or letters and digits. */
  alphanumeric?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  className?: string;
}

export function OtpInput({ length = 6, value, onChange, onComplete, alphanumeric = false, disabled, autoFocus, className, ...aria }: OtpInputProps) {
  const fieldProps = useFieldProps(aria);
  const [inner, setInner] = React.useState("");
  const v = value ?? inner;
  const invalid = fieldProps["aria-invalid"] === true;
  const split = length === 6 ? 3 : length === 8 ? 4 : 0;

  return (
    <OTPInput
      maxLength={length}
      value={v}
      onChange={(next: string) => {
        if (value === undefined) setInner(next);
        onChange?.(next);
      }}
      onComplete={onComplete}
      pattern={alphanumeric ? undefined : REGEXP_ONLY_DIGITS}
      inputMode={alphanumeric ? "text" : "numeric"}
      autoComplete="one-time-code"
      disabled={disabled}
      autoFocus={autoFocus}
      containerClassName={cn("flex w-full max-w-[320px] items-center justify-center gap-1.5 sm:gap-2 has-[:disabled]:opacity-50", className)}
      {...fieldProps}
      aria-label={fieldProps["aria-label"] ?? (fieldProps.id ? undefined : `${length}-digit code`)}
      render={({ slots }) => (
        <>
          {slots.map((slot, i) => (
            <React.Fragment key={i}>
              {split > 0 && i === split && <span aria-hidden className="h-0.5 w-2 shrink-0 rounded-full bg-border" />}
              <OtpSlot {...slot} invalid={invalid} />
            </React.Fragment>
          ))}
        </>
      )}
    />
  );
}

export default OtpInput;
