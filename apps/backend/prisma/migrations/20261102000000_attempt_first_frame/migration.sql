-- Week 3: time to first camera frame, and a verdict for check-ins that got no reply.
ALTER TYPE "AttemptVerdict" ADD VALUE 'NETWORK_ERROR';

ALTER TABLE "Attempt" ADD COLUMN "firstFrameMs" DOUBLE PRECISION;

CREATE INDEX "Attempt_deviceId_idx" ON "Attempt"("deviceId");
