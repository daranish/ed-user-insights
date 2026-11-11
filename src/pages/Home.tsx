import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, FileText, Lightbulb, PlusCircle } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { State } from "@/components/ui/state";
import { useStore } from "@/lib/store";
import { useLoad, useMe, useUserName } from "@/lib/hooks";
import { canCreateQuestion, ROLE_LABEL } from "@/lib/permissions";
import { search } from "@/lib/rules/search";
import { displayEvidence, CAPTURE_LABEL } from "@/lib/rules/consent";
import { participantOfEvidence } from "@/lib/rules/coverage";
import { isOverdue } from "@/lib/rules/metrics";
import { CONFIDENCE_LABEL } from "@/lib/rules/confidence";
import { fmtDate, TODAY, daysBetween } from "@/lib/time";
import { ActionStatusBadge, ActionTypeBadge, Card, ConfidenceBadge, Loaded, PageHeader } from "@/components/app/common";

export function GlobalSearch() {
  const db = useStore((s) => s.db);
  const navigate = useNavigate();
  const [q, setQ] = React.useState("");
  const hits = React.useMemo(() => search(q, db, { limit: 12 }), [q, db]);
  const findings = hits.filter((h) => h.kind === "finding");
  const evidence = hits.filter((h) => h.kind === "evidence");

  return (
    <div className="overflow-hidden rounded-[14px] bg-card ring-1 ring-border">
      <Command shouldFilter={false} label="Search findings and evidence">
        <CommandInput value={q} onValueChange={setQ} placeholder="Search findings and evidence: try “bottle”, “price” or “shower routine”" />
        {q.trim() && (
          <CommandList>
            <CommandEmpty>No findings or evidence match “{q}”. Try a broader word.</CommandEmpty>
            {findings.length > 0 && (
              <CommandGroup heading="Findings">
                {findings.map((h) => (
                  <CommandItem
                    key={h.id}
                    value={h.id}
                    icon={<Lightbulb />}
                    onSelect={() => navigate(`/questions/${h.questionId}/findings?f=${h.id}`)}
                    hint={`${h.questionId}: ${h.questionText} · n = ${h.n} · ${h.confidence ? CONFIDENCE_LABEL[h.confidence] : "Unrated"}`}
                  >
                    {h.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {evidence.length > 0 && (
              <CommandGroup heading="Evidence">
                {evidence.map((h) => {
                  const ev = db.evidence.find((e) => e.id === h.id)!;
                  const code = participantOfEvidence(db, ev.sessionId);
                  const view = displayEvidence(ev);
                  return (
                    <CommandItem
                      key={h.id}
                      value={h.id}
                      icon={<FileText />}
                      onSelect={() => navigate(`/questions/${h.questionId}/sessions`)}
                      hint={`${h.questionId}: ${h.questionText} · ${CAPTURE_LABEL[ev.captureType]}${code ? ` · ${code}` : ""}${h.confidence ? ` · in a ${CONFIDENCE_LABEL[h.confidence]} finding` : ""}`}
                    >
                      {view.text}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        )}
      </Command>
    </div>
  );
}

/** Everything assigned to me: open work first, soonest due first, finished work last. */
export function AssignedActions() {
  const me = useMe();
  const db = useStore((s) => s.db);
  const name = useUserName();
  const assigned = db.actions
    .filter((a) => a.assigneeId === me.id)
    .sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || a.dueDate.localeCompare(b.dueDate));
  const openCount = assigned.filter((a) => a.status !== "done").length;
  return (
    <Card
      title={`Assigned actions${assigned.length ? ` (${openCount} open)` : ""}`}
      description="Actions other people, or you, have assigned to you. Open one to update its status or add a comment."
    >
      {assigned.length === 0 ? (
        <State
          scene="projects"
          title="Nothing assigned to you"
          description="When someone assigns you an action on any question, it shows up here with its due date."
          framed
        />
      ) : (
        <ul className="grid gap-2">
          {assigned.map((a) => {
            const q = db.questions.find((x) => x.id === a.questionId);
            const late = isOverdue(a);
            return (
              <li key={a.id}>
                <Link
                  to={`/questions/${a.questionId}/actions?a=${a.id}`}
                  className={`group grid gap-1.5 rounded-[10px] p-3 ring-1 ring-border transition-colors hover:bg-accent ${late ? "bg-destructive-soft/40" : ""} ${a.status === "done" ? "opacity-75" : ""}`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ActionStatusBadge status={a.status} overdue={late} />
                    <ActionTypeBadge type={a.type} />
                    <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" aria-hidden />
                  </div>
                  <span className="font-medium">{a.description}</span>
                  <span className="text-[12px] text-muted-foreground">
                    {a.ownerId === me.id ? "Assigned by you" : `Assigned by ${name(a.ownerId)}`} · {a.questionId}
                    {q ? `: ${q.text}` : ""} · due {fmtDate(a.dueDate)}
                    {late ? ` (${daysBetween(a.dueDate, TODAY)} days late)` : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function Home() {
  const load = useLoad("home");
  const me = useMe();
  const db = useStore((s) => s.db);

  const create = canCreateQuestion(me);

  return (
    <>
      <PageHeader
        eyebrow={`${me.title} · ${ROLE_LABEL[me.role]}`}
        title={`Hello, ${me.name.split(" ")[0]}`}
        description="Questions turn into conversations, conversations into evidence, evidence into findings, and findings into actions with owners."
        actions={
          create.ok && (
            <Button asChild>
              <Link to="/questions/new">
                <PlusCircle className="size-4" aria-hidden /> {me.role === "owner" ? "New question" : "Raise a question"}
              </Link>
            </Button>
          )
        }
      />
      <Loaded load={load}>
        {() => (
          <div className="grid gap-6">
            <GlobalSearch />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
              <AssignedActions />

              <div className="grid content-start gap-6">
                <Card title="Recently written findings">
                  <ul className="grid gap-3">
                    {[...db.findings].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4).map((f) => (
                      <li key={f.id} className="grid gap-1">
                        <Link to={`/questions/${f.questionId}/findings?f=${f.id}`} className="text-[13px] font-medium hover:underline">{f.claim}</Link>
                        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                          <ConfidenceBadge level={f.confidence} /> {f.questionId}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </div>
          </div>
        )}
      </Loaded>
    </>
  );
}
