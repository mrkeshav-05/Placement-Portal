const DEFAULT_ADMIN_EMAIL = "placements@iiitl.ac.in";

export function configuredAdminEmails(value = process.env.ADMIN_EMAILS) {
  const configured = (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return new Set([DEFAULT_ADMIN_EMAIL, ...configured]);
}

export function isAdminEmail(email: string | null | undefined, configured?: string) {
  return Boolean(email && configuredAdminEmails(configured).has(email.toLowerCase()));
}

export function canUseGoogleAccount(email: string | null | undefined, configured?: string) {
  const normalized = email?.toLowerCase();
  return Boolean(
    normalized &&
      (normalized.endsWith("@iiitl.ac.in") || isAdminEmail(normalized, configured)),
  );
}
