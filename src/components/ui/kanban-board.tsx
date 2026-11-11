"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, LayoutGroup, animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  FileText,
  Flag,
  LayoutDashboard,
  type LucideIcon,
  Monitor,
  MoreHorizontal,
  Palette,
  Plus,
  Server,
  Smartphone,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const FONT_STACK =
  'var(--font-sans, "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif)';

const SQUIRCLE = "[corner-shape:squircle]";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

const CHIP =
  "inline-flex h-[22px] items-center gap-1 rounded-[7px] px-2 text-[11px] leading-none";

const GAP = 8;

const LIFT_SPRING = { type: "spring", stiffness: 520, damping: 34, mass: 0.7 } as const;
const FLOW_SPRING = { type: "spring", stiffness: 420, damping: 36, mass: 0.9 } as const;

export type Priority = "urgent" | "high" | "normal" | "low";

const PRIORITY_STYLES: Record<Priority, string> = {
  urgent:
    "bg-destructive-soft text-destructive",
  high: "bg-warning-soft text-warning",
  normal: "bg-info-soft text-info",
  low: "bg-muted text-muted-foreground",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
  low: "Low",
};

export type Accent = "slate" | "violet" | "blue" | "amber" | "emerald";

const ACCENT_DOT: Record<Accent, string> = {
  slate: "bg-muted-foreground/70",
  violet: "bg-violet-500",
  blue: "bg-info",
  amber: "bg-warning-fill",
  emerald: "bg-success",
};

export interface KanbanAssignee {
  name: string;
  /** Portrait URL. Falls back to initials on a colour picked from the name. */
  avatar?: string;
}

export interface KanbanTask {
  id: string;
  title: string;
  /** One supporting line under the title. */
  note?: string;
  priority?: Priority;
  /** Short label with an icon, e.g. "Web app". */
  category?: string;
  /** Icon key, or your own node. */
  icon?: IconKey | React.ReactNode;
  assignees?: KanbanAssignee[];
  /** Free text, e.g. "25 Apr" or "Tomorrow". */
  due?: string;
  /** Paints the due date amber. Use it for today, tomorrow and overdue. */
  dueSoon?: boolean;
  /** 0 to 100. Drawn as a ring next to the date. */
  progress?: number;
}

export interface KanbanColumn {
  id: string;
  name: string;
  accent?: Accent;
  tasks: KanbanTask[];
}

export interface KanbanBoardProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    "onAnimationStart" | "onDragStart" | "onDragEnd" | "onDrag" | "onChange"
  > {
  columns: KanbanColumn[];
  /** Fires after every move with the whole board. */
  onChange?: (columns: KanbanColumn[]) => void;
  /** Accessible name for the scrolling region. */
  label?: string;
}

type DragState = {
  taskId: string;
  fromCol: string;
  width: number;
  height: number;
  /** Where inside the card the pointer grabbed it. */
  offsetX: number;
  offsetY: number;
  /** The board's own scale on screen (a scaled preview), so the card in hand matches. */
  scale: number;
};

type Slot = { col: string; index: number };

