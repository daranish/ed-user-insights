import * as React from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, ClipboardCopy, Clock, Gauge, PlusCircle, Lightbulb, MessagesSquare, PenLine,
  Scale, Target, Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { State } from "@/components/ui/state";
import { toast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { useLoad, useMe, useUserName } from "@/lib/hooks";
import { canCreateQuestion, ROLE_LABEL } from "@/lib/permissions";
import { STAGE_LABEL } from "@/lib/rules/metrics";
import { liveDb } from "@/lib/rules/archive";
import { briefText, CHANNEL_BASE, executiveBrief, STAGES, type Brief, type BriefEvent } from "@/lib/rules/brief";
import { fmtDate, fmtDateTime, TODAY } from "@/lib/time";
import { AssumptionBadge, Kpi, STAGE_TONE, useCap } from "@/components/app/insights";
import { ActionStatusBadge, ActionTypeBadge, Card, ConfidenceBadge, Loaded, PageHeader } from "@/components/app/common";
import { isOverdue } from "@/lib/rules/metrics";
import { AssignedActions, GlobalSearch } from "@/pages/Home";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** One sentence a CEO can read in five seconds. */
function summary(b: Brief) {
  const p = b.pulse;
  const parts = [
    `${p.active} question${p.active === 1 ? "" : "s"} in flight`,
    p.contradicted ? `${p.contradicted} belief${p.contradicted === 1 ? "" : "s"} overturned by customers` : null,
    p.decisions ? `${p.decisions} decision${p.decisions === 1 ? "" : "s"} or experiment${p.decisions === 1 ? "" : "s"} under way` : null,
    p.overdue ? `${p.overdue} action${p.overdue === 1 ? "" : "s"} overdue` : "nothing overdue",
  ].filter(Boolean);
  return `${parts.join(", ")}.`;
}

function Pulse({ b }: { b: Brief }) {
  const p = b.pulse;
  const types = b.m.actionTypes;
  const count = (t: string) => types.find((x) => x.type === t)?.count ?? 0;
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[14px] bg-border ring-1 ring-border sm:grid-cols-2 xl:grid-cols-4">
      <Kpi
        icon={<Target />}
        label="Decisions from ED User Insights"
        value={p.decisions}
        note={`${count("decision")} decision${count("decision") === 1 ? "" : "s"} · ${count("experiment")} experiment${count("experiment") === 1 ? "" : "s"} · ${p.decisionsDone} finished`}
      />
      <Kpi
        icon={<Scale />}
        label="Beliefs tested"
        value={`${p.tested} of ${b.beliefs.length}`}
        note={p.contradicted ? <span className="font-medium text-warning">{p.contradicted} overturned by what customers said</span> : "None overturned so far"}
      >
        <Progress size="sm" tone="warning" value={p.tested} max={Math.max(1, b.beliefs.length)} label={<span className="sr-only">Beliefs tested</span>} />
      </Kpi>
      <Kpi
        icon={<Users />}
        label="Customers heard"
        value={p.conversations}
        note={`Own site ${p.heard["own-site"]} · Marketplace ${p.heard.marketplace} (${pct(p.marketplaceShare)}, base ~${pct(CHANNEL_BASE.marketplace)})`}
      >
        <Progress
          size="sm"
          tone={p.marketplaceShare < CHANNEL_BASE.marketplace - 0.05 ? "warning" : "success"}
          value={Math.round(p.marketplaceShare * 100)}
          max={Math.round(CHANNEL_BASE.marketplace * 100)}
          label={<span className="sr-only">Marketplace share against the customer base</span>}
        />
      </Kpi>
      <Kpi
        icon={<Clock />}
        label="Actions on time"
        value={pct(p.onTime)}
        note={p.overdue ? <span className="font-medium text-destructive">{p.overdue} overdue of {b.m.funnel.actions}</span> : `All ${b.m.funnel.actions} on schedule`}
      >
        <Progress size="sm" tone={p.overdue ? "destructive" : "success"} value={Math.round(p.onTime * 100)} max={100} label={<span className="sr-only">Actions on time</span>} />
      </Kpi>
    </div>
  );
}

