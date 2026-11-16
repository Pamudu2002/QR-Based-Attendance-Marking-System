-- AlterTable
ALTER TABLE "Lecturer" ADD COLUMN     "createdByAdminId" TEXT,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tempPasswordExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "adminId" TEXT;

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- AddForeignKey
ALTER TABLE "Lecturer" ADD CONSTRAINT "Lecturer_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
