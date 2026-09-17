-- The role an offer is for, as the placement office records it.
--
-- Nullable, because every row written before this column derived its role from
-- the linked drive's title, and an offer recorded off-portal had none at all.
-- Backfilling from `JobProfile` would freeze a title that the drive can still
-- rename, so reads fall back to the drive instead and this column stays null
-- until someone states a role explicitly.
ALTER TABLE "Offer" ADD COLUMN "jobTitle" TEXT;
