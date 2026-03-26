-- AlterTable
ALTER TABLE "ReportSchemeComponent" ADD COLUMN     "enterOutOf" INTEGER NOT NULL DEFAULT 100;

-- CreateTable
CREATE TABLE "ReportSchemeGradeDescriptor" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "achievementLevel" TEXT NOT NULL,
    "minMark" INTEGER NOT NULL,
    "maxMark" INTEGER NOT NULL,
    "descriptor" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportSchemeGradeDescriptor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportSchemeGradeDescriptor_schemeId_idx" ON "ReportSchemeGradeDescriptor"("schemeId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportSchemeGradeDescriptor_schemeId_grade_key" ON "ReportSchemeGradeDescriptor"("schemeId", "grade");

-- CreateIndex
CREATE UNIQUE INDEX "ReportSchemeGradeDescriptor_schemeId_order_key" ON "ReportSchemeGradeDescriptor"("schemeId", "order");

-- AddForeignKey
ALTER TABLE "ReportSchemeGradeDescriptor" ADD CONSTRAINT "ReportSchemeGradeDescriptor_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "ReportScheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
