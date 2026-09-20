"use client";

import {
  BellRing,
  Building2,
  Calendar,
  Edit3,
  Eye,
  FileClock,
  Megaphone,
  Paperclip,
  Plus,
  Send,
  Trash2,
  Undo2,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  deleteAnnouncementAction,
  saveAnnouncementAction,
  setAnnouncementStatusAction,
  type AnnouncementActionResult,
} from "@/app/admin/announcements/actions";
import { PortalDialog } from "@/components/common/portal-dialog";
import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
} from "@/components/common/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { AnnouncementStatus } from "@/lib/announcement-schema";
import { sanitizeAnnouncementHtml, stripHtmlToText } from "@/lib/rich-text";
import { Alert, AlertDescription } from "@/components/ui/alert";

export type AdminAnnouncementItem = {
  id: string;
  title: string;
  content: string;
  category: "COMPANY_EVENT" | "GENERAL";
  /** DRAFT is placement-cell only; PUBLISHED is on every student's feed. */
  status: AnnouncementStatus;
  publishedAt: string | null;
  tags: string[];
  companyId: string | null;
  companyName: string | null;
  companyLogoUrl: string | null;
  createdAt: string;
  createdByName: string | null;
  createdByEmail: string | null;
  attachments: AnnouncementAttachment[];
};

export type AnnouncementAttachment = {
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
};

/** Stands in for "no company" in the picker, which cannot hold an empty value. */
const NO_COMPANY = "__none";

export type CompanyOption = {
  id: string;
  name: string;
};

const dateOnly = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const PRESET_TAGS = [
  "Shortlist",
  "Interview",
  "Assessment",
  "Drive",
  "PPT",
  "Results",
  "Registration",
  "Policy",
  "Urgent",
];

/**
 * Announcements are written on their own pages — company event and general —
 * and managed here: what is live, what is still a draft, and moving one to
 * the other.
 */
