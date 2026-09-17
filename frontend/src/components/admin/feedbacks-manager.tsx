"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  HelpCircle,
  MessageSquare,
  MessageSquareReply,
  MessageSquareText,
  Send,
  Trash2,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  deleteFeedbackAction,
  respondFeedbackAction,
  type FeedbackActionResult,
} from "@/app/admin/feedbacks/actions";
import { AdminDialog } from "@/components/common/admin-dialog";
import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
} from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

export type AdminFeedbackItem = {
  id: string;
  userId: string;
  studentName: string | null;
  studentEmail: string | null;
  rollNumber: string | null;
  branch: string | null;
  batch: number | null;
  contactNumber: string | null;
  feedbackType: "QUERY" | "FEEDBACK" | "COMPLAINT" | string;
  subject: string;
  message: string;
  resolved: boolean;
  adminResponse: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export function FeedbacksManager({
  feedbacks,
}: {
  feedbacks: AdminFeedbackItem[];
  canPersist?: boolean;
}) {
  const router = useRouter();
  const [activeItem, setActiveItem] = useState<AdminFeedbackItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<AdminFeedbackItem | null>(null);
  const [replyText, setReplyText] = useState("");
  const [resolveCheck, setResolveCheck] = useState(true);

  const [result, setResult] = useState<FeedbackActionResult>({});
  const [isPending, startTransition] = useTransition();

  const metrics = useMemo(() => {
    const total = feedbacks.length;
    const pending = feedbacks.filter((f) => !f.resolved).length;
    const resolved = feedbacks.filter((f) => f.resolved).length;
    const queries = feedbacks.filter((f) => f.feedbackType.toUpperCase() === "QUERY").length;
    const feedbackCount = feedbacks.filter((f) => f.feedbackType.toUpperCase() === "FEEDBACK").length;
    const complaints = feedbacks.filter((f) => f.feedbackType.toUpperCase() === "COMPLAINT").length;
    return { total, pending, resolved, queries, feedbackCount, complaints };
  }, [feedbacks]);

  function openRespondModal(item: AdminFeedbackItem) {
    setResult({});
    setActiveItem(item);
    setReplyText(item.adminResponse ?? "");
    setResolveCheck(true);
  }

  function handleRespondSubmit(formData: FormData) {
    setResult({});
    startTransition(async () => {
      formData.set("feedbackId", activeItem!.id);
      formData.set("adminResponse", replyText);
      formData.set("resolve", resolveCheck ? "true" : "false");

      const res = await respondFeedbackAction(formData);
      setResult(res);
      if (res.success) {
        setActiveItem(null);
        router.refresh();
      }
    });
  }

  function handleDeleteSubmit(formData: FormData) {
    setResult({});
    startTransition(async () => {
      const res = await deleteFeedbackAction(formData);
      setResult(res);
      if (res.success) {
        setDeletingItem(null);
        router.refresh();
      }
    });
  }

  function getTypeBadge(type: string) {
    const norm = type.toUpperCase();
    if (norm === "QUERY") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "3px",
            background: "var(--badge-blue-bg)",
            color: "var(--badge-blue-text)",
            padding: "3px 8px",
            borderRadius: "6px",
            fontSize: "10px",
            fontWeight: 700,
          }}
        >
          <HelpCircle size={11} /> Query
        </span>
      );
    }
    if (norm === "COMPLAINT") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "3px",
            background: "var(--badge-red-bg)",
            color: "var(--badge-red-text)",
            padding: "3px 8px",
            borderRadius: "6px",
            fontSize: "10px",
            fontWeight: 700,
          }}
        >
          <AlertCircle size={11} /> Complaint
        </span>
      );
    }
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "3px",
          background: "var(--badge-green-bg)",
          color: "var(--badge-green-text)",
          padding: "3px 8px",
          borderRadius: "6px",
          fontSize: "10px",
          fontWeight: 700,
        }}
      >
        <MessageSquare size={11} /> Feedback
      </span>
    );
  }

  const columns = useMemo<DataTableColumn<AdminFeedbackItem>[]>(
    () => [
      {
        id: "student",
        header: "Student",
        width: "200px",
        hideable: false,
        sortValue: (item) => item.studentName || item.rollNumber || item.studentEmail,
        cell: (item) => (
          <>
            <strong style={{ color: "var(--ink)", fontWeight: 700 }}>
              {item.studentName || item.rollNumber || "Student"}
            </strong>
            <small style={{ color: "var(--muted)", display: "block", fontSize: "10px" }}>
              {[item.rollNumber, item.branch, item.batch ? `Batch '${String(item.batch).slice(-2)}` : null]
                .filter(Boolean)
                .join(" · ") || item.studentEmail}
            </small>
          </>
        ),
      },
      {
        id: "type",
        header: "Type",
        width: "120px",
        sortValue: (item) => item.feedbackType.toUpperCase(),
        cell: (item) => getTypeBadge(item.feedbackType),
      },
      {
        id: "subject",
        header: "Subject & Message",
        width: "260px",
        sortValue: (item) => item.subject,
        cell: (item) => (
          <>
            <strong style={{ color: "var(--ink)", fontSize: "12px" }}>{item.subject}</strong>
            <small
              style={{
                color: "var(--muted)",
                display: "block",
                fontSize: "10px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "280px",
              }}
            >
              {item.message}
            </small>
          </>
        ),
      },
      {
        id: "createdAt",
        header: "Submitted",
        width: "120px",
        sortValue: (item) => new Date(item.createdAt),
        cell: (item) => (
          <span style={{ fontWeight: 600, fontSize: "11px" }}>
            {new Date(item.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "110px",
        sortValue: (item) => item.resolved,
        cell: (item) =>
          item.resolved ? (
            <span className="cell-status" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <CheckCircle2 size={11} /> Resolved
            </span>
          ) : (
            <span className="cell-status pending" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <Clock3 size={11} /> Awaiting
            </span>
          ),
      },
      {
        id: "actions",
        header: "Actions",
        width: "150px",
        align: "right",
        hideable: false,
        cell: (item) => (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
            <button
              type="button"
              onClick={() => openRespondModal(item)}
              title={item.resolved ? "View conversation & edit response" : "Respond to student"}
              style={{
                border: 0,
                background: item.resolved ? "var(--surface-alt)" : "var(--badge-blue-bg)",
                color: "var(--blue)",
                borderRadius: "8px",
                padding: "6px 10px",
                fontSize: "11px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer",
              }}
            >
              <MessageSquareReply size={13} /> {item.resolved ? "View" : "Reply"}
            </button>

            <button
              type="button"
              onClick={() => {
                setResult({});
                setDeletingItem(item);
              }}
              title="Delete feedback item"
              aria-label={`Delete feedback ${item.subject}`}
              style={{
                border: 0,
                background: "var(--surface-alt)",
                color: "var(--badge-red-text)",
                borderRadius: "8px",
                padding: "6px",
                cursor: "pointer",
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  const filters = useMemo<DataTableFilter<AdminFeedbackItem>[]>(
    () => [
      {
        id: "type",
        label: "Type",
        options: [
          { value: "QUERY", label: `Queries (${metrics.queries})` },
          { value: "FEEDBACK", label: `Feedback (${metrics.feedbackCount})` },
          { value: "COMPLAINT", label: `Complaints (${metrics.complaints})` },
        ],
        value: (item) => item.feedbackType.toUpperCase(),
      },
      {
        id: "status",
        label: "Status",
        options: [
          { value: "PENDING", label: `Awaiting Response (${metrics.pending})` },
          { value: "RESOLVED", label: `Resolved (${metrics.resolved})` },
        ],
        value: (item) => (item.resolved ? "RESOLVED" : "PENDING"),
      },
    ],
    [metrics],
  );

  return (
    <div className="admin-page">
      <section className="admin-heading">
        <div>
          <span className="eyebrow">Management</span>
          <h1>Feedbacks & Queries</h1>
          <p>Respond to student queries, suggestions, and grievances regarding placement operations.</p>
        </div>
      </section>

      {/* Metrics Grid */}
      <section className="admin-metrics">
        <article>
          <div className="metric-icon violet">
            <MessageSquareText size={20} />
          </div>
          <div>
            <small>Total Messages</small>
            <strong>{metrics.total}</strong>
            <b>All student inquiries</b>
          </div>
        </article>

        <article>
          <div className="metric-icon" style={{ background: "var(--badge-orange-bg)", color: "var(--badge-orange-text)" }}>
            <Clock3 size={20} />
          </div>
          <div>
            <small>Awaiting Response</small>
            <strong>{metrics.pending}</strong>
            <b>Unresolved items</b>
          </div>
        </article>

        <article>
          <div className="metric-icon" style={{ background: "var(--badge-green-bg)", color: "var(--badge-green-text)" }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <small>Resolved</small>
            <strong>{metrics.resolved}</strong>
            <b>Answered queries</b>
          </div>
        </article>

        <article>
          <div className="metric-icon" style={{ background: "var(--badge-blue-bg)", color: "var(--badge-blue-text)" }}>
            <HelpCircle size={20} />
          </div>
          <div>
            <small>Queries & Complaints</small>
            <strong>{metrics.queries + metrics.complaints}</strong>
            <b>{metrics.queries} Qs · {metrics.complaints} Complaints</b>
          </div>
        </article>
      </section>

      {/* Result feedback */}
      {result.success && <Alert variant="success" className="mt-4"><AlertDescription>{result.success}</AlertDescription></Alert>}
      {result.error && <Alert variant="destructive" className="mt-4"><AlertDescription>{result.error}</AlertDescription></Alert>}

      <DataTable
        title="Submissions"
        data={feedbacks}
        columns={columns}
        getRowId={(item) => item.id}
        searchText={(item) =>
          `${item.studentName ?? ""} ${item.rollNumber ?? ""} ${item.studentEmail ?? ""} ${item.subject} ${item.message} ${item.adminResponse ?? ""}`
        }
        searchPlaceholder="Search by student name, roll number, subject, content..."
        filters={filters}
        columnStorageKey="feedbacks"
        minWidth={1080}
        emptyIcon={<MessageSquare />}
        emptyTitle="No messages found"
        emptyDescription={
          feedbacks.length
            ? "No student feedback items match your search filter."
            : "No messages or queries submitted yet."
        }
      />

      {/* Response & Detail Modal */}
      {activeItem && (
        <AdminDialog
          onClose={() => setActiveItem(null)}
          eyebrow={activeItem.resolved ? "Support History" : "Support Response"}
          title={activeItem.subject}
          className="max-h-[88vh] overflow-y-auto sm:max-w-[660px]"
        >
          <form
            className="grid gap-3"
            onSubmit={(e) => { e.preventDefault(); handleRespondSubmit(new FormData(e.currentTarget)); }}
          >
            <input type="hidden" name="feedbackId" value={activeItem.id} />

            {/* Student info box */}
            <div className="bg-muted rounded-[10px] border px-3.5 py-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1 text-[10px] font-bold uppercase">
                  <User size={12} /> Student Details
                </span>
                {getTypeBadge(activeItem.feedbackType)}
              </div>

              <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                <div>
                  <strong className="block">{activeItem.studentName || "Name not recorded"}</strong>
                  <small className="text-muted-foreground">{activeItem.studentEmail}</small>
                </div>
                <div>
                  <span>Roll: <strong>{activeItem.rollNumber || "N/A"}</strong></span>
                  <span className="block">
                    Branch: <strong>{[activeItem.branch, activeItem.batch ? `Batch ${activeItem.batch}` : null].filter(Boolean).join(" - ") || "N/A"}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Message box */}
            <div className="bg-muted rounded-[10px] border px-3.5 py-3 text-xs">
              <span className="text-muted-foreground text-[10px] font-bold uppercase">
                Student Message · {new Date(activeItem.createdAt).toLocaleString("en-IN")}
              </span>
              <p className="mt-1.5 leading-relaxed whitespace-pre-wrap">
                {activeItem.message}
              </p>
            </div>

            {/* Reply field */}
            <div className="grid gap-2">
              <Label htmlFor="feedback-response">Placement Cell Response</Label>
              <Textarea
                id="feedback-response"
                name="adminResponse"
                rows={5}
                required
                minLength={2}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Draft your official response to the student..."
              />
            </div>

            {/* Resolve checkbox */}
            <Label className="font-normal">
              <Checkbox
                checked={resolveCheck}
                onCheckedChange={(checked) => setResolveCheck(checked === true)}
              />
              Mark query as resolved
            </Label>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setActiveItem(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                <Send />
                {isPending ? "Submitting..." : activeItem.resolved ? "Update Response" : "Send Response"}
              </Button>
            </DialogFooter>
          </form>
        </AdminDialog>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <AdminDialog
          onClose={() => setDeletingItem(null)}
          eyebrow={<span className="text-[var(--badge-red-text)]">Delete</span>}
          title="Delete Feedback?"
          className="sm:max-w-[460px]"
        >
          <form
            className="grid gap-3"
            onSubmit={(e) => { e.preventDefault(); handleDeleteSubmit(new FormData(e.currentTarget)); }}
          >
            <input type="hidden" name="feedbackId" value={deletingItem.id} />

            <p className="text-muted-foreground text-xs leading-relaxed">
              Are you sure you want to delete message &ldquo;<strong>{deletingItem.subject}</strong>&rdquo; from <strong>{deletingItem.studentName || deletingItem.studentEmail}</strong>? This action cannot be undone.
            </p>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeletingItem(null)}>
                Keep message
              </Button>
              <Button type="submit" variant="destructive" disabled={isPending}>
                <Trash2 />
                {isPending ? "Deleting..." : "Yes, delete message"}
              </Button>
            </DialogFooter>
          </form>
        </AdminDialog>
      )}
    </div>
  );
}
