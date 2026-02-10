/*
  Warnings:

  - Added the required column `updatedAt` to the `Enrollment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Subject` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `level` on the `Subject` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_classId_fkey";

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "level",
ADD COLUMN     "level" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "EnrollmentSubject" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentSubject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnrollmentSubject_subjectId_idx" ON "EnrollmentSubject"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentSubject_enrollmentId_subjectId_key" ON "EnrollmentSubject"("enrollmentId", "subjectId");

-- CreateIndex
CREATE INDEX "Subject_level_idx" ON "Subject"("level");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_level_name_key" ON "Subject"("level", "name");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentSubject" ADD CONSTRAINT "EnrollmentSubject_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentSubject" ADD CONSTRAINT "EnrollmentSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
