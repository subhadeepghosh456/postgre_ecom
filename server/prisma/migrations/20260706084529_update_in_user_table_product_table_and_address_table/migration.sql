/*
  Warnings:

  - Added the required column `adminId` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `image` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('ADMIN', 'USER');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "adminId" INTEGER NOT NULL,
ADD COLUMN     "image" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserType" NOT NULL DEFAULT 'USER';

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
