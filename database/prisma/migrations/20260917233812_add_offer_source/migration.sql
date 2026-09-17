-- CreateEnum
CREATE TYPE "OfferSource" AS ENUM ('ON_CAMPUS', 'OFF_CAMPUS', 'HACKATHON');

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "source" "OfferSource" NOT NULL DEFAULT 'ON_CAMPUS';
