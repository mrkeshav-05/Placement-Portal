"use client";

import {
  Check,
  Download,
  ExternalLink,
  Eye,
  FilePlus,
  FileText,
  GraduationCap,
  IdCard,
  Lock,
  Mail,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import {
  deleteAadhaarDocAction,
  deletePanDocAction,
  deleteResumeAction,
  renameResumeAction,
  deleteCollegeIdDocAction,
  updateAadhaarAction,
  updateCollegeIdAction,
  updatePanAction,
  uploadCollegeIdDocAction,
  updateStudentProfile,
  uploadAadhaarDocAction,
  uploadPanDocAction,
  type ProfileUpdateResult,
} from "@/app/profile/actions";
import { uploadResume } from "@/app/profile/upload-action";
import { PortalDialog } from "@/components/common/portal-dialog";
import { IdentityDocumentRow } from "@/components/profile/identity-document-row";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { BACKLOG_OPTIONS, BLOOD_GROUPS, GENDERS } from "@/lib/profile-schema";

type ProfileValues = {
  name: string;
  rollNumber: string;
  personalEmail: string;
  contactNumber: string;
  altContactNumber: string;
  branch: string;
  degree: string;
  batch: string;
  gender: string;
  bloodGroup: string;
  dateOfBirth: string;
  currentAddress: string;
  class10Percent: string;
  class12Percent: string;
  cgpa: string;
  backlogs: string;
};

export type StudentProfileViewData = {
  canPersist: boolean;
  initials: string;
  completion: number;
  email: string;
  values: ProfileValues;
  identityDocuments: {
    aadhaarProvided: boolean;
    aadhaarMasked?: string | null;
    aadhaarDocProvided?: boolean;
    aadhaarDocFileName?: string | null;
    panProvided: boolean;
    panMasked?: string | null;
    panDocProvided?: boolean;
    panDocFileName?: string | null;
    collegeIdProvided: boolean;
    collegeIdMasked?: string | null;
    collegeIdDocProvided?: boolean;
    collegeIdDocFileName?: string | null;
  };
  resumes: Array<{
    id: string;
    label: string;
    name: string;
    fileUrl: string;
    uploadedAt: string;
  }>;
};

// Roster fields are set by the placement office from the official roster;
// cgpa/backlogs are locked for a different reason — both drive job
// eligibility and are shown to recruiters as fact, so a student self-editing
// them would let an ineligible student fabricate eligibility (corrected only
// through the placement office's admin tooling). Kept in ProfileValues for
// display, but renderFields never lets either group unlock.
const ROSTER_LOCKED_FIELDS = new Set<keyof ProfileValues>([
  "name",
  "rollNumber",
  "branch",
  "degree",
  "batch",
]);
const ACADEMIC_LOCKED_FIELDS = new Set<keyof ProfileValues>(["cgpa", "backlogs"]);
const LOCKED_FIELDS = new Set<keyof ProfileValues>([
  ...ROSTER_LOCKED_FIELDS,
  ...ACADEMIC_LOCKED_FIELDS,
]);

/** Radix has no empty option value, so "not provided" rides a sentinel. */
const NOT_PROVIDED = "__none";

/**
 * A field descriptor. Supplying `options` renders a `Select` instead of an
 * `Input`, so a new closed-list field is one entry here rather than new markup.
 */
type ProfileField = {
  key: keyof ProfileValues;
  label: string;
  type: string;
  options?: readonly string[];
  /** Native hints for immediate feedback. The schema is what actually decides. */
  step?: string;
  min?: number;
  max?: number;
};

const personalFields: ProfileField[] = [
  { key: "name", label: "Full name", type: "text" },
  { key: "dateOfBirth", label: "Date of birth", type: "date" },
  { key: "gender", label: "Gender", type: "text", options: GENDERS },
  { key: "bloodGroup", label: "Blood group", type: "text", options: BLOOD_GROUPS },
];
const academicFields: ProfileField[] = [
  { key: "rollNumber", label: "Roll number", type: "text" },
  { key: "branch", label: "Branch", type: "text" },
  { key: "degree", label: "Degree", type: "text" },
  { key: "batch", label: "Graduation year", type: "number" },
  { key: "class10Percent", label: "Class 10 %", type: "number", step: "0.01", min: 0, max: 100 },
  { key: "class12Percent", label: "Class 12 %", type: "number", step: "0.01", min: 0, max: 100 },
  { key: "cgpa", label: "Current CGPA", type: "number", step: "0.01", min: 0, max: 10 },
  { key: "backlogs", label: "Active backlogs", type: "number", options: BACKLOG_OPTIONS },
];
const contactFields: ProfileField[] = [
  { key: "personalEmail", label: "Personal email", type: "email" },
  { key: "contactNumber", label: "Phone", type: "tel" },
  { key: "altContactNumber", label: "Alternate phone", type: "tel" },
  { key: "currentAddress", label: "Current address", type: "text" },
];

const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** The tinted chip each profile card leads with, matching the admin cards. */
function SectionIcon({ children }: { children: ReactNode }) {
  return (
    <span className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-[var(--badge-blue-bg)] text-[color:var(--blue)]">
      {children}
    </span>
  );
}

export function ProfileView({ profile }: { profile: StudentProfileViewData }) {
  const router = useRouter();

  // ── Profile edit state ──────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ProfileUpdateResult>({});
  const [form, setForm] = useState(profile.values);

  // Identity number update modals
  const [aadhaarModal, setAadhaarModal] = useState(false);
  const [aadhaarInput, setAadhaarInput] = useState("");
  const [aadhaarError, setAadhaarError] = useState<string | null>(null);

  const [panModal, setPanModal] = useState(false);
  const [panInput, setPanInput] = useState("");
  const [panError, setPanError] = useState<string | null>(null);

  // Identity doc upload modals
  const [aadhaarDocModal, setAadhaarDocModal] = useState(false);
  const [aadhaarDocError, setAadhaarDocError] = useState<string | null>(null);

  const [panDocModal, setPanDocModal] = useState(false);
  const [panDocError, setPanDocError] = useState<string | null>(null);

  const [collegeIdModal, setCollegeIdModal] = useState(false);
  const [collegeIdInput, setCollegeIdInput] = useState("");
  const [collegeIdError, setCollegeIdError] = useState<string | null>(null);

  const [collegeIdDocModal, setCollegeIdDocModal] = useState(false);
  const [collegeIdDocError, setCollegeIdDocError] = useState<string | null>(null);

  // Unlock identity doc modal
  const [unlockDocModal, setUnlockDocModal] = useState<{
    type: "aadhaar" | "pan" | "college-id";
    label: string;
    fileName: string;
  } | null>(null);
  const [unlockInput, setUnlockInput] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  // Resume modals & preview
  const [uploadModal, setUploadModal] = useState(false);
  const [resumeLabel, setResumeLabel] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [renameModal, setRenameModal] = useState<{ id: string; currentLabel: string } | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);

  const [previewModal, setPreviewModal] = useState<{ label: string; url: string; filename: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  /**
   * Closes the preview and, for a decrypted identity document, drops the blob.
   *
   * An unlocked Aadhaar, PAN, or college ID arrives as a blob held by the tab,
   * and the object URL keeps that plaintext alive and fetchable until the tab
   * is closed. Revoking on close is what makes the dialog's "decrypted in
   * memory, on demand" claim true. A resume preview points at a server URL
   * instead, which is why the scheme is checked rather than revoked blindly.
   */
  function closePreview() {
    setPreviewModal((current) => {
      if (current?.url.startsWith("blob:")) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  function update(key: keyof ProfileValues, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !dirty || saving) return;
    const formData = new FormData(event.currentTarget);
    setSaving(true);
    const nextResult = await updateStudentProfile(formData);
    setResult(nextResult);
    setSaving(false);
    if (nextResult.success) {
      setEditing(false);
      setDirty(false);
      router.refresh();
    }
  }

  function handleAadhaarSubmit(e: FormEvent) {
    e.preventDefault();
    setAadhaarError(null);
    const formData = new FormData();
    formData.append("aadhaar", aadhaarInput.replace(/\s+/g, ""));
    startTransition(async () => {
      const res = await updateAadhaarAction(formData);
      if (res.error) {
        setAadhaarError(res.error);
      } else {
        setAadhaarModal(false);
        setAadhaarInput("");
        router.refresh();
      }
    });
  }

  function handlePanSubmit(e: FormEvent) {
    e.preventDefault();
    setPanError(null);
    const formData = new FormData();
    formData.append("pan", panInput.trim().toUpperCase());
    startTransition(async () => {
      const res = await updatePanAction(formData);
      if (res.error) {
        setPanError(res.error);
      } else {
        setPanModal(false);
        setPanInput("");
        router.refresh();
      }
    });
  }

  function handleUploadAadhaarDocSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAadhaarDocError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await uploadAadhaarDocAction(formData);
      if (res.error) {
        setAadhaarDocError(res.error);
      } else {
        setAadhaarDocModal(false);
        router.refresh();
      }
    });
  }

  function handleUploadPanDocSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPanDocError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await uploadPanDocAction(formData);
      if (res.error) {
        setPanDocError(res.error);
      } else {
        setPanDocModal(false);
        router.refresh();
      }
    });
  }

  async function handleUnlockSubmit(e: FormEvent) {
    e.preventDefault();
    if (!unlockDocModal) return;
    setUnlockError(null);
    setUnlocking(true);

    try {
      const res = await fetch(`/api/identity-docs/${unlockDocModal.type}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: unlockInput.trim() }),
      });

      if (!res.ok) {
        let errDetail = "Incorrect number. Document cannot be decrypted.";
        try {
          const json = await res.json();
          if (json.error) errDetail = json.error;
        } catch {}
        setUnlockError(errDetail);
        setUnlocking(false);
        return;
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPreviewModal({
        label: unlockDocModal.label,
        url: blobUrl,
        filename: unlockDocModal.fileName,
      });
      setUnlockDocModal(null);
      setUnlockInput("");
    } catch {
      setUnlockError("Failed to decrypt document. Please check the entered number.");
    } finally {
      setUnlocking(false);
    }
  }

  function handleDeleteAadhaarDoc() {
    if (!confirm("Are you sure you want to remove the uploaded Aadhaar document?")) return;
    startTransition(async () => {
      await deleteAadhaarDocAction();
      router.refresh();
    });
  }

  function handleCollegeIdSubmit(e: FormEvent) {
    e.preventDefault();
    setCollegeIdError(null);
    const formData = new FormData();
    formData.append("collegeId", collegeIdInput.trim().toUpperCase());
    startTransition(async () => {
      const res = await updateCollegeIdAction(formData);
      if (res.error) {
        setCollegeIdError(res.error);
      } else {
        setCollegeIdModal(false);
        setCollegeIdInput("");
        router.refresh();
      }
    });
  }

  function handleUploadCollegeIdDocSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCollegeIdDocError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await uploadCollegeIdDocAction(formData);
      if (res.error) {
        setCollegeIdDocError(res.error);
      } else {
        setCollegeIdDocModal(false);
        router.refresh();
      }
    });
  }

  function handleDeleteCollegeIdDoc() {
    if (!confirm("Are you sure you want to remove the uploaded College ID document?")) return;
    startTransition(async () => {
      await deleteCollegeIdDocAction();
      router.refresh();
    });
  }

  function handleDeletePanDoc() {
    if (!confirm("Are you sure you want to remove the uploaded PAN document?")) return;
    startTransition(async () => {
      await deletePanDocAction();
      router.refresh();
    });
  }

  function handleUploadResumeSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await uploadResume(formData);
      if (res.error) {
        setUploadError(res.error);
      } else {
        setUploadModal(false);
        setResumeLabel("");
        router.refresh();
      }
    });
  }

  function handleRenameSubmit(e: FormEvent) {
    e.preventDefault();
    if (!renameModal) return;
    setRenameError(null);
    startTransition(async () => {
      const res = await renameResumeAction(renameModal.id, renameInput);
      if (res.error) {
        setRenameError(res.error);
      } else {
        setRenameModal(null);
        setRenameInput("");
        router.refresh();
      }
    });
  }

  function handleDeleteResume(resumeId: string) {
    if (!confirm("Are you sure you want to delete this resume?")) return;
    startTransition(async () => {
      await deleteResumeAction(resumeId);
      router.refresh();
    });
  }

  function renderFields(fields: ProfileField[]) {
    return fields.map(({ key, label, type, options, step, min, max }) => {
      const locked = LOCKED_FIELDS.has(key);
      const disabled = locked || !editing;
      const error = result.fieldErrors?.[key]?.[0];
      const fieldId = `profile-${key}`;
      const title = ACADEMIC_LOCKED_FIELDS.has(key)
        ? "Contact the placement office to correct your CGPA or backlogs"
        : locked
          ? "Set by the placement office from the official roster"
          : undefined;
      const shared = {
        title,
        "aria-invalid": error ? (true as const) : undefined,
        "aria-errormessage": error ? `${key}-error` : undefined,
      };

      return (
        <div className={key === "currentAddress" ? "grid gap-2 sm:col-span-2" : "grid gap-2"} key={key}>
          <Label className="text-xs text-muted-foreground" htmlFor={fieldId}>
            {label}
          </Label>
          {options ? (
            <>
              {/* A Radix trigger is a button, so the value rides a hidden input
                  to reach FormData exactly as the native select used to. */}
              <input type="hidden" name={key} value={form[key]} disabled={disabled} />
              <Select
                disabled={disabled}
                value={form[key] || NOT_PROVIDED}
                onValueChange={(value) => update(key, value === NOT_PROVIDED ? "" : value)}
              >
                <SelectTrigger {...shared} className="w-full" id={fieldId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Every one of these fields is optional, so clearing stays possible. */}
                  <SelectItem value={NOT_PROVIDED}>Not provided</SelectItem>
                  {options.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : (
            <Input
              {...shared}
              disabled={disabled}
              id={fieldId}
              max={max}
              min={min}
              name={key}
              placeholder="Not provided"
              step={type === "number" ? (step ?? "any") : undefined}
              type={type}
              value={form[key]}
              onChange={(event) => update(key, event.target.value)}
            />
          )}
          {error ? (
            <small className="text-xs text-destructive" id={`${key}-error`}>
              {error}
            </small>
          ) : null}
        </div>
      );
    });
  }

  return (
    <>
      <form className="module-page profile-page" onSubmit={save}>
        <section className="profile-banner">
          <div className="profile-avatar">{profile.initials}</div>
          <div>
            <span className="eyebrow">Student profile</span>
            <h1>{form.name}</h1>
            <p>
              {form.rollNumber || "Roll number not added"} · {form.branch || "Branch not added"} ·{" "}
              {form.batch ? `Batch of ${form.batch}` : "Batch not added"}
            </p>
          </div>
          <div className="completion">
            <strong>{profile.completion}%</strong>
            <span>Profile complete</span>
            <i>
              {/* The only inline style left: the fill tracks a runtime figure. */}
              <b style={{ width: `${profile.completion}%` }} />
            </i>
          </div>
          {profile.canPersist ? (
            editing ? (
              <Button type="submit" variant="secondary" disabled={saving || !dirty}>
                <Save />
                {saving ? "Saving…" : dirty ? "Save changes" : "Change a field"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setResult({});
                  setDirty(false);
                  setEditing(true);
                }}
              >
                <Pencil />
                Edit profile
              </Button>
            )
          ) : null}
        </section>

        {!profile.canPersist ? (
          <Alert variant="info" className="mt-3.5">
            <AlertDescription>
              Development credential data is intentionally not stored. Sign in with Google to maintain a real profile.
            </AlertDescription>
          </Alert>
        ) : null}
        {result.success ? (
          <Alert variant="success" className="mt-3.5">
            <Check />
            <AlertDescription>{result.success}</AlertDescription>
          </Alert>
        ) : null}
        {result.error ? (
          <Alert variant="destructive" className="mt-3.5">
            <AlertDescription>{result.error}</AlertDescription>
          </Alert>
        ) : null}

        <section className="profile-grid">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <SectionIcon>
                  <UserRound className="size-[18px]" />
                </SectionIcon>
                <div>
                  <CardTitle>Personal details</CardTitle>
                  <CardDescription className="mt-0.5 text-xs">
                    Your identity and contact information
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {renderFields(personalFields)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <SectionIcon>
                  <GraduationCap className="size-[18px]" />
                </SectionIcon>
                <div>
                  <CardTitle>Academic details</CardTitle>
                  <CardDescription className="mt-0.5 text-xs">
                    Current program and performance
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {renderFields(academicFields)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <SectionIcon>
                  <Mail className="size-[18px]" />
                </SectionIcon>
                <div>
                  <CardTitle>Contact information</CardTitle>
                  <CardDescription className="mt-0.5 text-xs">
                    How the placement team reaches you
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label className="text-xs text-muted-foreground" htmlFor="profile-institute-email">
                  Institute email
                </Label>
                <Input disabled id="profile-institute-email" value={profile.email} />
              </div>
              {renderFields(contactFields)}
            </CardContent>
          </Card>

          {/* Identity Documents Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <SectionIcon>
                  <IdCard className="size-[18px]" />
                </SectionIcon>
                <div>
                  <CardTitle>Identity documents</CardTitle>
                  <CardDescription className="mt-0.5 text-xs">
                    Numbers and document files are encrypted at rest with AES-256-GCM
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              <IdentityDocumentRow
                title="Aadhaar card"
                icon={<IdCard className="size-4.5 shrink-0 text-[color:var(--blue)]" />}
                masked={profile.identityDocuments.aadhaarMasked}
                provided={profile.identityDocuments.aadhaarProvided}
                docProvided={Boolean(profile.identityDocuments.aadhaarDocProvided)}
                docFileName={profile.identityDocuments.aadhaarDocFileName}
                fallbackFileName="aadhaar_card.pdf"
                onEditNumber={() => {
                  setAadhaarError(null);
                  setAadhaarInput("");
                  setAadhaarModal(true);
                }}
                onPreview={() => {
                  setUnlockError(null);
                  setUnlockInput("");
                  setUnlockDocModal({
                    type: "aadhaar",
                    label: "Aadhaar Card Document",
                    fileName: profile.identityDocuments.aadhaarDocFileName || "aadhaar_card.pdf",
                  });
                }}
                onDelete={handleDeleteAadhaarDoc}
                onUpload={() => {
                  setAadhaarDocError(null);
                  setAadhaarDocModal(true);
                }}
              />

              <IdentityDocumentRow
                title="PAN card"
                icon={<FileText className="size-4.5 shrink-0 text-[color:var(--orange)]" />}
                masked={profile.identityDocuments.panMasked}
                provided={profile.identityDocuments.panProvided}
                docProvided={Boolean(profile.identityDocuments.panDocProvided)}
                docFileName={profile.identityDocuments.panDocFileName}
                fallbackFileName="pan_card.pdf"
                onEditNumber={() => {
                  setPanError(null);
                  setPanInput("");
                  setPanModal(true);
                }}
                onPreview={() => {
                  setUnlockError(null);
                  setUnlockInput("");
                  setUnlockDocModal({
                    type: "pan",
                    label: "PAN Card Document",
                    fileName: profile.identityDocuments.panDocFileName || "pan_card.pdf",
                  });
                }}
                onDelete={handleDeletePanDoc}
                onUpload={() => {
                  setPanDocError(null);
                  setPanDocModal(true);
                }}
              />

              <IdentityDocumentRow
                title="College ID card"
                icon={<GraduationCap className="size-4.5 shrink-0 text-[color:var(--navy)]" />}
                masked={profile.identityDocuments.collegeIdMasked}
                provided={profile.identityDocuments.collegeIdProvided}
                docProvided={Boolean(profile.identityDocuments.collegeIdDocProvided)}
                docFileName={profile.identityDocuments.collegeIdDocFileName}
                fallbackFileName="college_id.pdf"
                onEditNumber={() => {
                  setCollegeIdError(null);
                  setCollegeIdInput("");
                  setCollegeIdModal(true);
                }}
                onPreview={() => {
                  setUnlockError(null);
                  setUnlockInput("");
                  setUnlockDocModal({
                    type: "college-id",
                    label: "College ID Card Document",
                    fileName: profile.identityDocuments.collegeIdDocFileName || "college_id.pdf",
                  });
                }}
                onDelete={handleDeleteCollegeIdDoc}
                onUpload={() => {
                  setCollegeIdDocError(null);
                  setCollegeIdDocModal(true);
                }}
              />
            </CardContent>
          </Card>

          {/* Resumes Section */}
          <Card className="col-span-full">
            <CardHeader className="items-center">
              <div className="flex items-center gap-3">
                <SectionIcon>
                  <FileText className="size-[18px]" />
                </SectionIcon>
                <div>
                  <CardTitle>Resumes</CardTitle>
                  <CardDescription className="mt-0.5 text-xs">
                    Upload, manage, and preview your PDF resumes for applications
                  </CardDescription>
                </div>
              </div>
              <CardAction>
                <Button
                  type="button"
                  onClick={() => {
                    setUploadError(null);
                    setResumeLabel("");
                    setUploadModal(true);
                  }}
                >
                  <FilePlus />
                  Upload Resume
                </Button>
              </CardAction>
            </CardHeader>

            <CardContent className="grid gap-2.5">
              {profile.resumes.length ? (
                profile.resumes.map((resume) => (
                  <div
                    key={resume.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid shrink-0 place-items-center rounded-lg bg-[var(--badge-blue-bg)] p-2 text-[color:var(--blue)]">
                        <FileText className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <strong className="block truncate text-xs text-foreground">
                          {resume.label}
                        </strong>
                        <small className="text-[10px] text-muted-foreground">
                          {resume.name} · Uploaded {DATE_FMT.format(new Date(resume.uploadedAt))}
                        </small>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        title="Preview PDF"
                        onClick={() =>
                          setPreviewModal({
                            label: resume.label,
                            url: resume.fileUrl,
                            filename: resume.name,
                          })
                        }
                      >
                        <Eye />
                        Preview
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        title="Rename resume"
                        onClick={() => {
                          setRenameError(null);
                          setRenameInput(resume.label);
                          setRenameModal({ id: resume.id, currentLabel: resume.label });
                        }}
                      >
                        <Pencil />
                        Rename
                      </Button>

                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        title="Delete resume"
                        disabled={isPending}
                        onClick={() => handleDeleteResume(resume.id)}
                      >
                        <Trash2 />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty">
                  <FileText className="mx-auto mb-2 size-6 text-muted-foreground" />
                  <h3>No resumes uploaded yet</h3>
                  <p>
                    Upload your customized PDF resumes to easily apply to campus recruitment drives.
                  </p>
                  <Button
                    type="button"
                    className="mt-3"
                    onClick={() => {
                      setUploadError(null);
                      setResumeLabel("");
                      setUploadModal(true);
                    }}
                  >
                    <Plus />
                    Upload First Resume
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </form>

      {/* Aadhaar Number Update Modal */}
      {aadhaarModal && (
        <PortalDialog
          onClose={() => setAadhaarModal(false)}
          eyebrow="Identity Document"
          title="Update Aadhaar Card Number"
          className="sm:max-w-md"
        >
          <form className="grid gap-3" onSubmit={handleAadhaarSubmit}>
            {aadhaarError && (
              <Alert variant="destructive">
                <AlertDescription>{aadhaarError}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <Label htmlFor="aadhaar-number">12-digit Aadhaar Number</Label>
              <Input
                id="aadhaar-number"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={12}
                value={aadhaarInput}
                required
                className="tracking-widest"
                onChange={(e) => setAadhaarInput(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Aadhaar is encrypted using AES-256-GCM and never shared in plaintext.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAadhaarModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || aadhaarInput.length !== 12}>
                <Save />
                {isPending ? "Saving..." : "Save Aadhaar"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      )}

      {/* PAN Number Update Modal */}
      {panModal && (
        <PortalDialog
          onClose={() => setPanModal(false)}
          eyebrow="Identity Document"
          title="Update PAN Card Number"
          className="sm:max-w-md"
        >
          <form className="grid gap-3" onSubmit={handlePanSubmit}>
            {panError && (
              <Alert variant="destructive">
                <AlertDescription>{panError}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <Label htmlFor="pan-number">10-character PAN</Label>
              <Input
                id="pan-number"
                type="text"
                maxLength={10}
                value={panInput}
                required
                className="tracking-widest uppercase"
                onChange={(e) => setPanInput(e.target.value.toUpperCase())}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              PAN is encrypted using AES-256-GCM and stored securely.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPanModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || panInput.length !== 10}>
                <Save />
                {isPending ? "Saving..." : "Save PAN"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      )}

      {/* Upload Aadhaar Document File Modal */}
      {aadhaarDocModal && (
        <PortalDialog
          onClose={() => setAadhaarDocModal(false)}
          eyebrow="Encrypted Document Upload"
          title="Upload Aadhaar Card Document"
        >
          <form className="grid gap-3.5" onSubmit={handleUploadAadhaarDocSubmit}>
            {aadhaarDocError && (
              <Alert variant="destructive">
                <AlertDescription>{aadhaarDocError}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <Label htmlFor="aadhaar-doc-number">Confirm 12-digit Aadhaar Number</Label>
              <Input
                id="aadhaar-doc-number"
                name="aadhaar"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={12}
                required
                className="tracking-widest"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="aadhaar-doc-file">Aadhaar PDF Document (Max 5MB)</Label>
              <Input
                id="aadhaar-doc-file"
                name="file"
                type="file"
                accept="application/pdf"
                required
              />
            </div>

            <Alert variant="info">
              <ShieldCheck />
              <AlertDescription>
                The document file is encrypted with AES-256-GCM before saving and can only be unlocked by entering your full 12-digit Aadhaar number.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAadhaarDocModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                <UploadCloud />
                {isPending ? "Encrypting & Uploading..." : "Upload & Encrypt"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      )}

      {/* Upload PAN Document File Modal */}
      {panDocModal && (
        <PortalDialog
          onClose={() => setPanDocModal(false)}
          eyebrow="Encrypted Document Upload"
          title="Upload PAN Card Document"
        >
          <form className="grid gap-3.5" onSubmit={handleUploadPanDocSubmit}>
            {panDocError && (
              <Alert variant="destructive">
                <AlertDescription>{panDocError}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <Label htmlFor="pan-doc-number">Confirm 10-character PAN</Label>
              <Input
                id="pan-doc-number"
                name="pan"
                type="text"
                maxLength={10}
                required
                className="tracking-widest uppercase"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pan-doc-file">PAN PDF Document (Max 5MB)</Label>
              <Input id="pan-doc-file" name="file" type="file" accept="application/pdf" required />
            </div>

            <Alert variant="info">
              <ShieldCheck />
              <AlertDescription>
                The document file is encrypted with AES-256-GCM before saving and can only be unlocked by entering your full 10-character PAN.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPanDocModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                <UploadCloud />
                {isPending ? "Encrypting & Uploading..." : "Upload & Encrypt"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      )}

      {/* College ID number */}
      {collegeIdModal && (
        <PortalDialog
          onClose={() => setCollegeIdModal(false)}
          eyebrow="Identity Document"
          title="Update College ID Number"
          className="sm:max-w-md"
        >
          <form className="grid gap-3" onSubmit={handleCollegeIdSubmit}>
            {collegeIdError && (
              <Alert variant="destructive">
                <AlertDescription>{collegeIdError}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <Label htmlFor="college-id-number">College ID number</Label>
              <Input
                id="college-id-number"
                type="text"
                maxLength={20}
                value={collegeIdInput}
                required
                className="tracking-widest uppercase"
                onChange={(e) => setCollegeIdInput(e.target.value.toUpperCase())}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Usually your roll number as printed on the card. It is encrypted using AES-256-GCM and
              doubles as the challenge that unlocks the scan.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCollegeIdModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || collegeIdInput.trim().length < 4}>
                <Save />
                {isPending ? "Saving..." : "Save College ID"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      )}

      {/* Upload College ID Document File Modal */}
      {collegeIdDocModal && (
        <PortalDialog
          onClose={() => setCollegeIdDocModal(false)}
          eyebrow="Encrypted Document Upload"
          title="Upload College ID Card"
        >
          <form className="grid gap-3.5" onSubmit={handleUploadCollegeIdDocSubmit}>
            {collegeIdDocError && (
              <Alert variant="destructive">
                <AlertDescription>{collegeIdDocError}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <Label htmlFor="college-id-doc-number">Confirm College ID number</Label>
              <Input
                id="college-id-doc-number"
                name="collegeId"
                type="text"
                maxLength={20}
                required
                className="tracking-widest uppercase"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="college-id-doc-file">College ID PDF Document (Max 5MB)</Label>
              <Input
                id="college-id-doc-file"
                name="file"
                type="file"
                accept="application/pdf"
                required
              />
            </div>

            <Alert variant="info">
              <ShieldCheck />
              <AlertDescription>
                The document file is encrypted with AES-256-GCM before saving and can only be
                unlocked by entering your College ID number.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCollegeIdDocModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                <UploadCloud />
                {isPending ? "Encrypting & Uploading..." : "Upload & Encrypt"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      )}

      {/* Security Unlock Challenge Modal */}
      {unlockDocModal && (
        <PortalDialog
          onClose={() => setUnlockDocModal(null)}
          eyebrow="Security Challenge"
          title={`Unlock ${unlockDocModal.label}`}
          className="sm:max-w-md"
        >
          <form className="grid gap-3" onSubmit={handleUnlockSubmit}>
            <Card className="py-3">
              <CardContent className="flex items-center gap-2.5 px-3">
                <Lock className="size-5 shrink-0 text-[color:var(--navy)]" />
                <div className="min-w-0">
                  <strong className="block text-[11px] text-foreground">
                    End-to-End Encrypted File
                  </strong>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {unlockDocModal.fileName}
                  </span>
                </div>
              </CardContent>
            </Card>

            {unlockError && (
              <Alert variant="destructive">
                <AlertDescription>{unlockError}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-2">
              <Label htmlFor="unlock-number">
                Enter the full{" "}
                {unlockDocModal.type === "aadhaar"
                  ? "12-digit Aadhaar number"
                  : unlockDocModal.type === "pan"
                    ? "10-character PAN"
                    : "College ID number"}{" "}
                to decrypt
              </Label>
              <Input
                id="unlock-number"
                type="text"
                inputMode={unlockDocModal.type === "aadhaar" ? "numeric" : "text"}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={
                  unlockDocModal.type === "aadhaar" ? 12 : unlockDocModal.type === "pan" ? 10 : 20
                }
                value={unlockInput}
                required
                autoFocus
                className="tracking-[2px]"
                onChange={(e) =>
                  setUnlockInput(
                    unlockDocModal.type === "aadhaar"
                      ? e.target.value.replace(/[^0-9]/g, "")
                      : e.target.value.toUpperCase()
                  )
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This security verification prevents unauthorized viewing and decrypts the document
              on-demand in memory.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUnlockDocModal(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={unlocking || !unlockInput.trim()}>
                <ShieldCheck />
                {unlocking ? "Decrypting..." : "Decrypt & Preview"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      )}

      {/* Upload Resume Modal */}
      {uploadModal && (
        <PortalDialog
          onClose={() => setUploadModal(false)}
          eyebrow="Career Documents"
          title="Upload Resume"
        >
          <form className="grid gap-3.5" onSubmit={handleUploadResumeSubmit}>
            {uploadError && (
              <Alert variant="destructive">
                <AlertDescription>{uploadError}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <Label htmlFor="resume-label">Resume Label</Label>
              <Input
                id="resume-label"
                name="label"
                type="text"
                placeholder="e.g. SDE Resume / Backend Profile"
                value={resumeLabel}
                onChange={(e) => setResumeLabel(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="resume-file">PDF File (Max 5MB)</Label>
              <Input id="resume-file" name="file" type="file" accept="application/pdf" required />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUploadModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                <UploadCloud />
                {isPending ? "Uploading..." : "Upload"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      )}

      {/* Rename Resume Modal */}
      {renameModal && (
        <PortalDialog
          onClose={() => setRenameModal(null)}
          eyebrow="Manage Resume"
          title="Rename Resume Label"
          className="sm:max-w-md"
        >
          <form className="grid gap-3" onSubmit={handleRenameSubmit}>
            {renameError && (
              <Alert variant="destructive">
                <AlertDescription>{renameError}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <Label htmlFor="rename-label">New Label</Label>
              <Input
                id="rename-label"
                type="text"
                value={renameInput}
                required
                onChange={(e) => setRenameInput(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameModal(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !renameInput.trim()}>
                <Save />
                {isPending ? "Saving..." : "Update Label"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      )}

      {/* PDF Preview Modal */}
      {previewModal && (
        <PortalDialog
          onClose={closePreview}
          eyebrow="Document Preview"
          title={previewModal.label}
          description={previewModal.filename}
          className="flex h-[88vh] max-h-[88vh] flex-col sm:max-w-[1100px]"
        >
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-muted">
            <iframe
              className="size-full border-0"
              src={`${previewModal.url}#toolbar=1&navpanes=0`}
              title="Document PDF Preview"
            />
          </div>

          <DialogFooter className="sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <a
                  href={previewModal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in new window"
                >
                  <ExternalLink />
                  New Tab
                </a>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <a
                  href={previewModal.url}
                  download={previewModal.filename}
                  title="Download PDF"
                >
                  <Download />
                  Download
                </a>
              </Button>
            </div>
            <Button type="button" variant="outline" onClick={closePreview}>
              Close Preview
            </Button>
          </DialogFooter>
        </PortalDialog>
      )}
    </>
  );
}
