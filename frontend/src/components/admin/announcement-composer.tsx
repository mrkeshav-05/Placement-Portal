"use client";

import {
  Building2,
  CalendarRange,
  Check,
  ChevronDown,
  FileText,
  FileUp,
  Megaphone,
  Paperclip,
  Search,
  Tag,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  saveAnnouncementAction,
  uploadAnnouncementAttachmentAction,
  type AnnouncementActionResult,
} from "@/app/admin/announcements/actions";
import { PickerModal, useDismissOnOutsideClick } from "@/components/common/picker";
import {
  ATTACHMENT_EXTENSIONS,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_MB,
  type AnnouncementStatus,
} from "@/lib/announcement-schema";
import { Alert, AlertDescription } from "@/components/ui/alert";

type StagedAttachment = {
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
};

/** File sizes read as the uploader wrote them, not as raw byte counts. */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type ComposerCompany = { id: string; name: string };
export type ComposerEvent = {
  id: string;
  title: string;
  companyId: string;
  /** Graduating batch the drive is open to; the composer's placement season. */
  batch: number;
};

const TAG_SUGGESTIONS = [
  "General",
  "Update",
  "Placement",
  "Internship",
  "Internship+PPO",
  "Internship+FTE",
  "Shortlist",
  "Interview",
  "Assessment",
  "Results",
  "Policy",
  "Urgent",
];

