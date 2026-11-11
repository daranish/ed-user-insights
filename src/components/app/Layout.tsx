import * as React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell, BookOpen, ChevronDown, CheckSquare, ClipboardList, Database, FileClock, Gauge, Home, Info, LogOut, Menu, PlusCircle, RotateCcw,
  ScrollText, Send, Settings2, Upload, Users,
} from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Sidebar, SidebarDrawer, SidebarGroup, SidebarItem } from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { useStore, type Sim } from "@/lib/store";
import { useMe, useUserName } from "@/lib/hooks";
import { canCreateQuestion, ROLE_LABEL } from "@/lib/permissions";
import { sessionsAwaitingEvidence } from "@/lib/rules/recruitment";
import { TODAY, fmtDate, fmtDateTime, simNowMs } from "@/lib/time";
import { isOverdue } from "@/lib/rules/metrics";
import { SimBadge } from "./common";

function Nav() {
  const me = useMe();
  const questionCount = useStore((s) => s.db.questions.filter((q) => !q.archivedAt).length);
  const openAssigned = useStore((s) => s.db.actions.filter((a) => a.assigneeId === me.id && a.status !== "done").length);
  const waitingInvites = useStore((s) => s.db.recruitments.filter((r) => r.status === "invite-requested").length);
  const { pathname } = useLocation();
  const item = (to: string, icon: React.ReactNode, label: string, exact = false) => (
    <SidebarItem
      key={to}
      icon={icon}
      active={exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)}
      render={(p) => <Link {...p} to={to} />}
    >
      {label}
    </SidebarItem>
  );
  return (
    <>
      <SidebarGroup label="Workspace">
        {item("/", <Home />, "Home", true)}
        <SidebarItem
          icon={<ClipboardList />}
          active={(pathname === "/questions" || pathname.startsWith("/questions/")) && pathname !== "/questions/new"}
          badge={questionCount}
          render={(p) => <Link {...p} to="/questions" />}
        >
          Questions
        </SidebarItem>
        <SidebarItem
          icon={<CheckSquare />}
          active={pathname === "/actions"}
          badge={openAssigned || undefined}
          render={(p) => <Link {...p} to="/actions" />}
        >
          My actions
        </SidebarItem>
        {canCreateQuestion(me).ok && item("/questions/new", <PlusCircle />, me.role === "owner" ? "New question" : "Raise a question")}
        {item("/dashboard", <Gauge />, "Insights & Impacts")}
      </SidebarGroup>
      {me.role === "admin" && (
        <SidebarGroup label="Admin">
          {item(
            "/admin/invites",
            <span className="relative grid place-items-center">
              <Send />
              {waitingInvites > 0 && <span role="img" aria-label={`${waitingInvites} waiting`} className="absolute -top-1 -right-1 size-2 rounded-full bg-destructive ring-2 ring-card" />}
            </span>,
            "Invite requests",
          )}
          {item("/admin/import", <Upload />, "Import CSV")}
          {item("/admin/history", <FileClock />, "Import history")}
          {item("/admin/users", <Users />, "Users & roles")}
          {item("/admin/audit", <ScrollText />, "Audit log")}
        </SidebarGroup>
      )}
      <SidebarGroup label="Prototype">{item("/about", <Info />, "About this prototype")}</SidebarGroup>
    </>
  );
}

