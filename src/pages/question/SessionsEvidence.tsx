import * as React from "react";
import { AlertTriangle, FileAudio, Hourglass, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { State } from "@/components/ui/state";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Kbd } from "@/components/ui/kbd";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { useMutation, useUserName } from "@/lib/hooks";
import type { Check } from "@/lib/permissions";
import { CAPTURE_TYPES, type CaptureType, type Evidence, type Question, type Session } from "@/lib/types";
import { CAPTURE_LABEL } from "@/lib/rules/consent";
import { detectPii } from "@/lib/rules/pii";
import { fmtDate } from "@/lib/time";
import { sessionsAwaitingEvidence } from "@/lib/rules/recruitment";
import { participantOfEvidence } from "@/lib/rules/coverage";
import { Card, Reason, SimBadge } from "@/components/app/common";
import { EvidenceItem } from "@/components/app/evidence";
import { ConsentIcon } from "./PipelineBoard";

const LANGUAGES = ["English", "Hindi", "Kannada", "Tamil", "Telugu", "Marathi", "Bengali"];

function SessionCard({ s, selected, onSelect, waiting }: { s: Session; selected: boolean; onSelect: () => void; waiting: boolean }) {
  const db = useStore((st) => st.db);
  const name = useUserName();
  const p = db.participants.find((x) => x.code === s.participantCode);
  const count = db.evidence.filter((e) => e.sessionId === s.id).length;
  const rec = db.recruitments.find((r) => r.questionId === s.questionId && r.participantCode === s.participantCode);
  const recorded = !!rec?.consentRecord && !!s.recordingRef;
  return (
    <div className={`grid gap-2 rounded-[10px] p-3 ring-1 transition-colors ${selected ? "bg-accent ring-primary/40" : "ring-border"}`}>
      <button type="button" onClick={onSelect} className="grid gap-0.5 text-left" aria-pressed={selected}>
        <span className="flex items-center justify-between gap-2">
          <span className="font-medium">{s.participantCode} · {fmtDate(s.date)}</span>
          {waiting ? (
            <Badge size="sm" tone="warning"><Hourglass className="size-3" aria-hidden /> Evidence needed</Badge>
          ) : (
            <Badge size="sm" tone="outline">{count} evidence</Badge>
          )}
        </span>
        <span className="text-[12px] text-muted-foreground">
          {p?.segment} · {p?.channel} · {s.languageSpoken} · by {name(s.conductorId)}
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <ConsentIcon kind="record" given={rec?.consentRecord} />
          <ConsentIcon kind="quote" given={rec?.consentQuote} />
          {recorded && <span className="flex items-center gap-1"><FileAudio className="size-3.5" aria-hidden /> Call recording available</span>}
        </span>
      </button>
    </div>
  );
}

function RecordingLink({ s, consented, canEdit }: { s: Session; consented: boolean; canEdit: Check }) {
  const unavailable = useStore((st) => st.sim.recordingUnavailable);
  const setLink = useStore((st) => st.setRecordingLink);
  const m = useMutation(setLink);
  const [editing, setEditing] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const valid = /^https?:\/\/\S+$/i.test(url.trim());
  const showForm = canEdit.ok && (editing || !s.recordingRef);

  async function save() {
    setSubmitted(true);
    if (!valid) return;
    const r = await m.run(s.id, url.trim());
    if (r.ok) {
      toast.success("Recording link saved");
      setEditing(false);
      setSubmitted(false);
    }
  }

  return (
    <div className="mb-3 grid gap-2 rounded-[10px] bg-muted/60 p-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
          <FileAudio className="size-3.5" aria-hidden /> Call recording
        </span>
        <SimBadge what="Drive link" />
      </div>
      {!consented ? (
        <span className="text-muted-foreground">No recording: {s.participantCode} did not consent to being recorded.</span>
      ) : unavailable ? (
        <span className="flex items-center gap-1.5 text-destructive" role="status">
          <AlertTriangle className="size-3.5" aria-hidden /> Recording unavailable (Drive returned an error)
        </span>
      ) : showForm ? (
        <form
          noValidate
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Field
            label="Recording link"
            error={submitted && !valid ? "Paste a link that starts with https://" : m.error ?? undefined}
            hint="Save the recording to your Google Drive, copy its share link and paste it here."
          >
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/file/d/…" autoComplete="off" />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={m.busy}>Save link</Button>
            {editing && <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(false); setSubmitted(false); }}>Cancel</Button>}
          </div>
        </form>
      ) : s.recordingRef ? (
        <div className="flex items-center justify-between gap-2">
          <a
            href={s.recordingRef}
            className="flex min-w-0 items-center gap-1.5 font-medium underline"
            onClick={(e) => {
              e.preventDefault();
              toast.info("Simulated link", { description: "In production this opens the recording in Google Drive." });
            }}
          >
            <span className="truncate">{s.recordingRef}</span>
          </a>
          {canEdit.ok && (
            <Button size="sm" variant="outline" onClick={() => { setUrl(s.recordingRef ?? ""); setEditing(true); }}>
              <Pencil className="size-3.5" aria-hidden /> Edit link
            </Button>
          )}
        </div>
      ) : (
        <span className="text-muted-foreground">No recording link added yet.</span>
      )}
    </div>
  );
}

