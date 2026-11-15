"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setPpoOutcomeAction } from "@/app/admin/placement-records/actions";
import { PortalDialog } from "@/components/common/portal-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PPO_STATUSES } from "@/lib/offer-schema";
import { PPO_STATUS_LABELS, type PpoStatus } from "@/lib/placement-policy";

const OUTCOME_HELP: Record<PpoStatus, string> = {
  PENDING: "The student stays out of on-campus drives until this is recorded.",
  RECEIVED: "Recorded as a PPO offer: it counts as a placement and is judged by the Dream / First Round rules.",
  NOT_RECEIVED: "The student is eligible for on-campus drives again.",
};

/** Records whether an internship led to a PPO. Used by the placement records and the student detail page. */
export function PpoOutcomeDialog({
  offerId,
  studentName,
  company,
  current,
  onClose,
}: {
  offerId: string;
  studentName: string;
  company: string;
  current: PpoStatus;
  onClose: () => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<PpoStatus>(current === "PENDING" ? "NOT_RECEIVED" : current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setSaving(true);
    setError(null);
    formData.set("offerId", offerId);
    formData.set("status", status);
    const result = await setPpoOutcomeAction(formData);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <PortalDialog
      onClose={onClose}
      eyebrow="Internship"
      title={`PPO outcome — ${studentName}`}
      description={company}
      className="sm:max-w-[520px]"
    >
      <form className="grid gap-3" action={submit}>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="ppo-status">Did the company give a PPO?</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as PpoStatus)}>
            <SelectTrigger id="ppo-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PPO_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {PPO_STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <small className="text-muted-foreground">{OUTCOME_HELP[status]}</small>
        </div>

        {status === "RECEIVED" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="ppo-ctc">
                Annual CTC (₹) <span className="text-destructive">*</span>
              </Label>
              <Input id="ppo-ctc" name="ctc" type="number" min={0} step="any" required placeholder="1400000" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ppo-title">Role (optional)</Label>
              <Input id="ppo-title" name="jobTitle" maxLength={200} placeholder="Software Engineer" />
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save outcome"}
          </Button>
        </DialogFooter>
      </form>
    </PortalDialog>
  );
}
