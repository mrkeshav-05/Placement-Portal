import { AlertCircle, ArrowLeft, CheckCircle2, KeyRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canUsePasswordAccount, studentEmailDomain } from "@/lib/auth-access";
import { MIN_PASSWORD_LENGTH } from "@/lib/credentials-schema";
import { db } from "@/lib/db";
import { hasAnyAdminPermission } from "@/lib/permissions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setPasswordAction } from "./actions";

function describeError(code: string | undefined, domain: string) {
  if (!code) return null;
  if (code === "Current") {
    return { title: "That current password is wrong", body: "Re-enter the password you sign in with today." };
  }
  if (code === "Mismatch") {
    return { title: "Passwords do not match", body: "Enter the same new password in both fields." };
  }
  if (code === "Domain") {
    return {
      title: "This account cannot use a password",
      body: `Sign-in is limited to @${domain} addresses and to allowlisted administrator addresses.`,
    };
  }
  return {
    title: "Choose a stronger password",
    body: `Use at least ${MIN_PASSWORD_LENGTH} characters with at least one letter and one number.`,
  };
}

export default async function AccountPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, passwordHash: true },
  });
  if (!user) redirect("/login");

  const domain = studentEmailDomain();
  const { error, status } = await searchParams;
  const problem = describeError(error, domain);
  const hasPassword = Boolean(user.passwordHash);
  const eligible = canUsePasswordAccount(user.email);
  const homeHref = hasAnyAdminPermission(session.user) ? "/admin/dashboard" : "/dashboard";

  return (
    <main className="account-page">
      <div className="login-card">
        <div className="login-icon">
          <KeyRound />
        </div>
        <span className="eyebrow">Account security</span>
        <h2>{hasPassword ? "Change your password" : "Set a password"}</h2>
        <p>
          {eligible
            ? "This password is how you sign in. There is no reset email, so ask the placement office if you lose it."
            : `Sign-in is limited to @${domain} addresses and to addresses the placement office has allowlisted, so this account cannot hold a password.`}
        </p>
        {status === "saved" ? (
          <Alert variant="success" role="status" className="mb-5">
            <CheckCircle2 />
            <AlertTitle className="line-clamp-none">Password saved</AlertTitle>
            <AlertDescription>
              You can now sign in with {user.email} and this password.
            </AlertDescription>
          </Alert>
        ) : null}
        {problem ? (
          <Alert variant="destructive" className="mb-5">
            <AlertCircle />
            <AlertTitle className="line-clamp-none">{problem.title}</AlertTitle>
            <AlertDescription>{problem.body}</AlertDescription>
          </Alert>
        ) : null}
        {eligible ? (
          <form action={setPasswordAction} className="login-fields">
            {hasPassword ? (
              <div className="grid gap-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  className="h-11"
                  type="password"
                  name="currentPassword"
                  autoComplete="current-password"
                  required
                />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                className="h-11"
                type="password"
                name="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-new-password">Confirm new password</Label>
              <Input
                id="confirm-new-password"
                className="h-11"
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            </div>
            <Button type="submit" className="h-11 w-full">
              {hasPassword ? "Update password" : "Set password"}
            </Button>
          </form>
        ) : null}
        <p className="login-switch">
          <Link href={homeHref}>
            <ArrowLeft size={13} /> Back to the portal
          </Link>
        </p>
      </div>
    </main>
  );
}