export const KanbanBoard = React.forwardRef<HTMLDivElement, KanbanBoardProps>(
  function KanbanBoard(
    { columns, onChange, label = "Project board", className, style, ...props },
    ref,
  ) {
    const [cols, setCols] = React.useState<KanbanColumn[]>(columns);
    const [drag, setDrag] = React.useState<DragState | null>(null);
    const [slot, setSlot] = React.useState<Slot | null>(null);
    const [grabbed, setGrabbed] = React.useState<string | null>(null);
    const [announcement, setAnnouncement] = React.useState("");
    const [atStart, setAtStart] = React.useState(true);
    const [atEnd, setAtEnd] = React.useState(true);
    const reduceMotion = useReducedMotion();

    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const trackRef = React.useRef<HTMLDivElement>(null);
    const listRefs = React.useRef(new Map<string, HTMLDivElement>());
    const colRefs = React.useRef(new Map<string, HTMLDivElement>());
    const cardRefs = React.useRef(new Map<string, HTMLDivElement>());
    const dragRef = React.useRef<DragState | null>(null);
    const slotRef = React.useRef<Slot | null>(null);
    const autoScroll = React.useRef(0);
    const rafRef = React.useRef<number | null>(null);

    React.useEffect(() => setCols(columns), [columns]);

    const syncEdges = React.useCallback(() => {
      const el = trackRef.current;
      if (!el) return;
      setAtStart(el.scrollLeft < 8);
      setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
    }, []);

    React.useEffect(() => {
      syncEdges();
      const el = trackRef.current;
      if (!el) return;
      const ro = new ResizeObserver(syncEdges);
      ro.observe(el);
      return () => ro.disconnect();
    }, [syncEdges, cols.length]);

    const fade = "24px";
    const maskStops = [
      `transparent 0%, #000 ${atStart ? "0%" : fade}`,
      `#000 ${atEnd ? "100%" : `calc(100% - ${fade})`}, transparent 100%`,
    ].join(", ");
    const mask =
      atStart && atEnd ? undefined : `linear-gradient(to right, ${maskStops})`;

    React.useEffect(() => {
      if (!grabbed) return;
      const el = cardRefs.current.get(grabbed);
      if (el && document.activeElement !== el) el.focus({ preventScroll: true });
    }, [cols, grabbed]);

    const commit = React.useCallback(
      (next: KanbanColumn[]) => {
        setCols(next);
        onChange?.(next);
      },
      [onChange],
    );

    const locate = React.useCallback(
      (list: KanbanColumn[], taskId: string) => {
        for (const c of list) {
          const i = c.tasks.findIndex((t) => t.id === taskId);
          if (i > -1) return { col: c.id, index: i, task: c.tasks[i] };
        }
        return null;
      },
      [],
    );

    const move = React.useCallback(
      (taskId: string, to: Slot) => {
        setCols((prev) => {
          const found = locate(prev, taskId);
          if (!found) return prev;
          if (found.col === to.col && found.index === to.index) return prev;

          const next = prev.map((c) => ({ ...c, tasks: [...c.tasks] }));
          const from = next.find((c) => c.id === found.col)!;
          from.tasks.splice(found.index, 1);
          const dest = next.find((c) => c.id === to.col)!;
          dest.tasks.splice(Math.min(to.index, dest.tasks.length), 0, found.task);

          onChange?.(next);
          return next;
        });
      },
      [locate, onChange],
    );

    const snapRef = React.useRef(new Map<string, number[]>());

    const snapshot = React.useCallback((taskId: string, fromCol: string) => {
      const map = new Map<string, number[]>();
      listRefs.current.forEach((list, colId) => {
        const listTop = list.getBoundingClientRect().top;
        const cards = Array.from(list.querySelectorAll<HTMLElement>("[data-kanban-card]"));
        let removed = -1;
        let removedH = 0;
        const rows = cards.map((el, i) => {
          const r = el.getBoundingClientRect();
          const isDragged = colId === fromCol && el.dataset.kanbanCard === taskId;
          if (isDragged) {
            removed = i;
            removedH = r.height;
          }
          return { top: r.top - listTop, h: r.height, isDragged };
        });
        const mids = rows
          .filter((row) => !row.isDragged)
          .map((row, i) => {
            const shift = removed > -1 && i >= removed ? removedH + GAP : 0;
            return row.top - shift + row.h / 2;
          });
        map.set(colId, mids);
      });
      snapRef.current = map;
    }, []);

    const slotAt = React.useCallback((clientX: number, clientY: number): Slot | null => {
      const d = dragRef.current;
      if (!d) return null;

      let inside = "";
      let nearestId = "";
      let nearest = Infinity;
      colRefs.current.forEach((el, id) => {
        const r = el.getBoundingClientRect();
        if (clientX >= r.left && clientX <= r.right) inside = id;
        const dx = Math.abs(clientX - (r.left + r.width / 2));
        if (dx < nearest) {
          nearest = dx;
          nearestId = id;
        }
      });
      const colId = inside || nearestId;
      if (!colId) return null;

      const list = listRefs.current.get(colId);
      if (!list) return { col: colId, index: 0 };

      const listTop = list.getBoundingClientRect().top;
      const mids = snapRef.current.get(colId) ?? [];

      let index = mids.length;
      for (let i = 0; i < mids.length; i++) {
        if (clientY < listTop + mids[i]) {
          index = i;
          break;
        }
      }
      return { col: colId, index };
    }, []);

    const [landing, setLanding] = React.useState(false);

    const endDrag = React.useCallback(() => {
      const d = dragRef.current;
      const s = slotRef.current;
      if (!d) return;
      dragRef.current = null;
      autoScroll.current = 0;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;

      const finish = () => {
        if (s) move(d.taskId, s);
        slotRef.current = null;
        setLanding(false);
        setDrag(null);
        setSlot(null);
      };

      const gap = trackRef.current?.querySelector<HTMLElement>("[data-kanban-placeholder]");
      if (!s || !gap || reduceMotion) return finish();
      const r = gap.getBoundingClientRect();
      setLanding(true);
      Promise.all([
        animate(x, r.left, FLOW_SPRING),
        animate(y, r.top, FLOW_SPRING),
      ]).then(finish, finish);
    }, [move, reduceMotion, x, y]);

    React.useEffect(() => {
      if (!drag) return;

      const onMove = (e: PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        x.set(e.clientX - d.offsetX);
        y.set(e.clientY - d.offsetY);

        const next = slotAt(e.clientX, e.clientY);
        const cur = slotRef.current;
        if (next && (!cur || cur.col !== next.col || cur.index !== next.index)) {
          slotRef.current = next;
          setSlot(next);
        }

        const track = trackRef.current;
        if (track) {
          const r = track.getBoundingClientRect();
          const edge = 72;
          autoScroll.current =
            e.clientX < r.left + edge ? -14 : e.clientX > r.right - edge ? 14 : 0;
        }
      };

      const onUp = () => endDrag();

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);

      const tick = () => {
        if (autoScroll.current && trackRef.current) {
          trackRef.current.scrollLeft += autoScroll.current;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      return () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }, [drag, endDrag, slotAt, x, y]);

    const pendingRef = React.useRef<(() => void) | null>(null);
    React.useEffect(() => () => pendingRef.current?.(), []);

    const startDrag = (e: React.PointerEvent, task: KanbanTask, colId: string, index: number) => {
      if (e.button !== 0 || drag) return;
      pendingRef.current?.();
      const el = e.currentTarget as HTMLElement;
      const startX = e.clientX;
      const startY = e.clientY;

      const lift = (clientX: number, clientY: number) => {
        const r = el.getBoundingClientRect();
        const state: DragState = {
          taskId: task.id,
          fromCol: colId,
          width: r.width,
          height: r.height,
          offsetX: startX - r.left,
          offsetY: startY - r.top,
          scale: el.offsetWidth ? r.width / el.offsetWidth : 1,
        };
        x.set(clientX - state.offsetX);
        y.set(clientY - state.offsetY);
        snapshot(task.id, colId);
        dragRef.current = state;
        slotRef.current = { col: colId, index };
        setDrag(state);
        setSlot({ col: colId, index });
        setGrabbed(null);
      };

      const onMove = (ev: PointerEvent) => {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
        cleanup();
        lift(ev.clientX, ev.clientY);
      };
      const cleanup = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", cleanup);
        window.removeEventListener("pointercancel", cleanup);
        pendingRef.current = null;
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", cleanup);
      window.addEventListener("pointercancel", cleanup);
      pendingRef.current = cleanup;
    };

    const originRef = React.useRef<Slot | null>(null);

    const onCardKeyDown = (e: React.KeyboardEvent, task: KanbanTask) => {
      const isGrabbed = grabbed === task.id;

      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (isGrabbed) {
          setGrabbed(null);
          const at = locate(cols, task.id);
          setAnnouncement(
            at ? `Dropped ${task.title} in ${colName(cols, at.col)}, position ${at.index + 1}.` : "",
          );
        } else {
          const at = locate(cols, task.id);
          originRef.current = at ? { col: at.col, index: at.index } : null;
          setGrabbed(task.id);
          setAnnouncement(`Picked up ${task.title}. Use the arrow keys to move it.`);
        }
        return;
      }

      if (e.key === "Escape" && isGrabbed) {
        e.preventDefault();
        if (originRef.current) move(task.id, originRef.current);
        setGrabbed(null);
        setAnnouncement(`Cancelled. ${task.title} is back where it started.`);
        return;
      }

      if (!isGrabbed) return;
      const at = locate(cols, task.id);
      if (!at) return;
      const colIndex = cols.findIndex((c) => c.id === at.col);

      let to: Slot | null = null;
      if (e.key === "ArrowUp") to = { col: at.col, index: Math.max(0, at.index - 1) };
      if (e.key === "ArrowDown")
        to = { col: at.col, index: Math.min(cols[colIndex].tasks.length - 1, at.index + 1) };
      if (e.key === "ArrowLeft" && colIndex > 0)
        to = { col: cols[colIndex - 1].id, index: Math.min(at.index, cols[colIndex - 1].tasks.length) };
      if (e.key === "ArrowRight" && colIndex < cols.length - 1)
        to = { col: cols[colIndex + 1].id, index: Math.min(at.index, cols[colIndex + 1].tasks.length) };

      if (to) {
        e.preventDefault();
        move(task.id, to);
        setAnnouncement(
          `${task.title} moved to ${colName(cols, to.col)}, position ${to.index + 1}.`,
        );
      }
    };

    const dragged = drag ? locate(cols, drag.taskId) : null;

    return (
      <div
        ref={ref}
        style={
          {
            "--kanban-font": FONT_STACK,
            fontFamily: "var(--kanban-font)",
            ...style,
          } as React.CSSProperties
        }
        className={cn(
          "w-full select-none text-foreground antialiased",
          className,
        )}
        {...props}
      >
        <div
          ref={trackRef}
          role="group"
          aria-label={label}
          onScroll={syncEdges}
          style={
            mask
              ? ({ maskImage: mask, WebkitMaskImage: mask } as React.CSSProperties)
              : undefined
          }
          className={cn(
            "flex items-start gap-3 overflow-x-auto pb-1",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          <LayoutGroup>
            {cols.map((col) => {
              const isTarget = slot?.col === col.id && !!drag;
              return (
                <div
                  key={col.id}
                  data-kanban-column={col.id}
                  ref={(el) => {
                    if (el) colRefs.current.set(col.id, el);
                    else colRefs.current.delete(col.id);
                  }}
                  className={cn(
                    "group/col w-[286px] shrink-0 rounded-[16px] p-3 transition-colors duration-200",
                    "bg-muted/70",
                    isTarget && "bg-muted-foreground/20",
                    SQUIRCLE,
                  )}
                >
                  <ColumnHeader
                    col={col}
                    count={
                      col.tasks.length -
                      (drag && drag.fromCol === col.id ? 1 : 0) +
                      (drag && slot?.col === col.id ? 1 : 0)
                    }
                  />

                  <div
                    ref={(el) => {
                      if (el) listRefs.current.set(col.id, el);
                      else listRefs.current.delete(col.id);
                    }}
                    className="mt-3 flex flex-col gap-2"
                  >
                    {col.tasks
                      .filter((t) => t.id !== drag?.taskId)
                      .map((task, i) => {
                      return (
                        <React.Fragment key={task.id}>
                          {isTarget && slot!.index === i && (
                            <Placeholder height={drag!.height} />
                          )}
                          {(
                            <Card
                              task={task}
                              grabbed={grabbed === task.id}
                              reduceMotion={!!reduceMotion}
                              elRef={(el) => {
                                if (el) cardRefs.current.set(task.id, el);
                                else cardRefs.current.delete(task.id);
                              }}
                              onPointerDown={(e) => startDrag(e, task, col.id, i)}
                              onKeyDown={(e) => onCardKeyDown(e, task)}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                    {isTarget &&
                      slot!.index >=
                        col.tasks.filter((t) => t.id !== drag?.taskId).length && (
                        <Placeholder height={drag!.height} />
                      )}
                  </div>

                  <button
                    type="button"
                    className={cn(
                      "mt-2 flex w-full items-center gap-1.5 rounded-[10px] px-2 py-2 text-[13px] font-medium",
                      "text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                      FOCUS,
                      SQUIRCLE,
                    )}
                  >
                    <Plus aria-hidden className="h-3.5 w-3.5" />
                    Add task
                  </button>
                </div>
              );
            })}
          </LayoutGroup>
        </div>

        <ScrollRail trackRef={trackRef} />

        {typeof document !== "undefined" &&
          createPortal(
        <AnimatePresence>
          {drag && dragged && (
            <motion.div
              style={{ x, y, width: drag.width }}
              initial={{ scale: 1, rotate: 0 }}
              animate={
                landing || reduceMotion ? { scale: 1, rotate: 0 } : { scale: 1.03, rotate: 1.6 }
              }
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
              transition={LIFT_SPRING}
              className="pointer-events-none fixed left-0 top-0 z-50 origin-top-left"
            >
              <div style={{ width: drag.width / drag.scale, transform: `scale(${drag.scale})`, transformOrigin: "0 0" }}>
                <CardShell task={dragged.task} floating />
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
            document.body,
          )}

        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
      </div>
    );
  },
);

function colName(cols: KanbanColumn[], id: string) {
  return cols.find((c) => c.id === id)?.name ?? id;
}

function ScrollRail({ trackRef }: { trackRef: React.RefObject<HTMLDivElement | null> }) {
  const railRef = React.useRef<HTMLDivElement>(null);
  const [geom, setGeom] = React.useState({ ratio: 1, offset: 0 });
  const [held, setHeld] = React.useState(false);

  const sync = React.useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const ratio = el.clientWidth / el.scrollWidth;
    const max = el.scrollWidth - el.clientWidth;
    setGeom({ ratio, offset: max > 0 ? el.scrollLeft / max : 0 });
  }, [trackRef]);

  React.useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [sync, trackRef]);

  const scrollTo = React.useCallback(
    (clientX: number) => {
      const rail = railRef.current;
      const el = trackRef.current;
      if (!rail || !el) return;
      const r = rail.getBoundingClientRect();
      const thumbW = r.width * geom.ratio;
      const p = (clientX - r.left - thumbW / 2) / (r.width - thumbW);
      el.scrollLeft = Math.max(0, Math.min(1, p)) * (el.scrollWidth - el.clientWidth);
    },
    [geom.ratio, trackRef],
  );

  React.useEffect(() => {
    if (!held) return;
    const onMove = (e: PointerEvent) => scrollTo(e.clientX);
    const onUp = () => setHeld(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [held, scrollTo]);

  if (geom.ratio >= 0.999) return null;

  return (
    <div
      ref={railRef}
      onPointerDown={(e) => {
        setHeld(true);
        scrollTo(e.clientX);
      }}
      className="mt-3 h-[6px] w-full cursor-pointer rounded-full bg-muted"
    >
      <div
        style={{
          width: `${geom.ratio * 100}%`,
          marginLeft: `${geom.offset * (100 - geom.ratio * 100)}%`,
        }}
        className={cn(
          "h-full rounded-full transition-colors",
          held
            ? "bg-foreground/40"
            : "bg-foreground/20 hover:bg-foreground/30",
        )}
      />
    </div>
  );
}

function ColumnHeader({ col, count }: { col: KanbanColumn; count: number }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", ACCENT_DOT[col.accent ?? "slate"])} />
      <h3 className="m-0 truncate text-[13px] font-medium tracking-[-0.005em]">{col.name}</h3>
      <motion.span
        key={count}
        initial={{ y: -6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={FLOW_SPRING}
        className={cn(
          "grid h-[18px] min-w-[18px] place-items-center rounded-[6px] px-1 text-[11px] font-medium tabular-nums",
          "bg-muted text-muted-foreground",
          SQUIRCLE,
        )}
      >
        {count}
      </motion.span>
      <span className="ml-auto flex items-center">
        <IconButton label={`More options for ${col.name}`}>
          <MoreHorizontal aria-hidden className="h-3.5 w-3.5" />
        </IconButton>
      </span>
    </div>
  );
}

function IconButton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "grid h-6 w-6 place-items-center rounded-[7px] transition-colors duration-150",
        "text-muted-foreground hover:bg-accent hover:text-foreground active:bg-foreground/10",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        SQUIRCLE,
      )}
    >
      {children}
    </button>
  );
}

function Placeholder({ height }: { height: number }) {
  return (
    <motion.div
      layout
      data-kanban-placeholder
      initial={{ opacity: 0, scaleY: 0.7 }}
      animate={{ opacity: 1, scaleY: 1 }}
      exit={{ opacity: 0, scaleY: 0.7 }}
      transition={FLOW_SPRING}
      style={{ height }}
      className={cn(
        "origin-top rounded-[12px] border border-dashed",
        "border-input bg-foreground/5",
        SQUIRCLE,
      )}
    />
  );
}

function Card({
  task,
  grabbed,
  reduceMotion,
  elRef,
  onPointerDown,
  onKeyDown,
}: {
  task: KanbanTask;
  grabbed: boolean;
  reduceMotion: boolean;
  elRef: (el: HTMLDivElement | null) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  return (
    <motion.div
      ref={elRef}
      layout
      data-kanban-card={task.id}
      tabIndex={0}
      role="button"
      aria-roledescription="Draggable card"
      aria-grabbed={grabbed}
      aria-label={`${task.title}. Press space to pick up.`}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      transition={reduceMotion ? { duration: 0 } : FLOW_SPRING}
      whileHover={reduceMotion ? undefined : { y: -1 }}
      className={cn(
        "cursor-grab touch-none active:cursor-grabbing",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        grabbed && "ring-2 ring-primary/40",
        "rounded-[12px]",
        SQUIRCLE,
      )}
    >
      <CardShell task={task} />
    </motion.div>
  );
}

function CardShell({ task, floating }: { task: KanbanTask; floating?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[12px] border p-3",
        "border-border/50 bg-card",
        floating
          ? "shadow-[0_16px_32px_-12px_rgb(0_0_0/0.28)]"
          : "shadow-[0_1px_2px_rgb(0_0_0/0.05)]",
        SQUIRCLE,
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {task.priority && (
          <span className={cn(CHIP, "font-medium", PRIORITY_STYLES[task.priority], SQUIRCLE)}>
            <Flag aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2.25} />
            <span>{PRIORITY_LABELS[task.priority]}</span>
          </span>
        )}
        {task.category && (
          <span
            className={cn(
              CHIP,
              "font-normal",
              "bg-muted text-foreground/75",
              SQUIRCLE,
            )}
          >
            <TaskIcon icon={task.icon} />
            <span>{task.category}</span>
          </span>
        )}
      </div>

      <p className="m-0 mt-2.5 text-[14px] font-medium leading-snug tracking-[-0.005em]">
        {task.title}
      </p>

      {task.note && (
        <p className="m-0 mt-1 text-[12px] font-normal leading-snug text-muted-foreground">
          {task.note}
        </p>
      )}

      {(task.assignees?.length || task.due || task.progress != null) && (
        <>
          <div className="mt-3 h-px bg-muted" />
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              {task.due && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[12px] font-normal tabular-nums",
                    task.dueSoon
                      ? "text-warning"
                      : "text-muted-foreground",
                  )}
                >
                  <CalendarDays aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2.25} />
                  {task.due}
                </span>
              )}
              {task.progress != null && <ProgressRing value={task.progress} />}
            </div>
            <AvatarStack people={task.assignees ?? []} />
          </div>
        </>
      )}
    </div>
  );
}

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const skin = "bg-primary";
  return (
    <span className="group/tip relative flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2",
          "translate-y-1 opacity-0 transition-[opacity,transform] duration-150 ease-out",
          "group-hover/tip:translate-y-0 group-hover/tip:opacity-100",
          "group-focus-within/tip:translate-y-0 group-focus-within/tip:opacity-100",
        )}
      >
        <span
          className={cn(
            "block whitespace-nowrap rounded-[7px] px-2 py-1 text-[11px] font-medium leading-none",
            "text-white",
            skin,
            "shadow-[0_6px_16px_-4px_rgb(0_0_0/0.3)]",
            SQUIRCLE,
          )}
        >
          {label}
        </span>
        <span
          aria-hidden
          className={cn(
            "absolute left-1/2 top-full h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1.5px]",
            skin,
          )}
        />
      </span>
    </span>
  );
}

