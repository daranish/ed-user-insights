"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const SOFT = { type: "spring", stiffness: 300, damping: 30 } as const;

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

export interface Step {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Flag a step as needing attention, whatever its position. */
  error?: boolean;
  /** Can be skipped; shown as "Optional". */
  optional?: boolean;
}

export interface StepperProps extends React.HTMLAttributes<HTMLOListElement> {
  steps: Step[];
  /** 0-based index of the step in progress. `steps.length` means all done. */
  current: number;
  orientation?: "horizontal" | "vertical";
  /** Makes completed steps clickable. */
  onStepClick?: (index: number) => void;
}

export function Stepper({
  steps,
  current,
  orientation = "horizontal",
  onStepClick,
  className,
  ...rest
}: StepperProps) {
  const vertical = orientation === "vertical";
  return (
    <ol
      className={cn(
        vertical ? "grid gap-0" : "flex w-full items-start gap-2",
        className,
      )}
      {...rest}
    >
      {steps.map((s, i) => {
        const state: "done" | "current" | "upcoming" | "error" = s.error
          ? "error"
          : i < current
            ? "done"
            : i === current
              ? "current"
              : "upcoming";
        const clickable =
          !!onStepClick &&
          (state === "done" || state === "error") &&
          i !== current;
        const stateText = {
          done: "completed",
          current: "current step",
          upcoming: "not started",
          error: "needs attention",
        }[state];

        const marker = (
          <span
            aria-hidden
            className={cn(
              "relative z-[1] grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold tabular-nums transition-colors",
              state === "done" && "bg-primary text-primary-foreground",
              state === "current" &&
                "bg-card text-foreground ring-2 ring-primary",
              state === "upcoming" &&
                "bg-card text-muted-foreground ring-1 ring-inset ring-input",
              state === "error" &&
                "bg-destructive-soft text-destructive ring-1 ring-inset ring-destructive/40",
            )}
          >
            {state === "done" ? (
              <Check className="size-3.5" strokeWidth={3} />
            ) : state === "error" ? (
              <AlertTriangle className="size-3.5" />
            ) : (
              i + 1
            )}
          </span>
        );

        const text = (
          <span className="grid min-w-0 gap-0.5 pt-1">
            <span
              className={cn(
                "text-[13px] leading-5 font-medium",
                state === "upcoming"
                  ? "text-muted-foreground"
                  : state === "error"
                    ? "text-destructive"
                    : "text-foreground",
              )}
            >
              {s.title}
              <span className="sr-only">, {stateText}</span>
            </span>
            {(s.description || s.optional) && (
              <span className="text-[12px] leading-snug text-muted-foreground">
                {s.description}
                {s.optional && (s.description ? " · Optional" : "Optional")}
              </span>
            )}
          </span>
        );

        const connector = i < steps.length - 1 && (
          <span
            aria-hidden
            className={cn(
              "bg-border",
              i < current && "bg-primary",
              vertical
                ? "absolute top-8 bottom-1 left-[13px] w-0.5 rounded-full"
                : "mt-[13px] h-0.5 min-w-4 flex-1 rounded-full",
            )}
          />
        );

        const inner = (
          <>
            {marker}
            {text}
          </>
        );

        return (
          <li
            key={i}
            aria-current={state === "current" ? "step" : undefined}
            className={cn(
              vertical
                ? "relative pb-6 last:pb-0"
                : "flex min-w-0 flex-1 items-start gap-2 last:flex-none",
            )}
          >
            {clickable ? (
              <button
                type="button"
                onClick={() => onStepClick!(i)}
                className={cn(
                  "-m-1 flex cursor-pointer items-start gap-2.5 rounded-[10px] p-1 text-left hover:bg-accent",
                  FOCUS,
                )}
              >
                {inner}
              </button>
            ) : (
              <div className="flex items-start gap-2.5">{inner}</div>
            )}
            {connector}
          </li>
        );
      })}
    </ol>
  );
}

const SLIDE = {
  enter: (dir: number) => ({ opacity: 0, x: 16 * dir }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: -16 * dir }),
};
const FADE = { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } };

export interface WizardStep extends Step {
  id: string;
  /** What the step asks for. */
  content: React.ReactNode;
  /**
   * Runs on Next and Finish. Return true to go on, or the reason to stay as
   * a sentence. May be async: the button shows it is working.
   */
  validate?: () => true | string | Promise<true | string>;
}

export interface WizardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onSubmit"
> {
  steps: WizardStep[];
  /** Controlled step index. */
  step?: number;
  defaultStep?: number;
  onStepChange?: (index: number) => void;
  /** Runs on the last step's button. May return a promise; reject to show why it failed. */
  onFinish: () => void | Promise<void>;
  /** Shown after onFinish succeeds. Leave out to keep the last step on screen. */
  done?: React.ReactNode;
  /** Adds a Cancel button on the left. */
  onCancel?: () => void;
  nextLabel?: string;
  backLabel?: string;
  finishLabel?: string;
  /** Steps on the side instead of on top. Switches to the top on narrow screens. */
  orientation?: "horizontal" | "vertical";
}

