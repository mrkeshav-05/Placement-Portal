"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  saveOfferBulkAction,
  type OfferBulkActionResult,
} from "@/app/admin/placement-records/actions";
import type { CompanyOption, JobOption } from "@/components/admin/placement-records-manager";
import { CompanySelect } from "@/components/common/company-select";
import { COMPANY_OPTIONS } from "@/lib/company-options";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  isCtcType,
  OFFER_SOURCE_LABELS,
  OFFER_STATUS_LABELS,
  OFFER_TYPE_LABELS,
  parseRollNumbers,
  type OfferSource,
  type OfferStatus,
  type OfferType,
} from "@/lib/offer-schema";

/** Radix has no empty option value, so "no drive" is carried as a sentinel. */
const NO_DRIVE = "__none";

/** Seasons around the current one, the same window the company form offers. */
function seasonOptions() {
  const current = new Date().getFullYear();
  return Array.from({ length: 10 }, (_, index) => current - 2 + index);
}

export function PlacementRecordsBulkForm({
  companies,
  jobs,
  backendError,
}: {
  companies: CompanyOption[];
  jobs: JobOption[];
  backendError: string | null;
}) {
  const router = useRouter();
  const seasons = useMemo(() => seasonOptions(), []);

  const [batch, setBatch] = useState(new Date().getFullYear() + 1);
  const [companyId, setCompanyId] = useState("");
  const [jobProfileId, setJobProfileId] = useState("");
  const [source, setSource] = useState<OfferSource>("ON_CAMPUS");
  const [type, setType] = useState<OfferType>("FTE");
  const [status, setStatus] = useState<OfferStatus>("OFFERED");
  const [amount, setAmount] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [rollNumbers, setRollNumbers] = useState<string[]>([]);
  const [rollInput, setRollInput] = useState("");

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<OfferBulkActionResult>({});

  // Only this company's drives, and only for the season being recorded: a
  // drive from another company would attach the record to the wrong pipeline.
  const drives = useMemo(
    () => jobs.filter((job) => job.companyId === companyId && job.batch === batch),
    [jobs, companyId, batch],
  );

  function selectCompany(nextId: string) {
    setCompanyId(nextId);
    // The drive belonged to the previous company.
    setJobProfileId("");
  }

  function selectSource(next: OfferSource) {
    setSource(next);
    // A drive is a portal-run, on-campus process by definition — an
    // off-campus or hackathon record has no drive to link.
    if (next !== "ON_CAMPUS") setJobProfileId("");
  }

  function selectDrive(value: string) {
    const nextId = value === NO_DRIVE ? "" : value;
    setJobProfileId(nextId);
    // The drive's title is the usual answer for the role, but it stays
    // editable: an offer can be for a role the drive was not named after.
    const drive = jobs.find((job) => job.id === nextId);
    if (drive && !jobTitle.trim()) setJobTitle(drive.title);
  }

  function addRollNumbers() {
    const parsed = parseRollNumbers(rollInput);
    if (!parsed.length) return;
    setRollNumbers((current) => [...new Set([...current, ...parsed])]);
    setRollInput("");
  }

  function removeRollNumber(roll: string) {
    setRollNumbers((current) => current.filter((value) => value !== roll));
  }

  async function submit() {
    const formData = new FormData();
    // `companyId` holds either a real company's id (picked from the list) or
    // a plain name with no Company row yet (an off-campus/hackathon
    // recruiter) — only one of these two fields is ever meaningful.
    const isExistingCompany = companies.some((company) => company.id === companyId);
    formData.set("companyId", isExistingCompany ? companyId : "");
    formData.set("companyName", isExistingCompany ? "" : companyId);
    formData.set("jobProfileId", jobProfileId);
    formData.set("source", source);
    formData.set("type", type);
    formData.set("status", status);
    formData.set("jobTitle", jobTitle);
    formData.set("batch", String(batch));
    formData.set(isCtcType(type) ? "ctc" : "stipend", amount);
    formData.set("location", location);
    formData.set("remarks", notes);
    formData.set("rollNumbers", rollNumbers.join(","));

    setSaving(true);
    const next = await saveOfferBulkAction(formData);
    setResult(next);
    setSaving(false);

    if (next.created) {
      // Anything skipped stays on screen to be corrected, so the form is only
      // cleared of what was actually written.
      const rejected = new Set((next.skipped ?? []).map((entry) => entry.rollNumber));
      setRollNumbers((current) => current.filter((roll) => rejected.has(roll)));
      router.refresh();
    }
  }

  const missing = [
    companyId ? null : "company",
    jobTitle.trim() ? null : "job title",
    amount.trim() ? null : isCtcType(type) ? "annual CTC" : "monthly stipend",
    rollNumbers.length ? null : "at least one roll number",
  ].filter(Boolean) as string[];

  const amountLabel = isCtcType(type) ? "Annual CTC (₹)" : "Monthly stipend (₹)";

  return (
    <div className="grid gap-[18px]">
      {backendError ? (
        <Alert variant="destructive">
          <AlertDescription>{backendError}</AlertDescription>
        </Alert>
      ) : null}
      {result.success ? (
        <Alert variant="success">
          <AlertDescription>{result.success}</AlertDescription>
        </Alert>
      ) : null}
      {result.error ? (
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : null}

      {result.skipped?.length ? (
        <Alert variant="info">
          <AlertDescription>
            <strong>
              {result.skipped.length} roll number{result.skipped.length === 1 ? "" : "s"} skipped
            </strong>
            <ul className="mt-1.5 grid gap-1">
              {result.skipped.map((entry) => (
                <li key={entry.rollNumber}>
                  <b>{entry.rollNumber}</b> — {entry.reason}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Record Configuration</CardTitle>
          <CardDescription>
            These apply to every record created in this session.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-2">
            <Label htmlFor="bulk-season">
              Placement Season <span className="text-destructive">*</span>
            </Label>
            <Select value={String(batch)} onValueChange={(next) => setBatch(Number(next))}>
              <SelectTrigger id="bulk-season" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {seasons.map((season) => (
                  <SelectItem key={season} value={String(season)}>
                    {season}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bulk-company">
              Company <span className="text-destructive">*</span>
            </Label>
            <CompanySelect
              id="bulk-company"
              options={companies}
              suggestions={COMPANY_OPTIONS}
              value={companyId}
              onChange={selectCompany}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bulk-source">
              Recruitment Source <span className="text-destructive">*</span>
            </Label>
            <Select value={source} onValueChange={(next) => selectSource(next as OfferSource)}>
              <SelectTrigger id="bulk-source" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(OFFER_SOURCE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bulk-drive">Company Event</Label>
            <Select
              value={jobProfileId || NO_DRIVE}
              onValueChange={selectDrive}
              disabled={source !== "ON_CAMPUS"}
            >
              <SelectTrigger id="bulk-drive" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DRIVE}>Not from a portal drive</SelectItem>
                {drives.map((drive) => (
                  <SelectItem key={drive.id} value={drive.id}>
                    {drive.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {source !== "ON_CAMPUS"
                ? "Only an on-campus record can link to a portal drive."
                : companyId
                  ? drives.length
                    ? "Links each record to the drive it came from."
                    : `No ${batch} drives for this company.`
                  : "Select a company to list its drives."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Values for New Records</CardTitle>
          <CardDescription>
            A placement or pre-placement offer carries an annual CTC; an internship carries a
            monthly stipend.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="bulk-type">
              Type <span className="text-destructive">*</span>
            </Label>
            <Select value={type} onValueChange={(next) => setType(next as OfferType)}>
              <SelectTrigger id="bulk-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(OFFER_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bulk-status">
              Status <span className="text-destructive">*</span>
            </Label>
            <Select value={status} onValueChange={(next) => setStatus(next as OfferStatus)}>
              <SelectTrigger id="bulk-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(OFFER_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bulk-amount">
              {amountLabel} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="bulk-amount"
              type="number"
              min={0}
              step="any"
              value={amount}
              onChange={(input) => setAmount(input.target.value)}
              placeholder={isCtcType(type) ? "1800000" : "75000"}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bulk-job-title">
              Job Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="bulk-job-title"
              value={jobTitle}
              maxLength={200}
              onChange={(input) => setJobTitle(input.target.value)}
              placeholder="Associate Engineer"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bulk-location">Location</Label>
            <Input
              id="bulk-location"
              value={location}
              maxLength={200}
              onChange={(input) => setLocation(input.target.value)}
              placeholder="Bengaluru"
            />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="bulk-notes">Notes</Label>
            <Textarea
              id="bulk-notes"
              value={notes}
              rows={3}
              maxLength={2000}
              onChange={(input) => setNotes(input.target.value)}
              placeholder="Anything the office needs on file about this drive's outcome."
            />
            <p className="text-muted-foreground text-xs">
              Applied to every record created in this session.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Students</CardTitle>
          <CardDescription>
            Roll numbers, separated by commas, spaces, or newlines. A paste from a spreadsheet
            column works as it is.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap items-start gap-2">
            <Input
              id="bulk-roll-numbers"
              className="flex-1 basis-80"
              value={rollInput}
              onChange={(input) => setRollInput(input.target.value)}
              onKeyDown={(event) => {
                // Enter adds, rather than submitting: the button below writes
                // records, and one stray keystroke should not.
                if (event.key === "Enter") {
                  event.preventDefault();
                  addRollNumbers();
                }
              }}
              placeholder="2023UCS1632, 2023UME4018"
              aria-label="Roll numbers to add"
            />
            <Button type="button" variant="outline" onClick={addRollNumbers}>
              <Plus />
              Add
            </Button>
          </div>

          {rollNumbers.length ? (
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>
                  {rollNumbers.length} student{rollNumbers.length === 1 ? "" : "s"} added
                </Label>
                <Button type="button" variant="ghost" onClick={() => setRollNumbers([])}>
                  Clear all
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {rollNumbers.map((roll) => (
                  <Badge key={roll} variant="secondary" className="gap-1 pr-1">
                    {roll}
                    <button
                      type="button"
                      onClick={() => removeRollNumber(roll)}
                      aria-label={`Remove ${roll}`}
                      className="hover:text-destructive cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No students added yet. Roll numbers are matched against the roster, and any that
              are not found are reported back rather than silently dropped.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid justify-items-end gap-2">
        {missing.length ? (
          <p className="text-muted-foreground text-xs">Still needed: {missing.join(", ")}.</p>
        ) : null}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/placement-records")}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving || missing.length > 0 || Boolean(backendError)}
            onClick={submit}
          >
            {saving
              ? "Creating…"
              : `Create ${rollNumbers.length} record${rollNumbers.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
