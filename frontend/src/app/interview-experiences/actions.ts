"use server";

import { revalidatePath } from "next/cache";
import { backendFetch } from "@/lib/api-client";
import { interviewExperienceFormSchema } from "@/lib/interview-experience-schema";
import { requireStudent } from "@/lib/student-session";

export type InterviewExperienceSubmitResult = { error?: string; success?: boolean; message?: string };

const QUESTION_FIELD_NAMES = [
  "dsaQuestions",
  "oopsQuestions",
  "dbmsQuestions",
  "osQuestions",
  "cnQuestions",
  "sqlQuestions",
  "systemDesignQuestions",
  "csFundamentalsQuestions",
  "resumeQuestions",
  "projectsDiscussed",
  "codingQuestions",
  "aptitudeQuestions",
  "hrQuestions",
  "behavioralQuestions",
  "resources",
  "unansweredQuestions",
  "tips",
] as const;

export async function submitInterviewExperienceAction(
  formData: FormData
): Promise<InterviewExperienceSubmitResult> {
  const raw: Record<string, unknown> = {
    companyName: formData.get("companyName"),
    role: formData.get("role"),
    batch: formData.get("batch"),
    interviewType: formData.get("interviewType"),
    opportunityType: formData.get("opportunityType"),
    difficulty: formData.get("difficulty") || undefined,
    outcome: formData.get("outcome") || undefined,
  };
  for (const field of QUESTION_FIELD_NAMES) {
    raw[field] = formData.get(field) || undefined;
  }

  const parsed = interviewExperienceFormSchema.safeParse(raw);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || "Please check your inputs.";
    return { error: errorMsg };
  }

  const student = await requireStudent();
  if (!student.user) {
    return { error: "Sign in to submit an interview experience." };
  }

  try {
    await backendFetch("/api/v1/interview-experiences", {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    revalidatePath("/interview-experiences");
    revalidatePath("/admin/interview-experiences");
    return {
      success: true,
      message: "Thanks for sharing! Your submission is pending admin review before it goes live.",
    };
  } catch (err) {
    console.error("Failed to submit interview experience", err);
    return {
      error: err instanceof Error ? err.message : "Failed to submit interview experience. Please try again.",
    };
  }
}
