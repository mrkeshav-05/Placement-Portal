"use client";

import { AlertCircle, Mail, ShieldCheck } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { requestRegistrationOtpAction, verifyRegistrationOtpAction, type FormProblem } from "./actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD_LENGTH } from "@/lib/credentials-schema";

type Step = "form" | "otp";

function ProblemAlert({ problem }: { problem: FormProblem }) {
  return (
    <Alert variant="destructive" className="mb-5">
      <AlertCircle />
      <AlertTitle className="line-clamp-none">{problem.title}</AlertTitle>
      <AlertDescription>{problem.body}</AlertDescription>
    </Alert>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <small className="text-xs text-destructive">{message}</small>;
}

/**
 * Two-step registration: request a code, then prove it before anything is
 * written to `User`. See docs/DECISIONS.md (2026-09-22) — a single-step form
 * here used to let anyone who guessed an institute address claim it.
 */
export function RegisterForm({ domain }: { domain: string }) {
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  function requestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProblem(null);
    setFieldErrors({});
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await requestRegistrationOtpAction(formData);
      if (!result.success) {
        setProblem(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      setCode("");
      setStep("otp");
    });
  }

  function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProblem(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await verifyRegistrationOtpAction(formData);
      // A successful verify redirects from inside the action and never
      // returns here at all; only the error case has anything to show.
      if (result?.error) setProblem(result.error);
    });
  }

  function resendCode() {
    setProblem(null);
    const formData = new FormData();
    formData.set("name", name);
    formData.set("email", email);
    formData.set("password", password);
    formData.set("confirmPassword", confirmPassword);
    startTransition(async () => {
      const result = await requestRegistrationOtpAction(formData);
      if (!result.success) setProblem(result.error);
    });
  }

  if (step === "otp") {
    return (
      <>
        {problem ? <ProblemAlert problem={problem} /> : null}
        <form className="login-fields" onSubmit={verifyOtp}>
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="password" value={password} />
          <div className="grid gap-2">
            <Label htmlFor="register-otp-code">Verification code</Label>
            <Input
              id="register-otp-code"
              className="h-11 text-center tracking-[6px]"
              type="text"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            <p className="text-xs text-muted-foreground">
              Sent to <strong>{email}</strong>. It expires in {"10"} minutes.
            </p>
          </div>
          <Button type="submit" className="h-11 w-full" disabled={isPending || code.length !== 6}>
            <ShieldCheck />
            {isPending ? "Verifying…" : "Verify & create account"}
          </Button>
        </form>
        <div className="login-switch flex items-center justify-center gap-1">
          <Button type="button" variant="link" size="sm" disabled={isPending} onClick={resendCode}>
            Resend code
          </Button>
          <span aria-hidden>·</span>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => {
              setStep("form");
              setCode("");
              setProblem(null);
            }}
          >
            Use a different email
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      {problem ? <ProblemAlert problem={problem} /> : null}
      <form className="login-fields" onSubmit={requestOtp}>
        <div className="grid gap-2">
          <Label htmlFor="register-name">Full name</Label>
          <Input
            id="register-name"
            className="h-11"
            type="text"
            name="name"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <FieldError message={fieldErrors.name?.[0]} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="register-email">Institute email</Label>
          <Input
            id="register-email"
            className="h-11"
            type="email"
            name="email"
            autoComplete="email"
            placeholder={`you@${domain}`}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <FieldError message={fieldErrors.email?.[0]} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="register-password">Password</Label>
          <Input
            id="register-password"
            className="h-11"
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <FieldError message={fieldErrors.password?.[0]} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="register-confirm-password">Confirm password</Label>
          <Input
            id="register-confirm-password"
            className="h-11"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          <FieldError message={fieldErrors.confirmPassword?.[0]} />
        </div>
        <Button type="submit" className="h-11 w-full" disabled={isPending}>
          <Mail />
          {isPending ? "Sending code…" : "Send verification code"}
        </Button>
      </form>
    </>
  );
}
