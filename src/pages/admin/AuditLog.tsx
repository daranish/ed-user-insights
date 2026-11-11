import { AuditLogTable, auditCsv, type AuditEvent } from "@/components/ui/audit-log-table";
import { useStore } from "@/lib/store";
import { useLoad } from "@/lib/hooks";
import { PageHeader } from "@/components/app/common";
import { AdminGate } from "./AdminGate";

export function AuditLog() {
  const load = useLoad("audit");
  const db = useStore((s) => s.db);
  const rows: AuditEvent[] = db.audit.map((a) => {
    const u = db.users.find((x) => x.id === a.actorId);
    return {
      id: a.id,
      time: a.at,
      actor: { kind: "person", name: u?.name ?? a.actorId, email: u?.email },
      action: a.action,
      target: a.target,
      level: a.level,
    };
  });

  return (
    <AdminGate title="Audit log">
      <PageHeader title="Audit log" description="Contact reveals, imports, roll-backs, role changes and saves. Newest first." />
      <AuditLogTable
        rows={rows}
        loading={load.status === "loading"}
        error={load.status === "error" ? load.error : undefined}
        onRetry={load.retry}
        maxHeight={560}
        onExport={(shown) => {
          const blob = new Blob([auditCsv(shown)], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "audit-log.csv";
          a.click();
          URL.revokeObjectURL(url);
        }}
      />
    </AdminGate>
  );
}
