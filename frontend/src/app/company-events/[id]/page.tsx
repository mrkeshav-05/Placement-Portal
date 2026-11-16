import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import Link from "next/link";
import { ApplyButton } from "@/components/jobs/apply-button";
import { AuthenticatedPortalShell } from "@/components/layout/authenticated-portal-shell";
import { db } from "@/lib/db";
import { evaluateEligibility, isEligible } from "@/lib/eligibility";
import { policyAllows } from "@/lib/placement-policy";
import { fetchStudentStanding } from "@/lib/student-standing";
import {
  CompensationTable,
  DetailSection,
  FileCard,
  KeyFacts,
  RowList,
  SelectionRounds,
  workModeLabel,
  yesNo,
  type KeyFact,
} from "@/components/jobs/detail/job-detail-sections";
import type { CompensationEntry, EventAttachment, SelectionRound } from "@/lib/job-profile-schema";
import { employmentFlags } from "@/lib/job-profile-schema";
import {
  companyColor,
  companyInitials,
  daysUntil,
  formatInr,
  formatPortalDate,
  hasText,
  jobTypeLabel,
} from "@/lib/job-presenters";
import { sanitizeRichText } from "@/lib/rich-text";
import { toEligibilityProfile } from "@/lib/student-profile";
import { requireStudent } from "@/lib/student-session";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = await requireStudent();
  const job = await db.jobProfile.findFirst({
    where: { id, status: { not: "DRAFT" } },
    include: { company: true },
  });
  if (!job) notFound();

  const [resumes, existingApplication, standing] = student.user
    ? await Promise.all([
        db.resume.findMany({
          where: { userId: student.user.id },
          select: { id: true, label: true, fileName: true },
          orderBy: { uploadedAt: "desc" },
        }),
        db.application.findUnique({
          where: {
            userId_jobProfileId: {
              userId: student.user.id,
              jobProfileId: job.id,
            },
          },
        }),
        fetchStudentStanding(),
      ])
    : [[], null, null];
  const resumeCount = resumes.length;
  const profile = student.user ? toEligibilityProfile(student.user, resumeCount) : null;
  const policy = standing
    ? policyAllows(standing, { type: job.type, package: job.ctcStipend, companyCategory: job.company.category })
    : { allowed: true, reason: null };
  const eligibilityChecks = profile
    ? evaluateEligibility(profile, {
        minCgpa: job.minCGPA,
        batch: job.batch,
        branches: job.allowedBranches,
        degrees: job.allowedDegrees,
        genders: job.allowedGenders,
        maxBacklogs: job.maxBacklogs,
        maxBans: job.maxBans,
        min10Percent: job.min10Percent,
        min12Percent: job.min12Percent,
      })
    : [];
  // The placement policy reads as one more criterion, so a closed drive says why.
  const checks = standing && standing.standing !== "OPEN" && profile
    ? [
        ...eligibilityChecks,
        {
          key: "placementPolicy",
          label: policy.allowed ? `Placement policy: ${standing.label}, Dream drive open` : policy.reason ?? "Closed by the placement policy",
          pass: policy.allowed,
        },
      ]
    : eligibilityChecks;
  const applicationOpen = job.status === "ACTIVE" && job.registrationDeadline > new Date();
  const eligible = Boolean(profile && applicationOpen && isEligible(checks));
  const disabledReason = !student.user
    ? "Sign-in required"
    : !profile
      ? "Complete your profile"
      : !applicationOpen
        ? "Applications closed"
        : !policy.allowed
          ? "Closed by placement policy"
          : !eligible
          ? "Not currently eligible"
          : undefined;
  // Everything below renders only what the placement cell has entered: a
  // detail still missing from the recruiter is left out, not shown as blank.
  const jdFile = (job.jdFile as EventAttachment | null) ?? null;
  const extraFiles = Array.isArray(job.attachments) ? (job.attachments as EventAttachment[]) : [];
  const compensation = (job.compensation as Record<string, CompensationEntry> | null) ?? null;
  const rounds = (job.selectionRounds as Record<string, SelectionRound> | null) ?? null;
  const daysLeft = daysUntil(job.registrationDeadline);
  const deadlineNote = !applicationOpen
    ? "Applications closed"
    : daysLeft <= 0
      ? "Closes today"
      : daysLeft === 1
        ? "1 day left"
        : `${daysLeft} days left`;

  const flags = employmentFlags(job.type);
  const amount = job.ctcStipend != null && job.ctcStipend > 0 ? job.ctcStipend : null;
  // One headline figure: a monthly stipend for the internship types, a yearly
  // CTC for an FTE (unless the breakup table already states it by degree).
  const headline = flags.stipend
    ? amount != null
      ? { label: "Stipend", value: `${formatInr(amount)} / month` }
      : null
    : amount != null && !compensation
      ? { label: "CTC", value: `${formatInr(amount)} per year` }
      : null;
  const expectedCtc =
    flags.expectedCtc && job.ppoCtcLpa != null
      ? job.type === "INTERNSHIP_PPO"
        ? { label: "Expected PPO CTC", value: `${job.ppoCtcLpa} LPA` }
        : { label: "Expected full-time CTC", value: `${job.ppoCtcLpa} LPA` }
      : null;

  const facts: KeyFact[] = [
    job.locations.length ? { label: "Location", value: job.locations.join(", ") } : null,
    workModeLabel(job.workMode) ? { label: "Work mode", value: workModeLabel(job.workMode)! } : null,
    flags.duration && hasText(job.duration) ? { label: "Duration", value: job.duration } : null,
    headline,
    expectedCtc,
    hasText(job.joiningDate) ? { label: "Joining (tentative)", value: job.joiningDate } : null,
    { label: "Batch", value: String(job.batch) },
  ].filter((fact): fact is KeyFact => fact !== null);

  const compensationRows = [
    hasText(job.ctcStipendInfo) ? { label: "Additional info / benefits", value: job.ctcStipendInfo } : null,
    flags.fullTime
      ? job.hasBond === false
        ? { label: "Service bond", value: "No" }
        : job.hasBond === true || hasText(job.companyBond)
          ? { label: "Service bond", value: hasText(job.companyBond) ? job.companyBond : "Yes" }
          : null
      : null,
  ];
  const hasCompensation = Boolean(flags.fullTime && compensation) || compensationRows.some(Boolean);

  const selectionRows = [
    yesNo(job.ppt) ? { label: "Pre-placement talk", value: yesNo(job.ppt) } : null,
    yesNo(job.resumeShortlisting) ? { label: "Shortlisting from resumes", value: yesNo(job.resumeShortlisting) } : null,
    hasText(job.shortlistCriteria) ? { label: "Shortlisting criteria", value: job.shortlistCriteria } : null,
  ];
  const hasSelection = Boolean(rounds) || selectionRows.some(Boolean) || hasText(job.selectionNotes);

  const eligibilityRows = [
    job.minCGPA > 0 ? { label: "Minimum CGPA", value: job.minCGPA } : null,
    job.min10Percent != null ? { label: "Minimum 10th percentage", value: `${job.min10Percent}%` } : null,
    job.min12Percent != null ? { label: "Minimum 12th percentage", value: `${job.min12Percent}%` } : null,
    { label: "Backlogs", value: job.maxBacklogs === 0 ? "None allowed" : `Up to ${job.maxBacklogs}` },
    job.allowedDegrees.length ? { label: "Programmes", value: job.allowedDegrees.join(", ") } : null,
    job.allowedBranches.length ? { label: "Branches", value: job.allowedBranches.join(", ") } : null,
    job.allowedGenders.length ? { label: "Open to", value: job.allowedGenders.join(", ") } : null,
  ];

  const orgMeta = [job.company.industry, job.company.orgType].filter(hasText);
  const showFiles = Boolean(jdFile) || extraFiles.length > 0;

  return (
    <AuthenticatedPortalShell>
      <div className="job-detail">
        <Link className="back-link" href="/company-events">
          <ArrowLeft />
          Back to opportunities
        </Link>


        <div className="job-detail-grid">
          <article className="job-main">
            <div className="jd-card jd-top">
              <header className="jd-header">
                <div className="detail-logo" style={{ background: companyColor(job.company.name) }}>
                  {companyInitials(job.company.name)}
                </div>
                <div className="jd-title">
                  <p className="jd-company">
                    {job.company.name}
                    {orgMeta.length ? <span> · {orgMeta.join(" · ")}</span> : null}
                    {hasText(job.company.website) ? (
                      <a href={job.company.website} target="_blank" rel="noopener noreferrer">
                        Website
                        <ExternalLink aria-hidden />
                      </a>
                    ) : null}
                  </p>
                  <h1>{job.title}</h1>
                  <p className="jd-tags">
                    <span>{jobTypeLabel(job.type)}</span>
                    {job.jobCategory ? <span>{job.jobCategory === "NonTech" ? "Non-tech" : job.jobCategory}</span> : null}
                  </p>
                </div>
                <div className="jd-deadline" data-closed={!applicationOpen || undefined}>
                  <span>Apply by</span>
                  <strong>{formatPortalDate(job.registrationDeadline, true)}</strong>
                  <em>{deadlineNote}</em>
                </div>
              </header>
              <KeyFacts facts={facts} />
            </div>

            {showFiles ? (
              <DetailSection title="Documents">
                <ul className="jd-files">
                  {jdFile ? <FileCard jobId={job.id} fileKey="jd" file={jdFile} title="Job description" /> : null}
                  {extraFiles.map((file, index) => (
                    <FileCard key={file.fileUrl} jobId={job.id} fileKey={String(index)} file={file} />
                  ))}
                </ul>
              </DetailSection>
            ) : null}

            {hasText(job.description) || hasText(job.openingOverview) ? (
              <DetailSection title="About the role">
                {hasText(job.description) ? (
                  <div className="rte-content rte-content--preview jd-prose" dangerouslySetInnerHTML={{ __html: sanitizeRichText(job.description) }} />
                ) : null}
                {hasText(job.openingOverview) ? <p className="jd-prose jd-pre">{job.openingOverview}</p> : null}
              </DetailSection>
            ) : null}

            {hasCompensation ? (
              <DetailSection title="Compensation" note={flags.fullTime && compensation ? "Yearly, in INR" : undefined}>
                <CompensationTable compensation={flags.fullTime ? compensation : null} />
                <RowList rows={compensationRows} />
              </DetailSection>
            ) : null}

            <DetailSection title="Eligibility">
              <RowList rows={eligibilityRows} />
            </DetailSection>

            {hasSelection ? (
              <DetailSection title="Selection process">
                <RowList rows={selectionRows} />
                <SelectionRounds rounds={rounds} />
                {hasText(job.selectionNotes) ? <p className="jd-prose jd-pre">{job.selectionNotes}</p> : null}
              </DetailSection>
            ) : null}
          </article>

          <aside className="eligibility-card" id="apply">
            <span className="eyebrow">Your eligibility</span>
            <h2>{profile ? (eligible ? "You are eligible" : "Not currently eligible") : "Complete your profile"}</h2>
            <p>{profile ? "Calculated from your saved student profile." : "Add academic details to calculate eligibility for this role."}</p>
            {checks.length ? (
              <div>
                {checks.map((check) => (
                  <span className={check.pass ? "pass" : "fail"} key={check.key}>
                    {check.pass ? <CheckCircle2 /> : <XCircle />}
                    {check.label}
                  </span>
                ))}
              </div>
            ) : null}
            <ApplyButton jobId={job.id} disabledReason={disabledReason} alreadyApplied={Boolean(existingApplication)} resumes={resumes} />
            {hasText(job.redirectUrl) ? (
              <a className="jd-external" href={job.redirectUrl} target="_blank" rel="noopener noreferrer">
                Company application page
                <ExternalLink aria-hidden />
              </a>
            ) : null}
            <small>Applications are saved to your account and are visible only to you and authorized placement administrators.</small>
          </aside>
        </div>

        <a className="jd-mobile-bar" href="#apply">
          <span>{deadlineNote}</span>
          <strong>{disabledReason ?? (existingApplication ? "View application" : "Review and apply")}</strong>
        </a>
      </div>
    </AuthenticatedPortalShell>
  );
}
