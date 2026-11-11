// Evidence and finding displays.
import * as React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, FileWarning, History, Info, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useStore } from "@/lib/store";
import type { Evidence, Finding, Segment } from "@/lib/types";
import { CHANNELS, SEGMENTS } from "@/lib/types";
import { displayEvidence } from "@/lib/rules/consent";
import { computeCoverage, nOfN, participantOfEvidence, POPULATION_SPLIT, type Coverage } from "@/lib/rules/coverage";
import { CaptureBadge, ConfidenceBadge } from "./common";

/** One evidence item. */
export function EvidenceItem({ ev, compact, aside }: { ev: Evidence; compact?: boolean; aside?: React.ReactNode }) {
  const db = useStore((s) => s.db);
  const code = participantOfEvidence(db, ev.sessionId);
  const view = displayEvidence(ev);

  return (
    <div className={`grid gap-1.5 ${compact ? "" : "rounded-[10px] bg-card p-3 ring-1 ring-border"}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <CaptureBadge type={ev.captureType} />
        {ev.revisions.length > 0 && (
          <Badge size="sm" tone="outline">
            <History className="size-3" aria-hidden /> Edited ×{ev.revisions.length}
          </Badge>
        )}
        <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          {code}
          {aside}
        </span>
      </div>
      {ev.captureType === "direct-quotation" && view.original ? (
        <div className="grid gap-1.5">
          <p className="text-[13.5px] leading-relaxed" lang={ev.originalLanguage === "Hindi" ? "hi" : ev.originalLanguage === "Kannada" ? "kn" : undefined}>
            <span className="mr-1.5 text-[11.5px] font-medium text-muted-foreground">Original ({ev.originalLanguage ?? "language not noted"})</span>
            “{view.original}”
          </p>
          <p className="text-[13.5px] leading-relaxed">
            <span className="mr-1.5 text-[11.5px] font-medium text-muted-foreground">Translated</span>
            “{view.text}”
          </p>
        </div>
      ) : (
        <p className="text-[13.5px] leading-relaxed">{view.asQuote ? `“${view.text}”` : view.text}</p>
      )}
    </div>
  );
}

const SEG_SHORT: Record<Segment, string> = {
  "first-time": "First-time",
  "one-time lapsed": "One-time lapsed",
  repeat: "Repeat",
  "frequent buyer": "Frequent",
};

/** Live coverage for a finding: what it rests on and where it is thin. */
export function CoveragePanel({ cov, targetSegments = [] }: { cov: Coverage; targetSegments?: Segment[] }) {
  const n = cov.supportingParticipants.length;
  const total = cov.byChannel["own-site"] + cov.byChannel.marketplace;
  return (
    <div className="grid gap-4 text-[13px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 font-medium">
          <Users className="size-4 text-muted-foreground" aria-hidden /> {nOfN(cov)}
        </span>
        <span className="text-[12px] text-muted-foreground">{cov.supportingParticipants.join(", ") || "No participants yet"}</span>
      </div>

      <div className="grid gap-2">
        <div className="text-[12px] font-medium text-muted-foreground">By channel vs customer split <span className="font-normal">(40/60, illustrative)</span></div>
        {CHANNELS.map((c) => (
          <Progress
            key={c}
            size="sm"
            label={`${c === "own-site" ? "Own site" : "Marketplace"}: ${cov.byChannel[c]} of ${n}`}
            value={total ? Math.round((cov.byChannel[c] / total) * 100) : 0}
            showValue
            formatValue={(v) => `${v}% · customers ${Math.round(POPULATION_SPLIT[c] * 100)}%`}
          />
        ))}
      </div>

      <div className="grid gap-1.5">
        <div className="text-[12px] font-medium text-muted-foreground">By segment</div>
        <div className="flex flex-wrap gap-1.5">
          {SEGMENTS.map((s) => (
            <Badge key={s} size="sm" tone={cov.bySegment[s] ? "neutral" : "outline"}>
              {SEG_SHORT[s]}: {cov.bySegment[s]}
            </Badge>
          ))}
        </div>
      </div>

      <ul className="grid gap-1.5 text-[12.5px]">
        {cov.targetSegmentsWithoutSessions.filter((s) => targetSegments.includes(s)).length > 0 && (
          <li className="flex gap-1.5 text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            No completed sessions with: {cov.targetSegmentsWithoutSessions.map((s) => SEG_SHORT[s]).join(", ")}
          </li>
        )}
        <li className="flex gap-1.5">
          <FileWarning className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          {Math.round(cov.paraphraseShare * 100)}% of supporting evidence is paraphrase only
        </li>
        <li className="flex gap-1.5">
          <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          {cov.contradicting} contradicting · {cov.context} context
        </li>
      </ul>
    </div>
  );
}

/** Compact finding summary used on Home, search, reuse and the dashboard. */
export function FindingSummary({ finding, showQuestion }: { finding: Finding; showQuestion?: boolean }) {
  const db = useStore((s) => s.db);
  const cov = computeCoverage(finding, db);
  const q = db.questions.find((x) => x.id === finding.questionId);
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <Link to={`/questions/${finding.questionId}/findings?f=${finding.id}`} className="font-medium hover:underline">
          {finding.claim}
        </Link>
        <ConfidenceBadge level={finding.confidence} />
      </div>
      <div className="text-[12px] text-muted-foreground">
        {nOfN(cov)}
        {showQuestion && q ? ` · ${q.id}: ${q.text}` : ""}
      </div>
    </div>
  );
}
