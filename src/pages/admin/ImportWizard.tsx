import * as React from "react";
import { Link } from "react-router-dom";
import { Ban, CheckCircle2, Lock, PlayCircle, Plug, Upload } from "lucide-react";
import { parseCsv, type ImportField } from "@/components/ui/data-import";
import { Stepper } from "@/components/ui/stepper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { toast } from "@/components/ui/toast";
import { useStore, type StagedImport, type StagedRow } from "@/lib/store";
import { useLoad } from "@/lib/hooks";
import { CHANNELS, SEGMENTS, type ImportBatch } from "@/lib/types";
import { DEMO_IMPORT_FILE } from "@/fixtures";
import { Card, Loaded, PageHeader, SimBadge, Stat } from "@/components/app/common";
import { AdminGate } from "./AdminGate";

const FIELDS: ImportField[] = [
  { key: "customer_ref", label: "Customer reference", required: true, aliases: ["customer ref", "customer_id"], validate: (v) => (/^CR-\d{4,}$/.test(v) ? undefined : "Use the CR-12345 format") },
  { key: "segment", label: "Segment", required: true, type: "select", options: SEGMENTS },
  { key: "channel", label: "Channel", required: true, type: "select", options: CHANNELS },
  {
    key: "source",
    label: "Recruitment source",
    required: true,
    type: "select",
    options: ["export", "qr-opt-in"],
    validate: (v, row) => (row.channel === "marketplace" && v !== "qr-opt-in" ? "Marketplace buyers can only come from QR opt-ins" : undefined),
  },
  { key: "sku", label: "SKU", required: true },
  { key: "first_order_date", label: "First order date", required: true, type: "date" },
  { key: "last_order_date", label: "Last order date", required: true, type: "date" },
  { key: "name", label: "Name (contact store)", required: true },
  { key: "email", label: "Email (contact store)", type: "email", required: true },
  { key: "phone", label: "Phone (contact store)" },
];

const CONTACT = new Set(["name", "email", "phone"]);
const NOT_ALLOWED: Record<string, string> = {
  shipping_address: "Addresses are never needed to recruit for a conversation. Not allowed, and never stored.",
  address: "Addresses are never needed to recruit for a conversation. Not allowed, and never stored.",
  date_of_birth: "Not needed for research. Not allowed.",
};

function columnPolicy(header: string[]) {
  const known = new Set(FIELDS.map((f) => f.key));
  return header.map((h) => {
    const key = h.trim().toLowerCase();
    if (NOT_ALLOWED[key]) return { column: h, allowed: false, note: NOT_ALLOWED[key] };
    if (!known.has(key)) return { column: h, allowed: false, note: "Not in the import contract. Dropped." };
    return { column: h, allowed: true, note: CONTACT.has(key) ? "Goes to the separate contact store" : "Research data (pseudonymised)" };
  });
}

/** Rebuilds the CSV without the rejected columns, so they never reach staging. */
function stripColumns(text: string, keep: boolean[]) {
  const rows = parseCsv(text);
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return rows.map((r) => r.filter((_, i) => keep[i]).map(esc).join(",")).join("\n");
}

