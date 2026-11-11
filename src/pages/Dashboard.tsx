import * as React from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, CheckCircle2, CheckSquare, ChevronRight, Clock, FileText, GitCompare, Lightbulb,
  MessagesSquare, PenLine, Recycle, Scale, ShieldCheck, Signal, Target,
} from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { BarCompare, DonutBreakdown } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectItem } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { State } from "@/components/ui/state";
import { useStore } from "@/lib/store";
import { useLoad, useUserName } from "@/lib/hooks";
import { insights, STAGE_LABEL } from "@/lib/rules/metrics";
import { liveDb } from "@/lib/rules/archive";
import { computeCoverage, nOfN } from "@/lib/rules/coverage";
import { actionLog } from "@/lib/rules/actionLog";
import { fmtDate, TODAY, daysBetween } from "@/lib/time";
import { AssumptionBadge, Kpi, STAGE_TONE, useCap } from "@/components/app/insights";
import { ACTION_TYPE_LABEL, ActionStatusBadge, ActionTypeBadge, Card, ConfidenceBadge, Loaded, PageHeader } from "@/components/app/common";
import { isOverdue } from "@/lib/rules/metrics";

type Insights = ReturnType<typeof insights>;

type Row = Insights["scorecard"][number];

const pct = (x: number) => `${Math.round(x * 100)}%`;
const ratio = (a: number, b: number) => (b ? a / b : 0);

function Headline({ m }: { m: Insights }) {
  const tested = m.assumptions.filter((a) => a.status !== "untested").length;
  const contradicted = m.assumptions.filter((a) => a.status === "contradicted").length;
  const supported = m.assumptions.filter((a) => a.status === "supported").length;
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[14px] bg-border ring-1 ring-border sm:grid-cols-2 xl:grid-cols-4">
      <Kpi icon={<CheckSquare />} label="Findings acted on" value={pct(m.actionShare)} note={`${m.findingsWithAction} of ${m.findingsTotal} findings led to an action`}>
        <Progress size="sm" tone="success" value={m.findingsWithAction} max={Math.max(1, m.findingsTotal)} label={<span className="sr-only">Findings acted on</span>} />
      </Kpi>
      <Kpi
        icon={<Scale />}
        label="Assumptions tested"
        value={`${tested} of ${m.assumptions.length}`}
        note={`${contradicted} contradicted · ${supported} supported · ${m.assumptions.length - tested} untested`}
      >
        <Progress size="sm" tone="warning" value={tested} max={Math.max(1, m.assumptions.length)} label={<span className="sr-only">Assumptions tested</span>} />
      </Kpi>
      <Kpi
        icon={<Target />}
        label="Actions completed"
        value={`${m.funnel.actionsDone} of ${m.funnel.actions}`}
        note={
          m.actionStatus.overdue ? (
            <span className="font-medium text-destructive">{m.actionStatus.overdue} overdue · {m.actionStatus.inProgress} in progress</span>
          ) : (
            `${m.actionStatus.inProgress} in progress · none overdue`
          )
        }
      >
        <Progress size="sm" tone="success" value={m.funnel.actionsDone} max={Math.max(1, m.funnel.actions)} label={<span className="sr-only">Actions completed</span>} />
      </Kpi>
      <Kpi
        icon={<Signal />}
        label="Evidence strength"
        value={`${m.strength.pattern} Pattern`}
        note={`${m.strength.signal} Signal · ${m.strength.unrated} unrated · avg ${m.strength.avgParticipants.toFixed(1)} customers a finding`}
      >
        <Progress size="sm" tone="chart" value={m.strength.pattern} max={Math.max(1, m.findingsTotal)} label={<span className="sr-only">Findings at Pattern</span>} />
      </Kpi>
    </div>
  );
}

