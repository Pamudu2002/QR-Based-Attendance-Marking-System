-- AlterEnum
ALTER TYPE "AttemptVerdict" ADD VALUE 'NO_BEACON';

-- DropForeignKey
ALTER TABLE "CampusNetwork" DROP CONSTRAINT "CampusNetwork_lecturerId_fkey";

-- AlterTable
ALTER TABLE "Attempt" DROP COLUMN "bssid",
DROP COLUMN "ipOk",
DROP COLUMN "routerOk",
DROP COLUMN "ssid",
DROP COLUMN "wifiOk",
ADD COLUMN     "beaconAgeMs" INTEGER,
ADD COLUMN     "beaconOk" BOOLEAN,
ADD COLUMN     "beaconRssi" INTEGER;

-- AlterTable
ALTER TABLE "CheckinWindow" DROP COLUMN "enforceWifi",
ADD COLUMN     "requireBeacon" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Session" DROP COLUMN "expectedSsid";

-- DropTable
DROP TABLE "CampusNetwork";

-- DropEnum
DROP TYPE "NetworkKind";

-- CreateTable
CREATE TABLE "BeaconPhone" (
    "id" TEXT NOT NULL,
    "lecturerId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "keyLevel" "KeyLevel" NOT NULL,
    "model" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "androidSdk" INTEGER NOT NULL,
    "pairingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "lastState" TEXT,

    CONSTRAINT "BeaconPhone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BeaconPhone_pairingId_key" ON "BeaconPhone"("pairingId");

-- CreateIndex
CREATE INDEX "BeaconPhone_lecturerId_idx" ON "BeaconPhone"("lecturerId");

-- AddForeignKey
ALTER TABLE "BeaconPhone" ADD CONSTRAINT "BeaconPhone_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "Lecturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