function Beliefs({ b }: { b: Brief }) {
  const name = useUserName();
  const tested = b.beliefs.filter((x) => x.status !== "untested");
  const untested = b.beliefs.filter((x) => x.status === "untested");
  const cap = useCap(tested, 3, "tested beliefs");
  return (
    <Card
      title="What we believed vs what customers told us"
      description="Each question starts from a belief. This is where the team's assumptions met real customers, and what we did about it."
    >
      {b.beliefs.length === 0 ? (
        <State framed scene="chart" title="No beliefs on record" description="Questions with a starting assumption show up here once they have one." />
      ) : tested.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No belief has been tested yet. The first findings will show here.</p>
      ) : (
        <>
          <ul className={`grid gap-3 ${cap.scroll}`}>
            {cap.shown.map((x) => (
              <li key={x.question.id} className="grid gap-3 rounded-[12px] p-3.5 ring-1 ring-border">
                <div className="flex flex-wrap items-center gap-2">
                  <AssumptionBadge status={x.status} />
                  <Link to={`/questions/${x.question.id}/overview`} className="min-w-0 text-[13px] font-medium hover:underline">
                    {x.question.id}: {x.question.text}
                  </Link>
                  <span className="ml-auto text-[12px] whitespace-nowrap text-muted-foreground">{name(x.question.ownerId)}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid content-start gap-1 rounded-[10px] bg-muted/50 p-3">
                    <span className="text-[11.5px] font-medium tracking-wide text-muted-foreground uppercase">We assumed</span>
                    <p className={`text-[13px] ${x.status === "contradicted" ? "text-muted-foreground line-through decoration-warning/70" : ""}`}>
                      {x.question.currentAssumption}
                    </p>
                  </div>
                  <div className={`grid content-start gap-1 rounded-[10px] p-3 ${x.status === "contradicted" ? "bg-warning-soft/50" : "bg-success-soft/50"}`}>
                    <span className="text-[11.5px] font-medium tracking-wide text-muted-foreground uppercase">Customers told us</span>
                    {x.finding ? (
                      <>
                        <Link to={`/questions/${x.question.id}/findings?f=${x.finding.id}`} className="text-[13px] font-medium hover:underline">
                          {x.finding.claim}
                        </Link>
                        <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
                          <ConfidenceBadge level={x.finding.confidence} />
                          {x.participants} of {x.interviewed} interviewed
                          {x.finding.status === "draft" && <Badge size="sm" tone="outline">Draft</Badge>}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
                {x.finding && (
                  <div className="grid gap-1.5">
                    <span className="text-[11.5px] font-medium tracking-wide text-muted-foreground uppercase">What we did</span>
                    {x.actions.length === 0 ? (
                      <p className="text-[12.5px] font-medium text-warning">No action yet.</p>
                    ) : (
                      <ul className="grid gap-1.5">
                        {x.actions.map((a) => (
                          <li key={a.id}>
                            <Link to={`/questions/${a.questionId}/actions?a=${a.id}`} className="flex flex-wrap items-center gap-1.5 text-[12.5px] hover:underline">
                              <ActionTypeBadge type={a.type} />
                              <ActionStatusBadge status={a.status} overdue={isOverdue(a)} />
                              <span className="min-w-0">{a.description}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {cap.toggle}
        </>
      )}
      {untested.length > 0 && (
        <div className="mt-4 grid gap-2 border-t border-border pt-4">
          <span className="text-[11.5px] font-medium tracking-wide text-muted-foreground uppercase">Still to test ({untested.length})</span>
          <ul className="grid gap-1.5">
            {untested.map((x) => (
              <li key={x.question.id}>
                <Link to={`/questions/${x.question.id}/overview`} className="grid gap-0.5 rounded-[10px] px-2 py-1.5 transition-colors hover:bg-accent sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-3">
                  <span className="text-[13px]">
                    <span className="font-medium">{x.question.id}</span> · “{x.question.currentAssumption}”
                  </span>
                  <span className="text-[12px] whitespace-nowrap text-muted-foreground">{name(x.question.ownerId)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function Nudges({ b }: { b: Brief }) {
  const cap = useCap(b.risks, 4, "items");
  return (
    <Card title={`Needs a nudge${b.risks.length ? ` (${b.risks.length})` : ""}`} description="Worth a word with the person named. Worst first.">
      {b.risks.length === 0 ? (
        <State framed size="sm" scene="projects" title="Nothing is stuck" description="No overdue actions, no idle findings, and the channels are balanced." />
      ) : (
        <>
          <ul className={`grid gap-2 ${cap.scroll}`}>
            {cap.shown.map((r) => (
              <li key={r.id}>
                <Link to={r.href} className={`group grid gap-0.5 rounded-[10px] p-3 ring-1 ring-border transition-colors hover:bg-accent ${r.tone === "destructive" ? "bg-destructive-soft/40" : ""}`}>
                  <span className={`flex items-center gap-1.5 text-[13px] font-medium ${r.tone === "destructive" ? "text-destructive" : "text-warning"}`}>
                    <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                    {r.title}
                    <ArrowRight className="ml-auto size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" aria-hidden />
                  </span>
                  <span className="text-[12px] text-muted-foreground">{r.detail}</span>
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

function Portfolio({ b }: { b: Brief }) {
  const name = useUserName();
  const shown = b.portfolio.slice(0, 5);
  return (
    <Card
      title="Question portfolio"
      description="Every question on its way from asking customers to closing the loop. Late ones first, then the earliest."
      aside={
        <Button asChild variant="ghost" size="sm">
          <Link to="/questions">
            All {b.portfolio.length} questions <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </Button>
      }
    >
      <ul className="grid divide-y divide-border">
        {shown.map((r) => (
          <li key={r.question.id} className="py-3 first:pt-0 last:pb-0">
            <Link to={`/questions/${r.question.id}/overview`} className="group grid gap-x-6 gap-y-2 rounded-[10px] md:grid-cols-[minmax(0,1fr)_260px]">
              <div className="grid min-w-0 content-start gap-0.5">
                <span className="text-[13px] font-medium group-hover:underline">
                  {r.question.id}: {r.question.text}
                </span>
                <span className="text-[12px] text-muted-foreground">
                  {name(r.question.ownerId)}
                  {r.question.decisionItInforms ? ` · Informs: ${r.question.decisionItInforms}` : ""}
                </span>
              </div>
              <div className="grid content-start gap-1.5">
                <span className="flex items-center justify-between gap-2">
                  <Badge size="sm" tone={STAGE_TONE[r.stage]}>{STAGE_LABEL[r.stage]}</Badge>
                  <span className="text-[11.5px] text-muted-foreground tabular-nums">Step {r.step + 1} of {STAGES.length}</span>
                </span>
                <Progress
                  size="sm"
                  tone={r.overdue ? "destructive" : r.stage === "closed-loop" ? "success" : "chart"}
                  value={r.step + 1}
                  max={STAGES.length}
                  label={<span className="sr-only">{`${r.question.id}: step ${r.step + 1} of ${STAGES.length}, ${STAGE_LABEL[r.stage]}`}</span>}
                />
                <span className={`text-[12px] ${r.overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                  {r.overdue ? `${r.overdue} overdue · ` : ""}
                  {r.next}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const EVENT_ICON: Record<BriefEvent["kind"], React.ReactNode> = {
  question: <Lightbulb />,
  conversation: <MessagesSquare />,
  finding: <PenLine />,
  action: <Target />,
  outcome: <CheckCircle2 />,
};

function ThisWeek({ b }: { b: Brief }) {
  const [view, setView] = React.useState<"next" | "past">(b.upcoming.length ? "next" : "past");
  type Item = { key: string; at: string; href: string; text: string; icon: React.ReactNode; late?: boolean };
  const items: Item[] =
    view === "next"
      ? b.upcoming.map((u) => ({ key: `${u.kind}-${u.href}-${u.at}`, at: u.at, href: u.href, text: u.text, icon: u.kind === "call" ? <CalendarClock /> : <Target />, late: u.late }))
      : b.events.map((e) => ({ key: `${e.kind}-${e.href}-${e.at}`, at: e.at, href: e.href, text: e.text, icon: EVENT_ICON[e.kind], late: false }));
  const cap = useCap(items, 6, view === "next" ? "upcoming items" : "updates");
  return (
    <Card
      title="Timeline"
      description={view === "next" ? `Customer calls and due dates in the two weeks from ${fmtDate(TODAY)}.` : "What the team did, newest first."}
      aside={
        <SegmentedControl
          size="sm"
          label="Timeline view"
          value={view}
          onChange={setView}
          options={[
            { value: "next", label: `Coming up (${b.upcoming.length})` },
            { value: "past", label: "What happened" },
          ]}
        />
      }
    >
      {items.length === 0 ? (
        <State framed size="sm" scene="inbox" title={view === "next" ? "Nothing scheduled" : "No activity yet"} description={view === "next" ? "No calls booked or actions due in the next two weeks." : "Updates appear as the team works."} />
      ) : (
        <>
          <ol className={`grid gap-1 ${cap.scroll}`}>
            {cap.shown.map((i) => (
              <li key={i.key}>
                <Link to={i.href} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-[10px] px-2 py-2 transition-colors hover:bg-accent">
                  <span aria-hidden className={`mt-0.5 grid size-6 place-items-center rounded-full ring-1 ring-border [&_svg]:size-3.5 ${i.late ? "bg-destructive-soft text-destructive" : "bg-background text-foreground/75"}`}>
                    {i.icon}
                  </span>
                  <span className="text-[13px]">
                    {i.text}
                    {i.late && <span className="ml-1.5 font-medium text-destructive">Overdue</span>}
                  </span>
                  <span className="text-[12px] whitespace-nowrap text-muted-foreground tabular-nums">{i.at.length > 10 ? fmtDateTime(i.at) : fmtDate(i.at)}</span>
                </Link>
              </li>
            ))}
          </ol>
          {cap.toggle}
        </>
      )}
    </Card>
  );
}

/** Home for the CEO: a one-screen brief on what customer learning has changed, read-only, with links into the detail. */
export function ExecutiveBrief() {
  const load = useLoad("home");
  const me = useMe();
  const db = useStore((s) => s.db);
  const name = useUserName();
  const b = React.useMemo(() => executiveBrief(liveDb(db)), [db]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(briefText(b, name));
      toast.success("Brief copied", { description: "Plain text, ready to paste into an email or a leadership update." });
    } catch {
      toast.error("Couldn't copy the brief", { description: "Your browser blocked clipboard access. Try again from this tab." });
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={`${me.title} · ${ROLE_LABEL[me.role]} · ${fmtDate(TODAY)}`}
        title={`Hello, ${me.name.split(" ")[0]}`}
        description={load.status === "ready" ? summary(b) : "Your brief on what customers are teaching us."}
        actions={
          <>
            <Button variant="outline" onClick={copy} disabled={load.status !== "ready"}>
              <ClipboardCopy className="size-4" aria-hidden /> Copy brief
            </Button>
            {canCreateQuestion(me).ok && (
              <Button variant="outline" asChild>
                <Link to="/questions/new">
                  <PlusCircle className="size-4" aria-hidden /> Raise a question
                </Link>
              </Button>
            )}
            <Button asChild>
              <Link to="/dashboard">
                <Gauge className="size-4" aria-hidden /> Insights & Impacts
              </Link>
            </Button>
          </>
        }
      />
      <Loaded load={load}>
        {() => (
          <div className="grid gap-6">
            <Pulse b={b} />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <Beliefs b={b} />
              <div className="grid content-start gap-6">
                <AssignedActions />
                <Nudges b={b} />
                <GlobalSearch />
              </div>
            </div>
            <Portfolio b={b} />
            <ThisWeek b={b} />
          </div>
        )}
      </Loaded>
    </>
  );
}
