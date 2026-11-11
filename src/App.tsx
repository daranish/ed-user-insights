import { HashRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toast";
import { Layout } from "@/components/app/Layout";
import { useStore } from "@/lib/store";
import { SignIn } from "@/pages/SignIn";
import { Home } from "@/pages/Home";
import { ExecutiveBrief } from "@/pages/ExecutiveBrief";
import { useMe } from "@/lib/hooks";
import { isExecutive } from "@/lib/permissions";
import { NewQuestion } from "@/pages/NewQuestion";
import { QuestionWorkspace } from "@/pages/question/Workspace";
import { ImportWizard } from "@/pages/admin/ImportWizard";
import { ImportHistory } from "@/pages/admin/ImportHistory";
import { InviteRequests } from "@/pages/admin/InviteRequests";
import { UsersRoles } from "@/pages/admin/UsersRoles";
import { AuditLog } from "@/pages/admin/AuditLog";
import { Dashboard } from "@/pages/Dashboard";
import { Questions } from "@/pages/Questions";
import { MyActions } from "@/pages/MyActions";
import { About } from "@/pages/About";
import { NotFound } from "@/pages/NotFound";

function RequireUser() {
  const userId = useStore((s) => s.userId);
  const known = useStore((s) => s.db.users.some((u) => u.id === s.userId));
  if (!userId || !known) return <Navigate to="/signin" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <TooltipProvider>
      <HashRouter>
        <Routes>
          <Route path="/signin" element={<SignIn />} />
          <Route element={<RequireUser />}>
            <Route element={<Layout />}>
              <Route index element={<Start />} />
              <Route path="questions" element={<Questions />} />
              <Route path="actions" element={<MyActions />} />
              <Route path="questions/new" element={<NewQuestion />} />
              <Route path="questions/:id" element={<Navigate to="overview" replace />} />
              <Route path="questions/:id/:tab" element={<QuestionWorkspace />} />
              <Route path="admin" element={<Navigate to="/admin/import" replace />} />
              <Route path="admin/import" element={<ImportWizard />} />
              <Route path="admin/history" element={<ImportHistory />} />
              <Route path="admin/invites" element={<InviteRequests />} />
              <Route path="admin/users" element={<UsersRoles />} />
              <Route path="admin/audit" element={<AuditLog />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="about" element={<About />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </HashRouter>
      <Toaster />
    </TooltipProvider>
  );
}

/** The CEO lands on the executive brief; everyone else on their working Home. */
function Start() {
  const me = useMe();
  return isExecutive(me) ? <ExecutiveBrief /> : <Home />;
}