function EvidenceForm({ question, sourceId, canEdit, quoteOk }: { question: Question; sourceId: string; canEdit: Check; quoteOk: boolean }) {
  const db = useStore((s) => s.db);
  const addEvidence = useStore((s) => s.addEvidence);
  const m = useMutation(addEvidence);
  const session = db.sessions.find((s) => s.id === sourceId);

  const [text, setText] = React.useState("");
  const [original, setOriginal] = React.useState("");
  const [capture, setCapture] = React.useState<CaptureType>(quoteOk ? "direct-quotation" : "paraphrase");
  const [language, setLanguage] = React.useState(session?.languageSpoken ?? "English");
  const [tags, setTags] = React.useState<string[]>([]);
  const [extraTags, setExtraTags] = React.useState<string[]>([]);
  const [submitted, setSubmitted] = React.useState(false);
  const textRef = React.useRef<HTMLTextAreaElement>(null);
  const quote = capture === "direct-quotation";

  const allTags = [...new Set([...db.evidence.flatMap((e) => e.tags), ...extraTags])].sort();
  const names = db.contacts.map((c) => c.name);
  const pii = detectPii(`${text} ${original}`, names);
  const errors = {
    text: !text.trim() ? (quote ? "Add the translated text, in English." : "Write what was said or seen.") : undefined,
    tags: tags.length === 0 ? "Add at least one tag so this can be grouped and found." : undefined,
    original: quote && !original.trim() ? "Add their original words." : undefined,
  };
  const valid = !Object.values(errors).some(Boolean);

  async function save() {
    setSubmitted(true);
    if (!valid || !canEdit.ok) return;
    const r = await m.run({
      questionId: question.id,
      sessionId: sourceId,
      textEn: text.trim(),
      textOriginal: quote ? original.trim() : undefined,
      originalLanguage: quote ? language : undefined,
      captureType: capture,
      tags,
    });
    if (r.ok) {
      toast.success(`Evidence ${r.value} saved`, { description: "Type the next one. Capture type and tags are kept." });
      setText("");
      setOriginal("");
      setSubmitted(false);
      textRef.current?.focus();
    }
  }

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          void save();
        }
      }}
    >
      <SegmentedControl<CaptureType>
        label="Capture type"
        size="sm"
        value={capture}
        onChange={setCapture}
        options={CAPTURE_TYPES.filter((c) => quoteOk || c !== "direct-quotation").map((c) => ({ value: c, label: CAPTURE_LABEL[c] }))}
      />
      {!quoteOk && (
        <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <ConsentIcon kind="quote" given={false} /> Direct quotation is off: {session?.participantCode} did not consent to being quoted. Write a paraphrase or an observation instead.
        </p>
      )}
      {quote && (
        <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
          <Field label="Language">
            <Select value={language} onValueChange={setLanguage}>
              {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </Select>
          </Field>
          <Field label="Original words" required error={submitted ? errors.original : undefined} hint="Exactly as they said it, in the language spoken.">
            <Textarea autoFocus value={original} onChange={(e) => setOriginal(e.target.value)} rows={2} disabled={!canEdit.ok} />
          </Field>
        </div>
      )}
      <Field
        label={quote ? "Translated text" : "Evidence"}
        required
        error={submitted ? errors.text : undefined}
        hint={quote ? "The original words in English. If they spoke English, repeat them." : capture === "observation" ? "What you saw them do or what the data shows." : undefined}
      >
        <Textarea ref={textRef} autoFocus={!quote} value={text} onChange={(e) => setText(e.target.value)} rows={3} disabled={!canEdit.ok} placeholder="I still have a third of the bottle left…" />
      </Field>
      {pii.length > 0 && (
        <Alert tone="warning" size="sm" title="This looks like personal information">
          <ul className="list-disc pl-4">
            {pii.map((w) => <li key={w.kind + w.match}>{w.message}</li>)}
          </ul>
        </Alert>
      )}
      <Field label="Tags" required error={submitted ? errors.tags : undefined}>
        <Combobox
          multiple
          value={tags}
          onValueChange={setTags}
          options={allTags.map((t) => ({ value: t, label: t }))}
          placeholder="still-using, price…"
          searchPlaceholder="Find or create a tag"
          disabled={!canEdit.ok}
          onCreate={(t) => {
            const tag = t.toLowerCase().replace(/\s+/g, "-");
            setExtraTags((x) => [...x, tag]);
            setTags((x) => [...new Set([...x, tag])]);
          }}
        />
      </Field>
      {m.error && <Alert tone="destructive" size="sm" title="Not saved">{m.error}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Kbd keys="mod+enter" size="sm" /> saves and starts the next one
        </span>
        <Button type="submit" loading={m.busy} disabled={!canEdit.ok}>Save evidence</Button>
      </div>
      <Reason check={canEdit} />
    </form>
  );
}