function AvatarStack({ people }: { people: KanbanAssignee[] }) {
  const shown = people.slice(0, 3);
  const rest = people.slice(3);
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span key={p.name + i} className={cn(i > 0 && "-ml-1.5")}>
          <Tooltip label={p.name}>
            <span
              tabIndex={0}
              aria-label={p.name}
              className={cn(
                "grid h-[22px] w-[22px] place-items-center overflow-hidden rounded-full",
                "ring-2 ring-card",
                "focus-visible:outline-none focus-visible:ring-primary",
              )}
            >
              {p.avatar ? (
                <img src={p.avatar} alt="" draggable={false} className="h-full w-full object-cover" />
              ) : (
                <Initials name={p.name} />
              )}
            </span>
          </Tooltip>
        </span>
      ))}
      {rest.length > 0 && (
        <span className="-ml-1.5">
          <Tooltip label={rest.map((p) => p.name).join(", ")}>
            <span
              tabIndex={0}
              className={cn(
                "grid h-[22px] w-[22px] place-items-center rounded-full text-[10px] font-medium",
                "bg-muted-foreground/20 text-foreground/75 ring-2 ring-card",
                "focus-visible:outline-none focus-visible:ring-primary",
              )}
            >
              +{rest.length}
            </span>
          </Tooltip>
        </span>
      )}
    </div>
  );
}

