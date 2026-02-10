-- CreateEnum
CREATE TYPE "ResidenceSection" AS ENUM ('DAY', 'BOARDING');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "residenceSection" "ResidenceSection";
