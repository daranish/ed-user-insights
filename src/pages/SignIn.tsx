import * as React from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { AuthCard } from "@/components/ui/auth";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Field } from "@/components/ui/field";
import { useStore } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/permissions";
import { SimBadge } from "@/components/app/common";

const ROLE_HINT = {
  owner: "Creates questions, recruits, logs evidence, writes findings and actions.",
  admin: "Imports CSVs, manages users and roles.",
  viewer: "Reads findings and Insights & Impacts.",
} as const;

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
    </svg>
  );
}

export function SignIn() {
  const users = useStore((s) => s.db.users);
  const signIn = useStore((s) => s.signIn);
  const navigate = useNavigate();
  const [userId, setUserId] = React.useState(users[0].id);
  const [busy, setBusy] = React.useState(false);

  const submit = () => {
    setBusy(true);
    // Simulated OAuth round trip.
    setTimeout(() => {
      signIn(userId);
      navigate("/");
    }, 600);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <AuthCard
        logo={<BookOpen className="size-8 text-primary" aria-hidden />}
        title="ED User Insights"
        description="Everyday Goods · sign in with your company Google account"
        footer={
          <>
            No real sign-in happens. Pick who you want to be for this demo; you can switch any time from the header. All data is synthetic.
          </>
        }
      >
        <div className="grid gap-4">
          <div className="flex justify-center">
            <SimBadge what="Google sign-in (company domain)" />
          </div>
          <Field label="Sign in as">
            <RadioGroup value={userId} onValueChange={setUserId} variant="card" className="max-h-[320px] overflow-y-auto">
              {users.map((u) => (
                <RadioGroupItem
                  key={u.id}
                  value={u.id}
                  label={`${u.name} · ${u.title}`}
                  hint={`${ROLE_LABEL[u.role]}: ${u.canRaiseQuestion ? "Reads findings and Insights & Impacts; can also raise a question." : ROLE_HINT[u.role]}`}
                />
              ))}
            </RadioGroup>
          </Field>
          <Button size="lg" variant="outline" className="w-full" loading={busy} onClick={submit}>
            <span className="flex [&_svg]:size-4">
              <GoogleMark />
            </span>
            Sign in with Google (@everydaygoods)
          </Button>
        </div>
      </AuthCard>
    </div>
  );
}
