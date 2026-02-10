-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('O_MID', 'O_EOT', 'A_MID', 'A_EOT');

-- CreateTable
CREATE TABLE "ReportScheme" (
    "id" TEXT NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSchemeComponent" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "assessmentDefinitionId" TEXT NOT NULL,
    "weightOutOf" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ReportSchemeComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportScheme_reportType_key" ON "ReportScheme"("reportType");

-- CreateIndex
CREATE INDEX "ReportSchemeComponent_schemeId_idx" ON "ReportSchemeComponent"("schemeId");

-- CreateIndex
CREATE INDEX "ReportSchemeComponent_assessmentDefinitionId_idx" ON "ReportSchemeComponent"("assessmentDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportSchemeComponent_schemeId_assessmentDefinitionId_key" ON "ReportSchemeComponent"("schemeId", "assessmentDefinitionId");

-- AddForeignKey
ALTER TABLE "ReportSchemeComponent" ADD CONSTRAINT "ReportSchemeComponent_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "ReportScheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSchemeComponent" ADD CONSTRAINT "ReportSchemeComponent_assessmentDefinitionId_fkey" FOREIGN KEY ("assessmentDefinitionId") REFERENCES "AssessmentDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
