"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  JOB_QUESTION_TYPES,
  JOB_QUESTION_TYPE_LABELS,
  type JobQuestion,
} from "@/lib/job-profile-schema";

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `q_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

const needsOptions = (type: JobQuestion["type"]) => type === "MCQ" || type === "CHECKBOX";

/**
 * The event form's own screening questions, on top of the resume every
 * applicant already attaches — a company that wants a cover letter, a
 * portfolio link, or a "why us" answer asks for it here rather than over
 * email. Only the questions themselves are authored yet; collecting a
 * student's answer needs its own column on `Application` and is deliberately
 * separate follow-up work.
 */
export function EventQuestionBuilder({
  questions,
  onChange,
}: {
  questions: JobQuestion[];
  onChange: (next: JobQuestion[]) => void;
}) {
  function addQuestion() {
    onChange([...questions, { id: newId(), type: "TEXT", question: "" }]);
  }

  function removeQuestion(id: string) {
    onChange(questions.filter((question) => question.id !== id));
  }

  function patchQuestion(id: string, patch: Partial<JobQuestion>) {
    onChange(questions.map((question) => (question.id === id ? { ...question, ...patch } : question)));
  }

  function changeType(id: string, type: JobQuestion["type"]) {
    const current = questions.find((question) => question.id === id);
    patchQuestion(id, {
      type,
      options: needsOptions(type) ? (current?.options?.length ? current.options : ["", ""]) : undefined,
    });
  }

  function addOption(id: string) {
    const question = questions.find((item) => item.id === id);
    if (!question) return;
    patchQuestion(id, { options: [...(question.options ?? []), ""] });
  }

  function updateOption(id: string, index: number, value: string) {
    const question = questions.find((item) => item.id === id);
    if (!question) return;
    const options = [...(question.options ?? [])];
    options[index] = value;
    patchQuestion(id, { options });
  }

  function removeOption(id: string, index: number) {
    const question = questions.find((item) => item.id === id);
    if (!question) return;
    patchQuestion(id, { options: (question.options ?? []).filter((_, i) => i !== index) });
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <Label>Additional Questions</Label>
        <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
          <Plus />
          Add Question
        </Button>
      </div>

      {questions.map((question) => {
        const options = question.options ?? [];

        return (
          <div key={question.id} className="bg-muted/40 relative grid gap-3 rounded-lg border p-4">
            <button
              type="button"
              onClick={() => removeQuestion(question.id)}
              aria-label="Remove question"
              className="text-destructive hover:bg-destructive/10 absolute top-3 right-3 rounded-md p-1"
            >
              <X className="size-4" />
            </button>

            <div className="grid gap-3 pr-8 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Question Type</Label>
                <Select
                  value={question.type}
                  onValueChange={(next) => changeType(question.id, next as JobQuestion["type"])}
                >
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_QUESTION_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {JOB_QUESTION_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Question</Label>
                <Input
                  value={question.question}
                  maxLength={300}
                  placeholder="Enter your question"
                  className="bg-background"
                  onChange={(event) => patchQuestion(question.id, { question: event.target.value })}
                />
              </div>
            </div>

            {needsOptions(question.type) ? (
              <div className="grid gap-2">
                <Label>Options</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={option}
                        maxLength={200}
                        placeholder={`Option ${index + 1}`}
                        className="bg-background"
                        onChange={(event) => updateOption(question.id, index, event.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeOption(question.id, index)}
                        aria-label={`Remove option ${index + 1}`}
                        className="text-muted-foreground hover:text-destructive shrink-0 p-1"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit bg-background"
                  onClick={() => addOption(question.id)}
                >
                  <Plus />
                  Add Option
                </Button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
