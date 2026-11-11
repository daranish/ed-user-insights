import * as React from "react";
import { QrCode, UserMinus, UserPlus } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Select, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { State } from "@/components/ui/state";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { type Check } from "@/lib/permissions";
import type { Channel, Participant, Question, Recruitment as Rec, Segment } from "@/lib/types";
import { CHANNELS, SEGMENTS } from "@/lib/types";
import { Card, Reason, RecruitmentBadge } from "@/components/app/common";
import { PipelineBoard } from "./PipelineBoard";

type Row = { p: Participant; rec?: Rec };

const CHANNEL_LABEL: Record<Channel, string> = { "own-site": "Own site", marketplace: "Marketplace" };

export function Recruitment({ question, canEdit }: { question: Question; canEdit: Check }) {
  const db = useStore((s) => s.db);
  const addToRecruitment = useStore((s) => s.addToRecruitment);
  const removeFromRecruitment = useStore((s) => s.removeFromRecruitment);

  const [seg, setSeg] = React.useState("all");
  const [channel, setChannel] = React.useState("all");

  const recs = db.recruitments.filter((r) => r.questionId === question.id);
  const recOf = (code: string) => recs.find((r) => r.participantCode === code);

  const inTargets = (s: Segment) => !question.targetSegments?.length || question.targetSegments.includes(s);
  // Candidate pool: target segments and product focus. Plus anyone already in the pipeline.
  const pool: Row[] = db.participants
        .filter((p) => recOf(p.code) || (inTargets(p.segment) && (!question.productFocus || p.productContext.sku.startsWith(question.productFocus))))
    .map((p) => ({ p, rec: recOf(p.code) }));
  const filtered = pool.filter(
    (r) => (seg === "all" || r.p.segment === seg) && (channel === "all" || r.p.channel === channel),
  );
  const marketplaceInPool = pool.filter((r) => r.p.channel === "marketplace").length;

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error("Not saved", { description: e instanceof Error ? e.message : String(e), action: { label: "Dismiss", onClick: () => {} } });
    }
  };

  const rate = CHANNELS.map((c) => {
    const inChannel = recs.filter((r) => db.participants.find((p) => p.code === r.participantCode)?.channel === c);
    const contacted = inChannel.filter((r) => r.status !== "considered" && r.status !== "invite-requested");
    const responded = contacted.filter((r) => r.status !== "invited");
    const yes = contacted.filter((r) => r.status === "accepted" || r.status === "done" || r.status === "no-show");
    return { c, contacted: contacted.length, responded: responded.length, yes: yes.length };
  });

  const tableColumns: ColumnDef<Row>[] = [
    { id: "code", header: "Participant", accessorFn: (r) => r.p.code, cell: ({ row }) => <span className="font-medium">{row.original.p.code}</span> },
    { id: "segment", header: "Segment", accessorFn: (r) => r.p.segment },
    {
      id: "channel",
      header: "Channel",
      accessorFn: (r) => r.p.channel,
      cell: ({ row }) => CHANNEL_LABEL[row.original.p.channel],
    },
    {
      id: "product",
      header: "SKU",
      accessorFn: (r) => r.p.productContext.sku,
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (r) => r.rec?.status ?? "",
      cell: ({ row }) => {
        const { p, rec } = row.original;
        if (!rec) {
          return (
            <Button size="sm" variant="outline" disabled={!canEdit.ok} onClick={() => run(() => addToRecruitment(question.id, [p.code]), `${p.code} added as considered`)}>
              <UserPlus className="size-3.5" aria-hidden /> Consider
            </Button>
          );
        }
        if (rec.status !== "considered" || !canEdit.ok) return <RecruitmentBadge status={rec.status} />;
        return (
          <Button size="sm" variant="outline" onClick={() => run(() => removeFromRecruitment(question.id, p.code), `${p.code} removed from consideration`)}>
            <UserMinus className="size-3.5" aria-hidden /> Remove consideration
          </Button>
        );
      },
    },
  ];

  return (
    <div className="grid gap-6">
      <div className="grid gap-6">
        <Card
          title="Pipeline"
          description={canEdit.ok ? "Consider people below, then press Invite. Ops approve contact, the WhatsApp goes out, and the customer picks a time. Done and No-show unlock 30 minutes after the call." : "Read-only for your role."}
        >
          <PipelineBoard question={question} recs={recs} participants={db.participants} canEdit={canEdit.ok} run={run} />
        </Card>
        <Card title="Response rate by channel" description="Of people invited, how many replied (yes or no).">
          <div className="grid gap-4">
            {rate.map((x) => (
              <Progress
                key={x.c}
                label={CHANNEL_LABEL[x.c]}
                value={x.contacted ? Math.round((x.responded / x.contacted) * 100) : 0}
                showValue
                description={x.contacted ? `${x.responded} of ${x.contacted} replied · ${x.yes} said yes` : "No one invited yet"}
              />
            ))}
            <p className="text-[12px] text-muted-foreground">Marketplace buyers can only be reached through QR opt-ins, so expect fewer of them.</p>
          </div>
        </Card>
      </div>

      <Card
        title="Candidate pool"
        description={`Pseudonymised. ${question.targetSegments?.length ? question.targetSegments.join(", ") : "All segments"}${question.productFocus ? ` · ${question.productFocus} buyers` : ""}. Contact details stay hidden.`}
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <Select size="sm" aria-label="Filter by segment" value={seg} onValueChange={setSeg}>
            <SelectItem value="all">All segments</SelectItem>
            {SEGMENTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </Select>
          <Select size="sm" aria-label="Filter by channel" value={channel} onValueChange={setChannel}>
            <SelectItem value="all">All channels</SelectItem>
            {CHANNELS.map((c) => <SelectItem key={c} value={c}>{CHANNEL_LABEL[c]}</SelectItem>)}
          </Select>
          <Reason check={canEdit} className="self-center" />
        </div>
        {marketplaceInPool === 0 && channel !== "marketplace" && (
          <Alert tone="info" size="sm" className="mb-3" icon={<QrCode className="size-4" />}>
            No marketplace buyers in this pool yet. Marketplaces don't share buyer contacts; they reach us only through QR opt-ins on pack inserts, which arrive over time.
          </Alert>
        )}
        <DataTable<Row>
          label="Candidate pool"
          data={filtered}
          columns={tableColumns}
          getRowId={(r) => r.p.code}
          pageSize={10}
          density="compact"
          empty={
            channel === "marketplace" ? (
              <State
                size="sm"
                scene="inbox"
                title="No marketplace buyers yet"
                description="Marketplaces don't share buyer contacts. Marketplace participants come only from QR opt-ins on pack inserts, and those arrive over time as people scan and agree. Start with own-site buyers now, and check back after the next weekly opt-in import."
                action={<Button size="sm" variant="outline" onClick={() => setChannel("own-site")}>Show own-site buyers</Button>}
              />
            ) : (
              <State size="sm" scene="search" title="No one matches these filters" description="Clear a filter to see more of the pool." action={<Button size="sm" variant="outline" onClick={() => { setSeg("all"); setChannel("all"); }}>Clear filters</Button>} />
            )
          }
        />
      </Card>

    </div>
  );
}
