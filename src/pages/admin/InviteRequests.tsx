import * as React from "react";
import { Check, MessageCircle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { State } from "@/components/ui/state";
import { toast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { useLoad, useUserName } from "@/lib/hooks";
import { fmtDateTime } from "@/lib/time";
import { inviteMessage } from "@/lib/rules/recruitment";
import { Card, Loaded, PageHeader, RecruitmentBadge, SimBadge } from "@/components/app/common";
import { AdminGate } from "./AdminGate";

export function InviteRequests() {
  const load = useLoad("invites");
  const db = useStore((s) => s.db);
  const decide = useStore((s) => s.decideInvite);
  const name = useUserName();
  const [rejecting, setRejecting] = React.useState<{ questionId: string; code: string } | null>(null);
  const [reason, setReason] = React.useState("");
  const [err, setErr] = React.useState<string>();
  const [busy, setBusy] = React.useState<string | null>(null);

  const pending = db.recruitments.filter((r) => r.status === "invite-requested");
  const decided = db.recruitments.filter((r) => r.inviteDecidedAt).sort((a, b) => (b.inviteDecidedAt! > a.inviteDecidedAt! ? 1 : -1));

  const act = async (key: string, fn: () => Promise<void>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error("Not saved", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminGate title="Invite requests">
      <PageHeader
        title="Invite requests"
        description="Question owners ask for permission to contact people. Approving sends the WhatsApp invite straight away, naming the product they bought."
      />
      <Loaded load={load}>
        {() => (
          <div className="grid gap-6">
            <Card title={`Waiting for you (${pending.length})`}>
              {pending.length === 0 ? (
                <State size="sm" scene="inbox" title="No requests waiting" description="When a question owner presses Invite, the request lands here." />
              ) : (
                <ul className="grid gap-3">
                  {pending.map((r) => {
                    const q = db.questions.find((x) => x.id === r.questionId)!;
                    const p = db.participants.find((x) => x.code === r.participantCode)!;
                    const owner = name(q.ownerId);
                    const key = `${r.questionId}|${r.participantCode}`;
                    return (
                      <li key={key} className="grid gap-2 rounded-[10px] p-3 ring-1 ring-border">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[13.5px] font-medium">
                              {p.code} <span className="font-normal text-muted-foreground">· {p.segment} · {p.channel === "own-site" ? "Own site" : "Marketplace"}</span>
                            </p>
                            <p className="text-[12.5px] text-muted-foreground">
                              For {q.id}: {q.text} · asked by {name(r.inviteRequestedById)}{r.inviteRequestedAt ? `, ${fmtDateTime(r.inviteRequestedAt)}` : ""}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" disabled={busy === key} onClick={() => { setRejecting({ questionId: r.questionId, code: r.participantCode }); setReason(""); setErr(undefined); }}>
                              <X className="size-3.5" aria-hidden /> Reject
                            </Button>
                            <Button size="sm" loading={busy === key} onClick={() => act(key, () => decide(r.questionId, r.participantCode, { approve: true }), `Invite sent to ${p.code} (simulated WhatsApp)`)}>
                              <Check className="size-3.5" aria-hidden /> Approve and send
                            </Button>
                          </div>
                        </div>
                        <div className="rounded-[8px] bg-muted/60 p-2.5 text-[12.5px]">
                          <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
                            <MessageCircle className="size-3" aria-hidden /> Message that will be sent <SimBadge what="WhatsApp message" />
                          </p>
                          {inviteMessage(p, q, owner)}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card title="Decided">
              {decided.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">Nothing decided yet.</p>
              ) : (
                <ul className="grid gap-1.5">
                  {decided.map((r) => (
                    <li key={`${r.questionId}|${r.participantCode}`} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                      <span>
                        <span className="font-medium">{r.participantCode}</span> for {r.questionId}
                        <span className="text-muted-foreground"> · {name(r.inviteDecidedById)}, {fmtDateTime(r.inviteDecidedAt!)}</span>
                      </span>
                      {r.inviteDeniedReason && r.status === "considered" ? (
                        <Badge size="sm" tone="destructive" title={r.inviteDeniedReason}>Rejected: {r.inviteDeniedReason}</Badge>
                      ) : (
                        <RecruitmentBadge status={r.status} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </Loaded>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent title={`Reject contact for ${rejecting?.code}?`} description="The person goes back to “Considered” and the question owner sees your reason.">
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!reason.trim()) return setErr("Add a short reason, e.g. “Contacted for another study last week”.");
              const t = rejecting!;
              await act(`${t.questionId}|${t.code}`, () => decide(t.questionId, t.code, { approve: false, reason: reason.trim() }), `${t.code} rejected`);
              setRejecting(null);
            }}
          >
            <Field label="Reason" required error={err}>
              <Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button>
              <Button type="submit" variant="destructive">Reject</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminGate>
  );
}
