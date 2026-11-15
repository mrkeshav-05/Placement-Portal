-- An internship blocks on-campus applications until its PPO outcome is
-- recorded (replacing the end-date rule in 20261115160000_placement_policy).
-- Every existing row defaults to PENDING, so every recorded internship blocks
-- its holder until the placement cell records received / not received.
CREATE TYPE "PpoStatus" AS ENUM ('PENDING', 'RECEIVED', 'NOT_RECEIVED');

ALTER TABLE "Offer" ADD COLUMN "ppoStatus" "PpoStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Offer" ADD COLUMN "internshipOfferId" TEXT;
CREATE UNIQUE INDEX "Offer_internshipOfferId_key" ON "Offer"("internshipOfferId");
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_internshipOfferId_fkey" FOREIGN KEY ("internshipOfferId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
