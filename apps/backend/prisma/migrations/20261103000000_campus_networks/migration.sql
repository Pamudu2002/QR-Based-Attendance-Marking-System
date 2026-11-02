-- CreateEnum
CREATE TYPE "NetworkKind" AS ENUM ('IP_RANGE', 'ROUTER');

-- AlterTable
ALTER TABLE "Attempt" ADD COLUMN     "bssid" TEXT,
ADD COLUMN     "ipOk" BOOLEAN,
ADD COLUMN     "routerOk" BOOLEAN;

-- CreateTable
CREATE TABLE "CampusNetwork" (
    "id" TEXT NOT NULL,
    "lecturerId" TEXT NOT NULL,
    "kind" "NetworkKind" NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampusNetwork_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CampusNetwork_lecturerId_kind_value_key" ON "CampusNetwork"("lecturerId", "kind", "value");

-- AddForeignKey
ALTER TABLE "CampusNetwork" ADD CONSTRAINT "CampusNetwork_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "Lecturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

