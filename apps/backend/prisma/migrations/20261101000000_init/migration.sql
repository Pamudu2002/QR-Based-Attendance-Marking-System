-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AddedVia" AS ENUM ('MANUAL', 'CSV');

-- CreateEnum
CREATE TYPE "KeyLevel" AS ENUM ('STRONGBOX', 'TEE', 'SOFTWARE');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "RegistrationVerdict" AS ENUM ('REGISTERED', 'ALREADY_REGISTERED', 'BAD_TOKEN', 'EXPIRED', 'BAD_SIGNATURE', 'REGISTRATION_CLOSED', 'NOT_ON_ROSTER', 'NAME_MISMATCH', 'DEVICE_BOUND_TO_OTHER_STUDENT', 'STUDENT_HAS_OTHER_DEVICE');

-- CreateEnum
CREATE TYPE "WindowMode" AS ENUM ('NORMAL', 'EXP_GENUINE', 'EXP_RELAY');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('QR', 'MANUAL');

-- CreateEnum
CREATE TYPE "AttemptVerdict" AS ENUM ('OK', 'EXPIRED', 'BAD_TOKEN', 'BAD_SIGNATURE', 'WRONG_NETWORK', 'UNKNOWN_DEVICE', 'DEVICE_REVOKED', 'NOT_REGISTERED', 'OUTSIDE_TIME', 'DUPLICATE', 'NO_DECODE', 'CANCELLED');

-- CreateTable
CREATE TABLE "Lecturer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lecturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "lecturerId" TEXT,
    "deviceId" TEXT,
    "persistent" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "lecturerId" TEXT NOT NULL,
    "intake" TEXT NOT NULL,
    "semester" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registrationOpen" BOOLEAN NOT NULL DEFAULT false,
    "regSecret" TEXT NOT NULL,
    "regIntervalSec" INTEGER NOT NULL DEFAULT 30,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "indexNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterEntry" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rosterName" TEXT NOT NULL,
    "addedVia" "AddedVia" NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registeredAt" TIMESTAMP(3),
    "registeredDeviceId" TEXT,

    CONSTRAINT "RosterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "studentId" TEXT,
    "publicKey" TEXT NOT NULL,
    "keyLevel" "KeyLevel" NOT NULL,
    "model" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "androidSdk" INTEGER NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "boundAt" TIMESTAMP(3),

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationEvent" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "deviceId" TEXT,
    "indexNumberTyped" TEXT NOT NULL,
    "verdict" "RegistrationVerdict" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "venue" TEXT NOT NULL,
    "opensBeforeMin" INTEGER NOT NULL DEFAULT 15,
    "lateAfterMin" INTEGER NOT NULL DEFAULT 15,
    "expectedSsid" TEXT,
    "isExperiment" BOOLEAN NOT NULL DEFAULT false,
    "seriesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckinWindow" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "intervalSec" INTEGER NOT NULL,
    "graceSec" INTEGER NOT NULL DEFAULT 2,
    "secret" TEXT NOT NULL,
    "enforceWifi" BOOLEAN NOT NULL DEFAULT true,
    "mode" "WindowMode" NOT NULL DEFAULT 'NORMAL',
    "label" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "CheckinWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "source" "AttendanceSource" NOT NULL,
    "attemptId" TEXT,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markedBy" TEXT,
    "note" TEXT,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "windowId" TEXT,
    "deviceId" TEXT,
    "studentId" TEXT,
    "phoneLabel" TEXT,
    "distanceRow" TEXT,
    "distanceM" DOUBLE PRECISION,
    "role" TEXT,
    "runNo" INTEGER,
    "attemptNo" INTEGER,
    "decodeMs" DOUBLE PRECISION,
    "framesProcessed" INTEGER,
    "framesDropped" INTEGER,
    "biometricMs" DOUBLE PRECISION,
    "postRttMs" DOUBLE PRECISION,
    "totalMs" DOUBLE PRECISION,
    "authMethod" TEXT,
    "androidSdk" INTEGER,
    "seq" INTEGER,
    "issuedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "tokenAgeMs" INTEGER,
    "ssid" TEXT,
    "wifiOk" BOOLEAN,
    "verdict" "AttemptVerdict" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lecturer_email_key" ON "Lecturer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "Module_lecturerId_intake_semester_code_key" ON "Module"("lecturerId", "intake", "semester", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Student_indexNumber_key" ON "Student"("indexNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RosterEntry_moduleId_studentId_key" ON "RosterEntry"("moduleId", "studentId");

-- CreateIndex
CREATE INDEX "Device_studentId_idx" ON "Device"("studentId");

-- CreateIndex
CREATE INDEX "RegistrationEvent_moduleId_at_idx" ON "RegistrationEvent"("moduleId", "at");

-- CreateIndex
CREATE INDEX "Session_moduleId_startsAt_idx" ON "Session"("moduleId", "startsAt");

-- CreateIndex
CREATE INDEX "CheckinWindow_sessionId_idx" ON "CheckinWindow"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_sessionId_studentId_key" ON "Attendance"("sessionId", "studentId");

-- CreateIndex
CREATE INDEX "Attempt_windowId_idx" ON "Attempt"("windowId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "Lecturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "Lecturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_registeredDeviceId_fkey" FOREIGN KEY ("registeredDeviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationEvent" ADD CONSTRAINT "RegistrationEvent_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationEvent" ADD CONSTRAINT "RegistrationEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckinWindow" ADD CONSTRAINT "CheckinWindow_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "CheckinWindow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Hand-written constraints Prisma can't express in the schema.

-- At most one ACTIVE device per student (PLAN §6.1).
CREATE UNIQUE INDEX "Device_one_active_per_student" ON "Device"("studentId") WHERE "status" = 'ACTIVE' AND "studentId" IS NOT NULL;

-- A session must end after it starts.
ALTER TABLE "Session" ADD CONSTRAINT "Session_ends_after_starts" CHECK ("endsAt" > "startsAt");
