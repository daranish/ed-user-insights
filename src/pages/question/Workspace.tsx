import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Archive, ArchiveRestore, ArrowLeft, Eye } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { State } from "@/components/ui/state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { useLoad, useMe, useMutation, useUserName } from "@/lib/hooks";
import { canArchiveQuestion, canEditQuestion } from "@/lib/permissions";
import { fmtDate } from "@/lib/time";
import { Loaded, PageHeader } from "@/components/app/common";
import { Overview } from "./Overview";
import { Recruitment } from "./Recruitment";
import { EvidenceTab, SessionsEvidence } from "./SessionsEvidence";
import { Findings } from "./Findings";
import { Actions } from "./Actions";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "recruitment", label: "Recruitment" },
  { value: "sessions", label: "Sessions" },
  { value: "evidence", label: "Evidence" },
  { value: "findings", label: "Findings" },
  { value: "actions", label: "Actions" },
] as const;

export function QuestionWorkspace() {
  const { id = "", tab = "overview" } = useParams();
  const navigate = useNavigate();
  const me = useMe();
  const name = useUserName();
  const question = useStore((s) => s.db.questions.find((q) => q.id === id));
  const load = useLoad(`${id}/${tab}`);
  const archiveQuestion = useStore((s) => s.archiveQuestion);
  const restoreQuestion = useStore((s) => s.restoreQuestion);
  const archive = useMutation(archiveQuestion);
  const restore = useMutation(restoreQuestion);
  const failure = archive.error ?? restore.error;
  React.useEffect(() => {
    if (failure) toast.error(failure);
  }, [failure]);

  if (!question) {
    return (
      <State
        scene="404"
        title="Question not found"
        description={`There is no question ${id}. It may have been removed when the demo data was reset.`}
        action={<Button asChild><Link to="/">Go home</Link></Button>}
        framed
      />
    );
  }
  const edit = canEditQuestion(me, question, name(question.ownerId));
  const canArchive = canArchiveQuestion(me, question, name(question.ownerId)).ok;
  const archived = !!question.archivedAt;
  const active = TABS.some((t) => t.value === tab) ? tab : "overview";

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-1.5">
            <Link to="/questions" className="inline-flex items-center gap-1 font-medium text-foreground hover:underline">
              <ArrowLeft className="size-3" aria-hidden /> All questions
            </Link>
            · {question.id} · owner {name(question.ownerId)} · created {fmtDate(question.createdAt)}
            {question.status === "proposed" && <Badge size="sm" tone="warning">Proposed by {name(question.raisedById)}</Badge>}
          </span>
        }
        title={question.text}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {archived && <Badge tone="warning"><Archive className="size-3.5" aria-hidden /> Archived {fmtDate(question.archivedAt!)}</Badge>}
            {!edit.ok && !archived && (
              <Badge tone="outline">
                <Eye className="size-3.5" aria-hidden /> Read-only: {edit.reason}
              </Badge>
            )}
            {canArchive && !archived && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline">
                    <Archive className="size-4" aria-hidden /> Archive question
                  </Button>
                }
                title={`Archive ${question.id}?`}
                description="It becomes read-only and moves to the Archived tab, and it leaves the leadership figures. Nothing is deleted: its findings stay searchable, open actions stay on their assignees' lists, and you can restore it any time."
                actionLabel="Archive question"
                onConfirm={async () => {
                  if ((await archive.run(question.id)).ok) {
                    toast.success(`${question.id} archived`, { description: "Find it under Questions → Archived." });
                    navigate("/questions");
                  }
                }}
              />
            )}
            {canArchive && archived && (
              <Button
                variant="outline"
                loading={restore.busy}
                onClick={async () => {
                  if ((await restore.run(question.id)).ok) toast.success(`${question.id} restored`);
                }}
              >
                <ArchiveRestore className="size-4" aria-hidden /> Restore question
              </Button>
            )}
          </div>
        }
      />
      <Tabs value={active} onValueChange={(v) => navigate(`/questions/${id}/${v}`)}>
        <div className="mb-5 overflow-x-auto">
          <TabsList variant="underline">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      <Loaded load={load} rows={2}>
        {() => (
          <>
            {active === "overview" && <Overview question={question} canEdit={edit} />}
            {active === "recruitment" && <Recruitment question={question} canEdit={edit} />}
            {active === "sessions" && <SessionsEvidence question={question} canEdit={edit} />}
            {active === "evidence" && <EvidenceTab question={question} canEdit={edit} />}
            {active === "findings" && <Findings question={question} canEdit={edit} />}
            {active === "actions" && <Actions question={question} canEdit={edit} />}
          </>
        )}
      </Loaded>
    </>
  );
}
