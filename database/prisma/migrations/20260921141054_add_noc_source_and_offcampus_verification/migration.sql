-- CreateEnum
CREATE TYPE "NocSource" AS ENUM ('ON_CAMPUS', 'OFF_CAMPUS');

-- AlterTable
ALTER TABLE "NocRequest" ADD COLUMN     "nocRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "offCampusProofUrl" TEXT,
ADD COLUMN     "source" "NocSource" NOT NULL DEFAULT 'ON_CAMPUS',
ADD COLUMN     "verifiedByPlacementTeam" BOOLEAN NOT NULL DEFAULT false;
