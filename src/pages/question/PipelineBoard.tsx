import * as React from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Hourglass, Mic, Quote, Check, Mail, MessageCircle, Phone, Send, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectItem } from "@/components/ui/select";
import { State } from "@/components/ui/state";
import { useStore } from "@/lib/store";
import type { Participant, ParticipantContact, Question, Recruitment, RecruitmentStatus } from "@/lib/types";
import { fmtDate, fmtDateTime, simNowMs, toIstIso } from "@/lib/time";
import { canCloseMeeting, meetingEndsAt } from "@/lib/rules/recruitment";
import { RecruitmentBadge, SimBadge } from "@/components/app/common";

const COLUMNS: { status: RecruitmentStatus; title: string; empty: string }[] = [
  { status: "considered", title: "Considered", empty: "Pick people from the candidate pool below." },
  { status: "invite-requested", title: "Awaiting Ops", empty: "Nothing waiting for Ops." },
  { status: "invited", title: "Invite sent", empty: "No invites out." },
  { status: "accepted", title: "Accepted", empty: "No booked calls." },
  { status: "declined", title: "Declined", empty: "No declines." },
  { status: "no-show", title: "No-show", empty: "No no-shows." },
  { status: "done", title: "Done", empty: "No finished calls." },
];

type Run = (fn: () => Promise<unknown>, ok?: string) => Promise<void>;

