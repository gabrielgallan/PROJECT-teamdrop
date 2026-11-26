/*
  Warnings:

  - Added the required column `expires_at` to the `files` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "files" ADD COLUMN     "expires_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "storage_retention_seconds" INTEGER NOT NULL DEFAULT 86400;

-- CreateIndex
CREATE INDEX "files_expires_at_idx" ON "files"("expires_at");
