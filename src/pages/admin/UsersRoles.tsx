import * as React from "react";
import { UserPlus } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { useLoad, useMe, useMutation } from "@/lib/hooks";
import { ROLE_LABEL } from "@/lib/permissions";
import type { Role, User } from "@/lib/types";
import { Card, Loaded, PageHeader, SimBadge } from "@/components/app/common";
import { AdminGate } from "./AdminGate";

const ROLES: Role[] = ["owner", "admin", "viewer"];

function AddPersonDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addUser = useStore((s) => s.addUser);
  const m = useMutation(addUser);
  const [name, setName] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<Role>("owner");
  const [raise, setRaise] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    setName(""); setTitle(""); setEmail(""); setRole("owner"); setRaise(false); setSubmitted(false); m.setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const errors = {
    name: !name.trim() ? "Add their full name." : undefined,
    title: !title.trim() ? "Add their job title, e.g. Marketing lead." : undefined,
    email: !email.trim() ? "Add their work email." : !/^\S+@\S+\.\S+$/.test(email.trim()) ? "That doesn't look like an email address." : undefined,
  };
  const valid = !Object.values(errors).some(Boolean);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Add a person" description="They can sign in with their Google Workspace account and get the access of the role you pick. You can change it later.">
        <form
          noValidate
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSubmitted(true);
            if (!valid) return;
            const r = await m.run({ name, title, email, role, canRaiseQuestion: raise });
            if (r.ok) {
              toast.success(`${name.trim()} added as ${ROLE_LABEL[role]}`, { description: "They now appear in the role switcher and in owner and assignee lists." });
              onClose();
            }
          }}
        >
          <Field label="Full name" required error={submitted ? errors.name : undefined}>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nisha Verma" />
          </Field>
          <Field label="Job title" required error={submitted ? errors.title : undefined}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Marketing lead" />
          </Field>
          <Field label="Work email" required error={submitted ? errors.email : undefined}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nisha@everydaygoods.example" />
          </Field>
          <Field label="Role" hint={role === "owner" ? "Can own questions and run the research." : role === "admin" ? "Ops / data steward: imports, invite approvals, users and the audit log." : "Reads everything; can update actions assigned to them."}>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
            </Select>
          </Field>
          {role === "viewer" && (
            <Field inline label="Can raise questions" hint="For leaders who flag questions and pick an owner, like the CEO or CX lead.">
              <Checkbox checked={raise} onCheckedChange={(v) => setRaise(v === true)} />
            </Field>
          )}
          {m.error && <Alert tone="destructive" size="sm" title="Not added">{m.error}</Alert>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={m.busy}>Add person</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UsersRoles() {
  const load = useLoad("users");
  const users = useStore((s) => s.db.users);
  const setUserRole = useStore((s) => s.setUserRole);
  const me = useMe();
  const [adding, setAdding] = React.useState(false);

  const columns: ColumnDef<User>[] = [
    {
      id: "name",
      header: "Person",
      accessorKey: "name",
      cell: ({ row }) => (
        <span className="grid">
          <span className="font-medium">{row.original.name}{row.original.id === me.id && <span className="text-muted-foreground"> (you)</span>}</span>
          <span className="text-[12px] text-muted-foreground">{row.original.email}</span>
        </span>
      ),
    },
    { id: "title", header: "Title", accessorKey: "title" },
    {
      id: "role",
      header: "Role",
      accessorKey: "role",
      cell: ({ row: { original: u } }) =>
        u.id === me.id ? (
          <span className="grid gap-0.5">
            <Badge size="sm" tone="outline">{ROLE_LABEL[u.role]}</Badge>
            <span className="text-[11.5px] text-muted-foreground">You can't change your own role.</span>
          </span>
        ) : (
          <Select
            size="sm"
            aria-label={`Role for ${u.name}`}
            value={u.role}
            onValueChange={async (v) => {
              try {
                await setUserRole(u.id, v as Role);
                toast.success(`${u.name} is now ${ROLE_LABEL[v as Role]}`);
              } catch (e) {
                toast.error("Role not changed", { description: e instanceof Error ? e.message : String(e) });
              }
            }}
          >
            {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
          </Select>
        ),
    },
    { id: "extra", header: "Also", enableSorting: false, cell: ({ row }) => (row.original.canRaiseQuestion ? <Badge size="sm" tone="neutral">Can raise questions</Badge> : null) },
  ];

  return (
    <AdminGate title="Users & roles">
      <PageHeader
        title="Users & roles"
        description="Who can do what. Adding people and changing roles are written to the audit log."
        actions={
          <span className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">Sign-in is Google Workspace <SimBadge what="Google Workspace directory" /></span>
            <Button size="sm" onClick={() => setAdding(true)}><UserPlus className="size-4" aria-hidden /> Add person</Button>
          </span>
        }
      />
      <Loaded load={load}>
        {() => (
          <Card>
            <DataTable<User> label="Users" data={users} columns={columns} getRowId={(u) => u.id} pageSize={0} />
          </Card>
        )}
      </Loaded>
      <AddPersonDialog open={adding} onClose={() => setAdding(false)} />
    </AdminGate>
  );
}
