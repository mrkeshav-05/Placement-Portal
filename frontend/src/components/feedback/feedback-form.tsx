"use client";

import Link from "next/link";
import { CheckCircle2, MessageSquareText, Send } from "lucide-react";
import { useState } from "react";
import { submitFeedback, type FeedbackSubmitResult } from "@/app/feedback/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const MESSAGE_TYPES = [
  { value: "QUERY", label: "Query" },
  { value: "FEEDBACK", label: "Feedback" },
  { value: "COMPLAINT", label: "Complaint" },
];

export function FeedbackForm({
  student,
}: {
  student: { name: string; rollNumber: string; email: string; canSubmit: boolean };
}) {
  const [result, setResult] = useState<FeedbackSubmitResult>({});
  const [submitting, setSubmitting] = useState(false);
  // The trigger is a button, so the chosen type reaches the server action
  // through the hidden field below rather than through the control itself.
  const [feedbackType, setFeedbackType] = useState("QUERY");

  async function submit(formData: FormData) {
    setSubmitting(true);
    setResult(await submitFeedback(formData));
    setSubmitting(false);
  }

  if (result.reference) {
    return (
      <div className="module-page">
        <section className="page-heading">
          <div>
            <span className="eyebrow">Support</span>
            <h1>Message submitted</h1>
          </div>
        </section>

        <Card className="mt-[18px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-[18px] text-[var(--green)]" />
              Thanks for reaching out
            </CardTitle>
            <CardDescription>
              Your reference number is{" "}
              <strong className="font-bold text-[var(--ink)]">{result.reference}</strong>. The
              placement team will respond here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/feedback">View my feedbacks</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="module-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Support</span>
          <h1>Feedback or query</h1>
          <p>Send a question, suggestion, or complaint to the placement team.</p>
        </div>
      </section>

      <form action={submit}>
        <input type="hidden" name="feedbackType" value={feedbackType} />

        <Card className="mt-[18px]">
          <CardHeader className="grid-cols-[auto_1fr] items-center gap-x-3">
            <span className="row-span-2 grid size-10 place-items-center rounded-xl bg-[var(--badge-blue-bg)] text-[var(--blue)]">
              <MessageSquareText className="size-5" />
            </span>
            <CardTitle className="text-lg">New message</CardTitle>
            <CardDescription>Your saved student details are attached automatically.</CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4">
            {result.error ? (
              <Alert variant="destructive">
                <AlertDescription>{result.error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="feedback-student-name">Student name</Label>
                <Input id="feedback-student-name" disabled value={student.name} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="feedback-roll-number">Roll number</Label>
                <Input id="feedback-roll-number" disabled value={student.rollNumber} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="feedback-email">Institute email</Label>
                <Input id="feedback-email" disabled value={student.email} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="feedback-type">
                  Message type <span className="text-destructive">*</span>
                </Label>
                <Select required value={feedbackType} onValueChange={setFeedbackType}>
                  <SelectTrigger id="feedback-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESSAGE_TYPES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="feedback-subject">
                  Subject <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="feedback-subject"
                  name="subject"
                  required
                  minLength={5}
                  maxLength={150}
                  placeholder="Briefly describe your request"
                />
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="feedback-message">
                  Message <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="feedback-message"
                  name="message"
                  required
                  minLength={20}
                  maxLength={4000}
                  rows={7}
                  placeholder="Include enough detail for the team to help you..."
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex-wrap justify-between gap-3 border-t">
            <span className="text-muted-foreground text-xs">
              Typical response time: 1–2 working days
            </span>
            <Button type="submit" disabled={!student.canSubmit || submitting}>
              <Send />
              {student.canSubmit
                ? submitting
                  ? "Submitting…"
                  : "Submit message"
                : "Sign in to send a message"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
