"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const SQUIRCLE = "[corner-shape:squircle]";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DialogOverlay({ className, style, onMouseDown, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      onMouseDown={(e) => {
        e.preventDefault();
        onMouseDown?.(e);
      }}
      style={{ zIndex: LAYER.dialog, ...style }}
      className={cn(
        "fixed inset-0 bg-black/40 backdrop-blur-[2px] dark:bg-black/60",
        "motion-safe:data-[state=open]:animate-fade-in motion-safe:data-[state=closed]:animate-fade-out",
        className,
      )}
      {...props}
    />
  );
});

const WIDTH = { sm: "max-w-[400px]", md: "max-w-[480px]", lg: "max-w-[640px]", xl: "max-w-[860px]" } as const;

export interface DialogContentProps extends Omit<React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, "title"> {
  /** Rendered as the dialog's accessible name. Required — use `hideTitle` if the design has no visible title. */
  title: React.ReactNode;
  /** One or two sentences: what happens, and what it affects. */
  description?: React.ReactNode;
  /** Keep the title for screen readers only. */
  hideTitle?: boolean;
  size?: keyof typeof WIDTH;
  /** Show the × in the corner. Default true. */
  showClose?: boolean;
  /** Draw the panel in place, with no scrim or portal: for docs and previews.
      Pair with `<Dialog open modal={false}>`. */
  inline?: boolean;
}

export const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  function DialogContent(
    { className, children, title, description, hideTitle = false, size = "md", showClose = true, inline = false, style, ...props },
    ref,
  ) {
    const Wrap = inline ? React.Fragment : DialogPortal;
    return (
      <Wrap>
        {!inline && <DialogOverlay />}
        <DialogPrimitive.Content
          ref={ref}
          style={inline ? style : { zIndex: LAYER.dialog, ...style }}
          {...(inline
            ? {
                onOpenAutoFocus: (e: Event) => e.preventDefault(),
                onInteractOutside: (e: Event) => e.preventDefault(),
              }
            : null)}
          {...(description ? null : { "aria-describedby": props["aria-describedby"] })}
          className={cn(
            inline ? "relative w-full shadow-float" : "fixed top-1/2 left-1/2 w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2",
            "grid max-h-[calc(100dvh-48px)] gap-4 overflow-y-auto rounded-[22px] bg-card p-5 text-card-foreground shadow-overlay ring-1 ring-border sm:p-6",
            "motion-safe:data-[state=open]:animate-dialog-in motion-safe:data-[state=closed]:animate-dialog-out",
            "outline-none",
            WIDTH[size],
            SQUIRCLE,
            className,
          )}
          {...props}
        >
          <div className={cn("grid gap-1.5 pr-8", hideTitle && !description && "sr-only")}>
            <DialogPrimitive.Title className={cn("text-[15px] leading-snug font-medium tracking-[-0.01em]", hideTitle && "sr-only")}>
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="text-[13px] leading-relaxed text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          {children}
          {showClose && (
            <DialogPrimitive.Close
              aria-label="Close"
              className={cn(
                "absolute top-3.5 right-3.5 grid size-8 cursor-pointer place-items-center rounded-[9px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                FOCUS,
              )}
            >
              <X className="size-4" aria-hidden />
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </Wrap>
    );
  },
);

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}

export interface ConfirmDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The element that opens it. Omit when controlling `open` yourself. */
  trigger?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Verb for the action: "Delete project", not "OK". */
  actionLabel: string;
  cancelLabel?: string;
  /** Red action button. Default true — the reason to confirm is usually that it cannot be undone. */
  destructive?: boolean;
  /** Require typing this exact text before the action unlocks — for the irreversible. */
  confirmText?: string;
  /** May return a promise; the button shows loading and the dialog closes when it settles. */
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
  /** Draw it in place, open, with no scrim: for docs and previews. */
  inline?: boolean;
}

export function ConfirmDialog({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  description,
  actionLabel,
  cancelLabel = "Cancel",
  destructive = true,
  confirmText,
  onConfirm,
  children,
  inline = false,
}: ConfirmDialogProps) {
  const [inner, setInner] = React.useState(defaultOpen ?? false);
  const isOpen = open ?? inner;
  const setOpen = (v: boolean) => {
    if (open === undefined) setInner(v);
    onOpenChange?.(v);
  };
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const inputId = React.useId();
  const locked = confirmText !== undefined && typed !== confirmText;

  React.useEffect(() => {
    if (!isOpen) setTyped("");
  }, [isOpen]);

  const run = async () => {
    if (locked || busy) return;
    try {
      setBusy(true);
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={isOpen} modal={!inline} onOpenChange={(v) => !busy && setOpen(v)}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        role="alertdialog"
        title={title}
        description={description}
        size="sm"
        showClose={false}
        inline={inline}
        onPointerDownOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          if (inline) return;
          (confirmText !== undefined ? document.getElementById(inputId) : cancelRef.current)?.focus();
        }}
      >
        {children}
        {confirmText !== undefined && (
          <div className="grid gap-1.5">
            <label htmlFor={inputId} className="text-[13px] text-muted-foreground">
              Type <span className="font-medium text-foreground">{confirmText}</span> to confirm
            </label>
            <input
              id={inputId}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              autoComplete="off"
              spellCheck={false}
              className={cn(
                "h-9 w-full rounded-[10px] bg-card px-3 text-[13px] ring-1 ring-inset ring-input outline-none focus-visible:ring-2 focus-visible:ring-ring",
                SQUIRCLE,
              )}
            />
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button ref={cancelRef} variant="outline" disabled={busy}>
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button
            variant={(destructive ? "destructive" : "primary") as ButtonProps["variant"]}
            loading={busy}
            disabled={locked}
            onClick={run}
          >
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default Dialog;
