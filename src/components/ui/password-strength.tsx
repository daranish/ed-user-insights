"use client";

import * as React from "react";
import { Check, Circle } from "lucide-react";
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

export interface PasswordRule {
  label: string;
  test: (v: string) => boolean;
}

export const DEFAULT_RULES: PasswordRule[] = [
  { label: "At least 12 characters", test: (v) => v.length >= 12 },
  { label: "Upper and lower case", test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { label: "A number or a symbol", test: (v) => /[\d\W_]/.test(v) },
];

export function scorePassword(v: string): number {
  if (!v) return 0;
  let s = 0;
  if (v.length >= 8) s++;
  if (v.length >= 12) s++;
  if (v.length >= 16) s++;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(v)).length;
  if (kinds >= 3) s++;
  if (/^(.)\1+$/.test(v) || /^(password|qwerty|123456|letmein)/i.test(v)) s = Math.min(s, 1);
  return Math.min(4, s);
}

const WORDS = ["Too short", "Weak", "Fair", "Good", "Strong"];
const TONE = ["bg-destructive", "bg-destructive", "bg-warning-fill", "bg-success", "bg-success"];

export interface PasswordStrengthProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  rules?: PasswordRule[];
  /** Set true when your backend reports the password in a known breach. */
  compromised?: boolean;
}

export function PasswordStrength({ value, rules = DEFAULT_RULES, compromised = false, className, ...rest }: PasswordStrengthProps) {
  const score = compromised ? 0 : scorePassword(value);
  const passed = rules.map((r) => r.test(value));
  const missing = 12 - value.length;
  const next = compromised
    ? "This password has appeared in a data breach, choose another."
    : value.length === 0
      ? null
      : missing > 0
        ? `Add ${missing} more character${missing === 1 ? "" : "s"}.`
        : passed.every(Boolean)
          ? null
          : `Also: ${rules[passed.indexOf(false)].label.toLowerCase()}.`;

  return (
    <div className={cn("grid gap-2", className)} {...rest}>
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={cn("h-1 rounded-full bg-foreground/10 transition-colors duration-200", value && i <= Math.max(score, 1) && TONE[score])} />
          ))}
        </div>
        <span className="w-16 text-right text-[12px] font-medium text-muted-foreground" aria-live="polite">
          {value ? (
            <>
              <span className="sr-only">Password strength: </span>
              {WORDS[score]}
            </>
          ) : null}
        </span>
      </div>
      <ul className="grid gap-1">
        {rules.map((r, i) => (
          <li key={r.label} className={cn("flex items-center gap-1.5 text-[12px]", passed[i] ? "text-foreground" : "text-muted-foreground")}>
            {passed[i] ? <Check className="size-3.5 text-success" aria-hidden /> : <Circle className="size-3 opacity-50" aria-hidden />}
            {r.label}
            <span className="sr-only">{passed[i] ? ", done" : ", not yet"}</span>
          </li>
        ))}
      </ul>
      {next && <p className={cn("text-[12px]", compromised ? "text-destructive" : "text-muted-foreground")}>{next}</p>}
    </div>
  );
}

export default PasswordStrength;
