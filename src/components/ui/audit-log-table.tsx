"use client";

import * as React from "react";
import { Bot, Download, UserRound } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["figure", "title", "body", "sub", "dense", "meta", "chip", "micro"] }],
      shadow: [{ shadow: ["float", "overlay"] }],
    },
  },
});

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type AuditLevel = "info" | "warn" | "error";

export interface AuditActor {
  kind: "person" | "bot";
  name: string;
  email?: string;
  avatarUrl?: string;
}

export interface AuditEvent {
  id: string;
  /** ISO date-time. */
  time: string;
  actor: AuditActor;
  /** Machine name: "document.sent". */
  action: string;
  /** What it was done to, in words. */
  target?: string;
  ip?: string;
  level: AuditLevel;
}

export interface AuditLogTableProps {
  rows: AuditEvent[];
  loading?: boolean;
  error?: React.ReactNode;
  onRetry?: () => void;
  onRowClick?: (row: AuditEvent) => void;
  /** Download what is shown. Leave out to hide Export. */
  onExport?: (rows: AuditEvent[]) => void;
  /** Height of the scrolling log in px; the header stays pinned. Default 440. */
  maxHeight?: number;
  density?: "comfortable" | "compact";
  variant?: "default" | "striped" | "bordered";
  className?: string;
}

export const AUDIT_LEVEL: Record<AuditLevel, { label: string; tone: BadgeTone }> = {
  info: { label: "Info", tone: "neutral" },
  warn: { label: "Warning", tone: "warning" },
  error: { label: "Error", tone: "destructive" },
};

const TABS: Array<AuditLevel | "all"> = ["all", "info", "warn", "error"];

const stamp = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export const auditTime = (iso: string) => stamp.format(new Date(iso)).replace(",", "");

export function auditCsv(rows: AuditEvent[]) {
  const q = (v: string | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;
  return [
    "time,actor,actor_type,action,target,ip,level",
    ...rows.map((r) => [r.time, r.actor.email ?? r.actor.name, r.actor.kind, r.action, r.target, r.ip, r.level].map(q).join(",")),
  ].join("\n");
}

export function AuditLogTable({
  rows,
  loading,
  error,
  onRetry,
  onRowClick,
  onExport,
  maxHeight = 440,
  density = "compact",
  variant,
  className,
}: AuditLogTableProps) {
  const [tab, setTab] = React.useState<AuditLevel | "all">("all");
  const shown = React.useMemo(() => (tab === "all" ? rows : rows.filter((r) => r.level === tab)), [rows, tab]);

  const columns = React.useMemo<ColumnDef<AuditEvent, any>[]>(
    () => [
      {
        accessorKey: "time",
        header: "Time (UTC)",
        meta: { width: 140 },
        cell: ({ row }) => (
          <span className={cn("relative font-mono text-[12px] whitespace-nowrap text-muted-foreground", row.original.level === "error" && "text-foreground")}>
            {row.original.level === "error" && <span aria-hidden className="absolute top-[-9px] bottom-[-9px] -left-3 w-[3px] rounded-r bg-destructive" />}
            {auditTime(row.original.time)}
          </span>
        ),
      },
      {
        id: "actor",
        header: "Actor",
        accessorFn: (r) => `${r.actor.name} ${r.actor.email ?? ""}`,
        cell: ({ row }) => {
          const a = row.original.actor;
          return (
            <span className="flex min-w-[150px] items-center gap-2">
              {a.kind === "bot" ? (
                <span className="grid size-[22px] shrink-0 place-items-center rounded-[7px] bg-foreground text-background">
                  <Bot className="size-3.5" aria-hidden />
                </span>
              ) : !a.email ? (
                <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-muted text-muted-foreground ring-1 ring-border ring-inset">
                  <UserRound className="size-3.5" aria-hidden />
                </span>
              ) : (
                <Avatar seed={a.email} src={a.avatarUrl} name={a.name} size={22} />
              )}
              <span className="grid min-w-0 leading-tight">
                <span className="truncate font-medium">{a.name}</span>
                {a.kind === "bot" && <span className="text-[11.5px] text-muted-foreground">Automated</span>}
              </span>
            </span>
          );
        },
      },
      {
        accessorKey: "action",
        header: "Action",
        cell: ({ getValue }) => <code className="font-mono text-[12px] whitespace-nowrap">{getValue<string>()}</code>,
      },
      {
        accessorKey: "target",
        header: "Target",
        cell: ({ getValue }) => <span className="block max-w-[180px] truncate text-muted-foreground">{getValue<string | undefined>() ?? "–"}</span>,
      },
      {
        accessorKey: "ip",
        header: "IP",
        cell: ({ getValue }) => <span className="font-mono text-[12px] text-muted-foreground">{getValue<string | undefined>() ?? "–"}</span>,
      },
      {
        accessorKey: "level",
        header: "Level",
        cell: ({ row }) => {
          const l = AUDIT_LEVEL[row.original.level];
          return (
            <Badge tone={l.tone} dot size="sm">
              {l.label}
            </Badge>
          );
        },
      },
    ],
    [],
  );

  return (
    <DataTable
      className={className}
      label="Audit log"
      data={shown}
      columns={columns}
      getRowId={(r) => r.id}
      tabs={TABS.map((t) => ({
        value: t,
        label: t === "all" ? "All" : AUDIT_LEVEL[t].label,
        count: t === "all" ? rows.length : rows.filter((r) => r.level === t).length,
      }))}
      tab={tab}
      onTabChange={(v) => setTab(v as AuditLevel | "all")}
      searchPlaceholder="Search actor, action, IP"
      actions={
        onExport ? (
          <Button size="sm" variant="outline" onClick={() => onExport(shown)}>
            <Download /> Export
          </Button>
        ) : undefined
      }
      onRowClick={onRowClick}
      loading={loading}
      error={error}
      onRetry={onRetry}
      density={density}
      variant={variant}
      stickyHeader
      maxHeight={maxHeight}
      pageSize={0}
      initialSorting={[{ id: "time", desc: true }]}
    />
  );
}

export default AuditLogTable;