function RoleSwitcher() {
  const me = useMe();
  const users = useStore((s) => s.db.users);
  const signIn = useStore((s) => s.signIn);
  const signOut = useStore((s) => s.signOut);
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Signed in as ${me.name}. Switch role`}>
          <span className="max-w-[180px] truncate">
            {me.name} · <span className="text-muted-foreground">{me.title}</span>
          </span>
          <ChevronDown className="size-3.5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Switch role (simulated sign-in)</DropdownMenuLabel>
        {(["owner", "admin", "viewer"] as const).map((role) => (
          <React.Fragment key={role}>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">{ROLE_LABEL[role]}</DropdownMenuLabel>
            {users
              .filter((u) => u.role === role)
              .map((u) => (
                <DropdownMenuItem
                  key={u.id}
                  onSelect={() => {
                    signIn(u.id);
                    navigate("/");
                    toast.info(`Now signed in as ${u.name}`, { description: `${u.title} · ${ROLE_LABEL[u.role]}` });
                  }}
                  shortcut={u.id === me.id ? "Current" : undefined}
                >
                  {u.name} <span className="text-muted-foreground">· {u.title}</span>
                </DropdownMenuItem>
              ))}
          </React.Fragment>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            signOut();
            navigate("/signin");
          }}
        >
          <LogOut className="size-4" aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const SIM_TOGGLES: { key: Exclude<keyof Sim, "clockShiftMin">; label: string; hint: string }[] = [
  { key: "failNextSave", label: "Fail the next save", hint: "The next write returns a simulated 503 and nothing is saved." },
  { key: "conflictNext", label: "Edit conflict on next finding save", hint: "Someone else saves the finding first: reload or compare." },
  { key: "importFailNext", label: "Import validation failure", hint: "The next staging run fails on the server." },
  { key: "recordingUnavailable", label: "Recording unavailable", hint: "Drive recording links on sessions return 'unavailable'." },
];

type Note = { key: string; title: string; sub: string; to: string };

/** Ops: invite requests waiting. Question owners: finished calls that still need evidence. Viewers (CEO, CX lead): actions assigned to them. */
function NotificationBell() {
  const me = useMe();
  const db = useStore((s) => s.db);
  const name = useUserName();
  const navigate = useNavigate();
  // Notifications the user has already looked at, per user. Opening the bell marks everything shown as seen; new ones count again.
  const [seenBy, setSeenBy] = React.useState<Record<string, string[]>>({});
  let heading = "";
  let allTo = "";
  let allLabel = "";
  let empty = "";
  let notes: Note[] = [];
  if (me.role === "admin") {
    heading = "Invite requests";
    allTo = "/admin/invites";
    allLabel = "Open invite requests";
    empty = "Nothing waiting for approval.";
    notes = db.recruitments
      .filter((r) => r.status === "invite-requested")
      .map((r) => ({
        key: `${r.questionId}|${r.participantCode}`,
        title: `${r.participantCode} · ${r.questionId}`,
        sub: `${name(r.inviteRequestedById)} wants to contact them${r.inviteRequestedAt ? ` · ${fmtDateTime(r.inviteRequestedAt)}` : ""}`,
        to: "/admin/invites",
      }));
  } else if (me.role === "owner") {
    heading = "For you";
    allLabel = "Open the first one";
    empty = "Nothing needs your attention.";
    const mine = db.questions.filter((q) => q.ownerId === me.id && !q.archivedAt).map((q) => q.id);
    const assigned = db.questions
      .filter((q) => !q.archivedAt && q.ownerId === me.id && q.raisedById && q.raisedById !== me.id && q.status === "proposed" && !db.recruitments.some((r) => r.questionId === q.id))
      .map((q) => ({
        key: `question|${q.id}`,
        title: `${q.id} · new question for you`,
        sub: `${name(q.raisedById)} raised it and made you the owner: ${q.text}`,
        to: `/questions/${q.id}/overview`,
      }));
    const evidence = sessionsAwaitingEvidence(db.sessions.filter((x) => mine.includes(x.questionId)), db.evidence).map((x) => ({
      key: x.id,
      title: `${x.participantCode} · ${x.questionId}`,
      sub: "Call done. Fill in the evidence for this participant.",
      to: `/questions/${x.questionId}/sessions`,
    }));
    notes = [...assigned, ...evidence];
    allTo = notes[0]?.to ?? "";
  } else {
    heading = "Assigned to you";
    allTo = "/";
    allLabel = "Open Home";
    empty = "No open actions are assigned to you.";
    notes = db.actions
      .filter((a) => a.assigneeId === me.id && a.status !== "done")
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((a) => ({
        key: `action|${a.id}`,
        title: `${a.id} · ${a.questionId}`,
        sub: `${name(a.ownerId)} assigned you: ${a.description} · due ${fmtDate(a.dueDate)}${isOverdue(a) ? " (overdue)" : ""}`,
        to: `/questions/${a.questionId}/actions?a=${a.id}`,
      }));
  }
  const seen = seenBy[me.id] ?? [];
  const unseen = notes.filter((n) => !seen.includes(n.key)).length;
  const markSeen = (open: boolean) => {
    if (open && unseen > 0) setSeenBy((m) => ({ ...m, [me.id]: [...new Set([...(m[me.id] ?? []), ...notes.map((n) => n.key)])] }));
  };
  return (
    <DropdownMenu onOpenChange={markSeen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" icon className="relative" aria-label={unseen ? `Notifications, ${unseen} new: ${heading.toLowerCase()}` : `Notifications: ${heading.toLowerCase()}`}>
          <Bell className="size-4" aria-hidden />
          {unseen > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white">
              {unseen}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>{heading}</DropdownMenuLabel>
        {notes.length === 0 ? (
          <p className="px-2.5 pb-2 text-[12.5px] text-muted-foreground">{empty}</p>
        ) : (
          notes.slice(0, 5).map((n) => (
            <DropdownMenuItem key={n.key} onSelect={() => navigate(n.to)}>
              <span className="grid">
                <span className="text-[13px] font-medium">{n.title}</span>
                <span className="text-[12px] text-muted-foreground">{n.sub}</span>
              </span>
            </DropdownMenuItem>
          ))
        )}
        {allTo && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate(allTo)}>{allLabel}</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DemoControls({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const sim = useStore((s) => s.sim);
  const setSim = useStore((s) => s.setSim);
  const breakScreen = useStore((s) => s.breakScreen);
  const resetDemo = useStore((s) => s.resetDemo);
  const navigate = useNavigate();
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="right" title="Demo controls" description="For reviewers: force the states a real backend would produce.">
        <div className="grid gap-5">
          <div className="grid gap-2">
            <h3 className="text-[13px] font-semibold">API error on this screen</h3>
            <p className="text-[12.5px] text-muted-foreground">Reloads the current screen with a simulated 503, so you can see the error state and Retry.</p>
            <Button
              variant="outline"
              onClick={() => {
                breakScreen();
                onOpenChange(false);
              }}
            >
              Break this screen
            </Button>
          </div>
          <div className="grid gap-3">
            <h3 className="text-[13px] font-semibold">Next request</h3>
            {SIM_TOGGLES.map((t) => (
              <Field key={t.key} inline label={t.label} hint={t.hint}>
                <Switch checked={sim[t.key]} onCheckedChange={(v) => setSim({ [t.key]: v })} />
              </Field>
            ))}
          </div>
          <div className="grid gap-2">
            <h3 className="text-[13px] font-semibold">Simulated clock</h3>
            <p className="text-[12.5px] text-muted-foreground">Done and No-show unlock 30 minutes after a booked call. Fast-forward to try them. Now: {fmtDateTime(new Date(simNowMs(sim.clockShiftMin)).toISOString())}.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setSim({ clockShiftMin: sim.clockShiftMin + 60 })}>+1 hour</Button>
              <Button variant="outline" size="sm" onClick={() => setSim({ clockShiftMin: sim.clockShiftMin + 1440 })}>+1 day</Button>
              <Button variant="ghost" size="sm" disabled={sim.clockShiftMin === 0} onClick={() => setSim({ clockShiftMin: 0 })}>Reset</Button>
            </div>
          </div>
          <div className="grid gap-2">
            <h3 className="text-[13px] font-semibold">Data</h3>
            <Alert tone="neutral" size="sm" icon={<Database className="size-4" />}>
              Data lives in your browser (localStorage). Backend persistence is simulated. Demo date: {fmtDate(TODAY)}.
            </Alert>
            <ConfirmDialog
              trigger={
                <Button variant="outline">
                  <RotateCcw className="size-4" aria-hidden /> Reset demo data
                </Button>
              }
              title="Reset demo data?"
              description="Every change you made in this browser is replaced by the original synthetic data."
              actionLabel="Reset demo data"
              onConfirm={() => {
                resetDemo();
                onOpenChange(false);
                navigate("/");
                toast.success("Demo data reset");
              }}
            />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function Layout() {
  const [menu, setMenu] = React.useState(false);
  const [demo, setDemo] = React.useState(false);
  const header = (
    <Link to="/" className="flex items-center gap-2 px-1.5">
      <BookOpen className="size-5 text-primary" aria-hidden />
      <span className="text-[14.5px] font-semibold leading-tight">
        ED User Insights
        <span className="block text-[11px] font-normal text-muted-foreground">Everyday Goods</span>
      </span>
    </Link>
  );
  return (
    <div className="flex h-dvh overflow-hidden">
      <div className="hidden h-full border-r border-border md:block">
        <Sidebar header={header} width={264}>
          <Nav />
        </Sidebar>
      </div>
      <SidebarDrawer open={menu} onOpenChange={setMenu} header={header}>
        <Nav />
      </SidebarDrawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3 sm:px-5">
          <IconButton label="Open menu" variant="ghost" className="md:hidden" onClick={() => setMenu(true)}>
            <Menu />
          </IconButton>
          <div className="hidden items-center gap-1.5 text-[12px] text-muted-foreground sm:flex">
            Backend persistence <SimBadge what="backend persistence (data stays in this browser)" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDemo(true)}>
              <Settings2 className="size-4" aria-hidden /> Demo controls
            </Button>
            <NotificationBell />
            <RoleSwitcher />
          </div>
        </header>
        <main className="relative min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1200px] p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
      <DemoControls open={demo} onOpenChange={setDemo} />
    </div>
  );
}
