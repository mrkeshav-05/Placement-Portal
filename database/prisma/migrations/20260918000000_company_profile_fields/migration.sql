-- Company profile fields the Add Company screen collects.
--
-- All three are nullable: companies created before this screen existed have no
-- honest value for any of them, and guessing one would put words in the
-- placement cell's mouth.

-- Round the company recruits in, e.g. Dream or First Round.
ALTER TABLE "Company" ADD COLUMN "category" TEXT;

-- Recruiting season, the same idea as "JobProfile"."placementYear".
ALTER TABLE "Company" ADD COLUMN "placementSession" INTEGER;

-- Turnover as the company states it, kept as written.
ALTER TABLE "Company" ADD COLUMN "turnover" TEXT;
