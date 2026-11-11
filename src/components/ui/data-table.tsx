"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronRight, ChevronsUpDown, Columns3 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton, State } from "@/components/ui/state";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const SQUIRCLE = "[corner-shape:squircle]";

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

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** Right-align numbers so the digits line up. */
    align?: "left" | "right" | "center";
    /** Fixed width in px. */
    width?: number;
    /** Name for the columns menu when the header is not a string. */
    label?: string;
  }
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  /** Show a search box that filters across every column. */
  searchPlaceholder?: string;
  /** Adds a checkbox column. */
  selectable?: boolean;
  /** Rendered in the toolbar while rows are selected. */
  bulkActions?: (rows: T[]) => React.ReactNode;
  onSelectionChange?: (rows: T[]) => void;
  /** Rows per page. 0 turns paging off. Default 10. */
  pageSize?: number;
  /** Adds a columns menu for hiding and showing columns. */
  columnToggle?: boolean;
  /** Stable row ids; defaults to the index. */
  getRowId?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  density?: "compact" | "comfortable";
  empty?: React.ReactNode;
  /** What the rows are, for the table's accessible name: "Invoices". */
  label?: string;
  className?: string;
  /** Draws skeleton rows in the table's own shape. */
  loading?: boolean;
  /** Replaces the rows with a failure message. */
  error?: React.ReactNode;
  /** Shown as Retry under `error`. */
  onRetry?: () => void;
  /** Row treatment. Default `default`. */
  variant?: "default" | "striped" | "bordered";
  /** Status tabs above the table, with counts. You filter `data` for the chosen one. */
  tabs?: { value: string; label: string; count?: number }[];
  tab?: string;
  onTabChange?: (value: string) => void;
  /** Extra controls at the end of the toolbar: Export, Create. */
  actions?: React.ReactNode;
  /** Makes rows expandable; returns what shows under an open row. */
  renderExpanded?: (row: T) => React.ReactNode;
  /** Keep the header in view while the body scrolls. Pair with `maxHeight`. */
  stickyHeader?: boolean;
  /** Height of the scrolling body, in px. */
  maxHeight?: number;
  /** Sorted on first render. */
  initialSorting?: SortingState;
  /** Extra classes for a row, e.g. to mark the viewer's own row. */
  rowClassName?: (row: T) => string | undefined;
}

