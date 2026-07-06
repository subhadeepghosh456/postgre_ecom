-- CreateEnum
CREATE TYPE "Type" AS ENUM ('HOME', 'WORK');

-- CreateTable
CREATE TABLE "Address" (
    "id" SERIAL NOT NULL,
    "street" TEXT,
    "city" VARCHAR(255) NOT NULL,
    "landmark" TEXT,
    "country" TEXT NOT NULL DEFAULT 'india',
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" INTEGER NOT NULL,
    "type" "Type" NOT NULL DEFAULT 'HOME',
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
