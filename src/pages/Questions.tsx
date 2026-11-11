import * as React from "react";
import { Link } from "react-router-dom";
import { PlusCircle } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectItem } from "@/components/ui/select";
import { State } from "@/components/ui/state";
import { useStore } from "@/lib/store";
import { useLoad, useMe, useUserName } from "@/lib/hooks";
import { canCreateQuestion } from "@/lib/permissions";
import { insights, STAGE_LABEL } from "@/lib/rules/metrics";
import { archivedDb, liveDb } from "@/lib/rules/archive";
import { fmtDate } from "@/lib/time";
import { Card, Loaded, PageHeader } from "@/components/app/common";
import { AssumptionBadge, STAGE_TONE } from "@/components/app/insights";

type Row = ReturnType<typeof insights>["scorecard"][number];

/** Every question in one searchable, paged list. The sidebar stays short however many questions there are. */
export function Questions() {
  const load = useLoad("questions");
  const me = useMe();
  const name = useUserName();
  const db = useStore((s) => s.db);
  // Archived questions leave "My" and "All" and wait on their own tab, where they can still be opened.
  const rows = React.useMemo(() => insights(liveDb(db)).scorecard, [db]);
  const archived = React.useMemo(() => insights(archivedDb(db)).scorecard, [db]);
  const mine = rows.filter((r) => r.question.ownerId === me.id || r.question.raisedById === me.id);
  // Ops / data stewards don't own questions, so they only get the full list.
  const hasMine = me.role !== "admin";
  const [tab, setTab] = React.useState<string>(hasMine && mine.length ? "mine" : "all");
  const [stage, setStage] = React.useState("all");
  const create = canCreateQuestion(me);

  const byTab = tab === "archived" ? archived : hasMine && tab === "mine" ? mine : rows;
  const shown = byTab.filter((r) => stage === "all" || r.stage === stage);
  const stages = [...new Set(byTab.map((r) => r.stage))];

  const columns: ColumnDef<Row, unknown>[] = [
    {
      id: "question",
      header: "Question",
      accessorFn: (r) => `${r.question.id} ${r.question.text}`,
      cell: ({ row }) => (
        <Link to={`/questions/${row.original.question.id}/overview`} className="grid min-w-[240px] max-w-[420px] gap-0.5 whitespace-normal hover:underline">
          <span className="text-[12px] text-muted-foreground">{row.original.question.id} · created {fmtDate(row.original.question.createdAt)}</span>
          <span className="font-medium">{row.original.question.text}</span>
        </Link>
      ),
    },
    {
      id: "owner",
      header: "Owner",
      accessorFn: (r) => name(r.question.ownerId),
      cell: ({ row }) =>
        row.original.question.ownerId === me.id ? (
          <Badge size="sm" tone="primary">You</Badge>
        ) : (
          <span className="grid whitespace-nowrap" title="Read-only for you">
            {name(row.original.question.ownerId)}
            {row.original.question.raisedById === me.id && <span className="text-[12px] text-muted-foreground">You raised this</span>}
          </span>
        ),
    },
    {
      id: "stage",
      header: "Status",
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
    <>
      <PageHeader
        title="Questions"
        description="Every research question in one place. Anyone can read any question; only its owner can change or archive it."
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
          <Card>
            <DataTable<Row>
              label="Questions"
              data={shown}
              columns={columns}
              getRowId={(r) => r.question.id}
              pageSize={10}
              searchPlaceholder="Search by question, owner or stage"
              tabs={[
                ...(hasMine ? [{ value: "mine", label: "My questions", count: mine.length }] : []),
                { value: "all", label: "All questions", count: rows.length },
                { value: "archived", label: "Archived", count: archived.length },
              ]}
              tab={tab}
              onTabChange={setTab}
              actions={
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  Stage
                  <Select aria-label="Filter by stage" size="sm" value={stage} onValueChange={setStage} className="w-[170px]">
                    <SelectItem value="all">Any stage</SelectItem>
                    {stages.map((s) => <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>)}
                  </Select>
                </div>
              }
              empty={
                <State
                  size="sm"
                  title={tab === "mine" ? "No questions yet" : tab === "archived" ? "Nothing archived" : "No questions match"}
                  description={tab === "mine" ? "Questions you own or raised appear here. Switch to All questions to read everyone's." : tab === "archived" ? "Owners archive a question when the work stops. It stays readable here and can be restored." : "Try clearing the search or the stage filter."}
                />
              }
            />
          </Card>
        )}
      </Loaded>
    </>
  );
}
