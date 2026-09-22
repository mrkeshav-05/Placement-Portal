-- CreateIndex
CREATE INDEX "Application_jobProfileId_idx" ON "Application"("jobProfileId");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE INDEX "JobProfile_status_idx" ON "JobProfile"("status");

-- CreateIndex
CREATE INDEX "JobProfile_registrationDeadline_idx" ON "JobProfile"("registrationDeadline");
