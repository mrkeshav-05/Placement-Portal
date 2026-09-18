import { AlertCircle, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { studentEmailDomain } from "@/lib/auth-access";
import { isElevatedRole } from "@/lib/permissions";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordSignInAction } from "./actions";

function describeError(code: string | undefined, domain: string) {
  if (!code) return null;
  if (code === "CredentialsSignin" || code === "AccessDenied") {
    return {
      title: "Incorrect email or password",
      body: `Sign-in needs an @${domain} account that has a password set. Repeated failures lock the address for fifteen minutes. If your account was created by the placement office, ask them for its password.`,
    };
  }
  if (code === "Configuration") {
    return {
      title: "Sign-in is not configured correctly",
      body: "The server is missing its authentication secret. Contact the placement office.",
    };
  }
  return {
    title: "Sign-in could not be completed",
    body: "Something went wrong while signing you in. Please try again.",
  };
}

export default async function LoginPage({
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
            Your career journey,
            <br />
            all in one place.
          </h1>
          <p>Discover opportunities, manage applications, and stay connected with the placement cell.</p>
        </div>
        <small>Indian Institute of Information Technology Lucknow</small>
      </section>
      <section className="login-panel">
        <div className="login-top-actions">
          <ThemeToggle />
        </div>
        <div className="login-card">
          <div className="login-icon">
            <ShieldCheck />
          </div>
          <span className="eyebrow">Student portal</span>
          <h2>Welcome back</h2>
          <p>Sign in with your institute email address and password.</p>
          {problem ? (
            <Alert variant="destructive" className="mb-5">
              <AlertCircle />
              <AlertTitle className="line-clamp-none">{problem.title}</AlertTitle>
              <AlertDescription>{problem.body}</AlertDescription>
            </Alert>
          ) : null}
          <form action={passwordSignInAction} className="login-fields">
            <div className="grid gap-2">
              <Label htmlFor="login-email">Institute email</Label>
              <Input
                id="login-email"
                className="h-11"
                type="email"
                name="email"
                autoComplete="email"
                placeholder={`you@${domain}`}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                className="h-11"
                type="password"
                name="password"
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" className="h-11 w-full">
              Sign in
            </Button>
          </form>
          <p className="login-switch">
            No password account yet? <Link href="/register">Create one</Link>
          </p>
          <div className="login-note">
            Students register and sign in with <strong>@{domain}</strong> addresses.
            <br />
            Placement office accounts are created by the office, which also sets their first
            password.
          </div>
        </div>
      </section>
    </main>
  );
}
