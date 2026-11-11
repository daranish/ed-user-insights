"use client";

import * as React from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
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

export function ResizablePanelGroup({ className, ...props }: React.ComponentProps<typeof PanelGroup>) {
  return <PanelGroup className={cn("flex h-full w-full data-[panel-group-direction=vertical]:flex-col", className)} {...props} />;
}

export const ResizablePanel = Panel;

export function ResizableHandle({
  className,
  withGrip = true,
  ...props
}: React.ComponentProps<typeof PanelResizeHandle> & { withGrip?: boolean }) {
  return (
    <PanelResizeHandle
      className={cn(
        "group relative flex w-px shrink-0 items-center justify-center bg-border outline-none",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2",
        "data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full",
        "data-[panel-group-direction=vertical]:after:inset-x-0 data-[panel-group-direction=vertical]:after:inset-y-auto data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-3 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:top-1/2",
        "transition-colors hover:bg-foreground/25 data-[resize-handle-state=drag]:bg-ring focus-visible:bg-ring",
        className,
      )}
      {...props}
    >
      {withGrip && (
        <span
          aria-hidden
          className={cn(
            "z-10 h-6 w-1.5 rounded-full bg-border opacity-0 ring-1 ring-card transition-opacity",
            "group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[resize-handle-state=drag]:opacity-100",
            "group-data-[panel-group-direction=vertical]:h-1.5 group-data-[panel-group-direction=vertical]:w-6",
            "bg-foreground/35",
          )}
        />
      )}
    </PanelResizeHandle>
  );
}

export default ResizablePanelGroup;
