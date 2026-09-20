/*
  Warnings:

  - The `attachments` column on the `JobProfile` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "JobProfile" DROP COLUMN "attachments",
ADD COLUMN     "attachments" JSONB;
