"use client";

import * as React from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, PasswordInput } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { OtpInput } from "@/components/ui/otp-input";
import { PasswordStrength, scorePassword } from "@/components/ui/password-strength";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const SQUIRCLE = "[corner-shape:squircle]";

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

export function AuthCard({
  title,
  description,
  logo,
  footer,
  level = 1,
  className,
  children,
}: {
  title: React.ReactNode;
  /** Heading level of the title. 1 on a sign-in page; lower it when the card sits inside a page that has its own h1. */
  level?: 1 | 2 | 3;
  description?: React.ReactNode;
  logo?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("w-full max-w-[400px] rounded-[24px] bg-card p-5 text-card-foreground shadow-float ring-1 ring-border sm:p-8", SQUIRCLE, className)}>
      {logo && <div className="mb-5 flex justify-center">{logo}</div>}
      <div className="mb-6 grid gap-1.5 text-center">
        {React.createElement(`h${level}`, { className: "text-[20px] font-medium tracking-[-0.02em]" }, title)}
        {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {children}
      {footer && <div className="mt-6 text-center text-[12px] leading-relaxed text-muted-foreground">{footer}</div>}
    </div>
  );
}

export interface AuthProvider {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

function useSubmit<T>(fn: (v: T) => void | Promise<void>) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = async (v: T) => {
    setError(null);
    setBusy(true);
    try {
      await fn(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, setError };
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[10px] bg-destructive-soft px-3 py-2 text-[13px] text-destructive">
      {message}
    </p>
  );
}

function Providers({ providers, onProvider, disabled }: { providers?: AuthProvider[]; onProvider?: (id: string) => void; disabled?: boolean }) {
  if (!providers?.length) return null;
  return (
    <>
      <div className="grid gap-2">
        {providers.map((p) => (
          <Button key={p.id} type="button" variant="outline" size="lg" disabled={disabled} onClick={() => onProvider?.(p.id)} className="w-full">
            {p.icon && <span className="flex [&_img]:size-4 [&_svg]:size-4">{p.icon}</span>}
            {p.label}
          </Button>
        ))}
      </div>
      <div className="my-5 flex items-center gap-3 text-[12px] font-medium text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}

const LINK = "font-medium text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground";

export interface LoginFormProps {
  onSubmit: (v: { email: string; password: string; remember: boolean }) => void | Promise<void>;
  providers?: AuthProvider[];
  onProvider?: (id: string) => void;
  forgotHref?: string;
  signupHref?: string;
  /** Email-only magic link: hides the password field. */
  passwordless?: boolean;
  defaultEmail?: string;
}

export function LoginForm({ onSubmit, providers, onProvider, forgotHref, signupHref, passwordless = false, defaultEmail = "" }: LoginFormProps) {
  const [email, setEmail] = React.useState(defaultEmail);
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const { busy, error, run } = useSubmit(onSubmit);

  return (
    <div>
      <Providers providers={providers} onProvider={onProvider} disabled={busy} />
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          run({ email: email.trim(), password, remember });
        }}
      >
        <Field label="Email">
          <Input type="email" autoComplete="username" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </Field>
        {!passwordless && (
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="text-[13px] font-medium">Password</label>
              {forgotHref && <a href={forgotHref} className={cn("text-[12px]", LINK)}>Forgot password?</a>}
            </div>
            <PasswordInput id="login-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        )}
        {!passwordless && (
          <Field label="Keep me signed in" inline>
            <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
          </Field>
        )}
        <FormError message={error} />
        <Button type="submit" size="lg" loading={busy} className="w-full">
          {passwordless ? <><Mail /> Email me a sign-in link</> : "Sign in"}
        </Button>
      </form>
      {signupHref && (
        <p className="mt-5 text-center text-[13px] text-muted-foreground">
          New here? <a href={signupHref} className={LINK}>Create an account</a>
        </p>
      )}
    </div>
  );
}

export interface SignupFormProps {
  onSubmit: (v: { name: string; email: string; password: string }) => void | Promise<void>;
  providers?: AuthProvider[];
  onProvider?: (id: string) => void;
  loginHref?: string;
  termsHref?: string;
  privacyHref?: string;
}

export function SignupForm({ onSubmit, providers, onProvider, loginHref, termsHref, privacyHref }: SignupFormProps) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [agreed, setAgreed] = React.useState(false);
  const [tried, setTried] = React.useState(false);
  const { busy, error, run } = useSubmit(onSubmit);
  const weak = scorePassword(password) < 3;

  return (
    <div>
      <Providers providers={providers} onProvider={onProvider} disabled={busy} />
      <form
        className="grid gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setTried(true);
          if (!name.trim() || !/\S+@\S+\.\S+/.test(email) || weak || (termsHref && !agreed)) return;
          run({ name: name.trim(), email: email.trim(), password });
        }}
      >
        <Field label="Full name" error={tried && !name.trim() ? "Enter your name" : undefined}>
          <Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Work email" error={tried && !/\S+@\S+\.\S+/.test(email) ? "Enter an email like you@company.com" : undefined}>
          <Input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <div className="grid gap-2">
          <Field label="Password" error={tried && weak ? "Choose a stronger password" : undefined}>
            <PasswordInput autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <PasswordStrength value={password} />
        </div>
        {termsHref && (
          <Field
            inline
            error={tried && !agreed ? "Agree to the terms to continue" : undefined}
            label={
              <span className="font-normal text-muted-foreground">
                I agree to the <a href={termsHref} className={LINK}>Terms</a>
                {privacyHref && <> and <a href={privacyHref} className={LINK}>Privacy Policy</a></>}
              </span>
            }
          >
            <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
          </Field>
        )}
        <FormError message={error} />
        <Button type="submit" size="lg" loading={busy} className="w-full">Create account</Button>
      </form>
      {loginHref && (
        <p className="mt-5 text-center text-[13px] text-muted-foreground">
          Already have an account? <a href={loginHref} className={LINK}>Sign in</a>
        </p>
      )}
    </div>
  );
}

