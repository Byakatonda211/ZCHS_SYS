-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "isCompulsory" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Subject_level_isCompulsory_idx" ON "Subject"("level", "isCompulsory");