export function AnnouncementComposer({
  category,
  companies,
  events,
  seasons,
}: {
  category: "COMPANY_EVENT" | "GENERAL";
  companies: ComposerCompany[];
  events: ComposerEvent[];
  /** Seasons that actually have drives, newest first. */
  seasons: number[];
}) {
  const router = useRouter();
  const isCompanyEvent = category === "COMPANY_EVENT";

  const [season, setSeason] = useState<number | null>(null);
  const [companyId, setCompanyId] = useState<string>("");
  const [eventId, setEventId] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [seasonPickerOpen, setSeasonPickerOpen] = useState(false);
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [companyQuery, setCompanyQuery] = useState("");
  const [eventOpen, setEventOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState("");

  const [attachments, setAttachments] = useState<StagedAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<AnnouncementActionResult>({});

  const eventRef = useDismissOnOutsideClick(() => setEventOpen(false));
  const tagRef = useDismissOnOutsideClick(() => setTagOpen(false));

  const selectedCompany = companies.find((company) => company.id === companyId) ?? null;
  const selectedEvent = events.find((event) => event.id === eventId) ?? null;

  // Season and company narrow the drives, in that order: the same company runs
  // a different opening each year.
  const eventsForSelection = useMemo(
    () =>
      events.filter(
        (event) =>
          (!season || event.batch === season) && (!companyId || event.companyId === companyId),
      ),
    [events, season, companyId],
  );

  const filteredCompanies = useMemo(() => {
    const term = companyQuery.trim().toLowerCase();
    return term ? companies.filter((c) => c.name.toLowerCase().includes(term)) : companies;
  }, [companies, companyQuery]);

  const tagMatches = useMemo(() => {
    const term = tagQuery.trim().toLowerCase();
    const pool = TAG_SUGGESTIONS.filter((tag) => !tags.includes(tag));
    return term ? pool.filter((tag) => tag.toLowerCase().includes(term)) : pool;
  }, [tagQuery, tags]);

  const canCreateTag =
    tagQuery.trim().length > 0 &&
    !tags.some((tag) => tag.toLowerCase() === tagQuery.trim().toLowerCase()) &&
    !tagMatches.some((tag) => tag.toLowerCase() === tagQuery.trim().toLowerCase());

  // The editor stays locked until the announcement knows what it is about,
  // which is the whole point of the funnel above it.
  const missing = isCompanyEvent
    ? [
        season ? null : "placement season",
        companyId ? null : "company",
        title.trim() ? null : "title",
      ].filter(Boolean)
    : [title.trim() ? null : "title"].filter(Boolean);
  const editorReady = missing.length === 0;

  function addTag(tag: string) {
    const clean = tag.trim();
    if (!clean || tags.includes(clean)) return;
    setTags((previous) => [...previous, clean]);
    setTagQuery("");
  }

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length) return;

    const room = MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) {
      setResult({ error: `An announcement can carry at most ${MAX_ATTACHMENTS} files.` });
      return;
    }

    setUploading(true);
    // One request per file, so a rejected file names itself and the rest
    // still land.
    for (const file of Array.from(fileList).slice(0, room)) {
      const formData = new FormData();
      formData.set("file", file);
      const outcome = await uploadAnnouncementAttachmentAction(formData);
      if (outcome.error) {
        setResult({ error: outcome.error });
        continue;
      }
      if (outcome.attachment) {
        const uploaded = outcome.attachment;
        setAttachments((previous) =>
          previous.some((item) => item.fileUrl === uploaded.fileUrl)
            ? previous
            : [...previous, uploaded],
        );
      }
    }
    setUploading(false);
  }

  function reset() {
    setSeason(null);
    setCompanyId("");
    setEventId("");
    setTags([]);
    setTitle("");
    setContent("");
    setAttachments([]);
  }

  async function submit(status: AnnouncementStatus) {
    const formData = new FormData();
    formData.set("category", category);
    formData.set("status", status);
    formData.set("title", title);
    formData.set("content", content);
    formData.set("companyId", isCompanyEvent ? companyId : "");
    formData.set("jobProfileId", isCompanyEvent ? eventId : "");
    formData.set("tags", JSON.stringify(tags));
    formData.set("attachments", JSON.stringify(attachments));

    setSaving(true);
    const next = await saveAnnouncementAction(formData);
    setResult(next);
    setSaving(false);
    if (next.success) {
      reset();
      router.refresh();
    }
  }

  return (
    <section className="composer">
      {result.success ? <Alert variant="success" className="mt-4"><AlertDescription>{result.success}</AlertDescription></Alert> : null}
      {result.error ? <Alert variant="destructive" className="mt-4"><AlertDescription>{result.error}</AlertDescription></Alert> : null}

      <div className="composer-fields">
        {isCompanyEvent ? (
          <div className="composer-row two">
            <button
              type="button"
              className={`composer-field${season ? " filled" : ""}`}
              onClick={() => setSeasonPickerOpen(true)}
            >
              <CalendarRange />
              <span>{season ?? "Select placement season"}</span>
              {season ? <Check className="tick" /> : <ChevronDown className="tick" />}
            </button>

            <button
              type="button"
              className={`composer-field${selectedCompany ? " filled" : ""}`}
              disabled={!season}
              title={season ? "Select the recruiting company" : "Choose a placement season first"}
              onClick={() => {
                setCompanyQuery("");
                setCompanyPickerOpen(true);
              }}
            >
              <Building2 />
              <span>{selectedCompany?.name ?? "Select company"}</span>
              {selectedCompany ? <Check className="tick" /> : <ChevronDown className="tick" />}
            </button>
          </div>
        ) : null}

        {isCompanyEvent ? (
          <div className="composer-row" ref={eventRef}>
            <button
              type="button"
              className={`composer-field${selectedEvent ? " filled" : ""}`}
              disabled={!companyId}
              title={companyId ? "Select the drive" : "Choose a company first"}
              onClick={() => setEventOpen((open) => !open)}
            >
              <FileText />
              <span>{selectedEvent?.title ?? "Select event (optional)"}</span>
              <ChevronDown className={eventOpen ? "tick open" : "tick"} />
            </button>
            {eventOpen ? (
              <div className="composer-dropdown">
                {eventsForSelection.length ? (
                  <>
                    <button
                      type="button"
                      className="dropdown-option"
                      onClick={() => {
                        setEventId("");
                        setEventOpen(false);
                      }}
                    >
                      Not about a specific drive
                    </button>
                    {eventsForSelection.map((event) => (
                      <button
                        type="button"
                        key={event.id}
                        className={`dropdown-option${event.id === eventId ? " selected" : ""}`}
                        onClick={() => {
                          setEventId(event.id);
                          setEventOpen(false);
                        }}
                      >
                        {event.title}
                      </button>
                    ))}
                  </>
                ) : (
                  <p className="dropdown-empty">
                    {selectedCompany?.name ?? "This company"} has no drive for the {season} season.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="composer-row" ref={tagRef}>
          <button
            type="button"
            className={`composer-field${tags.length ? " filled" : ""}`}
            onClick={() => setTagOpen((open) => !open)}
          >
            <Tag />
            <span>{tags.length ? tags.join(", ") : "Select a tag…"}</span>
            <ChevronDown className={tagOpen ? "tick open" : "tick"} />
          </button>
          {tagOpen ? (
            <div className="composer-dropdown">
              <label className="dropdown-search">
                <Search />
                <input
                  autoFocus
                  value={tagQuery}
                  onChange={(event) => setTagQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTag(tagQuery);
                    }
                  }}
                  placeholder="Search tags or create a new one"
                />
              </label>
              {canCreateTag ? (
                <button
                  type="button"
                  className="dropdown-option create"
                  onClick={() => addTag(tagQuery)}
                >
                  Create “{tagQuery.trim()}”
                </button>
              ) : null}
              {tagMatches.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  className="dropdown-option"
                  onClick={() => addTag(tag)}
                >
                  {tag}
                </button>
              ))}
              {!tagMatches.length && !canCreateTag ? (
                <p className="dropdown-empty">Every suggested tag is already on this announcement.</p>
              ) : null}
            </div>
          ) : null}
        </div>

        {tags.length ? (
          <div className="composer-tags">
            {tags.map((tag) => (
              <span key={tag}>
                {tag}
                <button
                  type="button"
                  onClick={() => setTags((previous) => previous.filter((t) => t !== tag))}
                  aria-label={`Remove the ${tag} tag`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="composer-row">
          <input
            className="composer-title"
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={isCompanyEvent ? "Announcement title" : "Notice title"}
          />
        </div>

        <div className={`composer-editor${editorReady ? "" : " locked"}`}>
          {editorReady ? (
            <textarea
              value={content}
              maxLength={10000}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Write the announcement. Students see this text exactly as typed."
            />
          ) : (
            <p>Fill the fields above to start writing. Missing: {missing.join(", ")}.</p>
          )}
        </div>

        <div className="composer-attachments">
          <span className="attachments-label">Attachments</span>
          <div
            className={`dropzone${dragging ? " dragging" : ""}`}
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
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ATTACHMENT_EXTENSIONS.map((extension) => `.${extension}`).join(",")}
              onChange={(event) => {
                uploadFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <FileUp />
            <p>
              <button type="button" onClick={() => fileInputRef.current?.click()}>
                Click to upload
              </button>{" "}
              or drag and drop
            </p>
            <small>
              {ATTACHMENT_EXTENSIONS.map((extension) => `.${extension}`).join(", ")} · up to{" "}
              {MAX_ATTACHMENT_MB} MB each · {MAX_ATTACHMENTS} files at most
            </small>
          </div>

          {uploading ? <p className="attachment-progress">Uploading…</p> : null}

          {attachments.length ? (
            <ul className="attachment-list">
              {attachments.map((attachment) => (
                <li key={attachment.fileUrl}>
                  <Paperclip />
                  <span>
                    <strong>{attachment.fileName}</strong>
                    <small>{formatFileSize(attachment.sizeBytes)}</small>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((previous) =>
                        previous.filter((item) => item.fileUrl !== attachment.fileUrl),
                      )
                    }
                    aria-label={`Remove ${attachment.fileName}`}
                  >
                    <X />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="composer-note">
          <Megaphone />
          <p>
            Publishing puts this on every student&apos;s dashboard immediately. Save it as a draft
            to keep it inside the placement cell until it is ready.
          </p>
        </div>

        <div className="composer-actions">
          <button
            type="button"
            className="ghost"
            disabled={saving || !editorReady || !content.trim()}
            onClick={() => submit("DRAFT")}
          >
            {saving ? "Saving…" : "Save as draft"}
          </button>
          <button
            type="button"
            disabled={saving || !editorReady || !content.trim()}
            onClick={() => submit("PUBLISHED")}
          >
            {saving ? "Publishing…" : "Publish to students"}
          </button>
        </div>
      </div>

      {seasonPickerOpen ? (
        <PickerModal title="Select placement season" onClose={() => setSeasonPickerOpen(false)}>
          {seasons.length ? (
            <div className="picker-list">
              {seasons.map((year) => (
                <button
                  type="button"
                  key={year}
                  className={year === season ? "selected" : ""}
                  onClick={() => {
                    setSeason(year);
                    // The company and drive belonged to the previous season.
                    setCompanyId("");
                    setEventId("");
                    setSeasonPickerOpen(false);
                  }}
                >
                  {year}
                </button>
              ))}
            </div>
          ) : (
            <p className="dropdown-empty">
              No placement season exists yet. Create a job profile first; its batch opens the
              season.
            </p>
          )}
        </PickerModal>
      ) : null}

      {companyPickerOpen ? (
        <PickerModal title="Select a company" onClose={() => setCompanyPickerOpen(false)}>
          <label className="dropdown-search">
            <Search />
            <input
              autoFocus
              value={companyQuery}
              onChange={(event) => setCompanyQuery(event.target.value)}
              placeholder="Search companies…"
            />
          </label>
          {filteredCompanies.length ? (
            <div className="picker-list">
              {filteredCompanies.map((company) => (
                <button
                  type="button"
                  key={company.id}
                  className={company.id === companyId ? "selected" : ""}
                  onClick={() => {
                    setCompanyId(company.id);
                    setEventId("");
                    setCompanyPickerOpen(false);
                  }}
                >
                  {company.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="dropdown-empty">No company matches “{companyQuery.trim()}”.</p>
          )}
        </PickerModal>
      ) : null}
    </section>
  );
}
