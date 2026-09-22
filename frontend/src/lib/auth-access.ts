import type { Role } from "@prisma/client";

export const DEFAULT_STUDENT_EMAIL_DOMAIN = "iiitl.ac.in";

export function studentEmailDomain(value = process.env.STUDENT_EMAIL_DOMAIN) {
  return (value?.trim() || DEFAULT_STUDENT_EMAIL_DOMAIN).toLowerCase().replace(/^@/, "");
}

function domainOf(email: string) {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1);
}

function normalize(email: string | null | undefined) {
  const trimmed = email?.trim().toLowerCase();
  return trimmed || null;
}

/**
 * ADMIN_EMAILS is the only source of administrator access. There is no
 * built-in administrator: an address that is not listed here can never hold
 * the ADMIN role, and removing an address revokes it on the next sign-in.
 */
export function configuredAdminEmails(value = process.env.ADMIN_EMAILS) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string | null | undefined, configured?: string) {
  const normalized = normalize(email);
  return Boolean(normalized && configuredAdminEmails(configured).has(normalized));
}

export function isStudentEmail(email: string | null | undefined, domain?: string) {
  const normalized = normalize(email);
  return Boolean(normalized && domainOf(normalized) === studentEmailDomain(domain));
}

/**
 * Who may sign in at all. A password is now the only method, so this is also
 * the domain rule for the whole portal: an institute address, or an address
 * the operator listed in ADMIN_EMAILS. The allowlist exception exists because
 * a bootstrap administrator may hold an external address and would otherwise
 * have no way in. See docs/DECISIONS.md (2026-09-17, password-only sign-in).
 */
export function canUsePasswordAccount(
  email: string | null | undefined,
  configured?: string,
  domain?: string,
) {
  return isStudentEmail(email, domain) || isAdminEmail(email, configured);
}

/**
 * Who may create their own account. Narrower than sign-in on purpose: even
 * with the mailbox-ownership check in `frontend/src/lib/registration-otp.ts`,
 * registration stays institute-domain only and never reaches an allowlisted
 * administrator address — an OTP proves the address, not that it should hold
 * that role.
 */
export function canSelfRegister(email: string | null | undefined, domain?: string) {
  return isStudentEmail(email, domain);
}

export function resolveRole(email: string | null | undefined, configured?: string): Role {
  return isAdminEmail(email, configured) ? "SUPER_ADMIN" : "STUDENT";
}
