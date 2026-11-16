import type { JobStatus, JobType } from "@prisma/client";

const JOB_TYPE_LABELS: Record<JobType, string> = {
  INTERNSHIP: "Internship",
  FTE: "FTE",
  INTERNSHIP_PPO: "Internship + PPO",
  INTERNSHIP_FTE: "Internship + FTE",
};

export function jobTypeLabel(type: JobType) {
  return JOB_TYPE_LABELS[type];
}

export function jobStatusLabel(status: JobStatus) {
  return status === "ACTIVE" ? "Active" : status === "ENDED" ? "Closed" : "Draft";
}

export function companyInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function companyColor(name: string) {
  const colors = ["#1868db", "#4285f4", "#e11d48", "#6739b7", "#0f766e"];
  const hash = [...name].reduce((total, character) => total + character.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export function formatPortalDate(date: Date | string, includeTime = false) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(d);
}

/** True when a free-text field holds something worth showing a student. */
export function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Whole rupees with Indian digit grouping, e.g. ₹12,00,000. */
export function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Whole days from `now` to `deadline`, rounded up; negative once it has passed. */
export function daysUntil(deadline: Date, now = new Date()) {
  return Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
