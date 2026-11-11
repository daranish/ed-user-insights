// App-level building blocks composed from Layro components.
import * as React from "react";
import {
  AlertTriangle, CheckCircle2, Circle, Hourglass, CircleDashed, CircleDot, Clock, FlaskConical, Gavel, HelpCircle, Lock,
  MessageSquareQuote, Search, Signal, Sparkles, UserCheck, UserX, XCircle, Layers, Ban,
} from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { State, Skeleton } from "@/components/ui/state";
import { Tooltip } from "@/components/ui/tooltip";
import type { Check } from "@/lib/permissions";
import type { ActionStatus, ActionType, CaptureType, Confidence, RecruitmentStatus } from "@/lib/types";
import { CAPTURE_LABEL } from "@/lib/rules/consent";
import { CONFIDENCE_LABEL } from "@/lib/rules/confidence";

/** Marks anything that stands in for a real integration. */
export function SimBadge({ what, className }: { what?: string; className?: string }) {
  const badge = (
    <Badge
      size="sm"
      tone="outline"
      className={`shrink-0 font-semibold tracking-wide uppercase text-[color:var(--simulated)] ring-[color:var(--simulated)]/40 ${className ?? ""}`}
    >
      <Sparkles className="size-3" aria-hidden />
      Simulated{what ? <span className="sr-only">: {what}</span> : null}
    </Badge>
  );
  return what ? <Tooltip label={`Simulated: ${what}`}>{badge}</Tooltip> : badge;
}

export function PageHeader({ title, description, actions, eyebrow }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[12px] font-medium text-muted-foreground">{eyebrow}</div>}
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">{title}</h1>
        {description && <p className="mt-1 max-w-[70ch] text-[13.5px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, aside, children, className, description }: { title?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string; description?: React.ReactNode }) {
  return (
    <section className={`min-w-0 rounded-[14px] bg-card p-4 ring-1 ring-border sm:p-5 ${className ?? ""}`}>
      {(title || aside) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-[14.5px] font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{description}</p>}
          </div>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** Skeletons in the rough shape of a page. */
export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-64" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="rounded-[14px] p-4 ring-1 ring-border">
          <Skeleton lines={3} />
        </div>
      ))}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <State
      kind="error"
      title="Something went wrong"
      description={message ?? "The request failed."}
      action={<Button onClick={onRetry}>Retry</Button>}
      framed
    />
  );
}

/** Renders loading / error / content from a useLoad() result. */
export function Loaded({ load, children, rows }: { load: { status: string; error: string | null; retry: () => void }; children: () => React.ReactNode; rows?: number }) {
  if (load.status === "loading") return <LoadingBlock rows={rows} />;
  if (load.status === "error") return <ErrorBlock message={load.error} onRetry={load.retry} />;
  return <>{children()}</>;
}

/** A short reason beside a disabled control. */
export function Reason({ check, className }: { check: Check; className?: string }) {
  if (check.ok) return null;
  return (
    <p className={`flex items-start gap-1.5 text-[12px] text-muted-foreground ${className ?? ""}`}>
      <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
      {check.reason}
    </p>
  );
}

// ---------- Domain badges: always icon + label, never colour alone ----------

const CONF_ICON: Record<Confidence, React.ElementType> = { signal: Signal, pattern: Layers };
const CONF_TONE: Record<Confidence, BadgeTone> = { signal: "neutral", pattern: "info" };

export function ConfidenceBadge({ level }: { level: Confidence | null }) {
  if (!level) {
    return (
      <Badge size="sm" tone="outline">
        <CircleDashed className="size-3" aria-hidden /> Unrated
      </Badge>
    );
  }
  const Icon = CONF_ICON[level];
  return (
    <Badge size="sm" tone={CONF_TONE[level]}>
      <Icon className="size-3" aria-hidden /> {CONFIDENCE_LABEL[level]}
    </Badge>
  );
}

const CAPTURE_ICON: Record<CaptureType, React.ElementType> = {
  "direct-quotation": MessageSquareQuote, paraphrase: CircleDot, observation: Search,
};

export function CaptureBadge({ type }: { type: CaptureType }) {
  const Icon = CAPTURE_ICON[type] ?? CircleDot;
  return (
    <Badge size="sm" tone="outline">
      <Icon className="size-3" aria-hidden /> {CAPTURE_LABEL[type]}
    </Badge>
  );
}

const REC: Record<RecruitmentStatus, { label: string; tone: BadgeTone; Icon: React.ElementType }> = {
  considered: { label: "Considered", tone: "outline", Icon: Circle },
  "invite-requested": { label: "Awaiting Ops", tone: "warning", Icon: Hourglass },
  invited: { label: "Invite sent", tone: "info", Icon: Clock },
  accepted: { label: "Accepted", tone: "success", Icon: UserCheck },
  declined: { label: "Declined", tone: "neutral", Icon: UserX },
  "no-show": { label: "No-show", tone: "warning", Icon: AlertTriangle },
  done: { label: "Done", tone: "success", Icon: CheckCircle2 },
};

export function RecruitmentBadge({ status }: { status: RecruitmentStatus }) {
  const { label, tone, Icon } = REC[status];
  return (
    <Badge size="sm" tone={tone}>
      <Icon className="size-3" aria-hidden /> {label}
    </Badge>
  );
}
export const RECRUITMENT_LABEL = Object.fromEntries(Object.entries(REC).map(([k, v]) => [k, v.label])) as Record<RecruitmentStatus, string>;

const ACT: Record<ActionType, { label: string; Icon: React.ElementType }> = {
  decision: { label: "Decision", Icon: Gavel },
  experiment: { label: "Experiment", Icon: FlaskConical },
  "more-research": { label: "More research", Icon: HelpCircle },
  "no-action": { label: "No action", Icon: Ban },
};
export const ACTION_TYPE_LABEL = Object.fromEntries(Object.entries(ACT).map(([k, v]) => [k, v.label])) as Record<ActionType, string>;

export function ActionTypeBadge({ type }: { type: ActionType }) {
  const { label, Icon } = ACT[type];
  return (
    <Badge size="sm" tone="outline">
      <Icon className="size-3" aria-hidden /> {label}
    </Badge>
  );
}

export function ActionStatusBadge({ status, overdue }: { status: ActionStatus; overdue?: boolean }) {
  if (overdue) {
    return (
      <Badge size="sm" tone="destructive">
        <XCircle className="size-3" aria-hidden /> Overdue
      </Badge>
    );
  }
  if (status === "done") {
    return (
      <Badge size="sm" tone="success">
        <CheckCircle2 className="size-3" aria-hidden /> Done
      </Badge>
    );
  }
  if (status === "in-progress") {
    return (
      <Badge size="sm" tone="info">
        <CircleDot className="size-3" aria-hidden /> In progress
      </Badge>
    );
  }
  return (
    <Badge size="sm" tone="outline">
      <Circle className="size-3" aria-hidden /> Open
    </Badge>
  );
}

export function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="rounded-[12px] bg-card p-3.5 ring-1 ring-border">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-[20px] font-semibold tabular-nums">{value}</div>
      {note && <div className="mt-0.5 text-[11.5px] text-muted-foreground">{note}</div>}
    </div>
  );
}
