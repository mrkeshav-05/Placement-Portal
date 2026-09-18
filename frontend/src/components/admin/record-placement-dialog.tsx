"use client";

import { useState } from "react";
import { saveOfferAction } from "@/app/admin/placement-records/actions";
import type { AdminApplicationRow } from "@/components/admin/applications-manager";
import { PortalDialog } from "@/components/common/portal-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { isCtcType, OFFER_TYPE_LABELS, type OfferType } from "@/lib/offer-schema";

/**
 * A hired candidate belongs in Placement Records with a CTC or stipend on
 * file, not just a status label — this creates the linked `Offer` in one
 * step from the application row instead of sending the admin to re-pick the
 * same student and company in the standalone placement-records form.
 */
export function RecordPlacementDialog({
  application,
  onClose,
  onSaved,
}: {
  application: AdminApplicationRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<OfferType>("FTE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialOfferStatus =
    application.status === "OFFER_ACCEPTED"
      ? "ACCEPTED"
      : application.status === "OFFER_DECLINED"
        ? "DECLINED"
        : "OFFERED";

  async function submit(formData: FormData) {
    setSaving(true);
    setError(null);
    formData.set("userId", application.userId);
    formData.set("companyId", application.companyId);
    formData.set("jobProfileId", application.jobProfileId);
    formData.set("applicationId", application.id);
    formData.set("status", initialOfferStatus);
    formData.set("batch", String(application.batch ?? new Date().getFullYear()));

    const result = await saveOfferAction(formData);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <PortalDialog
      onClose={onClose}
      eyebrow="Placement record"
      title={`Record placement — ${application.studentName}`}
      description={`${application.companyName} · ${application.jobTitle}`}
    >
      <form className="grid gap-3" action={submit}>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="placement-type">Offer type</Label>
            <Select name="type" value={type} onValueChange={(value) => setType(value as OfferType)}>
              <SelectTrigger id="placement-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(OFFER_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isCtcType(type) ? (
            <div className="grid gap-2">
              <Label htmlFor="placement-ctc">Annual CTC (₹)</Label>
              <Input
                id="placement-ctc"
                name="ctc"
                type="number"
                min={0}
                step="any"
                required
                placeholder="1800000"
              />
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="placement-stipend">Monthly stipend (₹)</Label>
              <Input
                id="placement-stipend"
                name="stipend"
                type="number"
                min={0}
                step="any"
                required
                placeholder="75000"
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="placement-location">Location</Label>
            <Input id="placement-location" name="location" maxLength={200} placeholder="Bengaluru" />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="placement-remarks">Remarks</Label>
            <Textarea
              id="placement-remarks"
              name="remarks"
              rows={3}
              maxLength={2000}
              placeholder="Anything the office needs on file about this offer."
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Add record"}
          </Button>
        </DialogFooter>
      </form>
    </PortalDialog>
  );
}
