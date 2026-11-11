import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle, Check, CheckCircle2, ChevronDown, Circle, GitCompare, Info, Plus, RefreshCw, Save, Search, ThumbsDown, ThumbsUp, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { State } from "@/components/ui/state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectItem } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Combobox } from "@/components/ui/combobox";
import { Stepper } from "@/components/ui/stepper";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { EvidenceMap, type EvidenceEdge, type EvidenceNode } from "@/components/ui/evidence-map";
import { InlineDiff } from "@/components/ui/inline-diff";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { ConflictError, useStore } from "@/lib/store";
import { useMutation, useUserName } from "@/lib/hooks";
import type { Check as PermissionCheck } from "@/lib/permissions";
import type { Db, Evidence, Finding, Question, Stance } from "@/lib/types";
import { CONFIDENCES } from "@/lib/types";
import { computeCoverage, nOfN, participantOfEvidence } from "@/lib/rules/coverage";
import { completionBlockers, confidenceChecks, CONFIDENCE_LABEL, CONFIDENCE_RULE, isConfidenceValid } from "@/lib/rules/confidence";
import { displayEvidence } from "@/lib/rules/consent";
import { fmtDateTime } from "@/lib/time";
import { ConfidenceBadge, Reason } from "@/components/app/common";
import { EvidenceItem } from "@/components/app/evidence";

const STANCES: { value: Stance; label: string; tone: "success" | "destructive" | "neutral"; icon: React.ElementType; hint: string }[] = [
  { value: "supports", label: "Supports", tone: "success", icon: ThumbsUp, hint: "Backs the claim." },
  { value: "contradicts", label: "Contradicts", tone: "destructive", icon: ThumbsDown, hint: "Goes against the claim. Keep these: they keep the finding honest." },
  { value: "context", label: "Context", tone: "neutral", icon: Info, hint: "Helps explain it, but is neither for nor against." },
];

type SectionKey = "claim" | "evidence" | "rate" | "finish";
const SECTION_KEYS: SectionKey[] = ["claim", "evidence", "rate", "finish"];

/** Index of the first step that is not finished yet (4 when all are). */
function firstOpenStep(f: Finding): number {
  const done = [
    !!f.claim.trim() && !!f.limitations.trim(),
    f.links.length > 0,
    f.confidence !== null && f.counterEvidenceChecked !== null,
    f.status === "complete",
  ];
  const i = done.findIndex((d) => !d);
  return i < 0 ? done.length : i;
}

/** Small flag for a finding that goes against the question's starting assumption. */
function ContradictsBadge({ finding, question }: { finding: Finding; question: Question }) {
  if (!question.currentAssumption || finding.assumptionVerdict !== "contradicts") return null;
  return (
    <Badge size="sm" tone="warning" className="h-[18px] gap-1 px-1.5 text-[10.5px]" title={`Contradicts the assumption: ${question.currentAssumption}`}>
      <GitCompare className="size-2.5" aria-hidden /> Contradicts assumption
    </Badge>
  );
}

function evidenceMapData(f: Finding, db: Db) {
  const nodes: EvidenceNode[] = [{ id: f.id, kind: "claim", title: f.claim, description: f.limitations ? `Limits: ${f.limitations}` : undefined, status: f.links.some((l) => l.stance === "contradicts") ? "conflicting" : f.links.some((l) => l.stance === "supports") ? "supported" : "unsupported" }];
  const edges: EvidenceEdge[] = [];
  for (const l of f.links) {
    const e = db.evidence.find((x) => x.id === l.evidenceId);
    if (!e) continue;
    const code = participantOfEvidence(db, e.sessionId);
    const view = displayEvidence(e);
    nodes.push({
      id: e.id,
      kind: "note",
      title: view.text,
      description: `${e.captureType}${code ? ` · ${code}` : ""}`,
      sourceType: code ?? "Interview",
    });
    edges.push({ id: `${f.id}-${e.id}`, source: f.id, target: e.id, relation: l.stance === "context" ? "contextualizes" : l.stance });
  }
  return { nodes, edges };
}

