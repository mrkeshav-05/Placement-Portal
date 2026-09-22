"use client";

import { GraduationCap, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { updateStudentAcademicAction } from "@/app/admin/students/actions";
import { PortalDialog } from "@/components/common/portal-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The only student-record editor for cgpa/backlogs. Both drive job
 * eligibility and are shown to recruiters as fact, so the student's own
 * profile form cannot touch them (see `ACADEMIC_LOCKED_FIELDS` in
 * `profile-view.tsx`) — this dialog, gated by `students.update`, is the sole
 * write path left.
 */
export function StudentAcademicCorrectionDialog({
  studentId,
  currentCgpa,
  currentBacklogs,
}: {
  studentId: string;
  currentCgpa: number | null;
  currentBacklogs: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cgpa, setCgpa] = useState(currentCgpa === null ? "" : String(currentCgpa));
  const [backlogs, setBacklogs] = useState(String(currentBacklogs));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateStudentAcademicAction(studentId, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setError(null);
          setCgpa(currentCgpa === null ? "" : String(currentCgpa));
          setBacklogs(String(currentBacklogs));
          setOpen(true);
        }}
      >
        <GraduationCap />
        Correct CGPA / backlogs
      </Button>

      {open ? (
        <PortalDialog
          onClose={() => setOpen(false)}
          eyebrow="Academic record"
          title="Correct CGPA / Backlogs"
          description="These values drive job eligibility and are shown to recruiters as fact — only the placement office can change them."
          className="sm:max-w-md"
        >
          <form className="grid gap-3.5" onSubmit={handleSubmit}>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="academic-cgpa">CGPA (0-10)</Label>
              <Input
                id="academic-cgpa"
                name="cgpa"
                type="number"
                step="0.01"
                min={0}
                max={10}
                placeholder="Not provided"
                value={cgpa}
                onChange={(event) => setCgpa(event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="academic-backlogs">Active backlogs (0-20)</Label>
              <Input
                id="academic-backlogs"
                name="backlogs"
                type="number"
                step="1"
                min={0}
                max={20}
                value={backlogs}
                onChange={(event) => setBacklogs(event.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                <Save />
                {isPending ? "Saving..." : "Save correction"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      ) : null}
    </>
  );
}
