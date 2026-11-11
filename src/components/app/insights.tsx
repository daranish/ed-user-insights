import * as React from "react";
import { CircleDashed, GitCompare, ShieldCheck } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { QuestionStage } from "@/lib/rules/metrics";

export const STAGE_TONE: Record<QuestionStage, BadgeTone> = {
  recruiting: "outline",
  interviewing: "info",
  "writing-evidence": "warning",
  "writing-findings": "warning",
  deciding: "warning",
  acting: "info",
  "closed-loop": "success",
};

export function AssumptionBadge({ status }: { status: "contradicted" | "supported" | "untested" }) {
  if (status === "contradicted") {
    return (
      <Badge size="sm" tone="warning">
        <GitCompare className="size-3" aria-hidden /> Contradicted
      </Badge>
    );
  }
  if (status === "supported") {
    return (
      <Badge size="sm" tone="success">
        <ShieldCheck className="size-3" aria-hidden /> Supported
      </Badge>
    );
  }
  return (
    <Badge size="sm" tone="outline">
      <CircleDashed className="size-3" aria-hidden /> Untested
    </Badge>
  );
}

/** A headline figure with its icon, a one-line note and optional extra (a progress bar). */
export function Kpi({ icon, label, value, note, children }: { icon: React.ReactNode; label: string; value: React.ReactNode; note: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 bg-card p-4 sm:p-5">
      <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
        <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-[7px] bg-background text-foreground/75 ring-1 ring-border/80 [&_svg]:size-3.5">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </p>
      <p className="text-[26px] leading-none font-medium tracking-[-0.025em] tabular-nums">{value}</p>
      <p className="text-[12px] text-muted-foreground">{note}</p>
      {children}
    </div>
  );
}

/** Long lists show the first few, then expand into a scrolling panel, so the page stays the same size as data grows. */
export function useCap<T>(items: T[], limit: number, noun: string) {
  const [open, setOpen] = React.useState(false);
  const over = items.length > limit;
  return {
    shown: open ? items : items.slice(0, limit),
    scroll: open && over ? "max-h-[560px] overflow-y-auto pr-1" : "",
    toggle: over ? (
      <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? `Show fewer ${noun}` : `Show all ${items.length} ${noun}`}
      </Button>
    ) : null,
  };
}