function LearningLoop({ m }: { m: Insights }) {
  const f = m.funnel;
  const steps = [
    { label: "Questions", value: f.questions, hint: "asked by the team", icon: <Lightbulb /> },
    { label: "Customers contacted", value: f.contacted, hint: "invited on WhatsApp", icon: <MessagesSquare /> },
    { label: "Conversations", value: f.conversations, hint: `${pct(ratio(f.conversations, f.contacted))} of those contacted`, icon: <Clock /> },
    { label: "Evidence", value: f.evidence, hint: `${ratio(f.evidence, f.conversations).toFixed(1)} items a conversation`, icon: <FileText /> },
    { label: "Findings", value: f.findings, hint: `${f.findingsComplete} complete`, icon: <PenLine /> },
    { label: "Actions", value: f.actions, hint: `from ${m.findingsWithAction} finding${m.findingsWithAction === 1 ? "" : "s"}`, icon: <Target /> },
    { label: "Done", value: f.actionsDone, hint: f.actionsDone ? "with an outcome recorded" : "nothing finished yet", icon: <CheckCircle2 /> },
  ];
  return (
    <Card title="The learning loop" description="How far questions have travelled: from asking customers to changing what we do. Read left to right.">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {steps.map((s, i) => (
          <li key={s.label} className="relative grid content-start gap-1 rounded-[10px] bg-muted/50 p-3">
            <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground [&_svg]:size-3.5" >
              <span aria-hidden>{s.icon}</span>
              {s.label}
            </span>
            <span className="text-[22px] leading-tight font-medium tabular-nums">{s.value}</span>
            <span className="text-[11.5px] text-muted-foreground">{s.hint}</span>
            {i < steps.length - 1 && (
              <ChevronRight aria-hidden className="absolute top-1/2 -right-[13px] z-10 hidden size-4 -translate-y-1/2 rounded-full bg-card text-muted-foreground ring-1 ring-border lg:block" />
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function WhatWeLearned({ m }: { m: Insights }) {
  const db = useStore((s) => s.db);
  const cap = useCap(m.keyFindings, 4, "findings");
  return (
    <Card title="What we've learned" description="Every finding, strongest first. Complete findings have passed the counter-evidence check; drafts haven't yet.">
      {m.keyFindings.length === 0 ? (
        <State size="sm" title="No findings yet" description="Findings appear here once an owner writes one from interview evidence." />
      ) : (
        <>
        <ul className={`grid gap-2 ${cap.scroll}`}>
          {cap.shown.map(({ finding: f, actions }) => {
            const q = db.questions.find((x) => x.id === f.questionId);
            return (
              <li key={f.id} className="grid gap-2 rounded-[10px] p-3 ring-1 ring-border">
                <div className="flex flex-wrap items-center gap-1.5">
                  <ConfidenceBadge level={f.confidence} />
                  {f.status === "complete" ? (
                    <Badge size="sm" tone="success"><CheckCircle2 className="size-3" aria-hidden /> Complete</Badge>
                  ) : (
                    <Badge size="sm" tone="outline">Draft</Badge>
                  )}
                  {q?.currentAssumption && f.assumptionVerdict === "contradicts" && (
                    <Badge size="sm" tone="warning" title={`Contradicts: ${q.currentAssumption}`}>
                      <GitCompare className="size-3" aria-hidden /> Contradicts assumption
                    </Badge>
                  )}
                  {q?.currentAssumption && f.assumptionVerdict === "supports" && (
                    <Badge size="sm" tone="success" title={`Supports: ${q.currentAssumption}`}>
                      <ShieldCheck className="size-3" aria-hidden /> Supports assumption
                    </Badge>
                  )}
                  <span className="ml-auto text-[12px] text-muted-foreground">{f.id}</span>
                </div>
                <Link to={`/questions/${f.questionId}/findings?f=${f.id}`} className="font-medium hover:underline">
                  {f.claim}
                </Link>
                <div className="text-[12px] text-muted-foreground">
                  {nOfN(computeCoverage(f, db))} · {f.questionId}
                  {q ? `: ${q.text}` : ""}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2 text-[12px]">
                  {actions.length === 0 ? (
                    <span className="flex items-center gap-1.5 font-medium text-warning">
                      <AlertTriangle className="size-3.5" aria-hidden /> No action yet
                    </span>
                  ) : (
                    <>
                      <span className="text-muted-foreground">Led to</span>
                      {actions.map((a) => (
                        <Link
                          key={a.id}
                          to={`/questions/${a.questionId}/actions?a=${a.id}`}
                          title={a.description}
                          className="inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 ring-1 ring-border hover:bg-accent"
                        >
                          <span className="font-medium">{a.id}</span>
                          <span className="text-muted-foreground">{ACTION_TYPE_LABEL[a.type]}</span>
                          <ActionStatusBadge status={a.status} overdue={isOverdue(a)} />
                        </Link>
                      ))}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {cap.toggle}
        </>
      )}
    </Card>
  );
}

function AssumptionCheck({ m }: { m: Insights }) {
  // Tested questions first: they are the ones with something to say.
  const order = { contradicted: 0, supported: 1, untested: 2 } as const;
  const sorted = [...m.assumptions].sort((a, b) => order[a.status] - order[b.status]);
  const cap = useCap(sorted, 3, "questions");
  return (
    <Card title="Assumption check" description="What each question started out believing, and what the findings say. A contradiction means the conversations are doing their job.">
      <ul className={`grid gap-2 ${cap.scroll}`}>
        {cap.shown.map(({ question: q, status, contradicting, supporting }) => {
          const by = status === "contradicted" ? contradicting : status === "supported" ? supporting : [];
          return (
            <li key={q.id} className="grid gap-1.5 rounded-[10px] p-3 ring-1 ring-border">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/questions/${q.id}/findings`} className="text-[13px] font-medium hover:underline">
                  {q.id}: {q.text}
                </Link>
                <AssumptionBadge status={status} />
              </div>
              {q.currentAssumption ? (
                <p className="text-[12px] text-muted-foreground">
                  <span className="font-semibold text-foreground">We assumed:</span> “{q.currentAssumption}”
                </p>
              ) : (
                <p className="text-[12px] text-muted-foreground">No starting belief recorded for this question.</p>
              )}
              {by.length > 0 && (
                <p className="text-[12px] text-muted-foreground">
                  {status === "contradicted" ? "Contradicted by " : "Supported by "}
                  {by.map((f, i) => (
                    <React.Fragment key={f.id}>
                    {i > 0 && ", "}
                    <Link to={`/questions/${q.id}/findings?f=${f.id}`} title={f.claim} className="font-medium text-foreground hover:underline">
                      {f.id}
                      {f.status === "draft" ? " (draft)" : ""}
                    </Link>
                    </React.Fragment>
                  ))}
                </p>
              )}
              {q.currentAssumption && status === "untested" && (
                <p className="text-[12px] text-muted-foreground">No finding addresses it yet.</p>
              )}
            </li>
          );
        })}
      </ul>
      {cap.toggle}
    </Card>
  );
}

function NeedsAttention({ m }: { m: Insights }) {
  const db = useStore((s) => s.db);
  const name = useUserName();
  const { overdue, awaitingEvidence, drafts, unacted } = m.attention;
  const items: { key: string; to: string; tone: string; icon: React.ReactNode; title: string; meta: string }[] = [
    ...overdue.map((a) => ({
      key: a.id,
      to: `/questions/${a.questionId}/actions?a=${a.id}`,
      tone: "text-destructive",
      icon: <AlertTriangle />,
      title: a.description,
      meta: `Overdue ${daysBetween(a.dueDate, TODAY)} days · ${name(a.assigneeId)} · ${a.questionId}`,
    })),
    ...awaitingEvidence.map((s) => ({
      key: s.id,
      to: `/questions/${s.questionId}/sessions`,
      tone: "text-warning",
      icon: <FileText />,
      title: `Conversation with ${s.participantCode} has no evidence written up`,
      meta: `Held ${fmtDate(s.date)} · ${s.questionId}`,
    })),
    ...unacted.map((f) => ({
      key: f.id,
      to: `/questions/${f.questionId}/findings?f=${f.id}`,
      tone: "text-warning",
      icon: <Target />,
      title: f.claim,
      meta: `Complete finding with no action · ${f.questionId}`,
    })),
    ...drafts.map((f) => ({
      key: f.id,
      to: `/questions/${f.questionId}/findings?f=${f.id}`,
      tone: "text-muted-foreground",
      icon: <PenLine />,
      title: f.claim,
      meta: `Draft finding, not yet checked · ${name(db.questions.find((q) => q.id === f.questionId)?.ownerId ?? "")} · ${f.questionId}`,
    })),
  ];
  const cap = useCap(items, 5, "items");
  return (
    <Card title={`Needs attention${items.length ? ` (${items.length})` : ""}`} description="Where the loop is stuck, most urgent first.">
      {items.length === 0 ? (
        <State size="sm" kind="success" title="Nothing is stuck" />
      ) : (
        <>
        <ul className={`grid gap-1 ${cap.scroll}`}>
          {cap.shown.map((it) => (
            <li key={it.key}>
              <Link to={it.to} className="group flex gap-2.5 rounded-[8px] p-2 transition-colors hover:bg-accent">
                <span aria-hidden className={`mt-0.5 shrink-0 [&_svg]:size-4 ${it.tone}`}>{it.icon}</span>
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate text-[13px] font-medium">{it.title}</span>
                  <span className="text-[12px] text-muted-foreground">{it.meta}</span>
                </span>
                <ArrowRight className="ml-auto size-4 shrink-0 self-center text-muted-foreground opacity-0 group-hover:opacity-100" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
        {cap.toggle}
        </>
      )}
    </Card>
  );
}

function Scorecard({ m }: { m: Insights }) {
  const name = useUserName();
  const columns: ColumnDef<Row, unknown>[] = [
    {
      id: "question",
      header: "Question",
      accessorFn: (r) => r.question.id,
      cell: ({ row }) => (
        <Link to={`/questions/${row.original.question.id}/overview`} className="grid max-w-[360px] min-w-[220px] gap-0.5 whitespace-normal hover:underline">
          <span className="text-[12px] text-muted-foreground">{row.original.question.id}</span>
          <span className="font-medium">{row.original.question.text}</span>
        </Link>
      ),
    },
    { id: "owner", header: "Owner", accessorFn: (r) => name(r.question.ownerId) },
    {
      id: "stage",
      header: "Where it is",
      accessorFn: (r) => STAGE_LABEL[r.stage],
      cell: ({ row }) => <Badge size="sm" tone={STAGE_TONE[row.original.stage]}>{STAGE_LABEL[row.original.stage]}</Badge>,
    },
    { id: "conversations", header: "Conversations", accessorKey: "conversations" },
    { id: "findings", header: "Findings", accessorFn: (r) => r.findings },
    { id: "actions", header: "Actions", accessorFn: (r) => r.actions },
    {
      id: "assumption",
      header: "Assumption",
      accessorFn: (r) => r.assumption,
      cell: ({ row }) => <AssumptionBadge status={row.original.assumption} />,
    },
  ];
  return (
    <Card title="Question scorecard" description="Each question's progress through the loop. Open one to see the detail; anyone can read every question.">
      <DataTable<Row> label="Question scorecard" data={m.scorecard} columns={columns} getRowId={(r) => r.question.id} pageSize={6} searchPlaceholder="Search questions, owners or stages" />
    </Card>
  );
}

function ActionProgress({ m }: { m: Insights }) {
  const total = m.funnel.actions;
  const s = m.actionStatus;
  const rows = [
    { label: "Done", value: s.done, tone: "success" as const },
    { label: "In progress", value: s.inProgress, tone: "chart" as const },
    { label: "Open", value: s.open, tone: "default" as const },
    { label: "Overdue", value: s.overdue, tone: "destructive" as const },
  ];
  const types = m.actionTypes
    .map((t, i) => ({ label: ACTION_TYPE_LABEL[t.type], value: t.count, slot: (i + 1) as 1 | 2 | 3 | 4 }))
    .filter((t) => t.value > 0);
  return (
    <Card title="What findings turned into" description="Actions by status, and the kind of change they make.">
      {total === 0 ? (
        <State size="sm" title="No actions yet" description="When a finding leads to a decision, experiment or more research, it counts here." />
      ) : (
        <div className="grid gap-5">
          <div className="grid gap-3">
            {rows.map((r) => (
              <Progress key={r.label} size="sm" tone={r.tone} label={r.label} value={r.value} max={total} showValue formatValue={(v, max) => `${v} of ${max}`} />
            ))}
          </div>
          <div className="border-t border-border pt-4">
            <DonutBreakdown
              data={types}
              centerLabel="Actions"
              size={132}
              description={`Actions by type: ${types.map((t) => `${t.label} ${t.value}`).join(", ")}.`}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

function Impact({ m }: { m: Insights }) {
  const name = useUserName();
  const outcomes = useCap(m.outcomes, 3, "outcomes");
  const inFlight = m.actions
    .filter((a) => a.status !== "done")
    .sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)) || a.dueDate.localeCompare(b.dueDate));
  return (
    <Card title="Impact so far" description="Outcomes recorded when an action is marked done: what actually changed because we listened.">
      {m.outcomes.length === 0 ? (
        <div className="grid gap-3">
          <State size="sm" title="No outcome recorded yet" description="An outcome lands here when the assignee marks an action done and says what changed." />
          {inFlight.length > 0 && (
            <div className="grid gap-2">
              <p className="text-[12px] font-medium text-muted-foreground">Coming up</p>
              <ul className="grid gap-1.5">
                {inFlight.slice(0, 4).map((a) => (
                  <li key={a.id}>
                    <Link to={`/questions/${a.questionId}/actions?a=${a.id}`} className="grid gap-1 rounded-[10px] p-2.5 ring-1 ring-border hover:bg-accent">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <ActionStatusBadge status={a.status} overdue={isOverdue(a)} />
                        <ActionTypeBadge type={a.type} />
                      </span>
                      <span className="text-[13px] font-medium">{a.description}</span>
                      <span className="text-[12px] text-muted-foreground">{name(a.assigneeId)} · due {fmtDate(a.dueDate)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <>
        <ul className={`grid gap-2 ${outcomes.scroll}`}>
          {outcomes.shown.map((a) => {
            const last = actionLog(a).at(-1);
            return (
              <li key={a.id} className="grid gap-1.5 rounded-[10px] p-3 ring-1 ring-border">
                <span className="flex flex-wrap items-center gap-1.5">
                  <ActionTypeBadge type={a.type} />
                  <span className="text-[12px] text-muted-foreground">{a.id} · {a.questionId}</span>
                </span>
                <Link to={`/questions/${a.questionId}/actions?a=${a.id}`} className="text-[13px] font-medium hover:underline">{a.description}</Link>
                <p className="rounded-[8px] bg-success-soft/60 px-2.5 py-1.5 text-[12.5px]">
                  <span className="font-semibold">Outcome:</span> {a.outcomeNote}
                </p>
                <span className="text-[12px] text-muted-foreground">
                  {name(a.assigneeId)}
                  {last ? ` · ${fmtDate(last.at)}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
        {outcomes.toggle}
        </>
      )}
    </Card>
  );
}

function Coverage({ m }: { m: Insights }) {
  return (
    <Card title="Who we've heard from" description="Completed conversations by segment and channel, across all questions. An empty bar is a group we haven't heard from.">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <BarCompare
          data={m.grid.map((r) => ({ segment: r.segment, "own-site": r["own-site"], marketplace: r.marketplace }))}
          xKey="segment"
          format={(v) => (Number.isInteger(v) ? String(v) : "")}
          series={[
            { key: "own-site", label: "Own site", slot: 1 },
            { key: "marketplace", label: "Marketplace", slot: 4 },
          ]}
          description={`Completed conversations per segment and channel. Gaps: ${m.gaps.map((g) => `${g.segment} on ${g.channel}`).join(", ") || "none"}.`}
        />
        <div className="grid content-start gap-2">
          <p className="text-[12.5px] font-medium">
            {m.gaps.length ? `${m.gaps.length} of ${m.grid.length * 2} groups not heard from yet` : "Every group heard from"}
          </p>
          {m.gaps.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {m.gaps.map((g) => (
                <li key={`${g.segment}-${g.channel}`}>
                  <Badge size="sm" tone="warning">
                    <AlertTriangle className="size-3" aria-hidden /> {g.segment} · {g.channel === "own-site" ? "own site" : "marketplace"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 flex gap-1.5 text-[12px] text-muted-foreground">
            <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Marketplace gaps close slowly: those buyers (60% of customers) arrive only through QR opt-ins.
          </p>
          {m.reused.length > 0 && (
            <p className="flex gap-1.5 text-[12px] text-muted-foreground">
              <Recycle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {m.reused.length} finding{m.reused.length === 1 ? " was" : "s were"} reused by a later question, so it didn't have to be re-learned.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

export function Dashboard() {
  const load = useLoad("dashboard");
  const allDb = useStore((s) => s.db);
  // Archived questions are set aside, so they stay out of the leadership figures.
  const db = React.useMemo(() => liveDb(allDb), [allDb]);
  const name = useUserName();
  const [owner, setOwner] = React.useState("all");
  const [questionId, setQuestionId] = React.useState("all");
  const owners = React.useMemo(() => db.users.filter((u) => db.questions.some((q) => q.ownerId === u.id)), [db]);
  const choices = db.questions.filter((q) => owner === "all" || q.ownerId === owner);
  // Narrow every figure on the page to the chosen owner or question.
  const scoped = React.useMemo(() => {
    const ids = new Set(db.questions.filter((q) => (owner === "all" || q.ownerId === owner) && (questionId === "all" || q.id === questionId)).map((q) => q.id));
    const inScope = <T extends { questionId: string }>(xs: T[]) => xs.filter((x) => ids.has(x.questionId));
    return {
      ...db,
      questions: db.questions.filter((q) => ids.has(q.id)),
      recruitments: inScope(db.recruitments),
      sessions: inScope(db.sessions),
      evidence: inScope(db.evidence),
      findings: inScope(db.findings),
      actions: inScope(db.actions),
    };
  }, [db, owner, questionId]);
  const m = React.useMemo(() => insights(scoped), [scoped]);
  const filtered = owner !== "all" || questionId !== "all";

  return (
    <>
      <PageHeader
        title="Insights & Impacts"
        description="What customers have taught us, how sure we are, and what it changed. It deliberately doesn't rank people by how many conversations they held."
      />
      <Loaded load={load} rows={6}>
        {() => (
          <div className="grid gap-6">
            <div className="flex flex-wrap items-end gap-3 rounded-[14px] bg-card p-3 ring-1 ring-border sm:px-4">
              <label className="grid gap-1 text-[12px] font-medium text-muted-foreground">
                Owner
                <Select
                  aria-label="Filter by owner"
                  value={owner}
                  onValueChange={(v) => {
                    setOwner(v);
                    setQuestionId("all");
                  }}
                  className="w-[190px]"
                >
                  <SelectItem value="all">Everyone</SelectItem>
                  {owners.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </Select>
              </label>
              <label className="grid min-w-0 gap-1 text-[12px] font-medium text-muted-foreground">
                Question
                <Select aria-label="Filter by question" value={questionId} onValueChange={setQuestionId} className="w-[min(320px,80vw)]">
                  <SelectItem value="all">All questions ({choices.length})</SelectItem>
                  {choices.map((q) => <SelectItem key={q.id} value={q.id}>{q.id}: {q.text}</SelectItem>)}
                </Select>
              </label>
              <p className="ml-auto text-[12px] text-muted-foreground">
                Showing {filtered ? `${m.scorecard.length} of ${db.questions.length} questions` : `all ${db.questions.length} questions`}
                {owner !== "all" ? ` · owned by ${name(owner)}` : ""}
              </p>
              {filtered && (
                <Button variant="ghost" size="sm" onClick={() => { setOwner("all"); setQuestionId("all"); }}>Clear filters</Button>
              )}
            </div>
            {m.scorecard.length === 0 ? (
              <State framed title="No questions match" description="Try a different owner or clear the filters." />
            ) : (
              <>
            <Headline m={m} />
            <LearningLoop m={m} />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <WhatWeLearned m={m} />
              <div className="grid content-start gap-6">
                <AssumptionCheck m={m} />
                <NeedsAttention m={m} />
              </div>
            </div>

            <Scorecard m={m} />

            <div className="grid gap-6 lg:grid-cols-2">
              <ActionProgress m={m} />
              <Impact m={m} />
            </div>

            <Coverage m={m} />

            <div className="flex items-start gap-2 rounded-[10px] bg-muted/60 px-3 py-2 text-[12px] text-muted-foreground">
              <MessagesSquare className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Conversations held: <span className="font-medium text-foreground">{m.conversations}</span>. Shown small on purpose: a conversation count rewards volume, not learning. Read it alongside the action rate and coverage above.
              </span>
            </div>
              </>
            )}
          </div>
        )}
      </Loaded>
    </>
  );
}