/** Green when the customer gave that consent, struck out and grey when not. */
export function ConsentIcon({ given, kind }: { given?: boolean; kind: "record" | "quote" }) {
  const Icon = kind === "record" ? Mic : Quote;
  const label = `${kind === "record" ? "Recording" : "Quote"} consent ${given ? "given" : "not given"}`;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`relative grid size-6 place-items-center rounded-full ${given ? "bg-success-soft text-success" : "bg-muted text-muted-foreground/60"}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {!given && <span aria-hidden className="absolute h-0.5 w-5 -rotate-45 rounded bg-muted-foreground/70" />}
    </span>
  );
}

function ConsentLine({ kind, given }: { kind: "record" | "quote"; given?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <ConsentIcon kind={kind} given={given} />
      <span className={given ? "text-success" : "text-muted-foreground"}>{given ? "Given" : "Not given"}</span>
    </span>
  );
}

/** What the customer would do in WhatsApp. The prototype has no customer side, so the owner can play it. */
function CustomerReplyDialog({ target, question, onClose, run }: { target: string | null; question: Question; onClose: () => void; run: Run }) {
  const reply = useStore((s) => s.simulateCustomerReply);
  const shift = useStore((s) => s.sim.clockShiftMin);
  const [kind, setKind] = React.useState<"schedule" | "decline">("schedule");
  const [when, setWhen] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [recordOk, setRecordOk] = React.useState(false);
  const [quoteOk, setQuoteOk] = React.useState(false);
  const [err, setErr] = React.useState<string>();
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!target) return;
    setKind("schedule");
    // Default: tomorrow, 10:00.
    setWhen(toIstIso(simNowMs(shift) + 24 * 3_600_000).slice(0, 11) + "10:00");
    setReason("");
    setRecordOk(false);
    setQuoteOk(false);
    setErr(undefined);
  }, [target, shift]);

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={`${target} replies on WhatsApp`}
        description={<span className="flex items-center gap-1.5">The real customer does this in their own chat. <SimBadge what="Customer side of the WhatsApp flow" /></span>}
      >
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (kind === "schedule" && !when) return setErr("Pick a date and time.");
            if (kind === "decline" && !reason.trim()) return setErr("Add a short reason, e.g. “Too busy this month”.");
            setBusy(true);
            await run(
              () => reply(question.id, target!, kind === "schedule" ? { kind, scheduledAt: `${when}:00+05:30`, consentRecord: recordOk, consentQuote: quoteOk } : { kind, reason: reason.trim() }),
              kind === "schedule" ? `${target} booked a call. Meet link created and emailed to you (simulated)` : `${target} declined`,
            );
            setBusy(false);
            onClose();
          }}
        >
          <Field label="Customer's reply">
            <Select value={kind} onValueChange={(v) => { setKind(v as typeof kind); setErr(undefined); }}>
              <SelectItem value="schedule">Agrees and books a time</SelectItem>
              <SelectItem value="decline">Declines</SelectItem>
            </Select>
          </Field>
          {kind === "schedule" ? (
            <Field label="Date and time they pick" required error={err}>
              <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </Field>
          ) : null}
          {kind === "schedule" ? (
            <fieldset className="grid gap-2">
              <legend className="text-[13px] font-medium">Consent they give <span className="font-normal text-muted-foreground">(tick what they agree to)</span></legend>
              <Field inline label="Record the call"><Checkbox checked={recordOk} onCheckedChange={(v) => setRecordOk(v === true)} /></Field>
              <Field inline label="Quote them in findings"><Checkbox checked={quoteOk} onCheckedChange={(v) => setQuoteOk(v === true)} /></Field>
            </fieldset>
          ) : (
            <Field label="Reason" required error={err}>
              <Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Not comfortable on a call" />
            </Field>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={busy}>Send reply</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Opens from an Accepted card. The name comes through the audited reveal, so only the question owner sees it. */
function AcceptedDetailsDialog({ target, question, participants, canEdit, onClose }: {
  target: Recruitment | null; question: Question; participants: Participant[]; canEdit: boolean; onClose: () => void;
}) {
  const reveal = useStore((s) => s.revealContact);
  const owner = useStore((s) => s.db.users.find((u) => u.id === question.ownerId));
  const p = target && participants.find((x) => x.code === target.participantCode);
  const [contact, setContact] = React.useState<ParticipantContact>();
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    setContact(undefined);
    if (!target || !canEdit) return;
    let live = true;
    setLoading(true);
    reveal(question.id, target.participantCode)
      .then((c) => live && setContact(c))
      .catch(() => {})
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [target, canEdit, question.id, reveal]);

  const rows: [string, React.ReactNode][] = p && target ? [
    ["Name", canEdit ? (loading ? "Loading…" : contact?.name ?? "Not available") : "Only the question owner can see names"],
    ["SKU", p.productContext.sku],
    ["First purchase", p.productContext.firstOrderDate ? fmtDate(p.productContext.firstOrderDate) : "Not in the data"],
    ["Last purchase", fmtDate(p.productContext.lastOrderDate)],
    ["Call", target.scheduledAt ? fmtDateTime(target.scheduledAt) : "Not booked"],
    ["Consent to record", <ConsentLine key="r" kind="record" given={target.consentRecord} />],
    ["Consent to quote", <ConsentLine key="q" kind="quote" given={target.consentQuote} />],
    ["Google Meet link", target.meetLink ? (
      <span className="flex flex-wrap items-center gap-1.5">
        <a href={target.meetLink} onClick={(e) => e.preventDefault()} title="Simulated link: not opened" className="break-all underline">{target.meetLink}</a>
        <SimBadge what="Google Meet" />
      </span>
    ) : "No link yet"],
  ] : [];

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={target ? `${target.participantCode} · booked call` : "Booked call"} description="Details for the call you have booked with this customer.">
        <dl className="grid gap-2.5 text-[13px]">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[130px_1fr] gap-2">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="min-w-0 font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {target && (
          <div className="rounded-[8px] bg-muted/60 p-2.5 text-[12.5px]">
            <p className="mb-1 flex flex-wrap items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
              <Mail className="size-3" aria-hidden /> Email sent to {owner?.email ?? "the question owner"} <SimBadge what="Calendar email" />
            </p>
            Subject: Interview booked with {target.participantCode}{target.scheduledAt ? `, ${fmtDateTime(target.scheduledAt)}` : ""}. The Google Meet link is in the invite, and the same link is kept here.
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CardBody({
  p, rec, canEdit, nowMs, onReply, run, questionId,
}: {
  p: Participant; rec: Recruitment; canEdit: boolean; nowMs: number; onReply: () => void; run: Run; questionId: string;
}) {
  const closeMeeting = useStore((s) => s.closeMeeting);
  const needsEvidence = useStore((s) => {
    const sess = s.db.sessions.find((x) => x.questionId === questionId && x.participantCode === p.code);
    return !!sess && !s.db.evidence.some((e) => e.sessionId === sess.id);
  });
  if (rec.status === "considered" && rec.inviteDeniedReason) {
    return <p className="text-[12px] text-destructive">Ops declined contact: {rec.inviteDeniedReason}</p>;
  }
  if (rec.status === "invite-requested") {
    return <p className="text-[12px] text-muted-foreground">{rec.inviteRequestedAt ? fmtDateTime(rec.inviteRequestedAt) : ""}.</p>;
  }
  if (rec.status === "invited") {
    return (
      <div className="grid gap-1.5">
        <p className="flex flex-wrap items-center gap-1 text-[12px] text-muted-foreground">
          <MessageCircle className="size-3" aria-hidden /> WhatsApp sent{rec.invitedAt ? ` ${fmtDateTime(rec.invitedAt)}` : ""}
          <SimBadge what="WhatsApp message" />
        </p>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={onReply}>
            <Send className="size-3.5" aria-hidden /> Play customer reply
          </Button>
        )}
      </div>
    );
  }
  if (rec.status === "declined") return <p className="text-[12px] text-muted-foreground">{rec.declineReason ?? "No reason given"}</p>;
  const when = rec.scheduledAt && (
    <p className="flex items-center gap-1 text-[12px] text-muted-foreground">
      <CalendarClock className="size-3" aria-hidden /> {fmtDateTime(rec.scheduledAt)}
    </p>
  );
  const meet = rec.meetLink && (
    <p className="flex flex-wrap items-center gap-1 text-[12px] text-muted-foreground">
      <Phone className="size-3" aria-hidden />
      <a href={rec.meetLink} onClick={(e) => e.preventDefault()} title="Simulated link: not opened" className="underline">Meet link</a>
      <SimBadge what="Google Meet" />
    </p>
  );
  if (rec.status === "accepted") {
    const open = canCloseMeeting(rec, nowMs);
    return (
      <div className="grid gap-1.5">
        {when}
        {meet}
        <div className="flex items-center gap-1.5">
          <ConsentIcon kind="record" given={rec.consentRecord} />
          <ConsentIcon kind="quote" given={rec.consentQuote} />
        </div>
        {canEdit && (
          <>
            <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="outline" disabled={!open} onClick={() => run(() => closeMeeting(questionId, p.code, "done"), `${p.code} marked done. Evidence is now due on the Sessions tab`)}>
                <Check className="size-3.5" aria-hidden /> Done
              </Button>
              <Button size="sm" variant="outline" disabled={!open} onClick={() => run(() => closeMeeting(questionId, p.code, "no-show"), `${p.code} marked no-show`)}>
                <UserX className="size-3.5" aria-hidden /> No-show
              </Button>
            </div>
            {!open && rec.scheduledAt && <p className="text-[11.5px] text-muted-foreground">Unlocks {fmtDateTime(new Date(meetingEndsAt(rec.scheduledAt)).toISOString())}, 30 min after the meeting starts.</p>}
          </>
        )}
      </div>
    );
  }
  if (rec.status === "done" && needsEvidence) {
    return (
      <div className="grid gap-1.5">
        {when}
        <p className="flex items-center gap-1 text-[12px] font-medium text-warning">
          <Hourglass className="size-3" aria-hidden /> Evidence needed
        </p>
        {canEdit && (
          <Button asChild size="sm" variant="outline">
            <Link to={`/questions/${questionId}/sessions`}>Write evidence</Link>
          </Button>
        )}
      </div>
    );
  }
  return when || null;
}

export function PipelineBoard({ question, recs, participants, canEdit, run }: {
  question: Question; recs: Recruitment[]; participants: Participant[]; canEdit: boolean; run: Run;
}) {
  const requestInvites = useStore((s) => s.requestInvites);
  const shift = useStore((s) => s.sim.clockShiftMin);
  const [replyFor, setReplyFor] = React.useState<string | null>(null);
  const [detailsFor, setDetailsFor] = React.useState<Recruitment | null>(null);
  // Re-check the unlock time as the (simulated) clock moves.
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    const t = window.setInterval(tick, 20_000);
    return () => window.clearInterval(t);
  }, []);
  const nowMs = simNowMs(shift);

  const considered = recs.filter((r) => r.status === "considered");

  return (
    <>
      <div className="-mx-1 overflow-x-auto px-1 pb-1" role="region" aria-label="Recruitment pipeline" tabIndex={0}>
        <div className="grid min-w-max grid-flow-col auto-cols-[244px] gap-3">
          {COLUMNS.map((col) => {
            const items = recs.filter((r) => r.status === col.status);
            return (
              <section key={col.status} className="grid content-start gap-2 rounded-[12px] bg-muted/50 p-2.5" aria-label={col.title}>
                <header className="flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 text-[12.5px] font-semibold">
                    {col.title} <Badge size="sm" tone="neutral">{items.length}</Badge>
                  </h3>
                  {col.status === "considered" && canEdit && (
                    <Button
                      size="sm"
                      disabled={considered.length === 0}
                      onClick={() => run(() => requestInvites(question.id, considered.map((r) => r.participantCode)), `${considered.length} sent to Ops for approval`)}
                    >
                      <Send className="size-3.5" aria-hidden /> Invite ({considered.length})
                    </Button>
                  )}
                </header>
                {items.length === 0 ? (
                  <State size="sm" title={col.empty} />
                ) : (
                  items.map((rec) => {
                    const p = participants.find((x) => x.code === rec.participantCode)!;
                    return (
                      <article
                        key={rec.participantCode}
                        className={`grid gap-1.5 rounded-[10px] bg-card p-2.5 ring-1 ring-border${rec.status === "accepted" ? " cursor-pointer hover:ring-2 hover:ring-primary focus-visible:outline-2 focus-visible:outline-primary" : ""}`}
                        {...(rec.status === "accepted" ? {
                          role: "button",
                          tabIndex: 0,
                          "aria-label": `${rec.participantCode}: open call details`,
                          onClick: () => setDetailsFor(rec),
                          onKeyDown: (e: React.KeyboardEvent) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setDetailsFor(rec); } },
                        } : {})}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium">{rec.participantCode}</span>
                          <RecruitmentBadge status={rec.status} />
                        </div>
                        <p className="text-[12px] text-muted-foreground">
                          {p.segment} · {p.productContext.sku} · {p.channel === "own-site" ? "Own site" : "Marketplace"}
                        </p>
                        <CardBody p={p} rec={rec} canEdit={canEdit} nowMs={nowMs} onReply={() => setReplyFor(p.code)} run={run} questionId={question.id} />
                      </article>
                    );
                  })
                )}
              </section>
            );
          })}
        </div>
      </div>
      <AcceptedDetailsDialog target={detailsFor} question={question} participants={participants} canEdit={canEdit} onClose={() => setDetailsFor(null)} />
      <CustomerReplyDialog target={replyFor} question={question} onClose={() => setReplyFor(null)} run={run} />
    </>
  );
}
