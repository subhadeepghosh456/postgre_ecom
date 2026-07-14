-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- AlterTable
ALTER TABLE "Otp" ADD COLUMN     "purpose" "OtpPurpose" NOT NULL DEFAULT 'EMAIL_VERIFICATION';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Otp_userId_purpose_key" ON "Otp"("userId", "purpose");
