-- One home per figure: the monthly stipend and the PPO flag are `ctcStipend`
-- and the drive type, the internship length is `duration`, benefits are
-- `ctcStipendInfo`, and `cap` was never read by anything.
ALTER TABLE "JobProfile"
  DROP COLUMN "cap",
  DROP COLUMN "stipendPerMonth",
  DROP COLUMN "ppoOffered",
  DROP COLUMN "internshipKind",
  DROP COLUMN "additionalBenefits";
