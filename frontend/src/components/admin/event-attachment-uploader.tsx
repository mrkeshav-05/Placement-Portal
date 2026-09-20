"use client";

import { FileText, Paperclip, X } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "cn";
import {
  EVENT_ATTACHMENT_EXTENSIONS,
  MAX_EVENT_ATTACHMENTS,
  MAX_EVENT_ATTACHMENT_MB,
  type EventAttachment,
} from "@/lib/job-profile-schema";
import { uploadEventAttachmentAction } from "@/app/admin/events/actions";
import { Label } from "@/components/ui/label";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A company drive's own attachments — a job description or a poster — staged
 * the same way the announcement composer's do: uploaded as soon as they are
 * dropped, and only attached to the event when the form is saved.
 */
export function EventAttachmentUploader({
  attachments,
  onChange,
}: {
  attachments: EventAttachment[];
  onChange: (next: EventAttachment[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length) return;

    const room = MAX_EVENT_ATTACHMENTS - attachments.length;
    if (room <= 0) {
      setError(`An event can carry at most ${MAX_EVENT_ATTACHMENTS} files.`);
      return;
    }

    setError(null);
    setUploading(true);
    // One request per file, so a rejected file names itself and the rest
    // still land.
    for (const file of Array.from(fileList).slice(0, room)) {
      const formData = new FormData();
      formData.set("file", file);
      const outcome = await uploadEventAttachmentAction(formData);
      if (outcome.error) {
        setError(outcome.error);
        continue;
      }
      if (outcome.attachment) {
        const uploaded = outcome.attachment;
        onChange(
          attachments.some((item) => item.fileUrl === uploaded.fileUrl)
            ? attachments
            : [...attachments, uploaded],
        );
      }
    }
    setUploading(false);
  }

  return (
    <div className="grid gap-2">
      <Label>Attachments</Label>

      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          uploadFiles(event.dataTransfer.files);
        }}
        className={cn(
          "bg-muted/40 grid cursor-pointer place-items-center gap-1 rounded-lg border border-dashed px-4 py-8 text-center transition-colors",
          dragging && "border-primary bg-muted/70",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={EVENT_ATTACHMENT_EXTENSIONS.map((extension) => `.${extension}`).join(",")}
          className="hidden"
          onChange={(event) => {
            uploadFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <FileText className="text-muted-foreground mb-1 size-8" />
        <p className="text-sm">
          <span className="font-semibold">Click to upload</span> or drag and drop
        </p>
        <p className="text-muted-foreground text-xs">
          Only {EVENT_ATTACHMENT_EXTENSIONS.map((extension) => `.${extension}`).join(", ")} files,
          max {MAX_EVENT_ATTACHMENT_MB}MB each
        </p>
      </div>

      {uploading ? <p className="text-muted-foreground text-xs">Uploading…</p> : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}

      {attachments.length ? (
        <ul className="grid gap-2">
          {attachments.map((attachment) => (
            <li
              key={attachment.fileUrl}
              className="bg-background flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <Paperclip className="text-muted-foreground size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{attachment.fileName}</span>
              <span className="text-muted-foreground text-xs shrink-0">
                {formatFileSize(attachment.sizeBytes)}
              </span>
              <button
                type="button"
                onClick={() => onChange(attachments.filter((item) => item.fileUrl !== attachment.fileUrl))}
                aria-label={`Remove ${attachment.fileName}`}
                className="text-muted-foreground hover:text-destructive shrink-0 p-1"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
