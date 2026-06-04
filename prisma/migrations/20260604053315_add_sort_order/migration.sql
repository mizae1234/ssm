-- AlterTable
ALTER TABLE "ClaimLabor" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ClaimPart" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;
