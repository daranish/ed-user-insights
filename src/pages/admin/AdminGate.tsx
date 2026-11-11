import type * as React from "react";
import { State } from "@/components/ui/state";
import { useMe } from "@/lib/hooks";
import { canAdmin } from "@/lib/permissions";
import { PageHeader } from "@/components/app/common";

/** Admin screens are hidden from the nav for other roles; this covers direct links. */
export function AdminGate({ title, children }: { title: string; children: React.ReactNode }) {
  const me = useMe();
  const check = canAdmin(me);
  if (!check.ok) {
    return (
      <>
        <PageHeader title={title} />
        <State scene="locked" title="Admin only" description={`${check.reason} Switch to Ravi Kumar (Ops / data) from the header to try it.`} framed />
      </>
    );
  }
  return <>{children}</>;
}
