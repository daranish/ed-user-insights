import { useLoad } from "@/lib/hooks";
import { Loaded, PageHeader } from "@/components/app/common";
import { AssignedActions } from "@/pages/Home";

/** Every action assigned to the signed-in user, in one place. */
export function MyActions() {
  const load = useLoad("my-actions");
  return (
    <>
      <PageHeader title="My actions" description="Actions assigned to you across every question. Open one to update its status or add a comment." />
      <Loaded load={load}>{() => <AssignedActions />}</Loaded>
    </>
  );
}
