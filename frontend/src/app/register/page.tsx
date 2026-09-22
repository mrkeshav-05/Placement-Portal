import { UserPlus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { studentEmailDomain } from "@/lib/auth-access";
import { MIN_PASSWORD_LENGTH } from "@/lib/credentials-schema";
import { hasAnyAdminPermission } from "@/lib/permissions";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  const session = await auth();
  if (session) redirect(hasAnyAdminPermission(session.user) ? "/admin/dashboard" : "/dashboard");

  const domain = studentEmailDomain();

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
            Register with your <strong>@{domain}</strong> address. We&apos;ll email a code to confirm it&apos;s
            yours. If you used this portal before, registering with the same address keeps your profile and
            applications.
          </p>
          <RegisterForm domain={domain} />
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
