import { Link } from "react-router-dom";
import { CheckCircle2, Undo2 } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { State } from "@/components/ui/state";
import { toast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { useLoad, useUserName } from "@/lib/hooks";
import type { ImportBatch } from "@/lib/types";
import { fmtDateTime } from "@/lib/time";
import { Card, Loaded, PageHeader } from "@/components/app/common";
import { AdminGate } from "./AdminGate";

export function ImportHistory() {
  const load = useLoad("history");
  const batches = useStore((s) => s.db.importBatches);
  const rollback = useStore((s) => s.rollbackBatch);
  const name = useUserName();

  const columns: ColumnDef<ImportBatch>[] = [
    { id: "id", header: "Batch", accessorKey: "id", cell: ({ row }) => <span className="font-medium">{row.original.id}</span> },
    { id: "file", header: "File", accessorKey: "fileName", cell: ({ row }) => <code className="text-[12px]">{row.original.fileName}</code> },
    { id: "at", header: "When", accessorKey: "at", cell: ({ row }) => `${fmtDateTime(row.original.at)} · ${name(row.original.byId)}` },
    {
      id: "rows",
      header: "Rows",
      enableSorting: false,
      cell: ({ row: { original: b } }) => (
        <span className="text-[12.5px]">
          {b.rowsImported} added · {b.duplicates} dup · {b.rowsFailed} failed
          {b.rejectedColumns.length > 0 && <span className="block text-muted-foreground">Rejected: {b.rejectedColumns.join(", ")}</span>}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) =>
        row.original.status === "committed" ? (
          <Badge size="sm" tone="success"><CheckCircle2 className="size-3" aria-hidden /> Committed</Badge>
        ) : (
          <Badge size="sm" tone="neutral"><Undo2 className="size-3" aria-hidden /> Rolled back</Badge>
        ),
    },
    {
      id: "rollback",
      header: "",
      enableSorting: false,
      cell: ({ row: { original: b } }) =>
        b.status === "committed" ? (
          <HoldToConfirm
            size="sm"
            tone="destructive"
            label="Hold to roll back"
            holdingLabel="Keep holding…"
            confirmedLabel="Rolled back"
            onConfirm={async () => {
              try {
                await rollback(b.id);
                toast.success(`Batch ${b.id} rolled back`, { description: `${b.participantCodes.length} participants and their contacts removed.` });
              } catch (e) {
                toast.error("Can't roll back", { description: e instanceof Error ? e.message : String(e) });
                throw e;
              }
            }}
          />
        ) : null,
    },
  ];

  return (
    <AdminGate title="Import history">
      <PageHeader title="Import history" description="Every committed batch, with what was rejected. Roll a batch back while nobody has recruited from it." />
      <Loaded load={load}>
        {() => (
          <Card>
            <DataTable<ImportBatch>
              label="Import batches"
              data={batches}
              columns={columns}
              getRowId={(b) => b.id}
              empty={<State size="sm" title="No imports yet" description="Batches appear here after you commit an import." action={<Button asChild size="sm"><Link to="/admin/import">Import a CSV</Link></Button>} />}
            />
          </Card>
        )}
      </Loaded>
    </AdminGate>
  );
}