function ConflictDialog({ conflict, mine, onReload, onMerged, onClose }: { conflict: ConflictError | null; mine: Finding; onReload: () => void; onMerged: (claim: string, limitations: string) => void; onClose: () => void }) {
  const [mode, setMode] = React.useState<"choose" | "compare">("choose");
  const [claim, setClaim] = React.useState("");
  const [limits, setLimits] = React.useState("");
  React.useEffect(() => {
    if (conflict) {
      setMode("choose");
      setClaim(conflict.server.claim);
      setLimits(conflict.server.limitations);
    }
  }, [conflict]);
  if (!conflict) return null;
  const theirs = conflict.server;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg" title="Someone else saved this finding" description={`${conflict.byName} saved v${theirs.version} while you were editing v${mine.version}. Your changes are not lost yet.`}>
        {mode === "choose" ? (
          <div className="grid gap-3">
            <Alert tone="warning" size="sm">Saving now would overwrite their changes, so the app stopped. Choose how to continue.</Alert>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" onClick={onReload}>
                <RefreshCw className="size-4" aria-hidden /> Reload their version
              </Button>
              <Button onClick={() => setMode("compare")}>
                <GitCompare className="size-4" aria-hidden /> Compare and merge
              </Button>
            </div>
            <p className="text-[12px] text-muted-foreground">Reload discards your unsaved edits. Compare shows their text with your changes as suggestions to accept or reject.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            <InlineDiff title="Claim: your changes on their version" original={theirs.claim} suggested={mine.claim} onChange={setClaim} />
            <InlineDiff title="Limitations: your changes on their version" original={theirs.limitations} suggested={mine.limitations} onChange={setLimits} />
            <p className="text-[12px] text-muted-foreground">Your evidence links, confidence and counter-evidence check are kept. The merge saves as v{theirs.version + 1}.</p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setMode("choose")}>Back</Button>
              <Button onClick={() => onMerged(claim, limits)}>Save merged version</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewFindingDialog({ open, onOpenChange, question, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; question: Question; onCreated: (id: string) => void }) {
  const createFinding = useStore((s) => s.createFinding);
  const m = useMutation(createFinding);
  const [claim, setClaim] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      setClaim("");
      setSubmitted(false);
      m.setError(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const err = !claim.trim() ? "Write the claim in one sentence." : claim.trim().length < 8 ? "Say a little more." : undefined;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New finding" description="State it as a claim the evidence can support or contradict. You link the evidence next.">
        <form
          className="grid gap-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            setSubmitted(true);
            if (err) return;
            const r = await m.run(question.id, claim.trim());
            if (r.ok && r.value) {
              onCreated(r.value);
              onOpenChange(false);
            }
          }}
        >
          <Field label="Claim" required error={submitted ? err : undefined}>
            <Input autoFocus value={claim} onChange={(e) => setClaim(e.target.value)} placeholder="Delivery problems put people off a second order" />
          </Field>
          {m.error && <Alert tone="destructive" size="sm">{m.error}</Alert>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={m.busy}>Create finding</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A numbered step of the finding, with its own heading. The body can be collapsed; it stays mounted so nothing typed is lost. */
function Section({ id, n, title, description, done, summary, open, onToggle, aside, children }: { id: string; n: number; title: string; description?: React.ReactNode; done: boolean; summary?: React.ReactNode; open: boolean; onToggle: () => void; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`min-w-0 scroll-mt-6 rounded-[14px] bg-card ring-1 ring-border ${open ? "p-4 sm:p-5" : "px-4 py-2.5 sm:px-5"}`}>
      <div className={`flex flex-wrap items-start justify-between gap-3 ${open ? "mb-4" : ""}`}>
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-[8px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span
            aria-hidden
            className={`grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {done ? <Check className="size-3.5" strokeWidth={3} /> : n}
          </span>
          <span className="min-w-0 flex-1">
            <span id={`${id}-h`} className="block text-[14.5px] font-semibold">
              {title}
              {done && <span className="sr-only"> (done)</span>}
            </span>
            <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{open ? description : summary ?? description}</span>
          </span>
        </button>
        <div className="flex items-center gap-2">
          {open && aside}
          <Button
            variant="ghost"
            size="sm"
            icon
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={`${id}-body`}
            aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
          >
            <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
          </Button>
        </div>
      </div>
      <div id={`${id}-body`} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

function StanceBadge({ stance }: { stance: Stance }) {
  const s = STANCES.find((x) => x.value === stance)!;
  const Icon = s.icon;
  return (
    <Badge size="sm" tone={s.tone}>
      <Icon className="size-3" aria-hidden /> {s.label}
    </Badge>
  );
}

function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span key={t} className="rounded-[6px] bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">#{t}</span>
      ))}
    </div>
  );
}

/** The evidence already linked to the finding, grouped by how it relates. */
function LinkedEvidence({ evidence, draft, onStance, readOnly, onFind }: { evidence: Evidence[]; draft: Finding; onStance: (id: string, s: Stance | null) => void; readOnly: boolean; onFind: () => void }) {
  const linked = draft.links.flatMap((l) => {
    const ev = evidence.find((e) => e.id === l.evidenceId);
    return ev ? [{ stance: l.stance, ev }] : [];
  });
  if (!linked.length) {
    return (
      <State
        size="sm"
        title="Nothing linked yet"
        description="Find the items that back or go against this claim and link them."
        action={!readOnly ? <Button size="sm" onClick={onFind}><Search className="size-3.5" aria-hidden /> Find evidence</Button> : undefined}
      />
    );
  }
  return (
    <div className="grid gap-5">
      {STANCES.map((s) => {
        const items = linked.filter((x) => x.stance === s.value);
        return (
          <div key={s.value} className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <StanceBadge stance={s.value} />
              <span className="text-[12px] text-muted-foreground">{items.length} item{items.length === 1 ? "" : "s"} · {s.hint}</span>
            </div>
            {items.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-border px-3 py-2.5 text-[12.5px] text-muted-foreground">
                {s.value === "contradicts" ? "No contradicting evidence linked. Look for some before you rate confidence." : "None."}
              </p>
            ) : (
              items.map(({ ev }) => (
                <div key={ev.id} className="grid gap-2 rounded-[10px] p-3 ring-1 ring-border">
                  <EvidenceItem
                    ev={ev}
                    compact
                    aside={
                      !readOnly && (
                        <Button size="sm" variant="ghost" icon aria-label={`Unlink ${ev.id}`} title="Unlink" onClick={() => onStance(ev.id, null)}>
                          <X className="size-3.5" />
                        </Button>
                      )
                    }
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <TagList tags={ev.tags} />
                    {!readOnly && (
                      <SegmentedControl<Stance>
                        label={`How ${ev.id} relates to the finding`}
                        size="sm"
                        value={s.value}
                        onChange={(v) => onStance(ev.id, v)}
                        options={STANCES.map((x) => ({ value: x.value, label: x.label }))}
                      />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Unlinked evidence of the question, searchable, one click to link. */
function FindEvidence({ evidence, draft, onStance }: { evidence: Evidence[]; draft: Finding; onStance: (id: string, s: Stance) => void }) {
  const db = useStore((s) => s.db);
  const [text, setText] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const available = evidence.filter((e) => !draft.links.some((l) => l.evidenceId === e.id));
  const allTags = [...new Set(available.flatMap((e) => e.tags))].sort();
  const q = text.trim().toLowerCase();
  const shown = available.filter((e) => {
    if (tags.length && !tags.some((t) => e.tags.includes(t))) return false;
    if (!q) return true;
    const code = participantOfEvidence(db, e.sessionId) ?? "";
    return [e.id, code, e.textEn, e.textOriginal ?? "", ...e.tags].some((x) => x.toLowerCase().includes(q));
  });

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Search">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Words, participant (P-011) or ID" />
        </Field>
        <Field label="Tags">
          <Combobox multiple value={tags} onValueChange={setTags} options={allTags.map((t) => ({ value: t, label: t }))} placeholder="Any tag" searchPlaceholder="Find a tag" />
        </Field>
      </div>
      <p className="text-[12px] text-muted-foreground">
        {shown.length} of {available.length} unlinked item{available.length === 1 ? "" : "s"}
      </p>
      {available.length === 0 ? (
        <State size="sm" title={evidence.length ? "Everything is linked" : "No evidence for this question yet"} description={evidence.length ? "All of this question's evidence is already on the finding." : "Capture evidence on the Sessions tab, then link it here."} />
      ) : shown.length === 0 ? (
        <State size="sm" title="Nothing matches" description="Try other words or clear the tags." />
      ) : (
        <ul className="grid gap-2">
          {shown.map((ev) => (
            <li key={ev.id} className="grid gap-2 rounded-[10px] p-3 ring-1 ring-border">
              <EvidenceItem ev={ev} compact />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <TagList tags={ev.tags} />
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[12px] text-muted-foreground">Link as</span>
                  {STANCES.map((s) => {
                    const Icon = s.icon;
                    return (
                      <Button key={s.value} size="sm" variant="outline" aria-label={`Link ${ev.id} as ${s.label}`} onClick={() => onStance(ev.id, s.value)}>
                        <Icon className="size-3.5" aria-hidden /> {s.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FindingEditor({ question, finding, canEdit }: { question: Question; finding: Finding; canEdit: PermissionCheck }) {
  const db = useStore((s) => s.db);
  const name = useUserName();
  const saveFinding = useStore((s) => s.saveFinding);
  const completeFinding = useStore((s) => s.completeFinding);
  const clearFlags = useStore((s) => s.clearFindingFlags);
  const deleteFinding = useStore((s) => s.deleteFinding);
  const del = useMutation(deleteFinding);
  const [, setParams] = useSearchParams();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [draft, setDraft] = React.useState<Finding>(finding);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [conflict, setConflict] = React.useState<ConflictError | null>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const readOnly = !canEdit.ok;
  const [pane, setPane] = React.useState<"linked" | "find">(finding.links.length || readOnly ? "linked" : "find");
  const complete = useMutation(completeFinding);
  const clear = useMutation(clearFlags);

  const dirty = JSON.stringify([draft.claim, draft.limitations, draft.links, draft.confidence, draft.counterEvidenceChecked, draft.assumptionVerdict]) !==
    JSON.stringify([finding.claim, finding.limitations, finding.links, finding.confidence, finding.counterEvidenceChecked, finding.assumptionVerdict]);

  // Follow the stored finding when it changes and nothing is being edited.
  React.useEffect(() => {
    if (!dirty) setDraft(finding);
  }, [finding]); // eslint-disable-line react-hooks/exhaustive-deps

  const evidence = db.evidence.filter((e) => e.questionId === question.id);
  const cov = computeCoverage(draft, db);
  const checks = confidenceChecks(cov);
  const highest = [...CONFIDENCES].reverse().find((c) => checks[c].allowed);
  const actions = db.actions.filter((a) => a.findingIds.includes(finding.id));
  const soleActions = actions.filter((a) => a.findingIds.length === 1);
  const savedCov = computeCoverage(finding, db);
  const blockers = completionBlockers(finding, savedCov);
  const [open, setOpen] = React.useState<Record<SectionKey, boolean>>(() => {
    const cur = firstOpenStep(finding);
    return { claim: cur === 0, evidence: cur === 1, rate: cur === 2, finish: cur >= 3 };
  });
  const toggle = (k: SectionKey) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const allOpen = Object.values(open).every(Boolean);
  const ids = { claim: `${finding.id}-claim`, evidence: `${finding.id}-evidence`, rate: `${finding.id}-rate`, finish: `${finding.id}-finish` };

  const errors = {
    claim: !draft.claim.trim() ? "A finding needs a claim." : undefined,
    limitations: !draft.limitations.trim() ? "Say what this finding does not tell us." : undefined,
    confidence: !isConfidenceValid(draft.confidence, cov) ? "This level is higher than the linked evidence allows." : undefined,
    counter: draft.counterEvidenceChecked === "linked" && cov.contradicting === 0 ? "No contradicting evidence is linked." : undefined,
  };
  const valid = !Object.values(errors).some(Boolean);

  const stepDone = [
    !!draft.claim.trim() && !!draft.limitations.trim(),
    draft.links.length > 0,
    draft.confidence !== null && !errors.confidence && draft.counterEvidenceChecked !== null && !errors.counter,
    finding.status === "complete",
  ];
  const firstOpen = stepDone.findIndex((d) => !d);
  const current = firstOpen < 0 ? stepDone.length : firstOpen;

  const checklist: { ok: boolean; label: React.ReactNode }[] = [
    { ok: !!finding.claim.trim() && !!finding.limitations.trim(), label: "Claim and limitations written" },
    { ok: finding.links.some((l) => l.stance === "supports"), label: "Supporting evidence linked" },
    { ok: finding.confidence !== null && isConfidenceValid(finding.confidence, savedCov), label: "Confidence chosen, within what the evidence allows" },
    { ok: finding.counterEvidenceChecked !== null, label: "Counter-evidence checked" },
    { ok: !dirty, label: "Changes saved" },
  ];
  const canComplete = !readOnly && blockers.length === 0 && checklist.every((c) => c.ok);

  function setStance(id: string, s: Stance | null) {
    setDraft((d) => {
      const links = d.links.filter((l) => l.evidenceId !== id);
      return { ...d, links: s === null ? links : [...links, { evidenceId: id, stance: s }] };
    });
  }

  async function save(next: Finding = draft) {
    setSubmitted(true);
    if (!valid && next === draft) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await saveFinding(next);
      setDraft(saved);
      setSubmitted(false);
      toast.success(`Saved as v${saved.version}`);
    } catch (e) {
      if (e instanceof ConflictError) setConflict(e);
      else setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const goTo = (key: SectionKey) => {
    setOpen((o) => ({ ...o, [key]: true }));
    setTimeout(() => document.getElementById(ids[key])?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const map = evidenceMapData(finding, db);

  return (
    <div className="grid min-w-0 content-start gap-4">
      {/* Header: what this finding is and how far along it is */}
      <div className="grid gap-3 rounded-[14px] bg-card p-4 ring-1 ring-border sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{finding.id}</span> · v{finding.version} · last saved by {name(finding.updatedById)}, {fmtDateTime(finding.updatedAt)} · {nOfN(cov)}
          </span>
          <div className="flex items-center gap-1">
            {canEdit.ok && (
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-3.5" aria-hidden /> Delete finding
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setOpen({ claim: !allOpen, evidence: !allOpen, rate: !allOpen, finish: !allOpen })}>
              {allOpen ? "Collapse all" : "Expand all"}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="min-w-0 flex-1 text-[19px] leading-snug font-semibold text-balance">{draft.claim || "Untitled finding"}</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <ConfidenceBadge level={finding.confidence} />
            <ContradictsBadge finding={finding} question={question} />
            {finding.status === "complete" ? (
              <Badge size="sm" tone="success"><CheckCircle2 className="size-3" aria-hidden /> Complete</Badge>
            ) : (
              <Badge size="sm" tone="outline">Draft</Badge>
            )}
          </div>
        </div>
        <Stepper
          current={current}
          onStepClick={(i) => goTo(SECTION_KEYS[i])}
          steps={[
            { title: "State the claim", description: "And its limits" },
            { title: "Link evidence", description: `${draft.links.length} linked` },
            { title: "Rate confidence", description: draft.confidence ? CONFIDENCE_LABEL[draft.confidence] : "Not rated", error: !!errors.confidence },
            { title: "Complete", description: finding.status === "complete" ? "Done" : "Checks and actions" },
          ]}
        />
      </div>

      {finding.evidenceChanged && (
        <Alert
          tone="warning"
          title="Evidence changed since written"
          action={canEdit.ok && <Button size="sm" variant="outline" loading={clear.busy} onClick={() => clear.run(finding.id)}>I've re-read it</Button>}
        >
          Linked evidence was edited after this finding was saved. Re-read the evidence and check the claim still holds.
        </Alert>
      )}
      {finding.needsReReview && (
        <Alert
          tone="destructive"
          title="Needs re-review"
          action={canEdit.ok && <Button size="sm" variant="outline" loading={clear.busy} onClick={() => clear.run(finding.id)}>Mark reviewed</Button>}
        >
          Some linked evidence was removed. Coverage and confidence below are recalculated without it.
        </Alert>
      )}
      <Reason check={canEdit} />

      {/* 1. Claim */}
      <Section id={ids.claim} n={1} title="State the claim" description="One sentence the evidence can back or go against, and what it does not tell us." done={stepDone[0]} summary={draft.claim || "No claim yet"} open={open.claim} onToggle={() => toggle("claim")}>
        <div className="grid gap-4">
          <Field label="Claim" required error={submitted ? errors.claim : undefined}>
            <Textarea value={draft.claim} onChange={(e) => setDraft({ ...draft, claim: e.target.value })} rows={2} autoGrow={false} disabled={readOnly} />
          </Field>
          <Field label="Limitations" required hint="What this finding does not tell us, e.g. who you didn't speak to." error={submitted ? errors.limitations : undefined}>
            <Textarea value={draft.limitations} onChange={(e) => setDraft({ ...draft, limitations: e.target.value })} rows={3} autoGrow={false} disabled={readOnly} />
          </Field>
          {question.currentAssumption && (
            <Field label="Relation to Existing Assumption" hint={<><strong className="font-semibold text-foreground">Previous assumption:</strong> {question.currentAssumption}</>}>
              <Select value={draft.assumptionVerdict} onValueChange={(v) => setDraft({ ...draft, assumptionVerdict: v as Finding["assumptionVerdict"] })} disabled={readOnly}>
                <SelectItem value="supports">Supports the assumption</SelectItem>
                <SelectItem value="contradicts">Contradicts the assumption</SelectItem>
                <SelectItem value="not-addressed">Doesn't address it</SelectItem>
              </Select>
            </Field>
          )}
        </div>
      </Section>

      {/* 2. Evidence */}
      <Section
        id={ids.evidence}
        n={2}
        title="Link evidence"
        description="Mark what supports the claim, what goes against it, and what gives context."
        done={stepDone[1]}
        summary={`${draft.links.length} linked · ${cov.contradicting} contradicting · ${nOfN(cov)}`}
        open={open.evidence}
        onToggle={() => toggle("evidence")}
        aside={
          !readOnly && (
            <SegmentedControl<"linked" | "find">
              label="Evidence view"
              size="sm"
              value={pane}
              onChange={setPane}
              options={[
                { value: "linked", label: `Linked (${draft.links.length})` },
                { value: "find", label: "Find evidence" },
              ]}
            />
          )
        }
      >
        <div className="min-w-0">
          {pane === "find" && !readOnly ? (
            <FindEvidence evidence={evidence} draft={draft} onStance={setStance} />
          ) : (
            <LinkedEvidence evidence={evidence} draft={draft} onStance={setStance} readOnly={readOnly} onFind={() => setPane("find")} />
          )}
        </div>
      </Section>

      {/* 3. Confidence */}
      <Section
        id={ids.rate}
        n={3}
        title="Rate confidence"
        description={highest ? `The linked evidence allows up to ${CONFIDENCE_LABEL[highest]}.` : "Link evidence from at least one participant to rate this finding."}
        done={stepDone[2]}
        summary={draft.confidence ? `${CONFIDENCE_LABEL[draft.confidence]} · counter-evidence ${draft.counterEvidenceChecked ? "checked" : "not checked"}` : "Not rated yet"}
        open={open.rate}
        onToggle={() => toggle("rate")}
      >
        <div className="grid gap-6">
          <fieldset className="grid content-start gap-2">
            <legend className="mb-1 text-[13px] font-medium">Confidence</legend>
            <RadioGroup
              variant="card"
              value={draft.confidence ?? ""}
              onValueChange={(v) => setDraft({ ...draft, confidence: v as Finding["confidence"] })}
              disabled={readOnly}
              aria-label="Confidence"
            >
              {CONFIDENCES.map((c) => (
                <RadioGroupItem
                  key={c}
                  value={c}
                  disabled={!checks[c].allowed}
                  label={CONFIDENCE_LABEL[c]}
                  hint={`${CONFIDENCE_RULE[c]} ${checks[c].allowed ? `✓ ${checks[c].reason}` : `Not yet: ${checks[c].reason}`}`}
                />
              ))}
            </RadioGroup>
            {errors.confidence && (
              <p role="alert" className="flex gap-1.5 text-[12px] text-destructive">
                <AlertTriangle className="mt-0.5 size-3.5" aria-hidden /> {errors.confidence} Pick a lower level.
              </p>
            )}
          </fieldset>

          <fieldset className="grid content-start gap-2">
            <legend className="mb-1 text-[13px] font-medium">Counter-evidence check</legend>
            <p className="text-[12px] text-muted-foreground">Did you look for anything that goes against the claim?</p>
            <RadioGroup
              variant="card"
              value={draft.counterEvidenceChecked ?? ""}
              onValueChange={(v) => setDraft({ ...draft, counterEvidenceChecked: v as Finding["counterEvidenceChecked"] })}
              disabled={readOnly}
              aria-label="Counter-evidence check"
            >
              <RadioGroupItem value="linked" disabled={cov.contradicting === 0} label="Contradicting evidence is linked" hint={cov.contradicting ? `${cov.contradicting} item${cov.contradicting === 1 ? "" : "s"} linked as contradicting.` : "Link an item as “Contradicts” first."} />
              <RadioGroupItem value="none-found" label="I looked and found none" hint="You searched this question's evidence for anything against the claim." />
            </RadioGroup>
            {submitted && errors.counter && <p role="alert" className="text-[12px] text-destructive">{errors.counter}</p>}
          </fieldset>
        </div>
      </Section>

      {/* 4. Complete */}
      <Section id={ids.finish} n={4} title="Complete the finding" description="A finding is complete when it is checked and saved." done={stepDone[3]} summary={finding.status === "complete" ? "Complete" : `${checklist.filter((c) => c.ok).length} of ${checklist.length} checks done`} open={open.finish} onToggle={() => toggle("finish")}>
        {finding.status === "complete" ? (
          <p className="flex items-center gap-2 text-[13px]">
            <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
            Complete. It counts on Home and in the CEO view, with {actions.length} action{actions.length === 1 ? "" : "s"}:{" "}
            <Link className="underline" to={`/questions/${question.id}/actions?f=${finding.id}`}>see actions</Link>
          </p>
        ) : (
          <div className="grid gap-4">
            <ul className="grid gap-2 text-[13px]">
              {checklist.map((c, i) => (
                <li key={i} className="flex items-start gap-2">
                  {c.ok ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="Done" />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Not done" />
                  )}
                  <span className={c.ok ? "" : "text-muted-foreground"}>{c.label}</span>
                </li>
              ))}
            </ul>
            <div>
              <Button
                loading={complete.busy}
                disabled={!canComplete}
                onClick={async () => {
                  if ((await complete.run(finding.id)).ok) toast.success("Finding marked complete");
                }}
              >
                <CheckCircle2 className="size-4" aria-hidden /> Mark complete
              </Button>
            </div>
            {complete.error && <Alert tone="destructive" size="sm">{complete.error}</Alert>}
          </div>
        )}
      </Section>

      <div className="rounded-[14px] bg-card px-4 ring-1 ring-border sm:px-5 [&_h3_button]:py-2.5">
        <Accordion type="multiple">
          <AccordionItem value="map" title="Evidence map" subtitle={map.edges.length ? `${map.edges.length} saved link${map.edges.length === 1 ? "" : "s"}. Solid lines support, dashed contradict, dotted give context.` : "Link evidence and save to see the map."}>
            {map.edges.length === 0 ? (
              <State size="sm" title="No evidence linked yet" description="Link evidence and save to see the map." />
            ) : (
              <EvidenceMap nodes={map.nodes} edges={map.edges} linkedBy="human" />
            )}
          </AccordionItem>
        </Accordion>
      </div>

      {/* Save bar: only while there is something to save, so a saved finding has no extra scroll */}
      {!readOnly && (dirty || busy || error || (submitted && !valid)) && (
        <div className="sticky bottom-3 z-20 grid gap-2 rounded-[12px] bg-card/95 px-4 py-3 shadow-lg ring-1 ring-border backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[13px]" role="status">
              <span className="size-2 rounded-full bg-warning" aria-hidden /> Unsaved changes
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setDraft(finding); setSubmitted(false); setError(null); }} disabled={!dirty || busy}>
                Discard
              </Button>
              <Button onClick={() => save()} loading={busy} disabled={!dirty}>
                <Save className="size-4" aria-hidden /> Save finding
              </Button>
            </div>
          </div>
          {error && <Alert tone="destructive" size="sm" title="Not saved">{error}</Alert>}
          {submitted && !valid && (
            <Alert tone="warning" size="sm">
              Fix before saving: {[errors.claim, errors.limitations, errors.confidence, errors.counter].filter(Boolean).join(" ")}
            </Alert>
          )}
        </div>
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent title={`Delete ${finding.id}?`} description="This can't be undone. The evidence itself stays on the Evidence tab.">
          <div className="grid gap-4">
            <p className="text-[13px]">
              “{finding.claim || "Untitled finding"}” will be removed
              {soleActions.length > 0 ? `, along with ${soleActions.length} action${soleActions.length === 1 ? "" : "s"} that only this finding supports` : ""}.
            </p>
            {del.error && <Alert tone="destructive" size="sm">{del.error}</Alert>}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button
                variant="destructive"
                loading={del.busy}
                onClick={async () => {
                  if ((await del.run(finding.id)).ok) {
                    setConfirmDelete(false);
                    setParams({});
                    toast.success("Finding deleted");
                  }
                }}
              >
                Delete finding
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <ConflictDialog
        conflict={conflict}
        mine={draft}
        onClose={() => setConflict(null)}
        onReload={() => {
          if (conflict) setDraft(conflict.server);
          setConflict(null);
          toast.info(`Loaded v${conflict?.server.version}`, { description: "Your unsaved edits were discarded." });
        }}
        onMerged={(claim, limitations) => {
          const server = conflict!.server;
          setConflict(null);
          void save({ ...draft, claim, limitations, version: server.version });
        }}
      />
    </div>
  );
}

export function Findings({ question, canEdit }: { question: Question; canEdit: PermissionCheck }) {
  const db = useStore((s) => s.db);
  const [params, setParams] = useSearchParams();
  const findings = db.findings.filter((f) => f.questionId === question.id);
  const selectedId = params.get("f") ?? findings[0]?.id;
  const selected = findings.find((f) => f.id === selectedId) ?? findings[0];
  const [newOpen, setNewOpen] = React.useState(false);

  if (!selected) {
    return (
      <>
        <State
          scene="chart"
          title="No findings yet"
          description="Once you have evidence from a few conversations, write a finding: a claim, the evidence for and against it, and what it does not tell us."
          action={canEdit.ok ? <Button onClick={() => setNewOpen(true)}>Write the first finding</Button> : undefined}
          secondaryAction={<Link className="text-[13px] underline" to={`/questions/${question.id}/sessions`}>Capture evidence first</Link>}
          framed
        />
        <NewFindingDialog open={newOpen} onOpenChange={setNewOpen} question={question} onCreated={(id) => setParams({ f: id })} />
      </>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <nav aria-label="Findings" className="grid h-fit content-start gap-3 lg:sticky lg:top-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[14px] font-semibold">
            Findings <span className="font-normal text-muted-foreground">({findings.length})</span>
          </h2>
          <Button size="sm" variant="outline" onClick={() => setNewOpen(true)} disabled={!canEdit.ok}>
            <Plus className="size-3.5" aria-hidden /> New
          </Button>
        </div>
        <ul className="grid gap-2">
          {findings.map((f) => {
            const on = selected.id === f.id;
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setParams({ f: f.id })}
                  aria-current={on ? "true" : undefined}
                  className={`grid w-full gap-1.5 rounded-[10px] p-3 text-left ring-1 transition-colors ${on ? "bg-accent ring-primary/40" : "bg-card ring-border hover:bg-accent"}`}
                >
                  <span className="line-clamp-2 text-[13.5px] leading-snug font-medium">{f.claim}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <ConfidenceBadge level={f.confidence} />
                    <ContradictsBadge finding={f} question={question} />
                    {f.status === "complete" ? (
                      <Badge size="sm" tone="success"><CheckCircle2 className="size-3" aria-hidden /> Complete</Badge>
                    ) : (
                      <Badge size="sm" tone="outline">Draft</Badge>
                    )}
                    {(f.evidenceChanged || f.needsReReview) && (
                      <Badge size="sm" tone="warning"><AlertTriangle className="size-3" aria-hidden /> Re-read</Badge>
                    )}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    {nOfN(computeCoverage(f, db))} · {f.links.length} linked
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <FindingEditor key={selected.id} question={question} finding={selected} canEdit={canEdit} />
      <NewFindingDialog open={newOpen} onOpenChange={setNewOpen} question={question} onCreated={(id) => setParams({ f: id })} />
    </div>
  );
}
