import { AlertCircle, UserPlus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { studentEmailDomain } from "@/lib/auth-access";
import { MIN_PASSWORD_LENGTH } from "@/lib/credentials-schema";
import { isElevatedRole } from "@/lib/permissions";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction } from "./actions";

function describeError(code: string | undefined, domain: string) {
  if (!code) return null;
  if (code === "Exists") {
    return {
      title: "This address already has an account",
      body: "Sign in instead. If you have lost the password, ask the placement office to set a new one.",
    };
  }
  if (code === "Domain") {
    return {
      title: `Use your @${domain} address`,
      body: "Password accounts are limited to institute addresses.",
    };
  }
  if (code === "Staff") {
    return {
      title: "Placement office accounts are created by the office",
      body: "Ask the placement cell to create your account and give you its first password. You can change it afterwards.",
    };
  }
  if (code === "Mismatch") {
    return { title: "Passwords do not match", body: "Re-enter the same password in both fields." };
  }
  if (code === "Password") {
    return {
      title: "Choose a stronger password",
      body: `Use at least ${MIN_PASSWORD_LENGTH} characters with at least one letter and one number.`,
    };
  }
  if (code === "Email") {
    return { title: "Enter a valid email address", body: `Your address must end in @${domain}.` };
  }
  return { title: "Enter your full name", body: "We show this name to the placement office." };
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) redirect(isElevatedRole(session.user.role) ? "/admin/dashboard" : "/dashboard");

  const domain = studentEmailDomain();
  const problem = describeError((await searchParams).error, domain);

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-brand">
          <Image src="/iiitl-emblem.png" alt="" width={44} height={35} priority />
          <span>IIIT Lucknow</span>
        </div>
        <div>
          <span className="eyebrow">Training &amp; Placement Cell</span>
          <h1>
            One account for
            <br />
            every opportunity.
          </h1>
          <p>Register once, then track drives, applications, and offers from a single place.</p>
        </div>
        <small>Indian Institute of Information Technology Lucknow</small>
      </section>
      <section className="login-panel">
        <div className="login-top-actions">
          <ThemeToggle />
        </div>
        <div className="login-card">
          <div className="login-icon">
            <UserPlus />
          </div>
          <span className="eyebrow">Student portal</span>
          <h2>Create your account</h2>
          <p>
            Register with your <strong>@{domain}</strong> address. If you used this portal before,
            registering with the same address keeps your profile and applications.
          </p>
          {problem ? (
            <Alert variant="destructive" className="mb-5">
              <AlertCircle />
              <AlertTitle className="line-clamp-none">{problem.title}</AlertTitle>
              <AlertDescription>{problem.body}</AlertDescription>
            </Alert>
          ) : null}
          <form action={registerAction} className="login-fields">
            <div className="grid gap-2">
              <Label htmlFor="register-name">Full name</Label>
              <Input
                id="register-name"
                className="h-11"
                type="text"
                name="name"
                autoComplete="name"
                required
              />
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
              />
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
              />
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
              />
            </div>
            <Button type="submit" className="h-11 w-full">
              Create account
            </Button>
          </form>
          <p className="login-switch">
            Already registered? <Link href="/login">Sign in</Link>
          </p>
          <div className="login-note">
            Use at least {MIN_PASSWORD_LENGTH} characters with a letter and a number.
            <br />
            Placement office accounts are created by the office, not here.
          </div>
        </div>
      </section>
    </main>
  );
}