function EditEvidenceDialog({ ev, onClose }: { ev: Evidence | null; onClose: () => void }) {
  const db = useStore((s) => s.db);
  const editEvidence = useStore((s) => s.editEvidence);
  const m = useMutation(editEvidence);
  const [text, setText] = React.useState("");
  const [original, setOriginal] = React.useState("");
  const [language, setLanguage] = React.useState("English");
  const [capture, setCapture] = React.useState<CaptureType>("direct-quotation");
  React.useEffect(() => {
    if (ev) {
      setText(ev.textEn);
      setOriginal(ev.textOriginal ?? "");
      setLanguage(ev.originalLanguage ?? "English");
      setCapture(ev.captureType);
      m.setError(null);
    }
  }, [ev]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ev) return null;
  const quote = capture === "direct-quotation";
  const code = participantOfEvidence(db, ev.sessionId);
  const quoteOk = ev.captureType === "direct-quotation" || !!db.recruitments.find((r) => r.questionId === ev.questionId && r.participantCode === code)?.consentQuote;
  const usedBy = db.findings.filter((f) => f.links.some((l) => l.evidenceId === ev.id));
  const ready = !!text.trim() && (!quote || !!original.trim());
  return (
    <Dialog open={!!ev} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Edit ${ev.id}`} description="Edits keep the previous text as a revision.">
        <div className="grid gap-4">
          {usedBy.length > 0 && (
            <Alert tone="warning" size="sm" title={`Used by ${usedBy.length} finding${usedBy.length === 1 ? "" : "s"}`}>
              Saving flags {usedBy.map((f) => `“${f.claim}”`).join(", ")} as “evidence changed since written”, so the owner re-reads it.
            </Alert>
          )}
          <SegmentedControl<CaptureType> label="Capture type" size="sm" value={capture} onChange={setCapture} options={CAPTURE_TYPES.filter((c) => quoteOk || c !== "direct-quotation").map((c) => ({ value: c, label: CAPTURE_LABEL[c] }))} />
          {!quoteOk && <p className="text-[12.5px] text-muted-foreground">Direct quotation is off: {code} did not consent to being quoted.</p>}
          {quote && (
            <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
              <Field label="Language">
                <Select value={language} onValueChange={setLanguage}>
                  {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </Select>
              </Field>
              <Field label="Original words" required error={!original.trim() ? "Original words can't be empty." : undefined}>
                <Textarea value={original} onChange={(e) => setOriginal(e.target.value)} rows={2} />
              </Field>
            </div>
          )}
          <Field label={quote ? "Translated text" : "Evidence"} required error={!text.trim() ? "Evidence can't be empty." : undefined}>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          </Field>
          {ev.revisions.length > 0 && (
            <details className="text-[12.5px] text-muted-foreground">
              <summary className="cursor-pointer">{ev.revisions.length} earlier version{ev.revisions.length === 1 ? "" : "s"}</summary>
              <ul className="mt-2 grid gap-1">
                {ev.revisions.map((r, i) => <li key={i}>“{r.previousTextEn}”</li>)}
              </ul>
            </details>
          )}
          {m.error && <Alert tone="destructive" size="sm">{m.error}</Alert>}
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              loading={m.busy}
              disabled={!ready}
              onClick={async () => {
                const r = await m.run(ev.id, {
                  textEn: text.trim(),
                  captureType: capture,
                  tags: ev.tags,
                  textOriginal: quote ? original.trim() : undefined,
                  originalLanguage: quote ? language : undefined,
                });
                if (r.ok) {
                  toast.success("Evidence updated", { description: r.value ? `${r.value} finding${r.value === 1 ? "" : "s"} flagged for re-reading.` : "Saved as a new revision." });
                  onClose();
                }
              }}
            >
              Save revision
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SessionsEvidence({ question, canEdit }: { question: Question; canEdit: Check }) {
  const db = useStore((s) => s.db);
  const sessions = db.sessions.filter((s) => s.questionId === question.id).sort((a, b) => b.date.localeCompare(a.date));
  const evidence = db.evidence.filter((e) => e.questionId === question.id);
  const waiting = sessionsAwaitingEvidence(sessions, evidence);
  const [source, setSource] = React.useState<string>((waiting[0] ?? sessions[0])?.id ?? "");
  const [editing, setEditing] = React.useState<Evidence | null>(null);
  const [adding, setAdding] = React.useState(false);
  const selected = db.sessions.find((s) => s.id === source);
  const mine = evidence.filter((e) => e.sessionId === source);
  const rec = db.recruitments.find((r) => r.questionId === question.id && r.participantCode === selected?.participantCode);
  const consented = !!rec?.consentRecord;
  const quoteOk = !!rec?.consentQuote;

  return (
    <div className="grid gap-6">
      {waiting.length > 0 && canEdit.ok && (
        <Alert tone="warning" title={`Evidence needed for ${waiting.length} participant${waiting.length === 1 ? "" : "s"}`}>
          The call is done for {waiting.map((s) => s.participantCode).join(", ")}. Pick them below and add what they said or did.
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card title="Participants" description="People appear here when you mark their call Done on the Recruitment tab.">
          {sessions.length === 0 ? (
            <State size="sm" title="No finished calls yet" description="Mark an accepted participant Done on the Recruitment tab, 30 minutes after the call. They move here to wait for your evidence." />
          ) : (
            <div className="grid gap-2">
              {sessions.map((s) => (
                <SessionCard key={s.id} s={s} selected={source === s.id} onSelect={() => setSource(s.id)} waiting={waiting.some((w) => w.id === s.id)} />
              ))}
            </div>
          )}
          <Reason check={canEdit} className="mt-3" />
        </Card>

        <Card
          title={selected ? `Evidence from ${selected.participantCode} (${mine.length})` : "Evidence"}
          description="What was collected from this participant."
          aside={
            selected && canEdit.ok && (
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus className="size-3.5" aria-hidden /> Add evidence
              </Button>
            )
          }
        >
          {!selected ? (
            <State size="sm" title="Pick a participant" description="Choose someone on the left to see the evidence collected from them." />
          ) : null}
          {selected && (
            <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px]">
              <span className="flex items-center gap-2"><ConsentIcon kind="record" given={consented} /> Recording consent: {consented ? "Given" : "Not given"}</span>
              <span className="flex items-center gap-2"><ConsentIcon kind="quote" given={quoteOk} /> Quote consent: {quoteOk ? "Given" : "Not given"}</span>
            </div>
          )}
          {selected && <RecordingLink key={selected.id} s={selected} consented={consented} canEdit={canEdit} />}
          {!selected ? null : mine.length === 0 ? (
            <State size="sm" title="No evidence yet" description={canEdit.ok ? "Press Add evidence to write what they said or did." : "Nothing has been captured from this participant."} />
          ) : (
            <div className="grid gap-2">
              {mine.map((ev) => (
                <EvidenceItem
                  key={ev.id}
                  ev={ev}
                  aside={
                    canEdit.ok && (
                      <Button size="sm" variant="ghost" icon aria-label={`Edit ${ev.id}`} onClick={() => setEditing(ev)}>
                        <Pencil className="size-3.5" />
                      </Button>
                    )
                  }
                />
              ))}
            </div>
          )}
        </Card>
      </div>
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent title={`Add evidence: ${selected?.participantCode ?? ""}`} description="Save, and the form clears for the next item. Capture type and tags are kept.">
          {selected && <EvidenceForm key={source} question={question} sourceId={source} canEdit={canEdit} quoteOk={quoteOk} />}
        </DialogContent>
      </Dialog>
      <EditEvidenceDialog ev={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

type CaptureFilter = CaptureType | "all";

export function EvidenceTab({ question, canEdit }: { question: Question; canEdit: Check }) {
  const db = useStore((s) => s.db);
  const evidence = db.evidence.filter((e) => e.questionId === question.id);
  const [editing, setEditing] = React.useState<Evidence | null>(null);
  const [tags, setTags] = React.useState<string[]>([]);
  const [who, setWho] = React.useState("all");
  const [capture, setCapture] = React.useState<CaptureFilter>("all");

  const allTags = [...new Set(evidence.flatMap((e) => e.tags))].sort();
  const people = [...new Set(evidence.map((e) => participantOfEvidence(db, e.sessionId)).filter((c): c is string => !!c))].sort();
  const shown = evidence.filter(
    (e) =>
      (capture === "all" || e.captureType === capture) &&
      (who === "all" || participantOfEvidence(db, e.sessionId) === who) &&
      (tags.length === 0 || tags.some((t) => e.tags.includes(t))),
  );
  const filtered = capture !== "all" || who !== "all" || tags.length > 0;

  return (
    <div className="grid gap-6">
      <Card title="Filter evidence">
        <div className="grid items-end gap-4 md:grid-cols-2">
          <Field label="Tags" optional>
            <Combobox multiple value={tags} onValueChange={setTags} options={allTags.map((t) => ({ value: t, label: t }))} placeholder="Any tag" searchPlaceholder="Find a tag" />
          </Field>
          <Field label="Participant" optional>
            <Select value={who} onValueChange={setWho}>
              <SelectItem value="all">All participants</SelectItem>
              {people.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </Select>
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl<CaptureFilter>
            label="Capture type"
            size="sm"
            value={capture}
            onChange={setCapture}
            options={[{ value: "all", label: "All" }, ...CAPTURE_TYPES.map((c) => ({ value: c as CaptureFilter, label: CAPTURE_LABEL[c] }))]}
          />
          {filtered && (
            <Button size="sm" variant="ghost" onClick={() => { setTags([]); setWho("all"); setCapture("all"); }}>Clear filters</Button>
          )}
        </div>
      </Card>

      <Card title={`All evidence (${shown.length}${filtered ? ` of ${evidence.length}` : ""})`} description="Each item shows its capture type.">
        {evidence.length === 0 ? (
          <State size="sm" title="No evidence yet" description="Evidence you capture from calls appears here, ready to link to findings." />
        ) : shown.length === 0 ? (
          <State size="sm" title="Nothing matches these filters" description="Clear a filter to see more." />
        ) : (
          <div className="grid gap-2">
            {shown.map((ev) => (
              <EvidenceItem
                key={ev.id}
                ev={ev}
                aside={
                  canEdit.ok && (
                    <Button size="sm" variant="ghost" icon aria-label={`Edit ${ev.id}`} onClick={() => setEditing(ev)}>
                      <Pencil className="size-3.5" />
                    </Button>
                  )
                }
              />
            ))}
          </div>
        )}
      </Card>
      <EditEvidenceDialog ev={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
