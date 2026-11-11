import { Link } from "react-router-dom";
import { Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import type { Check } from "@/lib/permissions";
import type { Question } from "@/lib/types";
import { assumptionStatus, isOverdue } from "@/lib/rules/metrics";
import { interviewedParticipants } from "@/lib/rules/coverage";
import { Card, Stat } from "@/components/app/common";
import { FindingSummary } from "@/components/app/evidence";

export function Overview({ question }: { question: Question; canEdit?: Check }) {
  const db = useStore((s) => s.db);

  const recs = db.recruitments.filter((r) => r.questionId === question.id);
  const findings = db.findings.filter((f) => f.questionId === question.id);
  const actions = db.actions.filter((a) => a.questionId === question.id);
  const status = assumptionStatus(db, question.id);
  const reused = question.reusedFindingIds.map((id) => db.findings.find((f) => f.id === id)).filter(Boolean);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="In the pipeline" value={recs.length} note={`${recs.filter((r) => r.status === "accepted").length} accepted, ${recs.filter((r) => r.status === "declined").length} declined`} />
        <Stat label="Conversations done" value={interviewedParticipants(db, question.id).length} />
        <Stat label="Findings" value={findings.length} note={`${findings.filter((f) => f.status === "complete").length} complete`} />
        <Stat label="Actions" value={actions.length} note={`${actions.filter(isOverdue).length} overdue`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <dl className="grid gap-3 text-[13.5px]">
            <div>
              <dt className="text-[12px] font-medium text-muted-foreground">Question</dt>
              <dd className="font-medium">{question.text}</dd>
            </div>
            {question.decisionItInforms && (
              <div>
                <dt className="text-[12px] font-medium text-muted-foreground">Decision it informs</dt>
                <dd>{question.decisionItInforms}</dd>
              </div>
            )}
            {question.currentAssumption && (
            <div>
              <dt className="text-[12px] font-medium text-muted-foreground">Current assumption</dt>
              <dd className="flex flex-wrap items-center gap-2">
                {question.currentAssumption}
                <Badge size="sm" tone={status === "contradicted" ? "info" : status === "supported" ? "success" : "outline"}>
                  {status === "contradicted" ? "Contradicted by findings" : status === "supported" ? "Supported by findings" : "Not tested yet"}
                </Badge>
              </dd>
            </div>
            )}
            <div>
              <dt className="text-[12px] font-medium text-muted-foreground">Target User Segment</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {(question.targetSegments ?? []).length === 0 ? (
                  <span className="text-muted-foreground">All segments</span>
                ) : (
                  (question.targetSegments ?? []).map((s) => (
                    <Badge key={s} size="sm" tone="neutral">
                      <Target className="size-3" aria-hidden /> {s}
                    </Badge>
                  ))
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[12px] font-medium text-muted-foreground">Target Product</dt>
              <dd className="mt-1">
                {question.productFocus ? <Badge size="sm" tone="outline">{question.productFocus}</Badge> : <span className="text-muted-foreground">All products</span>}
              </dd>
            </div>
          </dl>
        </Card>
        <div className="grid content-start gap-6">
          <Card title="Builds on" description="Existing findings this question chose to reuse.">
            {reused.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No earlier findings reused.</p>
            ) : (
              <ul className="grid gap-3">
                {reused.map((f) => (
                  <li key={f!.id}>
                    <FindingSummary finding={f!} showQuestion />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-[13px]">
        Next:
        <Link className="underline" to={`/questions/${question.id}/recruitment`}>recruit participants</Link>·
        <Link className="underline" to={`/questions/${question.id}/sessions`}>review sessions</Link>·
        <Link className="underline" to={`/questions/${question.id}/evidence`}>see evidence</Link>·
        <Link className="underline" to={`/questions/${question.id}/findings`}>write findings</Link>
      </div>
    </div>
  );
}
