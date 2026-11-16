-- JAF 2026-27 fields. All nullable: null means "not provided".
ALTER TABLE "Company"
  ADD COLUMN "orgType" TEXT,
  ADD COLUMN "industry" TEXT;

ALTER TABLE "JobProfile"
  ADD COLUMN "jdFile" JSONB,
  ADD COLUMN "workMode" TEXT,
  ADD COLUMN "joiningDate" TEXT,
  ADD COLUMN "internshipKind" TEXT,
  ADD COLUMN "stipendPerMonth" DOUBLE PRECISION,
  ADD COLUMN "ppoOffered" BOOLEAN,
  ADD COLUMN "ppoCtcLpa" DOUBLE PRECISION,
  ADD COLUMN "compensation" JSONB,
  ADD COLUMN "hasBond" BOOLEAN,
  ADD COLUMN "additionalBenefits" TEXT,
  ADD COLUMN "ppt" BOOLEAN,
  ADD COLUMN "resumeShortlisting" BOOLEAN,
  ADD COLUMN "shortlistCriteria" TEXT,
  ADD COLUMN "selectionRounds" JSONB,
  ADD COLUMN "selectionNotes" TEXT;