export function Wizard({
  steps,
  step,
  defaultStep = 0,
  onStepChange,
  onFinish,
  done,
  onCancel,
  nextLabel = "Next",
  backLabel = "Back",
  finishLabel = "Finish",
  orientation = "horizontal",
  className,
  ...props
}: WizardProps) {
  const reduce = useReducedMotion();
  const [inner, setInner] = React.useState(defaultStep);
  const at = Math.min(step ?? inner, steps.length - 1);
  const [dir, setDir] = React.useState(1);
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<{
    step: number;
    text: string;
  } | null>(null);
  const [finished, setFinished] = React.useState(false);
  const heading = React.useRef<HTMLHeadingElement>(null);
  const moved = React.useRef(false);
  const id = React.useId();
  const last = at === steps.length - 1;
  const current = steps[at];

  const setHeading = React.useCallback((el: HTMLHeadingElement | null) => {
    heading.current = el;
    if (el && moved.current) el.focus({ preventScroll: true });
  }, []);

  const go = (to: number) => {
    moved.current = true;
    setDir(to > at ? 1 : -1);
    setProblem(null);
    if (step === undefined) setInner(to);
    onStepChange?.(to);
  };

  const next = async () => {
    setProblem(null);
    setBusy(true);
    try {
      const ok = current.validate ? await current.validate() : true;
      if (ok !== true) {
        setProblem({ step: at, text: ok });
        return;
      }
      if (last) {
        await onFinish();
        moved.current = true;
        if (done) setFinished(true);
      } else go(at + 1);
    } catch (err) {
      setProblem({
        step: at,
        text:
          err instanceof Error ? err.message : "That did not work. Try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  const vertical = orientation === "vertical";
  const indicator = steps.map((s, i) => ({
    title: s.title,
    optional: s.optional,
    error: s.error || problem?.step === i,
  }));

  if (finished && done) {
    return (
      <div className={cn("w-full", className)} {...props}>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SOFT}
        >
          <h2 ref={setHeading} tabIndex={-1} className="sr-only">
            Finished
          </h2>
          {done}
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn("@container w-full", className)} {...props}>
      <div
        className={cn(
          "grid gap-6",
          vertical &&
            "@min-[640px]:grid-cols-[200px_minmax(0,1fr)] @min-[640px]:gap-8",
        )}
      >
        <Stepper
          aria-label="Steps"
          steps={indicator}
          current={at}
          orientation={vertical ? "vertical" : "horizontal"}
          onStepClick={(i) => i < at && go(i)}
          className={cn(
            vertical ? "hidden @min-[640px]:grid" : "hidden @min-[520px]:flex",
          )}
        />
        <div
          className={cn(
            "grid gap-1.5",
            vertical ? "@min-[640px]:hidden" : "@min-[520px]:hidden",
          )}
        >
          <p className="m-0 text-[12.5px] text-muted-foreground">
            Step {at + 1} of {steps.length}
          </p>
          <div
            aria-hidden
            className="h-1 overflow-hidden rounded-full bg-foreground/10"
          >
            <div
              className="h-full rounded-full bg-foreground transition-[width] duration-300"
              style={{ width: `${((at + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="min-w-0">
          <section aria-labelledby={`${id}-h`} className="min-w-0">
            <AnimatePresence mode="wait" initial={false} custom={dir}>
              <motion.div
                key={current.id}
                custom={dir}
                variants={reduce ? FADE : SLIDE}
                initial="enter"
                animate="center"
                exit="exit"
                transition={reduce ? { duration: 0.1 } : SOFT}
              >
                <h2
                  id={`${id}-h`}
                  ref={setHeading}
                  tabIndex={-1}
                  className="m-0 text-[16px] font-medium tracking-[-0.01em] outline-none"
                >
                  {current.title}
                  {current.optional && (
                    <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                      Optional
                    </span>
                  )}
                </h2>
                {current.description && (
                  <p className="m-0 mt-1 text-[13px] text-muted-foreground">
                    {current.description}
                  </p>
                )}
                <div className="mt-4">{current.content}</div>
              </motion.div>
            </AnimatePresence>
          </section>

          {problem && (
            <Alert tone="destructive" size="sm" className="mt-4">
              {problem.text}
            </Alert>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            {onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                disabled={busy}
              >
                Cancel
              </Button>
            )}
            <span className="flex-1" />
            {at > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => go(at - 1)}
                disabled={busy}
              >
                <ArrowLeft />
                {backLabel}
              </Button>
            )}
            {current.optional && !last && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => go(at + 1)}
                disabled={busy}
              >
                Skip
              </Button>
            )}
            <Button size="sm" onClick={next} loading={busy}>
              {last ? finishLabel : nextLabel}
              {!last && <ArrowRight />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Stepper;
