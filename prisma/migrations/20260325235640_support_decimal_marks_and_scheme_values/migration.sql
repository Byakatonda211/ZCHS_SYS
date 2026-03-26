/*
  Warnings:

  - You are about to alter the column `scoreRaw` on the `MarkEntry` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(8,2)`.
  - You are about to alter the column `weightOutOf` on the `ReportSchemeComponent` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(8,2)`.
  - You are about to alter the column `enterOutOf` on the `ReportSchemeComponent` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(8,2)`.
  - You are about to alter the column `minMark` on the `ReportSchemeGradeDescriptor` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(8,2)`.
  - You are about to alter the column `maxMark` on the `ReportSchemeGradeDescriptor` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(8,2)`.

*/
-- AlterTable
ALTER TABLE "MarkEntry" ALTER COLUMN "scoreRaw" SET DATA TYPE DECIMAL(8,2);

-- AlterTable
ALTER TABLE "ReportSchemeComponent" ALTER COLUMN "weightOutOf" SET DATA TYPE DECIMAL(8,2),
ALTER COLUMN "enterOutOf" SET DEFAULT 100.00,
ALTER COLUMN "enterOutOf" SET DATA TYPE DECIMAL(8,2);

-- AlterTable
ALTER TABLE "ReportSchemeGradeDescriptor" ALTER COLUMN "minMark" SET DATA TYPE DECIMAL(8,2),
ALTER COLUMN "maxMark" SET DATA TYPE DECIMAL(8,2);