export function AnnouncementsManager({
  announcements,
  companies,
  canPersist,
}: {
  announcements: AdminAnnouncementItem[];
  companies: CompanyOption[];
  canPersist: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminAnnouncementItem | null | undefined>(undefined);
  const [previewing, setPreviewing] = useState<AdminAnnouncementItem | null>(null);
  const [deleting, setDeleting] = useState<AdminAnnouncementItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<AnnouncementActionResult>({});

  // Modal form internal state
  const [formCategory, setFormCategory] = useState<"COMPANY_EVENT" | "GENERAL">("GENERAL");
  const [formTags, setFormTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  // Empty means "no company". Radix rejects an empty-valued item, so the
  // picker shows NO_COMPANY instead and `submitForm` posts the empty string
  // the action already reads as null.
  const [formCompanyId, setFormCompanyId] = useState("");
  // The rich text editor is a controlled React component, not a native form
  // field, so its value can't ride along on a `name` attribute the way the
  // textarea it replaced did — it is mirrored into a hidden input instead.
  const [formContent, setFormContent] = useState("");
  // Which footer button was pressed. A ref, not state, because the value has
  // to be readable inside the submit handler of the same click.
  const submitStatus = useRef<AnnouncementStatus>("PUBLISHED");

  const metrics = useMemo(() => {
    const companyEvents = announcements.filter((a) => a.category === "COMPANY_EVENT").length;
    const general = announcements.filter((a) => a.category === "GENERAL").length;
    const active = announcements.filter((a) => a.status === "PUBLISHED").length;
    const drafts = announcements.filter((a) => a.status === "DRAFT").length;
    return { companyEvents, general, active, drafts };
  }, [announcements]);

  async function changeStatus(formData: FormData) {
    setSaving(true);
    const nextResult = await setAnnouncementStatusAction(formData);
    setResult(nextResult);
    setSaving(false);
    if (nextResult.success) router.refresh();
  }

  function openEditModal(item: AdminAnnouncementItem) {
    setResult({});
    setFormCategory(item.category);
    setFormTags([...item.tags]);
    setCustomTagInput("");
    setFormCompanyId(item.companyId ?? "");
    setFormContent(item.content);
    // Editing keeps the announcement where it is: saving a live announcement
    // must not quietly withdraw it, and saving a draft must not publish it.
    submitStatus.current = item.status;
    setEditing(item);
  }

  function togglePresetTag(tag: string) {
    setFormTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function addCustomTag() {
    const trimmed = customTagInput.trim();
    if (trimmed && !formTags.includes(trimmed)) {
      setFormTags((prev) => [...prev, trimmed]);
      setCustomTagInput("");
    }
  }

  function removeTag(tagToRemove: string) {
    setFormTags((prev) => prev.filter((t) => t !== tagToRemove));
  }

  async function submitForm(formData: FormData) {
    setSaving(true);
    formData.set("tags", JSON.stringify(formTags));
    formData.set("category", formCategory);
    formData.set("status", submitStatus.current);
    formData.set("companyId", formCategory === "COMPANY_EVENT" ? formCompanyId : "");
    const nextResult = await saveAnnouncementAction(formData);
    setResult(nextResult);
    setSaving(false);
    if (nextResult.success) {
      setEditing(undefined);
      router.refresh();
    }
  }

  async function handleRemove(formData: FormData) {
    setSaving(true);
    const nextResult = await deleteAnnouncementAction(formData);
    setResult(nextResult);
    setSaving(false);
    setDeleting(null);
    if (nextResult.success) {
      router.refresh();
    }
  }

  const columns = useMemo<DataTableColumn<AdminAnnouncementItem>[]>(
    () => [
      {
        id: "title",
        header: "Title & Overview",
        width: "260px",
        hideable: false,
        sortValue: (item) => item.title,
        cell: (item) => (
          <span style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background:
                  item.category === "COMPANY_EVENT"
                    ? "var(--badge-blue-bg)"
                    : "var(--badge-purple-bg)",
                color:
                  item.category === "COMPANY_EVENT"
                    ? "var(--blue)"
                    : "var(--badge-purple-text)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              {item.category === "COMPANY_EVENT" ? <Building2 size={16} /> : <Megaphone size={16} />}
            </span>
            <span style={{ minWidth: 0 }}>
              <strong
                style={{
                  color: "var(--ink)",
                  fontSize: 12,
                  fontWeight: 700,
                  display: "block",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={item.title}
              >
                {item.title}
              </strong>
              <span
                style={{
                  color: "var(--muted)",
                  fontSize: 11,
                  display: "block",
                  margin: "2px 0 0",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 320,
                }}
              >
                {stripHtmlToText(item.content)}
              </span>
            </span>
          </span>
        ),
      },
      {
        id: "status",
        header: "Status & Target",
        width: "140px",
        sortValue: (item) => item.status,
        cell: (item) => (
          <>
            <span
              className={`cell-status ${item.status === "DRAFT" ? "draft" : ""}`}
              style={{ fontSize: 9.5, padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}
            >
              {item.status === "DRAFT" ? "Draft" : "Active"}
            </span>
            <small style={{ display: "block", color: "var(--muted)", marginTop: 4 }}>
              {item.category === "COMPANY_EVENT" ? "Company event" : "General update"}
            </small>
            {item.companyName ? (
              <small
                style={{
                  display: "block",
                  color: "var(--ink)",
                  fontWeight: 600,
                  marginTop: 4,
                }}
              >
                {item.companyName}
              </small>
            ) : null}
          </>
        ),
      },
      {
        id: "tags",
        header: "Tags",
        width: "140px",
        sortValue: (item) => item.tags.length,
        // One line, like every other cell: the grid scrolls sideways, so a
        // second tag widens the column instead of deepening the row.
        cell: (item) => (
          <span style={{ display: "flex", gap: 4 }}>
            {item.tags.length > 0 ? (
              item.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 9,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: "var(--surface-alt)",
                    border: "1px solid var(--border)",
                    color: "var(--ink)",
                    fontWeight: 600,
                  }}
                >
                  {tag}
                </span>
              ))
            ) : (
              <small style={{ color: "var(--muted)" }}>No tags</small>
            )}
            {item.tags.length > 3 ? (
              <span
                style={{
                  fontSize: 9,
                  padding: "2px 5px",
                  borderRadius: 4,
                  background: "var(--surface-highlight)",
                  color: "var(--muted)",
                  fontWeight: 700,
                }}
              >
                +{item.tags.length - 3}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: "published",
        header: "Author & Published",
        width: "150px",
        // Sorts by the date the cell shows, which is the publication date once
        // an announcement is live and the writing date while it is a draft.
        sortValue: (item) =>
          new Date(item.status === "PUBLISHED" && item.publishedAt ? item.publishedAt : item.createdAt),
        cell: (item) => (
          <>
            <span style={{ fontWeight: 600, color: "var(--ink)", display: "block" }}>
              {item.createdByName || item.createdByEmail || "Placement Cell"}
            </span>
            <small style={{ color: "var(--muted)", fontSize: 10 }}>
              {item.status === "PUBLISHED" && item.publishedAt
                ? `Published ${dateOnly.format(new Date(item.publishedAt))}`
                : `Written ${dateOnly.format(new Date(item.createdAt))}`}
            </small>
          </>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        width: "132px",
        align: "right",
        hideable: false,
        cell: (item) => (
          <span className="row-actions" style={{ justifyContent: "flex-end" }}>
            <form action={changeStatus}>
              <input type="hidden" name="announcementId" value={item.id} />
              <input
                type="hidden"
                name="status"
                value={item.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"}
              />
              <button
                title={
                  item.status === "PUBLISHED"
                    ? "Withdraw to drafts — students stop seeing it"
                    : "Publish — students see it immediately"
                }
                aria-label={
                  item.status === "PUBLISHED"
                    ? `Withdraw ${item.title} to drafts`
                    : `Publish ${item.title}`
                }
                disabled={!canPersist || saving}
                type="submit"
              >
                {item.status === "PUBLISHED" ? <Undo2 /> : <Send />}
              </button>
            </form>
            <button
              title="Preview announcement"
              aria-label={`Preview ${item.title}`}
              onClick={() => setPreviewing(item)}
              type="button"
            >
              <Eye />
            </button>
            <button
              title="Edit announcement"
              aria-label={`Edit ${item.title}`}
              onClick={() => openEditModal(item)}
              type="button"
            >
              <Edit3 />
            </button>
            <button
              title="Delete announcement"
              aria-label={`Delete ${item.title}`}
              onClick={() => setDeleting(item)}
              type="button"
            >
              <Trash2 />
            </button>
          </span>
        ),
      },
    ],
    // `changeStatus` and `openEditModal` are redefined per render but close
    // over nothing beyond the values listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canPersist, saving],
  );

  const filters = useMemo<DataTableFilter<AdminAnnouncementItem>[]>(
    () => [
      {
        id: "status",
        label: "Status",
        options: [
          { value: "PUBLISHED", label: "Active" },
          { value: "DRAFT", label: "Drafts" },
        ],
        value: (item) => item.status,
      },
      {
        id: "category",
        label: "Category",
        options: [
          { value: "COMPANY_EVENT", label: "Company events" },
          { value: "GENERAL", label: "General notices" },
        ],
        value: (item) => item.category,
      },
      ...(companies.length
        ? [
            {
              id: "company",
              label: "Company",
              options: companies.map((comp) => ({ value: comp.id, label: comp.name })),
              value: (item: AdminAnnouncementItem) => item.companyId,
            },
          ]
        : []),
    ],
    [companies],
  );

  return (
    <div className="admin-page">
      <section className="admin-heading">
        <div>
          <span className="eyebrow">Communications & Drives</span>
          <h1>Active &amp; drafts</h1>
          <p>
            Everything published or held as a draft, and the control to move one to the other.
          </p>
        </div>
        <Link href="/admin/announcements/company-event">
          <Plus />
          Write an announcement
        </Link>
      </section>

      <nav className="admin-tabs" aria-label="Announcement pages">
        <Link href="/admin/announcements/company-event">
          <Building2 />
          Company event announcement
          <b>{metrics.companyEvents}</b>
        </Link>
        <Link href="/admin/announcements/general">
          <Megaphone />
          General announcement
          <b>{metrics.general}</b>
        </Link>
        <span className="active" aria-current="page">
          <FileClock />
          Active &amp; drafts
          <b>{announcements.length}</b>
        </span>
      </nav>

      {result.success ? <Alert variant="success" className="mt-4"><AlertDescription>{result.success}</AlertDescription></Alert> : null}
      {result.error ? <Alert variant="destructive" className="mt-4"><AlertDescription>{result.error}</AlertDescription></Alert> : null}

      {/* Metrics Banner */}
      <section className="admin-metrics">
        <article>
          <div className="metric-icon blue">
            <Building2 />
          </div>
          <div>
            <small>Company Drives</small>
            <strong>{metrics.companyEvents}</strong>
            <b>Hiring updates &amp; shortlists</b>
          </div>
        </article>

        <article>
          <div className="metric-icon violet">
            <Megaphone />
          </div>
          <div>
            <small>General Notices</small>
            <strong>{metrics.general}</strong>
            <b style={{ color: "var(--badge-purple-text)" }}>Policy &amp; campus updates</b>
          </div>
        </article>

        <article>
          <div className="metric-icon green">
            <BellRing />
          </div>
          <div>
            <small>Active</small>
            <strong>{metrics.active}</strong>
            <b>Visible to students now</b>
          </div>
        </article>

        <article>
          <div className="metric-icon orange">
            <FileClock />
          </div>
          <div>
            <small>Drafts</small>
            <strong>{metrics.drafts}</strong>
            <b style={{ color: "var(--orange)" }}>Not visible to students</b>
          </div>
        </article>
      </section>

      <DataTable
        title="Announcements"
        data={announcements}
        columns={columns}
        getRowId={(item) => item.id}
        searchText={(item) =>
          `${item.title} ${stripHtmlToText(item.content)} ${item.companyName ?? ""} ${item.tags.join(" ")} ${item.createdByName ?? ""}`
        }
        searchPlaceholder="Search by title, content, company, or tags…"
        filters={filters}
        columnStorageKey="announcements"
        minWidth={900}
        emptyIcon={<Megaphone />}
        emptyTitle={
          announcements.length
            ? "No announcements in this view"
            : "No announcements written yet"
        }
        emptyDescription={
          announcements.length
            ? "Clear the search or the status and category filters."
            : "Write a company event or general announcement; every one appears here, live or draft."
        }
      />

      {/* CREATE / EDIT MODAL */}
      {editing !== undefined ? (
        <PortalDialog
          onClose={() => setEditing(undefined)}
          eyebrow="Announcement Record"
          title={editing ? "Edit announcement" : "Create announcement"}
          className="max-h-[88vh] overflow-y-auto sm:max-w-[720px]"
        >
          <form key={editing?.id ?? "create"} className="grid gap-3" action={submitForm}>
            <input type="hidden" name="id" value={editing?.id ?? ""} />

            {/* Title */}
            <div className="grid gap-2">
              <Label htmlFor="announcement-title">Announcement Title *</Label>
              <Input
                id="announcement-title"
                name="title"
                required
                minLength={2}
                maxLength={200}
                defaultValue={editing?.title ?? ""}
                placeholder="e.g., Google Technical Assessment Shortlist & Schedule"
              />
            </div>

            {/* Category Segmented Selector */}
            <div className="grid gap-2">
              <Label>Category *</Label>
              <ToggleGroup
                type="single"
                variant="outline"
                spacing={2}
                className="w-full"
                value={formCategory}
                // Radix clears a single toggle group when the active item is
                // pressed again; an announcement is always one category or the
                // other, so that clearing is ignored.
                onValueChange={(next) =>
                  next && setFormCategory(next as "COMPANY_EVENT" | "GENERAL")
                }
              >
                <ToggleGroupItem
                  value="GENERAL"
                  className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90"
                >
                  <Megaphone />
                  General Update
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="COMPANY_EVENT"
                  className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90"
                >
                  <Building2 />
                  Company Drive / Event
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Associated Company (when category is Company Event) */}
            {formCategory === "COMPANY_EVENT" ? (
              <div className="grid gap-2">
                <Label htmlFor="announcement-company">Associated Company</Label>
                <Select
                  value={formCompanyId || NO_COMPANY}
                  onValueChange={(next) =>
                    setFormCompanyId(next === NO_COMPANY ? "" : next)
                  }
                >
                  <SelectTrigger id="announcement-company" className="w-full">
                    <SelectValue placeholder="-- Select Recruiting Company (Optional) --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_COMPANY}>No company</SelectItem>
                    {companies.map((comp) => (
                      <SelectItem value={comp.id} key={comp.id}>
                        {comp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {/* Tags Selector & Custom Tag Input */}
            <div className="grid gap-2">
              <Label>Tags &amp; Badges</Label>

              {/* Preset Suggestions */}
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TAGS.map((tag) => {
                  const isSelected = formTags.includes(tag);
                  return (
                    <Button
                      type="button"
                      key={tag}
                      size="xs"
                      variant={isSelected ? "default" : "outline"}
                      className="rounded-full"
                      onClick={() => togglePresetTag(tag)}
                    >
                      {isSelected ? "✓ " : "+ "}
                      {tag}
                    </Button>
                  );
                })}
              </div>

              {/* Active Selected Tags Display */}
              {formTags.length > 0 ? (
                <div className="bg-muted flex flex-wrap gap-1.5 rounded-md border px-2.5 py-2">
                  {formTags.map((tag) => (
                    <Badge key={tag} variant="outline" className="bg-background gap-1.5">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        aria-label={`Remove ${tag}`}
                        className="text-muted-foreground hover:text-foreground leading-none"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : null}

              {/* Custom tag adder */}
              <div className="flex gap-2">
                <Input
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomTag();
                    }
                  }}
                  placeholder="Add custom tag (press Enter or Add)..."
                />
                <Button type="button" variant="outline" onClick={addCustomTag}>
                  Add
                </Button>
              </div>
            </div>

            {/* Content / Body */}
            <div className="grid gap-2">
              <Label htmlFor="announcement-content">Announcement Content *</Label>
              <RichTextEditor
                id="announcement-content"
                value={formContent}
                onChange={setFormContent}
                placeholder="Enter the full announcement details, test links, shortlist instructions, eligibility criteria, etc."
              />
              <input type="hidden" name="content" value={formContent} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(undefined)}>
                Cancel
              </Button>
              {/* Two submit buttons rather than a status dropdown: the choice
                  is the act, and the label says who will see the result. */}
              <Button
                type="submit"
                variant="outline"
                disabled={saving || !stripHtmlToText(formContent)}
                onClick={() => {
                  submitStatus.current = "DRAFT";
                }}
              >
                {saving ? "Saving…" : "Save as draft"}
              </Button>
              <Button
                type="submit"
                disabled={saving || !stripHtmlToText(formContent)}
                onClick={() => {
                  submitStatus.current = "PUBLISHED";
                }}
              >
                {saving
                  ? "Publishing…"
                  : editing?.status === "PUBLISHED"
                    ? "Save & keep live"
                    : "Publish to students"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      ) : null}

      {/* DETAIL PREVIEW MODAL */}
      {previewing ? (
        <PortalDialog
          onClose={() => setPreviewing(null)}
          eyebrow={
            previewing.category === "COMPANY_EVENT"
              ? "Company Drive Announcement"
              : "General Notice"
          }
          title={previewing.title}
          className="max-h-[88vh] overflow-y-auto sm:max-w-[680px]"
        >
          <div className="grid gap-4">
            {/* Metadata Banner */}
            <div className="bg-muted flex flex-wrap items-center gap-3 rounded-[10px] border px-3.5 py-2.5 text-xs">
              {previewing.companyName ? (
                <div className="flex items-center gap-1.5">
                  <Building2 size={14} className="text-[var(--blue)]" />
                  <strong>{previewing.companyName}</strong>
                </div>
              ) : null}

              <div className="text-muted-foreground flex items-center gap-1.5">
                <Calendar size={14} />
                <span>
                  {new Intl.DateTimeFormat("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(previewing.createdAt))}
                </span>
              </div>

              <div className="text-muted-foreground flex items-center gap-1.5">
                <User size={14} />
                <span>{previewing.createdByName || previewing.createdByEmail || "Placement Cell"}</span>
              </div>
            </div>

            {/* Tags */}
            {previewing.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {previewing.tags.map((tag) => (
                  <Badge
                    key={tag}
                    className="bg-[var(--badge-blue-bg)] text-[var(--blue)]"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}

            {/* Body: this is the same HTML the composer produced, run back
                through the sanitizer before it touches the DOM — the
                schema already sanitized it once on the way in, but a row
                written before that existed gets the same treatment here. */}
            <div
              className="rte-content rte-content--preview rounded-[10px] border p-4"
              dangerouslySetInnerHTML={{ __html: sanitizeAnnouncementHtml(previewing.content) }}
            />

            {previewing.attachments.length ? (
              <div className="grid gap-2">
                <span className="attachments-label">
                  Attachments ({previewing.attachments.length})
                </span>
                <div className="attachment-links">
                  {previewing.attachments.map((file) => (
                    <a
                      key={file.fileUrl}
                      href={file.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Paperclip />
                      {file.fileName}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const toEdit = previewing;
                setPreviewing(null);
                openEditModal(toEdit);
              }}
            >
              Edit
            </Button>
            <Button type="button" onClick={() => setPreviewing(null)}>
              Done
            </Button>
          </DialogFooter>
        </PortalDialog>
      ) : null}

      {/* DELETE CONFIRMATION MODAL */}
      {deleting ? (
        <PortalDialog
          onClose={() => setDeleting(null)}
          eyebrow={<span className="text-[var(--badge-red-text)]">Confirm Deletion</span>}
          title="Delete Announcement"
          className="sm:max-w-[460px]"
        >
          <form className="grid gap-3" action={handleRemove}>
            <input type="hidden" name="announcementId" value={deleting.id} />

            <div className="text-xs leading-relaxed">
              Are you sure you want to delete <strong>&ldquo;{deleting.title}&rdquo;</strong>?
              <p className="text-muted-foreground mt-2 text-[11px]">
                This action cannot be undone. The announcement will be immediately removed from student dashboards.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={saving}>
                {saving ? "Deleting…" : "Delete announcement"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      ) : null}
    </div>
  );
}
