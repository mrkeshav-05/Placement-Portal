"use client";

import { Check, FileText } from "lucide-react";
import { useActionState, useState } from "react";
import { applyToJob, type ApplyState } from "@/app/company-events/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ResumeOption = {
  id: string;
  label: string;
  fileName: string;
};

const initialState: ApplyState = {};

export function ApplyButton({
  jobId,
  disabledReason,
  alreadyApplied,
  resumes = [],
}: {
  jobId: string;
  disabledReason?: string;
  alreadyApplied: boolean;
  resumes?: ResumeOption[];
}) {
  const [state, action, pending] = useActionState(applyToJob, initialState);
  const [selectedResume, setSelectedResume] = useState<string>(
    resumes.length ? resumes[0].id : "",
  );
  const applied = alreadyApplied || Boolean(state.success);

  return (
    <form action={action} className="apply-form">
      <input type="hidden" name="jobId" value={jobId} />
      {/* The trigger is a button, so the selected resume travels with the
          action through this field whether or not the picker is shown. */}
      <input type="hidden" name="resumeId" value={selectedResume} />

      {!applied && !disabledReason && resumes.length > 0 ? (
        <div className="mb-3 grid gap-1.5">
          <Label htmlFor="apply-resume" className="text-muted-foreground text-[11px] font-bold">
            <FileText className="size-[13px]" />
            Submit with Resume:
          </Label>
          <Select value={selectedResume} onValueChange={setSelectedResume}>
            <SelectTrigger id="apply-resume" className="w-full bg-[var(--card-bg)] text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {resumes.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label} ({r.fileName})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <Button
        type="submit"
        className={`h-auto w-full rounded-xl py-3.5 text-[13px] font-extrabold shadow-[0_4px_14px_rgba(var(--brand-rgb),0.25)] ${
          applied
            ? "bg-[var(--green)] shadow-[0_4px_14px_rgba(var(--success-rgb),0.25)] hover:bg-[var(--green)]"
            : ""
        }`}
        disabled={Boolean(disabledReason) || applied || pending}
      >
        {applied ? (
          <>
            <Check />
            Application submitted
          </>
        ) : pending ? (
          "Submitting…"
        ) : (
          disabledReason ?? "Apply"
        )}
      </Button>

      {state.error ? (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
