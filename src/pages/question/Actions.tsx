import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Circle, CircleDot, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { State } from "@/components/ui/state";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectItem } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { useMe, useMutation, useUserName } from "@/lib/hooks";
import { canEditAction, canUpdateAction, type Check } from "@/lib/permissions";
import { ACTION_TYPES, type Action, type ActionLogEntry, type ActionStatus, type ActionType, type Question } from "@/lib/types";
import { isOverdue } from "@/lib/rules/metrics";
import { actionLog } from "@/lib/rules/actionLog";
import { fmtDate, fmtDateTime, toDay, TODAY } from "@/lib/time";
import { ActionTypeBadge, ACTION_TYPE_LABEL, Card, Reason } from "@/components/app/common";

const STATUS_LABEL: Record<ActionStatus, string> = { open: "Open", "in-progress": "In progress", done: "Done" };

const TYPE_HINT: Record<ActionType, string> = {
  decision: "We change something now, because of these findings.",
  experiment: "We test a change and measure it.",
  "more-research": "We need more or different evidence first.",
  "no-action": "We deliberately don't act. Say why.",
};

function ActionFormDialog({ open, onOpenChange, question, defaultFindingId, editing }: { open: boolean; onOpenChange: (o: boolean) => void; question: Question; defaultFindingId?: string; editing?: Action | null }) {
  const db = useStore((s) => s.db);
  const me = useMe();
  const createAction = useStore((s) => s.createAction);
  const editAction = useStore((s) => s.editAction);
  const create = useMutation(createAction);
  const edit = useMutation(editAction);
  const m = editing ? edit : create;
  const findings = db.findings.filter((f) => f.questionId === question.id);
  const [findingIds, setFindingIds] = React.useState<string[]>([]);
  const [type, setType] = React.useState<ActionType>("decision");
  const [description, setDescription] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [assigneeId, setAssigneeId] = React.useState(me.id);
  const [due, setDue] = React.useState<Date | undefined>();
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setFindingIds(editing ? editing.findingIds : defaultFindingId ? [defaultFindingId] : findings[0] ? [findings[0].id] : []);
      setType(editing?.type ?? "decision");
      setDescription(editing?.description ?? "");
      setReason(editing?.reason ?? "");
      setAssigneeId(editing?.assigneeId ?? me.id);
      setDue(editing ? new Date(`${editing.dueDate}T00:00:00`) : undefined);
      setSubmitted(false);
      create.setError(null);
      edit.setError(null);
    }
  }, [open, editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dueChanged = !editing || (due && toDay(due) !== editing.dueDate);
  const errors = {
    findings: findingIds.length === 0 ? "Pick at least one finding that backs this action." : undefined,
    description: !description.trim() ? "Describe the action." : undefined,
    reason: type === "no-action" && !reason.trim() ? "A no-action needs a reason, so the choice is visible later." : undefined,
    due: !due ? "Set a due date." : dueChanged && toDay(due) < TODAY ? "Due date can't be in the past." : undefined,
  };
  const valid = !Object.values(errors).some(Boolean);
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        title={editing ? `Edit action ${editing.id}` : "New action"}
        description={editing ? "Only you, as its creator, can change these details. The person it's assigned to updates the status." : "Anyone can create an action. You become its owner, and you pick who it's assigned to."}
      >
        <form
          noValidate
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSubmitted(true);
            if (!valid) return;
            const body = { findingIds, type, description: description.trim(), reason: type === "no-action" ? reason.trim() : undefined, assigneeId, dueDate: toDay(due!) };
            const r = editing ? await edit.run(editing.id, body) : await create.run({ ...body, questionId: question.id });
            if (r.ok) {
              toast.success(editing ? "Action updated" : `Action ${r.value} created`);
              onOpenChange(false);
            }
          }}
        >
          <Field label="Supported by findings" required error={show("findings")} hint="An action can come from more than one finding.">
            <Combobox
              multiple
              value={findingIds}
              onValueChange={setFindingIds}
              options={findings.map((f) => ({ value: f.id, label: `${f.id} · ${f.claim}` }))}
              placeholder="Choose findings"
              searchPlaceholder="Find a finding"
            />
          </Field>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-[13px] font-medium">Type</legend>
            <RadioGroup variant="card" value={type} onValueChange={(v) => setType(v as ActionType)} className="sm:grid-cols-2" aria-label="Action type">
              {ACTION_TYPES.map((t) => <RadioGroupItem key={t} value={t} label={ACTION_TYPE_LABEL[t]} hint={TYPE_HINT[t]} />)}
            </RadioGroup>
          </fieldset>
          <Field label="Description" required error={show("description")}>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} autoGrow={false} placeholder={type === "experiment" ? "A/B test a day-55 reminder…" : "What will happen"} />
          </Field>
          {type === "no-action" && (
            <Field label="Reason for no action" required error={show("reason")}>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} autoGrow={false} />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Assigned to" required hint={assigneeId === me.id ? "You, as the creator, are doing it yourself." : undefined}>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                {db.users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}{u.id === me.id ? " (you)" : ""} · {u.title}</SelectItem>)}
              </Select>
            </Field>
            <Field label={type === "no-action" ? "Review date" : "Due date"} required error={show("due")}>
              <DatePicker value={due} onValueChange={setDue} disabledDays={{ before: new Date(`${TODAY}T00:00:00`) }} />
            </Field>
          </div>
          {m.error && <Alert tone="destructive" size="sm" title="Not saved">{m.error}</Alert>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={m.busy}>{editing ? "Save changes" : "Create action"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One entry of the progress log, worded for a reader scanning the history. */
function LogItem({ entry, last, final }: { entry: ActionLogEntry; last: boolean; final: boolean }) {
  const name = useUserName();
  let title: string;
  let Icon = CircleDot;
  let tone = "text-muted-foreground";
  if (entry.kind === "created") {
    title = "Action created";
    Icon = Sparkles;
  } else if (entry.kind === "edited") {
    title = "Action edited";
    Icon = Pencil;
  } else if (entry.status === "done") {
    title = "Marked done";
    Icon = CheckCircle2;
    tone = "text-success";
  } else if (entry.status) {
    title = `Moved to ${STATUS_LABEL[entry.status].toLowerCase()}`;
    Icon = entry.status === "in-progress" ? CircleDot : Circle;
    tone = entry.status === "in-progress" ? "text-primary" : "text-muted-foreground";
  } else {
    title = "Progress note";
  }
  return (
    <li className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0">
      {!last && <span className="absolute top-5 bottom-0 left-[9.5px] w-px bg-border" aria-hidden />}
      <Icon className={`relative mt-0.5 size-5 rounded-full bg-card ${tone}`} aria-hidden />
      <div className="grid min-w-0 gap-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-[13px] font-medium">{title}</span>
          <time dateTime={entry.at} className="text-[12px] text-muted-foreground">{fmtDateTime(entry.at)}</time>
        </div>
        {entry.note && (
          <p className="rounded-[8px] bg-muted/60 px-2.5 py-1.5 text-[13px] leading-relaxed whitespace-pre-wrap">
            {final && <span className="mb-0.5 block text-[11.5px] font-medium text-muted-foreground">Final outcome</span>}
            {entry.note}
          </p>
        )}
        <span className="text-[12px] text-muted-foreground">
          by {name(entry.byId)}
        </span>
      </div>
    </li>
  );
}

function ActionDialog({ action: opened, initialStatus, onEdit, onClose }: { action: Action | null; initialStatus?: ActionStatus; onEdit: (a: Action) => void; onClose: () => void }) {
  const me = useMe();
  const deleteAction = useStore((s) => s.deleteAction);
  const del = useMutation(deleteAction);
  const [confirming, setConfirming] = React.useState(false);
  const db = useStore((s) => s.db);
  const name = useUserName();
  const updateAction = useStore((s) => s.updateAction);
  const m = useMutation(updateAction);
  const action = opened ? db.actions.find((a) => a.id === opened.id) ?? opened : null;
  const [status, setStatus] = React.useState<ActionStatus>("open");
  const [note, setNote] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const logRef = React.useRef<HTMLOListElement>(null);
  React.useEffect(() => {
    if (opened) {
      setStatus(initialStatus ?? opened.status);
      setNote("");
      setSubmitted(false);
      setConfirming(false);
      m.setError(null);
    }
  }, [opened?.id, initialStatus]); // eslint-disable-line react-hooks/exhaustive-deps
  const entries = action ? actionLog(action) : [];
  React.useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length, opened?.id]);
  if (!action) return null;
  const check = canUpdateAction(me, action, name(action.assigneeId));
  const mayEdit = canEditAction(me, action, name(action.ownerId));
  const supporting = action.findingIds.map((id) => db.findings.find((f) => f.id === id)).filter((x): x is NonNullable<typeof x> => !!x);

  const changed = status !== action.status;
  const finishing = status === "done";
  const err = finishing && !note.trim() ? "Write the final outcome before marking it done." : !changed && !note.trim() ? "Add a note or change the status." : undefined;
  const lastDone = [...entries].reverse().find((e) => e.status === "done")?.id;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg" title={`Action ${action.id}`} description={action.description}>
        <div className="grid gap-5">
          <dl className="grid gap-x-4 gap-y-2 rounded-[10px] bg-muted/60 p-3 text-[13px] sm:grid-cols-3">
            <div><dt className="text-[12px] text-muted-foreground">Type</dt><dd><ActionTypeBadge type={action.type} /></dd></div>
            <div><dt className="text-[12px] text-muted-foreground">{action.type === "no-action" ? "Review date" : "Due"}</dt><dd>{fmtDate(action.dueDate)}</dd></div>
            <div><dt className="text-[12px] text-muted-foreground">Owner (created it)</dt><dd>{name(action.ownerId)}</dd></div>
            <div><dt className="text-[12px] text-muted-foreground">Assigned to</dt><dd>{name(action.assigneeId)}{action.assigneeId === action.ownerId ? " (same person)" : ""}</dd></div>
            <div className="sm:col-span-3">
              <dt className="text-[12px] text-muted-foreground">Supported by {supporting.length} finding{supporting.length === 1 ? "" : "s"}</dt>
              <dd>
                <ul className="mt-0.5 grid gap-0.5">
                  {supporting.map((f) => <li key={f.id} className="line-clamp-2"><span className="font-medium">{f.id}</span> · {f.claim}</li>)}
                </ul>
              </dd>
            </div>
            {action.reason && <div className="sm:col-span-3"><dt className="text-[12px] text-muted-foreground">Reason</dt><dd>{action.reason}</dd></div>}
          </dl>

          {mayEdit.ok && (
            <div className="-mt-2 grid gap-2">
              {confirming ? (
                <Alert tone="destructive" size="sm" title={`Delete ${action.id}?`}>
                  <span className="block">This removes the action and its progress log. It can't be undone.</span>
                  {del.error && <span className="mt-1 block">{del.error}</span>}
                  <span className="mt-2 flex gap-2">
                    <Button size="sm" variant="destructive" loading={del.busy} onClick={async () => { if ((await del.run(action.id)).ok) { toast.success("Action deleted"); onClose(); } }}>Delete action</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Keep it</Button>
                  </span>
                </Alert>
              ) : (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onEdit(action)}><Pencil className="size-3.5" aria-hidden /> Edit details</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirming(true)}><Trash2 className="size-3.5" aria-hidden /> Delete</Button>
                </div>
              )}
            </div>
          )}

          <section aria-labelledby="progress-h" className="grid gap-2">
            <h3 id="progress-h" className="text-[13px] font-semibold">Progress <span className="font-normal text-muted-foreground">({entries.length})</span></h3>
            <ol ref={logRef} className="max-h-[260px] overflow-y-auto pr-1">
              {entries.map((e, i) => <LogItem key={e.id} entry={e} last={i === entries.length - 1} final={e.id === lastDone && action.status === "done"} />)}
            </ol>
          </section>

          {check.ok ? (
            <form
              noValidate
              className="grid gap-3 border-t border-border pt-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setSubmitted(true);
                if (err) return;
                const r = await m.run(action.id, { status: changed ? status : undefined, note });
                if (r.ok) {
                  toast.success(finishing ? "Marked done" : "Progress added");
                  setNote("");
                  setSubmitted(false);
                  setStatus(status);
                }
              }}
            >
              <h3 className="text-[13px] font-semibold">{action.status === "done" ? "Add a follow-up" : "Add an update"}</h3>
              <div className="grid items-start gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                <Field label="Status">
                  <Select value={status} onValueChange={(v) => setStatus(v as ActionStatus)}>
                    {(Object.keys(STATUS_LABEL) as ActionStatus[]).map((k) => <SelectItem key={k} value={k}>{STATUS_LABEL[k]}</SelectItem>)}
                  </Select>
                </Field>
                <Field
                  label={finishing && changed ? "Final outcome" : "Note"}
                  required={finishing && changed}
                  optional={!(finishing && changed)}
                  error={submitted ? err : undefined}
                  hint={finishing && changed ? "What happened, and did it change the decision?" : "What changed or what you heard back."}
                >
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} autoGrow={false} placeholder={finishing && changed ? "We decided to…" : "Asked the CX team to…"} />
                </Field>
              </div>
              {m.error && <Alert tone="destructive" size="sm" title="Not saved">{m.error}</Alert>}
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
                <Button type="submit" loading={m.busy}>{finishing && changed ? "Mark done" : "Add to log"}</Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="grid gap-3">
              <Reason check={check} />
              <DialogFooter><Button variant="ghost" onClick={onClose}>Close</Button></DialogFooter>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Actions({ question }: { question: Question; canEdit: Check }) {
  const db = useStore((s) => s.db);
  const me = useMe();
  const name = useUserName();
  const [params] = useSearchParams();
  const [formOpen, setFormOpen] = React.useState(!!params.get("f"));
  const [formFor, setFormFor] = React.useState<Action | null>(null);
  const updateAction = useStore((s) => s.updateAction);
  const [viewing, setViewing] = React.useState<{ action: Action; status?: ActionStatus } | null>(() => {
    const a = db.actions.find((x) => x.id === params.get("a") && x.questionId === question.id);
    return a ? { action: a } : null;
  });
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const findings = db.findings.filter((f) => f.questionId === question.id);
  const actions = db.actions.filter((a) => a.questionId === question.id);
  const withoutAction = findings.filter((f) => !actions.some((a) => a.findingIds.includes(f.id)));
  const newAction = () => { setFormFor(null); setFormOpen(true); };

  const columns: ColumnDef<Action>[] = [
    { id: "type", header: "Type", accessorKey: "type", cell: ({ row }) => <ActionTypeBadge type={row.original.type} /> },
    {
      id: "description",
      header: "Action",
      accessorKey: "description",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setViewing({ action: row.original })}
          className="grid max-w-[420px] cursor-pointer gap-0.5 rounded-[6px] text-left whitespace-normal hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={`Open action ${row.original.id}`}
        >
          <span>{row.original.description}</span>
          {row.original.reason && <span className="text-[12px] text-muted-foreground">Reason: {row.original.reason}</span>}
        </button>
      ),
    },
    {
      id: "findings",
      header: "Findings",
      accessorFn: (a) => a.findingIds.join(", "),
      cell: ({ row }) => (
        <span className="flex max-w-[160px] flex-wrap gap-1 whitespace-normal">
          {row.original.findingIds.map((id) => (
            <Badge key={id} size="sm" tone="outline" title={db.findings.find((f) => f.id === id)?.claim}>{id}</Badge>
          ))}
        </span>
      ),
    },
    { id: "owner", header: "Owner", accessorFn: (a) => name(a.ownerId) },
    { id: "assignee", header: "Assigned to", accessorFn: (a) => name(a.assigneeId) },
    { id: "due", header: "Due", accessorKey: "dueDate", cell: ({ row }) => fmtDate(row.original.dueDate) },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => {
        const act = row.original;
        const check = canUpdateAction(me, act, name(act.assigneeId));
        return (
          <div title={check.reason} className="grid gap-1">
            <Select
              aria-label={`Status of ${act.id}`}
              value={act.status}
              disabled={!check.ok || savingId === act.id}
              onValueChange={async (v) => {
                const next = v as ActionStatus;
                if (next === act.status) return;
                if (next === "done" && !act.outcomeNote?.trim()) {
                  setViewing({ action: act, status: next });
                  return;
                }
                setSavingId(act.id);
                try {
                  await updateAction(act.id, { status: next });
                  toast.success(`${act.id} is now ${STATUS_LABEL[next].toLowerCase()}`);
                } catch (e) {
                  toast.error("Status not changed", { description: e instanceof Error ? e.message : undefined });
                } finally {
                  setSavingId(null);
                }
              }}
            >
              {(Object.keys(STATUS_LABEL) as ActionStatus[]).map((k) => <SelectItem key={k} value={k}>{STATUS_LABEL[k]}</SelectItem>)}
            </Select>
            {isOverdue(act) && <span className="text-[12px] font-medium text-destructive">Overdue</span>}
          </div>
        );
      },
    },
  ];

  return (
    <div className="grid gap-5">
      {withoutAction.length > 0 && (
        <Alert tone="info" title="Findings without an action">
          {withoutAction.map((f) => `“${f.claim}”`).join(", ")}. Add an action so the finding leads to something.
        </Alert>
      )}
      <Card
        title="Actions"
        description="Decisions, experiments, more research, or a deliberate no-action. Each has an owner (who created it), an assignee and a date."
        aside={
          <Button onClick={newAction} disabled={findings.length === 0}>
            <Plus className="size-4" aria-hidden /> New action
          </Button>
        }
      >
        <DataTable<Action>
          label="Actions"
          data={actions}
          columns={columns}
          getRowId={(a) => a.id}
          rowClassName={(a) => (isOverdue(a) ? "bg-destructive-soft/40" : undefined)}
          empty={
            <State
              size="sm"
              title={findings.length ? "No actions yet" : "No findings to act on yet"}
              description={findings.length ? "Turn one or more findings into a decision, an experiment, more research, or a recorded no-action." : "Write a finding first, then decide what it changes."}
              action={findings.length ? <Button size="sm" onClick={newAction}>Create the first action</Button> : undefined}
            />
          }
        />
      </Card>
      <ActionFormDialog open={formOpen} onOpenChange={setFormOpen} question={question} defaultFindingId={params.get("f") ?? undefined} editing={formFor} />
      <ActionDialog
        action={viewing?.action ?? null}
        initialStatus={viewing?.status}
        onEdit={(a) => { setViewing(null); setFormFor(a); setFormOpen(true); }}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}
