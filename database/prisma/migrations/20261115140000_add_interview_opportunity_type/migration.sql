-- Which kind of opportunity the interview was for: INTERN, INTERN_FTE or FTE.
-- Nullable: experiences submitted before this column keep a NULL.
ALTER TABLE "InterviewExperience" ADD COLUMN "opportunityType" TEXT;
