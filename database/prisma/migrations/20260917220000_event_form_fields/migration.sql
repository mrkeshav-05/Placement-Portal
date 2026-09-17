-- Season the drive belongs to. Existing rows conflated it with the graduating
-- batch, so the batch is the only faithful backfill before the column is
-- required.
ALTER TABLE "JobProfile" ADD COLUMN "placementYear" INTEGER;
UPDATE "JobProfile" SET "placementYear" = "batch" WHERE "placementYear" IS NULL;
ALTER TABLE "JobProfile" ALTER COLUMN "placementYear" SET NOT NULL;

-- Offer terms quoted from the company, kept as written.
ALTER TABLE "JobProfile" ADD COLUMN "cap" TEXT;
ALTER TABLE "JobProfile" ADD COLUMN "companyBond" TEXT;
ALTER TABLE "JobProfile" ADD COLUMN "duration" TEXT;
ALTER TABLE "JobProfile" ADD COLUMN "redirectUrl" TEXT;