/** The checks the browser runs before anything is sent to staging. Returns the first problem with a row, if any. */
function rowProblem(row: StagedRow): string | undefined {
  for (const f of FIELDS) {
    const v = (row[f.key] ?? "").trim();
    if (!v) {
      if (f.required) return `${f.label} is empty`;
      continue;
    }
    if (f.type === "select" && !(f.options as readonly string[]).includes(v)) return `${f.label} “${v}” is not one of ${f.options!.join(", ")}`;
    if (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${f.label} is not a date`;
    if (f.type === "email" && !/^\S+@\S+\.\S+$/.test(v)) return `${f.label} is not an email`;
    const msg = f.validate?.(v, row);
    if (msg) return msg;
  }
  return undefined;
}

const STEPS = [
  { title: "Upload", description: "Column check" },
  { title: "Staging validation", description: "Match and fix rows" },
  { title: "Review", description: "Duplicates and refusals" },
  { title: "Commit", description: "Create the batch" },
];

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ImportWizard() {
  const load = useLoad("import");
  const stageImport = useStore((s) => s.stageImport);
  const commitImport = useStore((s) => s.commitImport);
  const [step, setStep] = React.useState(0);
  const [file, setFile] = React.useState<{ name: string; text: string } | null>(null);
  const [staged, setStaged] = React.useState<StagedImport | null>(null);
  const [skipped, setSkipped] = React.useState<{ ref: string; reason: string }[]>([]);
  const [batch, setBatch] = React.useState<ImportBatch | null>(null);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Bumped by Start over so a simulation already in flight stops touching the screen.
  const run = React.useRef(0);

  const header = file ? parseCsv(file.text)[0] ?? [] : [];
  const policy = columnPolicy(header);
  const rejected = policy.filter((p) => !p.allowed).map((p) => p.column);
  const totalRows = file ? Math.max(0, parseCsv(file.text).length - 1) : 0;

  function reset() {
    run.current += 1;
    setStep(0);
    setFile(null);
    setStaged(null);
    setSkipped([]);
    setBatch(null);
    setRunning(false);
    setError(null);
  }

  /** Plays all four stages end to end on the demo export, pausing on each so the steward can see what it did. */
  async function simulate() {
    const id = ++run.current;
    const live = () => run.current === id;
    setError(null);
    setStaged(null);
    setBatch(null);
    setSkipped([]);
    setRunning(true);
    try {
      // 1. Upload and column check
      setFile(DEMO_IMPORT_FILE);
      setStep(0);
      await pause(2200);
      if (!live()) return;

      // 2. Staging validation: drop rejected columns, skip rows that break the rules, send the rest to the server checks
      const text = DEMO_IMPORT_FILE;
      const pol = columnPolicy(parseCsv(text.text)[0] ?? []);
      const reject = pol.filter((p) => !p.allowed).map((p) => p.column);
      const rows = parseCsv(stripColumns(text.text, pol.map((p) => p.allowed)));
      const [cols, ...body] = rows;
      const records: StagedRow[] = body.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i] ?? ""])));
      const good: StagedRow[] = [];
      const bad: { ref: string; reason: string }[] = [];
      for (const rec of records) {
        const problem = rowProblem(rec);
        if (problem) bad.push({ ref: rec.customer_ref, reason: problem });
        else good.push(rec);
      }
      setSkipped(bad);
      setStep(1);
      const result = await stageImport(text.name, reject, good, bad.length);
      if (!live()) return;
      setStaged(result);
      await pause(2200);
      if (!live()) return;

      // 3. Review
      setStep(2);
      await pause(3000);
      if (!live()) return;
      if (result.fresh.length === 0) {
        setRunning(false);
        setError("Every valid row in this export is already in the pool, so there is nothing to commit. Reset the demo data from Demo controls to run it again.");
        return;
      }

      // 4. Commit
      const b = await commitImport(result);
      if (!live()) return;
      setBatch(b);
      setStep(3);
      setRunning(false);
      toast.success(`Batch ${b.id} committed`, { description: `${b.rowsImported} participants added to the pool.` });
    } catch (e) {
      if (!live()) return;
      setRunning(false);
      setError(e instanceof Error ? e.message : "The simulated import failed.");
    }
  }

  const dupColumns: ColumnDef<StagedImport["duplicates"][number]>[] = [
    { id: "ref", header: "customer_ref", accessorFn: (d) => d.row.customer_ref },
    { id: "match", header: "Matches", accessorFn: (d) => d.existingCode, cell: ({ row }) => <Badge size="sm" tone="warning">{row.original.existingCode}</Badge> },
    { id: "segment", header: "Segment in file", accessorFn: (d) => d.row.segment },
    { id: "what", header: "On commit", enableSorting: false, cell: () => <span className="text-[12.5px] text-muted-foreground">Skipped. The existing participant is kept.</span> },
  ];
  const refusedColumns: ColumnDef<StagedImport["refused"][number]>[] = [
    { id: "ref", header: "customer_ref", accessorFn: (d) => d.row.customer_ref },
    { id: "reason", header: "Reason", accessorFn: (d) => d.reason },
  ];
  const skippedColumns: ColumnDef<{ ref: string; reason: string }>[] = [
    { id: "ref", header: "customer_ref", accessorFn: (d) => d.ref },
    { id: "reason", header: "Why it was skipped", accessorFn: (d) => d.reason },
  ];

  return (
    <AdminGate title="Import CSV">
      <PageHeader
        title="Import participants from CSV"
        description="Only allowed columns reach staging; contact details go to a separate store; nothing is added to the pool until the batch is committed."
        actions={<span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">CRM export source <SimBadge what="CRM / order export" /></span>}
      />
      <Loaded load={load}>
        {() => (
          <div className="grid gap-6">
            <Stepper steps={STEPS} current={batch ? 4 : step} />

            {running && (
              <Alert tone="info" size="sm" title={`Simulating stage ${step + 1} of 4: ${STEPS[step].title}`}>
                This plays the import end to end on a synthetic CRM export. Nothing real is read or sent.
                <Button variant="ghost" size="sm" className="ml-2" onClick={reset}>Cancel</Button>
              </Alert>
            )}
            {error && (
              <Alert tone="destructive" title="The simulated import stopped">
                {error}
                <Button variant="outline" size="sm" className="ml-2" onClick={reset}>Start over</Button>
              </Alert>
            )}

            {step === 0 && (
              <Card title="1. Upload and column check">
                <div className="grid gap-4">
                  {!file && (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button onClick={simulate} disabled={running}>
                          <PlayCircle className="size-4" aria-hidden /> Simulate CSV import
                        </Button>
                        <Button variant="outline" disabled aria-disabled title="File upload is not available in this prototype">
                          <Upload className="size-4" aria-hidden /> Upload a CSV
                        </Button>
                        <SimBadge what="CRM export file" />
                      </div>
                      <Alert tone="neutral" size="sm" icon={<Plug className="size-4" />} title="CRM integration is coming">
                        In future the export will arrive directly from the CRM, with no file to hand over. Until then, simulate the import to see all four stages: column check, staging validation, review and commit.
                      </Alert>
                      <p className="text-[13px] text-muted-foreground">
                        The contract expects: {FIELDS.map((f) => f.key).join(", ")}. The synthetic export includes a <code>shipping_address</code> column, a few problem rows and a duplicate on purpose.
                      </p>
                    </>
                  )}
                  {file && (
                    <>
                      <p className="text-[13px]">
                        <span className="font-medium">{file.name}</span> · {totalRows} rows · {header.length} columns
                      </p>
                      <ul className="grid gap-1.5">
                        {policy.map((p) => (
                          <li key={p.column} className={`flex flex-wrap items-center gap-2 rounded-[8px] px-3 py-2 text-[13px] ring-1 ${p.allowed ? "ring-border" : "bg-destructive-soft ring-destructive/25"}`}>
                            {p.allowed ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <Ban className="size-4 text-destructive" aria-hidden />}
                            <code className="font-mono text-[12.5px]">{p.column}</code>
                            <span className="text-muted-foreground">{p.allowed ? p.note : `Rejected: ${p.note}`}</span>
                            {p.allowed && CONTACT.has(p.column) && <Lock className="ml-auto size-3.5 text-muted-foreground" aria-label="Separate contact store" />}
                          </li>
                        ))}
                      </ul>
                      {rejected.length > 0 && (
                        <Alert tone="warning" title={`${rejected.length} column${rejected.length === 1 ? "" : "s"} rejected`}>
                          {rejected.join(", ")} will be removed before staging and the rejection is written to the audit log.
                        </Alert>
                      )}
                    </>
                  )}
                </div>
              </Card>
            )}

            {step === 1 && (
              <Card title="2. Staging validation">
                <div className="grid gap-4">
                  <Alert tone="info" size="sm">
                    Each row is checked against the import contract in the browser, then the rest go to the server checks for duplicates and impossible dates. Nothing is committed yet.
                  </Alert>
                  {!staged ? (
                    <p className="text-[13px] text-muted-foreground">Validating {totalRows} rows…</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Stat label="Rows checked" value={staged.rowsTotal} />
                      <Stat label="Passed browser checks" value={staged.rowsTotal - skipped.length} />
                      <Stat label="Skipped in validation" value={skipped.length} />
                    </div>
                  )}
                  {staged && skipped.length > 0 && (
                    <DataTable label="Rows skipped in validation" data={skipped} columns={skippedColumns} pageSize={0} density="compact" />
                  )}
                </div>
              </Card>
            )}

            {step === 2 && staged && (
              <Card title="3. Review before commit">
                <div className="grid gap-5">
                  <div className="grid gap-3 sm:grid-cols-5">
                    <Stat label="Rows in file" value={staged.rowsTotal} />
                    <Stat label="Ready to add" value={staged.fresh.length} />
                    <Stat label="Duplicates" value={staged.duplicates.length} note="Matched on customer_ref" />
                    <Stat label="Refused in staging" value={staged.refused.length} />
                    <Stat label="Skipped in validation" value={staged.skippedInBrowser} />
                  </div>
                  {staged.rejectedColumns.length > 0 && (
                    <Alert tone="warning" size="sm">Rejected columns, not stored: {staged.rejectedColumns.join(", ")}</Alert>
                  )}
                  <div className="grid gap-2">
                    <h3 className="text-[13.5px] font-semibold">Duplicate matches</h3>
                    <DataTable label="Duplicate matches" data={staged.duplicates} columns={dupColumns} pageSize={0} density="compact" empty={<p className="p-4 text-[13px] text-muted-foreground">No duplicates.</p>} />
                  </div>
                  <div className="grid gap-2">
                    <h3 className="text-[13.5px] font-semibold">Refused by staging</h3>
                    <DataTable label="Refused rows" data={staged.refused} columns={refusedColumns} pageSize={0} density="compact" empty={<p className="p-4 text-[13px] text-muted-foreground">No rows refused.</p>} />
                  </div>
                  {!running && (
                    <div className="flex justify-end">
                      <Button variant="ghost" onClick={reset}>Start over</Button>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {step === 3 && batch && (
              <Card title="4. Committed">
                <div className="grid gap-3">
                  <Alert tone="success" title={`Batch ${batch.id} is in the pool`}>
                    {batch.rowsImported} participants added ({batch.participantCodes.join(", ")}). {batch.duplicates} duplicate{batch.duplicates === 1 ? "" : "s"} skipped, {batch.rowsFailed} row{batch.rowsFailed === 1 ? "" : "s"} failed. You can roll the batch back from Import history until someone recruits from it.
                  </Alert>
                  <div className="flex gap-2">
                    <Button asChild variant="outline"><Link to="/admin/history">Open import history</Link></Button>
                    <Button variant="ghost" onClick={reset}>Simulate again</Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </Loaded>
    </AdminGate>
  );
}
