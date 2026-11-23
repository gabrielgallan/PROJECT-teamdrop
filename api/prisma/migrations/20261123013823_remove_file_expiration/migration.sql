/*
  Warnings:

  - You are about to drop the column `expires_at` on the `files` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "files_expires_at_idx";

-- AlterTable
ALTER TABLE "files" DROP COLUMN "expires_at";