export function DataTable<T>({
  data,
  columns: userColumns,
  searchPlaceholder,
  selectable = false,
  bulkActions,
  onSelectionChange,
  pageSize = 10,
  columnToggle = false,
  getRowId,
  onRowClick,
  density = "comfortable",
  empty,
  label = "Table",
  className,
  loading = false,
  error,
  onRetry,
  variant = "default",
  tabs,
  tab,
  onTabChange,
  actions,
  renderExpanded,
  stickyHeader = false,
  maxHeight,
  initialSorting,
  rowClassName,
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting ?? []);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [visibility, setVisibility] = React.useState<VisibilityState>({});

  const columns = React.useMemo<ColumnDef<T, any>[]>(() => {
    const expander: ColumnDef<T, any>[] = renderExpanded
      ? [
          {
            id: "__expand",
            enableSorting: false,
            enableHiding: false,
            meta: { width: 40 },
            header: () => <span className="sr-only">Details</span>,
            cell: ({ row }) => {
              const open = !!expanded[row.id];
              return (
                <button
                  type="button"
                  aria-expanded={open}
                  aria-label={open ? "Hide details" : "Show details"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded((x) => ({ ...x, [row.id]: !open }));
                  }}
                  className="grid size-7 cursor-pointer place-items-center rounded-[7px] text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <ChevronRight className={cn("size-4 transition-transform motion-reduce:transition-none", open && "rotate-90")} aria-hidden />
                </button>
              );
            },
          },
        ]
      : [];
    if (!selectable) return [...expander, ...userColumns];
    const select: ColumnDef<T, any> = {
      id: "__select",
      enableSorting: false,
      enableHiding: false,
      meta: { width: 44 },
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all rows on this page"
          checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(v === true)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Select row"
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(v === true)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    };
    return [select, ...expander, ...userColumns];
  }, [selectable, userColumns, renderExpanded, expanded]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, rowSelection, columnVisibility: visibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setVisibility,
    getRowId,
    enableRowSelection: selectable,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(pageSize > 0 ? { getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize, pageIndex: 0 } } } : {}),
  });

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
  const selectedKey = Object.keys(rowSelection).join(",");
  React.useEffect(() => {
    onSelectionChange?.(selectedRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  const rows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const cellPad = density === "compact" ? "px-3 py-1.5" : "px-3 py-2.5";
  const hasToolbar = !!searchPlaceholder || columnToggle || !!actions || (selectable && selectedRows.length > 0);
  const hasFooter = !loading && !error && rows.length > 0 && table.getVisibleLeafColumns().some((c) => c.columnDef.footer);
  const span = table.getVisibleLeafColumns().length;

  const glide = useGlideHeight();
  const paged = React.useRef(false);
  return (
    <div className={cn("grid min-w-0 gap-3", className)}>
      {tabs && tabs.length > 0 && (
        <div role="group" aria-label={`Filter ${label.toLowerCase()} by status`} className="-mb-0.5 flex min-w-0 gap-1 overflow-x-auto border-b border-border">
          {tabs.map((t) => {
            const on = (tab ?? tabs[0].value) === t.value;
            return (
              <button
                key={t.value}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  onTabChange?.(t.value);
                  table.setPageIndex(0);
                }}
                className={cn(
                  "relative -mb-px inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  on ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                {t.count !== undefined && (
                  <span className={cn("rounded-[6px] px-1.5 text-[11px] leading-[18px] tabular-nums", on ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {hasToolbar && (
        <div className="flex flex-wrap items-center gap-2">
          {searchPlaceholder && (
            <SearchInput
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              value={globalFilter}
              onValueChange={(v) => {
                setGlobalFilter(v);
                table.setPageIndex(0);
              }}
              wrapperClassName="w-full max-w-[260px]"
            />
          )}
          {selectable && selectedRows.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="sr-only" aria-live="polite">{`${selectedRows.length} selected`}</span>
              {bulkActions?.(selectedRows)}
            </div>
          )}
          {(columnToggle || actions) && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {actions}
          {columnToggle && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Columns3 /> Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                {table
                  .getAllLeafColumns()
                  .filter((c) => c.getCanHide())
                  .map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.id}
                      checked={c.getIsVisible()}
                      onCheckedChange={(v) => c.toggleVisibility(v === true)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {c.columnDef.meta?.label ?? (typeof c.columnDef.header === "string" ? c.columnDef.header : c.id)}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
            </div>
          )}
        </div>
      )}

      <div
        className={cn("relative min-w-0 overflow-x-auto rounded-[18px] bg-card ring-1 ring-border", maxHeight && "overflow-y-auto", SQUIRCLE)}
        style={maxHeight ? { maxHeight } : glide.style}
      >
        <table ref={glide.ref} aria-label={label} aria-busy={loading || undefined} className="w-full border-collapse text-[13px]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border">
                {hg.headers.map((h) => {
                  const meta = h.column.columnDef.meta;
                  const sorted = h.column.getIsSorted();
                  const canSort = h.column.getCanSort();
                  const align = meta?.align ?? "left";
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      style={meta?.width ? { width: meta.width } : undefined}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : canSort ? "none" : undefined}
                      className={cn(
                        "h-10 px-3 text-[12px] font-medium whitespace-nowrap text-muted-foreground",
                        stickyHeader && "sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--border)]",
                        variant === "bordered" && "border-r border-border/60 last:border-r-0",
                        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
                      )}
                    >
                      {h.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className={cn(
                            "-mx-1.5 inline-flex cursor-pointer items-center gap-1 rounded-[6px] px-1.5 py-0.5 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                            sorted && "text-foreground",
                            align === "right" && "flex-row-reverse",
                          )}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3.5" aria-hidden />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3.5" aria-hidden />
                          ) : (
                            <ChevronsUpDown className="size-3.5 opacity-50" aria-hidden />
                          )}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody
            key={loading ? "loading" : error ? "error" : rows.length ? `rows-${table.getState().pagination?.pageIndex ?? 0}` : "empty"}
            className={cn(
              "motion-safe:animate-[layro-fade-in_.24s_ease-out]",
              paged.current && "motion-safe:animate-[layro-blur-in_.32s_cubic-bezier(0.22,1,0.36,1)]",
            )}
          >
            {loading ? (
              Array.from({ length: Math.min(pageSize || 5, 6) }, (_, i) => (
                <tr key={`sk${i}`} className="border-b border-border/60 last:border-b-0">
                  {table.getVisibleLeafColumns().map((c) => (
                    <td key={c.id} className={cellPad}>
                      <Skeleton className={cn("h-3.5 rounded-full", c.columnDef.meta?.align === "right" ? "ml-auto w-14" : i % 2 ? "w-3/4" : "w-1/2")} />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={span}>
                  <State
                    kind="error"
                    size="sm"
                    title={`Couldn't load ${label.toLowerCase()}`}
                    description={error}
                    action={onRetry ? <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button> : undefined}
                  />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={span}>
                  {(globalFilter ? null : empty) ?? (
                    <State
                      size="sm"
                      scene={globalFilter ? "search" : "inbox"}
                      title={globalFilter ? "No matches" : "Nothing here yet"}
                      description={globalFilter ? `Nothing matches “${globalFilter}”.` : undefined}
                      action={
                        globalFilter ? (
                          <Button size="sm" variant="outline" onClick={() => setGlobalFilter("")}>
                            Show everything
                          </Button>
                        ) : undefined
                      }
                    />
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row, ri) => (
                <React.Fragment key={row.id}>
                <tr
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    "border-b border-border/60 transition-colors last:border-b-0 hover:bg-muted/50 data-[state=selected]:bg-accent/70",
                    variant === "striped" && ri % 2 === 1 && "bg-muted/35",
                    onRowClick && "cursor-pointer",
                    rowClassName?.(row.original),
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const align = cell.column.columnDef.meta?.align ?? "left";
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          cellPad,
                          "align-middle text-foreground",
                          variant === "bordered" && "border-r border-border/60 last:border-r-0",
                          align === "right" ? "text-right tabular-nums" : align === "center" ? "text-center" : "",
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
                {renderExpanded && expanded[row.id] && (
                  <tr className="border-b border-border/60 bg-muted/30 last:border-b-0">
                    <td colSpan={span} className="px-3 py-3">
                      {renderExpanded(row.original)}
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))
            )}
          </tbody>
          {hasFooter && (
            <tfoot>
              {table.getFooterGroups().slice(0, 1).map((fg) => (
                <tr key={fg.id} className="border-t border-border bg-muted/40">
                  {fg.headers.map((h) => {
                    const align = h.column.columnDef.meta?.align ?? "left";
                    return (
                      <td
                        key={h.id}
                        className={cn(
                          cellPad,
                          "font-medium text-foreground",
                          align === "right" ? "text-right tabular-nums" : align === "center" ? "text-center" : "",
                        )}
                      >
                        {h.isPlaceholder ? null : flexRender(h.column.columnDef.footer, h.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tfoot>
          )}
        </table>
      </div>

      {pageSize > 0 && table.getPageCount() > 1 && (
        <Pagination
          label={`${label} pages`}
          page={table.getState().pagination.pageIndex + 1}
          pageCount={table.getPageCount()}
          onPageChange={(p) => {
            paged.current = true;
            table.setPageIndex(p - 1);
          }}
          total={filteredCount}
          pageSize={table.getState().pagination.pageSize}
        />
      )}
    </div>
  );
}

function useGlideHeight() {
  const ref = React.useRef<HTMLTableElement>(null);
  const [height, setHeight] = React.useState<number>();
  React.useEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box || typeof ResizeObserver === "undefined") return;
    const measure = () => setHeight(el.offsetHeight + (box.offsetHeight - box.clientHeight));
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return {
    ref,
    style: height
      ? ({
          height,
          overflowY: "hidden",
          transition: "height 320ms cubic-bezier(0.22, 1, 0.36, 1)",
        } as React.CSSProperties)
      : undefined,
  };
}

export type { ColumnDef };
export default DataTable;
