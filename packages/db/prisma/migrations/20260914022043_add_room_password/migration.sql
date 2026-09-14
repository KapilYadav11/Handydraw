/*
  Warnings:

  - Added the required column `passwordHash` to the `Room` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "passwordHash" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Room_slug_idx" ON "Room"("slug");