export function ForgotPasswordForm({ onSubmit, backHref }: { onSubmit: (v: { email: string }) => void | Promise<void>; backHref?: string }) {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const { busy, error, run } = useSubmit(async (v: { email: string }) => {
    await onSubmit(v);
    setSent(true);
  });

  return (
    <div className="grid gap-4">
      {sent ? (
        <div role="status" className="grid gap-2 rounded-[12px] bg-muted/60 p-4 text-center">
          <Mail className="mx-auto size-5 text-muted-foreground" aria-hidden />
          <p className="text-[13px] font-medium">Check your inbox</p>
          <p className="text-[13px] text-muted-foreground">
            If an account exists for <span className="text-foreground">{email}</span>, a reset link is on its way. It expires in 30 minutes.
          </p>
        </div>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run({ email: email.trim() });
          }}
        >
          <Field label="Email" hint="We'll send a link to reset your password">
            <Input type="email" autoComplete="username" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <FormError message={error} />
          <Button type="submit" size="lg" loading={busy} className="w-full">Send reset link</Button>
        </form>
      )}
      {backHref && (
        <a href={backHref} className="mx-auto inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden /> Back to sign in
        </a>
      )}
    </div>
  );
}

export interface VerifyCodeFormProps {
  /** Where the code went, shown in the copy: "maya@madgixs.com". */
  destination: string;
  length?: number;
  onVerify: (code: string) => void | Promise<void>;
  onResend?: () => void | Promise<void>;
  /** Seconds before Resend is offered again. Default 30. */
  cooldown?: number;
  /** Focus the first box on mount. Default true — this is usually its own screen. */
  autoFocus?: boolean;
}

export function VerifyCodeForm({ destination, length = 6, onVerify, onResend, cooldown = 30, autoFocus = true }: VerifyCodeFormProps) {
  const [code, setCode] = React.useState("");
  const [left, setLeft] = React.useState(cooldown);
  const { busy, error, run, setError } = useSubmit(onVerify);

  React.useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  return (
    <form
      className="grid w-full justify-items-center gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === length) run(code);
      }}
    >
      <p className="text-center text-[13px] text-muted-foreground [overflow-wrap:anywhere]">
        Enter the {length}-digit code sent to <span className="font-medium text-foreground">{destination}</span>
      </p>
      <OtpInput
        length={length}
        value={code}
        aria-label="Verification code"
        aria-invalid={error ? true : undefined}
        onChange={(v) => {
          setCode(v);
          if (error) setError(null);
        }}
        onComplete={(v) => run(v)}
        autoFocus={autoFocus}
      />
      <FormError message={error} />
      <Button type="submit" size="lg" loading={busy} disabled={code.length < length} className="w-full">Verify</Button>
      {onResend && (
        <p className="text-[13px] text-muted-foreground" aria-live="polite">
          {left > 0 ? (
            <>Resend a code in {left}s</>
          ) : (
            <button
              type="button"
              className={cn("cursor-pointer", LINK)}
              onClick={async () => {
                await onResend();
                setLeft(cooldown);
              }}
            >
              Resend code
            </button>
          )}
        </p>
      )}
    </form>
  );
}

export default LoginForm;
