-- Placement policy: internships carry an end date (they block on-campus
-- applications until it passes), an approved NOC records an internship Offer
-- linked back to it, and an NOC carries the internship's role and stipend.
ALTER TABLE "Offer" ADD COLUMN "endDate" TIMESTAMP(3);
ALTER TABLE "Offer" ADD COLUMN "nocRequestId" TEXT;
CREATE UNIQUE INDEX "Offer_nocRequestId_key" ON "Offer"("nocRequestId");
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_nocRequestId_fkey" FOREIGN KEY ("nocRequestId") REFERENCES "NocRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NocRequest" ADD COLUMN "jobTitle" TEXT;
ALTER TABLE "NocRequest" ADD COLUMN "stipend" DOUBLE PRECISION;
