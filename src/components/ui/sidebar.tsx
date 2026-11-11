"use client";

import * as React from "react";
import { PanelLeft } from "lucide-react";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

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

const CollapsedContext = React.createContext(false);

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  /** Accessible name for the nav. Default "Main". The sidebar itself is "<label> sidebar". */
  label?: string;
  /** Width when expanded, in px. Default 240. */
  width?: number;
  /** Width as an icon rail, in px. Default 60. */
  railWidth?: number;
  /** The body neither pads nor scrolls: for one child that scrolls itself. */
  flush?: boolean;
  /** Classes for the body that holds the children. */
  bodyClassName?: string;
}

export function Sidebar({
  collapsed = false,
  onCollapsedChange,
  header,
  footer,
  label = "Main",
  width = 240,
  railWidth = 60,
  flush = false,
  bodyClassName,
  className,
  style,
  children,
  ...rest
}: SidebarProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <CollapsedContext.Provider value={collapsed}>
        <aside
          aria-label={`${label} sidebar`}
          data-collapsed={collapsed || undefined}
          style={{ "--sidebar-width": `${width}px`, "--sidebar-rail": `${railWidth}px`, ...style } as React.CSSProperties}
          className={cn(
            "flex h-full flex-col bg-card text-card-foreground transition-[width] duration-200 ease-out",
            collapsed ? "w-[var(--sidebar-rail)]" : "w-[var(--sidebar-width)]",
            className,
          )}
          {...rest}
        >
          {(header || onCollapsedChange) && (
            <div className={cn("flex shrink-0 items-center gap-2 p-2.5", collapsed && "flex-col")}>
              {header && <div className={cn("min-w-0", !collapsed && "flex-1")}>{header}</div>}
              {onCollapsedChange && (
                <Tooltip label={collapsed ? "Expand sidebar" : "Collapse sidebar"} side="right">
                  <button
                    type="button"
                    onClick={() => onCollapsedChange(!collapsed)}
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    aria-expanded={!collapsed}
                    className={cn(
                      "grid size-8 shrink-0 cursor-pointer place-items-center rounded-[9px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                      FOCUS,
                    )}
                  >
                    <PanelLeft className="size-4" aria-hidden />
                  </button>
                </Tooltip>
              )}
            </div>
          )}
          <nav
            aria-label={label}
            className={cn(
              "min-h-0 flex-1",
              flush ? "flex flex-col overflow-hidden" : "overflow-y-auto overflow-x-hidden px-2.5 pb-2.5",
              bodyClassName,
            )}
          >
            {children}
          </nav>
          {footer && <div className="shrink-0 border-t border-border p-2.5">{footer}</div>}
        </aside>
      </CollapsedContext.Provider>
    </TooltipProvider>
  );
}

export interface SidebarDrawerProps extends Omit<SidebarProps, "collapsed" | "onCollapsedChange"> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Close when an item is chosen. Default true. */
  closeOnSelect?: boolean;
}

export function SidebarDrawer({ open, onOpenChange, closeOnSelect = true, label = "Main", width = 280, className, ...props }: SidebarDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        side="left"
        title={label}
        hideTitle
        bodyClassName="p-0 overflow-hidden"
        style={{ width, maxWidth: "85vw" }}
        onClickCapture={(e) => {
          if (closeOnSelect && (e.target as HTMLElement).closest("[data-sidebar-item]")) onOpenChange(false);
        }}
      >
        <Sidebar label={label} width={width} className={cn("w-full", className)} {...props} />
      </DrawerContent>
    </Drawer>
  );
}

export function SidebarGroup({ label, className, children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { label?: string }) {
  const collapsed = React.useContext(CollapsedContext);
  const id = React.useId();
  return (
    <div role="group" aria-labelledby={label ? id : undefined} className={cn("mt-3 first:mt-1", className)} {...rest}>
      {label && (
        <p
          id={id}
          className={cn(
            "px-2.5 pb-1 text-[12px] font-semibold text-muted-foreground",
            collapsed && "sr-only",
          )}
        >
          {label}
        </p>
      )}
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-0.5">{children}</ul>
    </div>
  );
}

export interface SidebarItemProps {
  icon?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  /** A count or a short word, right-aligned; a dot in the collapsed rail. */
  badge?: React.ReactNode;
  disabled?: boolean;
  /** Render your router's link: `render={(p) => <Link {...p} href="/inbox" />}`. */
  render?: (props: React.HTMLAttributes<HTMLElement> & { className: string; "aria-current"?: "page" }) => React.ReactNode;
  children: React.ReactNode;
}

export function SidebarItem({ icon, href, onClick, active, badge, disabled, render, children }: SidebarItemProps) {
  const collapsed = React.useContext(CollapsedContext);
  const cls = cn(
    "group/item relative flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 text-[13px] font-medium transition-colors",
    "text-foreground/75 hover:bg-accent hover:text-foreground",
    "aria-[current=page]:bg-accent aria-[current=page]:text-foreground",
    "aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:size-4 [&_svg]:shrink-0",
    collapsed && "justify-center px-0",
    FOCUS,
    SQUIRCLE,
  );
  const content = (
    <>
      {icon}
      <span className={cn("min-w-0 truncate", collapsed && "sr-only")}>{children}</span>
      {badge !== undefined &&
        (collapsed ? (
          <span aria-hidden className="absolute top-1.5 right-2 size-1.5 rounded-full bg-primary" />
        ) : (
          <span className="ml-auto shrink-0 rounded-[6px] bg-muted px-1.5 text-[11px] leading-[18px] tabular-nums text-muted-foreground">
            {badge}
          </span>
        ))}
    </>
  );
  const common = {
    className: cls,
    "data-sidebar-item": "",
    "aria-current": active ? ("page" as const) : undefined,
    "aria-disabled": disabled || undefined,
  };
  const el = render ? (
    render({ ...common, children: content })
  ) : href ? (
    <a href={href} {...common}>
      {content}
    </a>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} {...common}>
      {content}
    </button>
  );
  return (
    <li>
      {collapsed ? (
        <Tooltip label={children} side="right">
          {el as React.ReactElement}
        </Tooltip>
      ) : (
        el
      )}
    </li>
  );
}

export default Sidebar;
