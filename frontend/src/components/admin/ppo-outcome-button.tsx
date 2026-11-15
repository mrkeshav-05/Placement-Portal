"use client";

import { useState } from "react";
import { PpoOutcomeDialog } from "@/components/admin/ppo-outcome-dialog";
import { Button } from "@/components/ui/button";
import { PPO_STATUS_LABELS, type PpoStatus } from "@/lib/placement-policy";

/**
 * An internship's PPO state as a chip, with, for someone allowed to update
 * placement records, the button that records the outcome. Lives in its own
 * client component because the student detail page is a server component.
 */
export function PpoOutcomeButton({
  offerId,
  studentName,
  company,
  current,
  canRecord,
}: {
  offerId: string;
  studentName: string;
  company: string;
  current: PpoStatus;
  canRecord: boolean;
}) {
  const [open, setOpen] = useState(false);
  const badge = current === "RECEIVED" ? "accepted" : current === "NOT_RECEIVED" ? "declined" : "offered";

  return (
    <>
      <b className={`cell-status ${badge}`}>{PPO_STATUS_LABELS[current]}</b>
      {canRecord ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          {current === "PENDING" ? "Record PPO" : "Change"}
        </Button>
      ) : null}
      {open ? (
        <PpoOutcomeDialog
          offerId={offerId}
          studentName={studentName}
          company={company}
          current={current}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
