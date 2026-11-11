"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const SQUIRCLE = "[corner-shape:squircle]";

const LAYER = {
  dialog: 70,
  popover: 75,
  toast: 80,
} as const;

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

export function useCommandShortcut(key = "k") {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === key && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key]);
  return [open, setOpen] as const;
}

export const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(function Command({ className, ...props }, ref) {
  return <CommandPrimitive ref={ref} className={cn("flex w-full flex-col overflow-hidden text-popover-foreground", className)} {...props} />;
});

export function CommandInput({ className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center gap-2.5 border-b border-border px-3.5">
      <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <CommandPrimitive.Input
        className={cn("h-12 w-full bg-transparent text-[14px] outline-none placeholder:text-muted-foreground", className)}
        {...props}
      />
    </div>
  );
}

export function CommandList({ className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    ref.current?.querySelector("[cmdk-list-sizer]")?.setAttribute("role", "presentation");
    ref.current?.querySelectorAll("[cmdk-separator]").forEach((el) => el.setAttribute("role", "none"));
  });
  return <CommandPrimitive.List ref={ref} className={cn("max-h-[min(360px,60dvh)] overflow-y-auto overscroll-contain p-1.5", className)} {...props} />;
}

export function CommandEmpty({ className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty className={cn("px-3 py-8 text-center text-[13px] text-muted-foreground", className)} {...props} />;
}

export function CommandGroup({ className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        "py-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-1.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]: [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function CommandSeparator({ className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>) {
  return <CommandPrimitive.Separator className={cn("-mx-1.5 my-1 h-px bg-border", className)} {...props} />;
}

export interface CommandItemProps extends React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item> {
  icon?: React.ReactNode;
  /** Display only: "⌘N", "G M". */
  shortcut?: string;
  /** A second line under the label. */
  hint?: React.ReactNode;
}

export function CommandItem({ className, icon, shortcut, hint, children, ...props }: CommandItemProps) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13px] outline-none select-none",
        "data-[selected=true]:bg-accent data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        className,
      )}
      {...props}
    >
      {icon}
      <span className="grid min-w-0 flex-1">
        <span className="truncate">{children}</span>
        {hint && <span className="truncate text-[12px] text-muted-foreground">{hint}</span>}
      </span>
      {shortcut && (
        <span className="flex gap-1">
          {shortcut.split(" ").map((k, i) => (
            <kbd key={i} className="grid h-5 min-w-5 place-items-center rounded-[5px] bg-muted px-1 font-sans text-[11px] text-foreground/70">
              {k}
            </kbd>
          ))}
        </span>
      )}
    </CommandPrimitive.Item>
  );
}

export interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder?: string;
  emptyText?: string;
  /** Hint shown in the footer. */
  footer?: React.ReactNode;
  /** Draw the palette in place, always open, with no dialog: for docs and previews. */
  inline?: boolean;
  children: React.ReactNode;
}

export function CommandMenu({ open, onOpenChange, placeholder = "Search or jump to…", emptyText = "No results.", footer, inline = false, children }: CommandMenuProps) {
  const body = (
    <Command loop>
      <CommandInput placeholder={placeholder} />
      <CommandList>
        <CommandEmpty>{emptyText}</CommandEmpty>
        {children}
      </CommandList>
      <div className="flex items-center gap-3 border-t border-border px-3.5 py-2 text-[12px] text-muted-foreground">
        {footer ?? (
          <>
            <span><kbd className="font-sans">↑↓</kbd> to move</span>
            <span><kbd className="font-sans">↵</kbd> to open</span>
            <span><kbd className="font-sans">esc</kbd> to close</span>
          </>
        )}
      </div>
    </Command>
  );
  if (inline)
    return (
      <div className={cn("w-full overflow-hidden rounded-[20px] bg-popover shadow-float ring-1 ring-border", SQUIRCLE)}>{body}</div>
    );
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          style={{ zIndex: LAYER.dialog }}
          className="fixed inset-0 bg-black/30 dark:bg-black/60 motion-safe:data-[state=open]:animate-fade-in motion-safe:data-[state=closed]:animate-fade-out"
        />
        <DialogPrimitive.Content
          style={{ zIndex: LAYER.dialog }}
          aria-describedby={undefined}
          className={cn(
            "fixed top-[12dvh] left-1/2 w-[calc(100vw-24px)] max-w-[560px] -translate-x-1/2 overflow-hidden rounded-[20px] bg-popover shadow-overlay ring-1 ring-border outline-none",
            "motion-safe:data-[state=open]:animate-pop-in motion-safe:data-[state=closed]:animate-pop-out",
            SQUIRCLE,
          )}
        >
          <DialogPrimitive.Title className="sr-only">Command menu</DialogPrimitive.Title>
          {body}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export default CommandMenu;
