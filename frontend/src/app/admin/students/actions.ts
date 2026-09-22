"use server";

import { revalidatePath } from "next/cache";
import { backendFetch } from "@/lib/api-client";
import { requirePermission } from "@/lib/admin-session";
import { PERM_STUDENTS_UPDATE } from "@/lib/permissions";
import { studentAcademicCorrectionSchema } from "@/lib/profile-schema";

export type StudentAcademicActionResult = {
  success?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

/**
 * The only write path for a student's cgpa/backlogs: both drive job
 * eligibility and are shown to recruiters as fact, so the student-facing
 * PATCH /profile route deliberately cannot set them (see the comment on
 * studentProfileSchema). Guarded by students.update, never by the student's
 * own session.
 */
export async function updateStudentAcademicAction(
  studentId: string,
  formData: FormData,
): Promise<StudentAcademicActionResult> {
  await requirePermission(PERM_STUDENTS_UPDATE);

  if (!studentId) {
    return { error: "Invalid student ID." };
  }

  const parsed = studentAcademicCorrectionSchema.safeParse({
    cgpa: formData.get("cgpa"),
    backlogs: formData.get("backlogs"),
  });
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await backendFetch(`/api/v1/students/admin/${studentId}/academic`, {
      method: "PATCH",
      body: JSON.stringify(parsed.data),
    });
  } catch (err) {
    console.error("Failed to correct student academic record", err);
    return { error: err instanceof Error ? err.message : "Failed to save the correction." };
  }

  revalidatePath(`/admin/students/${studentId}`);
  revalidatePath("/admin/students");
  return { success: "Academic record updated." };
}