const INITIAL_TINTS = [
  "bg-violet-500",
  "bg-info",
  "bg-success",
  "bg-warning-fill",
  "bg-rose-500",
  "bg-teal-500",
];

function Initials({ name }: { name: string }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn(
        "grid h-full w-full place-items-center text-[10px] font-medium text-white",
        INITIAL_TINTS[h % INITIAL_TINTS.length],
      )}
    >
      {initials}
    </span>
  );
}

function ProgressRing({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const r = 6;
  const c = 2 * Math.PI * r;
  const done = v >= 100;
  return (
    <span className="inline-flex items-center gap-1">
      <svg viewBox="0 0 16 16" aria-hidden className="h-[14px] w-[14px] -rotate-90">
        <circle cx="8"cy="8"r={r} fill="none"strokeWidth="2"className="stroke-foreground/10" />
        <motion.circle
          cx="8"
          cy="8"
          r={r}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c - (c * v) / 100 }}
          transition={FLOW_SPRING}
          className={done ? "stroke-success" : "stroke-foreground"}
        />
      </svg>
      <span className="text-[12px] font-normal tabular-nums text-muted-foreground">
        {v}%
      </span>
    </span>
  );
}

export type IconKey = "web" | "dashboard" | "mobile" | "brand" | "infra" | "docs";

const CATEGORY_ICONS: Record<IconKey, { Icon: LucideIcon; tint: string }> = {
  web: { Icon: Monitor, tint: "text-info" },
  dashboard: { Icon: LayoutDashboard, tint: "text-success" },
  mobile: { Icon: Smartphone, tint: "text-violet-500" },
  brand: { Icon: Palette, tint: "text-rose-500" },
  infra: { Icon: Server, tint: "text-warning-fill" },
  docs: { Icon: FileText, tint: "text-teal-500" },
};

function TaskIcon({ icon }: { icon?: IconKey | React.ReactNode }) {
  if (icon && typeof icon !== "string") return <>{icon}</>;
  const { Icon, tint } = CATEGORY_ICONS[(icon as IconKey) ?? "web"] ?? CATEGORY_ICONS.web;
  return <Icon aria-hidden className={cn("h-3 w-3 shrink-0", tint)} strokeWidth={2.25} />;
}

export default KanbanBoard;
