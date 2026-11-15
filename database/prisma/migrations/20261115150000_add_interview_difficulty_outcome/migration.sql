-- Optional context a student can attach to an interview experience.
-- difficulty: EASY / MEDIUM / HARD. outcome: SELECTED / NOT_SELECTED / NOT_DISCLOSED.
-- Both nullable: rows from before these columns existed keep NULL.
ALTER TABLE "InterviewExperience" ADD COLUMN "difficulty" TEXT;
ALTER TABLE "InterviewExperience" ADD COLUMN "outcome" TEXT;
