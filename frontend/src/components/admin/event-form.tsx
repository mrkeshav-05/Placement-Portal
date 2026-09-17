"use client";

import { Building2, CalendarDays, Check, ChevronDown, ListChecks } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { saveJobProfile, type JobProfileActionResult } from "@/app/admin/events/actions";
import { PickerModal } from "@/components/common/picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  JOB_CATEGORIES,
} from "@/lib/job-profile-schema";
import { GENDERS } from "@/lib/profile-schema";

export type EventCompanyOption = { id: string; name: string };
/** Branches the roster actually holds, grouped by the degree that offers them. */
export type EventBranchGroup = { degree: string; branches: string[] };

export type EventFormValues = {
  id: string;
  companyId: string;
  title: string;
  type: (typeof EMPLOYMENT_TYPES)[number];
  jobCategory: string | null;
  batch: number;
  placementYear: number;
  registrationDeadline: string;
  status: "DRAFT" | "ACTIVE" | "ENDED";
  minCGPA: number;
  maxBacklogs: number;
  maxBans: number;
  allowedDegrees: string[];
  allowedBranches: string[];
  allowedGenders: string[];
  locations: string[];
  ctcStipend: number | null;
  ctcStipendInfo: string | null;
  description: string | null;
  openingOverview: string | null;
  cap: string | null;
  companyBond: string | null;
  duration: string | null;
  redirectUrl: string | null;
};

const STATUS_LABELS: Record<EventFormValues["status"], string> = {
  DRAFT: "Draft — hidden from students",
  ACTIVE: "Active — visible and open",
  ENDED: "Ended — visible but closed",
};

const dayFormat = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** Quarter-hour slots for a whole day, the granularity deadlines are set at. */
const TIME_SLOTS = Array.from({ length: 96 }, (_, index) => ({
  hours: Math.floor(index / 4),
  minutes: (index % 4) * 15,
}));

function slotLabel(hours: number, minutes: number) {
  const sample = new Date(2000, 0, 1, hours, minutes);
  return timeFormat.format(sample);
}

function withTime(day: Date, hours: number, minutes: number) {
  const next = new Date(day);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/** A decade of seasons around the current one, newest years last. */
function yearOptions() {
  const current = new Date().getFullYear();
  return Array.from({ length: 10 }, (_, index) => current - 3 + index);
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** A field label above its control, with the asterisk the cell reads as required. */
function FieldLabel({
  children,
  required,
  htmlFor,
}: {
  children: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
}) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      {required ? <span className="text-destructive">*</span> : null}
    </Label>
  );
}

export function EventForm({
  companies,
  degrees,
  branchGroups,
  event,
}: {
  companies: EventCompanyOption[];
  degrees: string[];
  branchGroups: EventBranchGroup[];
  /** The drive being edited, or null on the add screen. */
  event: EventFormValues | null;
}) {
  const router = useRouter();
  const years = useMemo(() => yearOptions(), []);
  const nextSeason = new Date().getFullYear() + 1;

  const [companyId, setCompanyId] = useState(event?.companyId ?? "");
  const [placementYear, setPlacementYear] = useState(event?.placementYear ?? nextSeason);
  const [batch, setBatch] = useState<number | null>(event?.batch ?? null);
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [category, setCategory] = useState(event?.jobCategory ?? "");
  const [type, setType] = useState<EventFormValues["type"] | "">(event?.type ?? "");
  const [deadline, setDeadline] = useState<Date | null>(
    event ? new Date(event.registrationDeadline) : null,
  );
  const [allowedDegrees, setAllowedDegrees] = useState<string[]>(event?.allowedDegrees ?? []);
  const [allowedBranches, setAllowedBranches] = useState<string[]>(event?.allowedBranches ?? []);
  const [minCGPA, setMinCGPA] = useState(event ? String(event.minCGPA) : "");
  const [maxBacklogs, setMaxBacklogs] = useState(event ? String(event.maxBacklogs) : "");
  const [optionalOpen, setOptionalOpen] = useState(
    Boolean(event && (event.allowedGenders.length > 0 || event.maxBans > 0)),
  );
  const [allowedGenders, setAllowedGenders] = useState<string[]>(event?.allowedGenders ?? []);
  const [maxBans, setMaxBans] = useState(event ? String(event.maxBans) : "0");
  const [cap, setCap] = useState(event?.cap ?? "");
  const [companyBond, setCompanyBond] = useState(event?.companyBond ?? "");
  const [locations, setLocations] = useState(event?.locations.join(", ") ?? "");
  const [duration, setDuration] = useState(event?.duration ?? "");
  const [ctcStipend, setCtcStipend] = useState(event?.ctcStipend != null ? String(event.ctcStipend) : "");
  const [ctcStipendInfo, setCtcStipendInfo] = useState(event?.ctcStipendInfo ?? "");
  const [openingOverview, setOpeningOverview] = useState(event?.openingOverview ?? "");
  const [redirectUrl, setRedirectUrl] = useState(event?.redirectUrl ?? "");
  const [status, setStatus] = useState<EventFormValues["status"]>(event?.status ?? "DRAFT");

  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [degreePickerOpen, setDegreePickerOpen] = useState(false);
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const [branchQuery, setBranchQuery] = useState("");

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<JobProfileActionResult>({});

  const selectedCompany = companies.find((company) => company.id === companyId) ?? null;

  // Only the degrees on the drive contribute branches: a BTech-only opening
  // should not offer MTech streams.
  const offeredBranchGroups = useMemo(() => {
    const term = branchQuery.trim().toLowerCase();
    return branchGroups
      .filter((group) => allowedDegrees.length === 0 || allowedDegrees.includes(group.degree))
      .map((group) => ({
        degree: group.degree,
        branches: term
          ? group.branches.filter((branch) => branch.toLowerCase().includes(term))
          : group.branches,
      }))
      .filter((group) => group.branches.length > 0);
  }, [branchGroups, allowedDegrees, branchQuery]);

  function pickDegrees(next: string[]) {
    setAllowedDegrees(next);
    // A branch belongs to a degree; dropping the degree drops its branches.
    const reachable = new Set(
      branchGroups
        .filter((group) => next.length === 0 || next.includes(group.degree))
        .flatMap((group) => group.branches),
    );
    setAllowedBranches((previous) => previous.filter((branch) => reachable.has(branch)));
  }

  async function submit() {
    const formData = new FormData();
    formData.set("id", event?.id ?? "");
    formData.set("companyId", companyId);
    formData.set("title", title);
    formData.set("type", type);
    formData.set("jobCategory", category);
    formData.set("batch", batch == null ? "" : String(batch));
    formData.set("placementYear", String(placementYear));
    formData.set("registrationDeadline", deadline ? deadline.toISOString() : "");
    formData.set("status", status);
    formData.set("description", description);
    formData.set("openingOverview", openingOverview);
    formData.set("minCGPA", minCGPA || "0");
    formData.set("maxBacklogs", maxBacklogs || "0");
    formData.set("maxBans", optionalOpen ? maxBans || "0" : "0");
    formData.set("allowedDegrees", JSON.stringify(allowedDegrees));
    formData.set("allowedBranches", JSON.stringify(allowedBranches));
    formData.set("allowedGenders", JSON.stringify(optionalOpen ? allowedGenders : []));
    formData.set("locations", locations);
    formData.set("ctcStipend", ctcStipend);
    formData.set("ctcStipendInfo", ctcStipendInfo);
    formData.set("cap", cap);
    formData.set("companyBond", companyBond);
    formData.set("duration", duration);
    formData.set("redirectUrl", redirectUrl);

    setSaving(true);
    const next = await saveJobProfile(formData);
    setResult(next);
    setSaving(false);
    if (next.success) {
      router.push("/admin/events");
      router.refresh();
    }
  }

  const missing = [
    selectedCompany ? null : "company",
    title.trim() ? null : "job title",
    description.trim() ? null : "description",
    category ? null : "category",
    type ? null : "employment type",
    batch ? null : "batch",
    deadline ? null : "last date to apply",
    allowedDegrees.length ? null : "allowed degrees",
    allowedBranches.length ? null : "allowed branches",
  ].filter(Boolean) as string[];

  const blockedReason = companies.length
    ? null
    : "Add a company before creating its event.";

  /** Fills the active pill, so a choice does not read as a hover. */
  const pillFill =
    "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90";

  return (
    <div className="mt-[18px] grid gap-4">
      {blockedReason ? (
        <Alert>
          <AlertDescription>{blockedReason}</AlertDescription>
        </Alert>
      ) : null}
      {result.success ? (
        <Alert>
          <AlertDescription>{result.success}</AlertDescription>
        </Alert>
      ) : null}
      {result.error ? (
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <FieldLabel htmlFor="placement-year">Placement Year</FieldLabel>
          <Select
            value={String(placementYear)}
            onValueChange={(next) => setPlacementYear(Number(next))}
          >
            <SelectTrigger id="placement-year" className="w-full">
              <CalendarDays className="text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <FieldLabel required>Company</FieldLabel>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start font-normal"
            onClick={() => setCompanyPickerOpen(true)}
          >
            <Building2 className="text-muted-foreground" />
            <span className={selectedCompany ? "" : "text-muted-foreground"}>
              {selectedCompany?.name ?? "Select Company"}
            </span>
            {selectedCompany ? (
              <Check className="ml-auto opacity-60" />
            ) : (
              <ChevronDown className="ml-auto opacity-60" />
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <FieldLabel htmlFor="event-title" required>
          Job Title
        </FieldLabel>
        <Input
          id="event-title"
          value={title}
          maxLength={160}
          onChange={(input) => setTitle(input.target.value)}
          placeholder="Title of the Job"
        />
      </div>

      <div className="grid gap-2">
        <FieldLabel htmlFor="event-description" required>
          Description
        </FieldLabel>
        <Textarea
          id="event-description"
          value={description}
          rows={4}
          maxLength={5000}
          onChange={(input) => setDescription(input.target.value)}
          placeholder="Description of the Job"
        />
      </div>

      <div className="grid gap-2">
        <FieldLabel required>Category</FieldLabel>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={2}
          value={category}
          onValueChange={(next) => next && setCategory(next)}
        >
          {JOB_CATEGORIES.map((option) => (
            <ToggleGroupItem key={option} value={option} className={pillFill}>
              {option}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid gap-2">
        <FieldLabel required>Employment Type</FieldLabel>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={2}
          value={type}
          onValueChange={(next) => next && setType(next as EventFormValues["type"])}
        >
          {EMPLOYMENT_TYPES.map((option) => (
            <ToggleGroupItem key={option} value={option} className={pillFill}>
              {EMPLOYMENT_TYPE_LABELS[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <FieldLabel htmlFor="event-batch" required>
            Batch
          </FieldLabel>
          <Select
            value={batch == null ? "" : String(batch)}
            onValueChange={(next) => setBatch(Number(next))}
          >
            <SelectTrigger id="event-batch" className="w-full">
              <SelectValue placeholder="Select Batch" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <FieldLabel required>Last Date to Apply</FieldLabel>
          <Popover open={deadlineOpen} onOpenChange={setDeadlineOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-start font-normal">
                <CalendarDays className="text-muted-foreground" />
                <span className={deadline ? "" : "text-muted-foreground"}>
                  {deadline
                    ? `${dayFormat.format(deadline)} at ${timeFormat.format(deadline)}`
                    : "e.g. Tomorrow at 10am"}
                </span>
                {deadline ? (
                  <Check className="ml-auto opacity-60" />
                ) : (
                  <ChevronDown className="ml-auto opacity-60" />
                )}
              </Button>
            </PopoverTrigger>
            {/* The month grid beside the quarter-hour list, because a deadline
                is a day and a time and the office sets both in one visit. */}
            <PopoverContent align="end" className="flex w-auto gap-3 p-3">
              <DayPicker
                mode="single"
                selected={deadline ?? undefined}
                defaultMonth={deadline ?? undefined}
                disabled={{ before: startOfToday() }}
                onSelect={(day) => {
                  if (!day) return;
                  setDeadline((previous) =>
                    withTime(day, previous?.getHours() ?? 23, previous?.getMinutes() ?? 45),
                  );
                }}
              />
              <div className="grid content-start gap-2 border-l pl-3">
                <Label>Time</Label>
                <ScrollArea className="h-60 w-28">
                  <div className="grid gap-1 pr-2">
                    {TIME_SLOTS.map(({ hours, minutes }) => {
                      const active =
                        deadline?.getHours() === hours && deadline?.getMinutes() === minutes;
                      return (
                        <Button
                          type="button"
                          key={`${hours}-${minutes}`}
                          size="sm"
                          variant={active ? "default" : "ghost"}
                          className="justify-start font-normal"
                          onClick={() =>
                            setDeadline((previous) =>
                              withTime(previous ?? startOfToday(), hours, minutes),
                            )
                          }
                        >
                          {slotLabel(hours, minutes)}
                        </Button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid gap-2">
        <FieldLabel required>Allowed Degrees</FieldLabel>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start font-normal"
          onClick={() => setDegreePickerOpen(true)}
        >
          <ListChecks className="text-muted-foreground" />
          <span className={allowedDegrees.length ? "" : "text-muted-foreground"}>
            {allowedDegrees.length ? allowedDegrees.join(", ") : "Select Degrees"}
          </span>
          {allowedDegrees.length ? (
            <Check className="ml-auto opacity-60" />
          ) : (
            <ChevronDown className="ml-auto opacity-60" />
          )}
        </Button>
      </div>

      <div className="grid gap-2">
        <FieldLabel required>Allowed Branches</FieldLabel>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start font-normal"
          disabled={allowedDegrees.length === 0}
          title={allowedDegrees.length ? "Select branches" : "Choose the degrees first"}
          onClick={() => {
            setBranchQuery("");
            setBranchPickerOpen(true);
          }}
        >
          <ListChecks className="text-muted-foreground" />
          <span className={allowedBranches.length ? "truncate" : "text-muted-foreground"}>
            {allowedBranches.length
              ? `${allowedBranches.length} selected · ${allowedBranches.join(", ")}`
              : "Select Branches"}
          </span>
          {allowedBranches.length ? (
            <Check className="ml-auto opacity-60" />
          ) : (
            <ChevronDown className="ml-auto opacity-60" />
          )}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <FieldLabel htmlFor="event-cgpa">CGPA</FieldLabel>
          <Input
            id="event-cgpa"
            value={minCGPA}
            type="number"
            min={0}
            max={10}
            step="0.01"
            onChange={(input) => setMinCGPA(input.target.value)}
            placeholder="Minimum CGPA"
          />
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="event-backlogs">Backlogs</FieldLabel>
          <Input
            id="event-backlogs"
            value={maxBacklogs}
            type="number"
            min={0}
            step="1"
            onChange={(input) => setMaxBacklogs(input.target.value)}
            placeholder="Maximum Backlogs"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="optional-eligibility"
          checked={optionalOpen}
          onCheckedChange={setOptionalOpen}
        />
        <Label htmlFor="optional-eligibility">Enable Optional Eligibility Criteria</Label>
      </div>

      {optionalOpen ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <FieldLabel>Allowed Genders</FieldLabel>
            <ToggleGroup
              type="multiple"
              variant="outline"
              spacing={2}
              value={allowedGenders}
              onValueChange={setAllowedGenders}
            >
              {GENDERS.map((gender) => (
                <ToggleGroupItem key={gender} value={gender} className={pillFill}>
                  {gender}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="text-muted-foreground text-xs">
              Leave both unpicked to open the drive to everyone.
            </p>
          </div>
          <div className="grid gap-2">
            <FieldLabel htmlFor="event-bans">Maximum Placement Bans</FieldLabel>
            <Input
              id="event-bans"
              value={maxBans}
              type="number"
              min={0}
              step="1"
              onChange={(input) => setMaxBans(input.target.value)}
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <FieldLabel htmlFor="event-cap">Cap</FieldLabel>
          <Input
            id="event-cap"
            value={cap}
            maxLength={100}
            onChange={(input) => setCap(input.target.value)}
            placeholder="Enter CAP"
          />
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="event-bond">Company Bond</FieldLabel>
          <Input
            id="event-bond"
            value={companyBond}
            maxLength={200}
            onChange={(input) => setCompanyBond(input.target.value)}
            placeholder="e.g. 2 years bond"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <FieldLabel htmlFor="event-locations" required>
            Place of Posting
          </FieldLabel>
          <Input
            id="event-locations"
            value={locations}
            onChange={(input) => setLocations(input.target.value)}
            placeholder="e.g. Bengaluru, Remote"
          />
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="event-duration">Duration</FieldLabel>
          <Input
            id="event-duration"
            value={duration}
            maxLength={100}
            onChange={(input) => setDuration(input.target.value)}
            placeholder="e.g. 6 months, leave blank for placement"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <FieldLabel htmlFor="event-ctc">CTC / Stipend</FieldLabel>
        <Input
          id="event-ctc"
          value={ctcStipend}
          type="number"
          min={0}
          step="any"
          onChange={(input) => setCtcStipend(input.target.value)}
          placeholder="e.g. 1200000"
        />
      </div>

      <div className="grid gap-2">
        <FieldLabel htmlFor="event-ctc-info">Additional CTC / Stipend Info</FieldLabel>
        <Input
          id="event-ctc-info"
          value={ctcStipendInfo}
          maxLength={500}
          onChange={(input) => setCtcStipendInfo(input.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <FieldLabel htmlFor="event-overview">Additional Info</FieldLabel>
        <Textarea
          id="event-overview"
          value={openingOverview}
          rows={4}
          maxLength={10000}
          onChange={(input) => setOpeningOverview(input.target.value)}
          placeholder="Any other info or instructions…"
        />
      </div>

      <div className="grid gap-2">
        <FieldLabel htmlFor="event-redirect">Optional Redirect Link</FieldLabel>
        <Input
          id="event-redirect"
          value={redirectUrl}
          maxLength={500}
          onChange={(input) => setRedirectUrl(input.target.value)}
          placeholder="https://careers.example.com/apply"
        />
      </div>

      <div className="grid gap-2">
        <FieldLabel>Visibility</FieldLabel>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={2}
          value={status}
          onValueChange={(next) => next && setStatus(next as EventFormValues["status"])}
        >
          {(Object.keys(STATUS_LABELS) as EventFormValues["status"][]).map((option) => (
            <ToggleGroupItem key={option} value={option} className={pillFill}>
              {STATUS_LABELS[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid justify-items-end gap-2">
        {missing.length ? (
          <p className="text-muted-foreground text-xs">Still needed: {missing.join(", ")}.</p>
        ) : null}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/admin/events")}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving || missing.length > 0 || Boolean(blockedReason)}
            onClick={submit}
          >
            {saving ? "Saving…" : event ? "Save changes" : "Create event"}
          </Button>
        </div>
      </div>

      {/* The company list is searched rather than scrolled, so it is a command
          palette instead of the plain button list it used to be. */}
      <Dialog open={companyPickerOpen} onOpenChange={setCompanyPickerOpen}>
        <DialogContent className="p-0 sm:max-w-[520px]">
          <DialogHeader className="sr-only">
            <DialogTitle>Select a Company</DialogTitle>
          </DialogHeader>
          <Command>
            <CommandInput placeholder="Search companies…" />
            <CommandList>
              <CommandEmpty>No company matches that search.</CommandEmpty>
              {companies.map((company) => (
                <CommandItem
                  key={company.id}
                  value={company.name}
                  onSelect={() => {
                    setCompanyId(company.id);
                    setCompanyPickerOpen(false);
                  }}
                >
                  {company.name}
                  {company.id === companyId ? <Check className="ml-auto" /> : null}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      {degreePickerOpen ? (
        <PickerModal
          title="Select Degrees"
          onClose={() => setDegreePickerOpen(false)}
          footer={
            <Button type="button" onClick={() => setDegreePickerOpen(false)}>
              Continue
            </Button>
          }
        >
          {degrees.length ? (
            <div className="grid gap-2">
              <label className="hover:bg-accent flex items-center gap-3 rounded-md border p-3 text-sm font-semibold">
                <Checkbox
                  checked={allowedDegrees.length === degrees.length}
                  onCheckedChange={() =>
                    pickDegrees(allowedDegrees.length === degrees.length ? [] : [...degrees])
                  }
                />
                Select All
              </label>
              {degrees.map((degree) => (
                <label
                  key={degree}
                  className="hover:bg-accent flex items-center gap-3 rounded-md border p-3 text-sm font-medium"
                >
                  <Checkbox
                    checked={allowedDegrees.includes(degree)}
                    onCheckedChange={() => pickDegrees(toggle(allowedDegrees, degree))}
                  />
                  {degree}
                </label>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              The student roster carries no degrees yet, so there is nothing to allow. Import
              students first.
            </p>
          )}
        </PickerModal>
      ) : null}

      {branchPickerOpen ? (
        <PickerModal
          title="Select Branches"
          onClose={() => setBranchPickerOpen(false)}
          footer={
            <>
              <Button type="button" onClick={() => setBranchPickerOpen(false)}>
                Continue
              </Button>
              <small className="text-muted-foreground">
                Clearing a degree above also clears the branches it offered.
              </small>
            </>
          }
        >
          <div className="flex gap-2">
            <Input
              autoFocus
              value={branchQuery}
              onChange={(input) => setBranchQuery(input.target.value)}
              placeholder="Search branches…"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setAllowedBranches([])}
              aria-label="Clear every selected branch"
            >
              <span aria-hidden="true">×</span>
            </Button>
          </div>
          <ScrollArea className="max-h-[380px]">
            {offeredBranchGroups.length ? (
              offeredBranchGroups.map((group) => {
                const allPicked = group.branches.every((branch) =>
                  allowedBranches.includes(branch),
                );
                return (
                  <div className="grid gap-2 py-2" key={group.degree}>
                    <header className="flex items-center justify-between gap-2">
                      <strong className="text-sm">{group.degree}</strong>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          setAllowedBranches((previous) =>
                            allPicked
                              ? previous.filter((branch) => !group.branches.includes(branch))
                              : [...new Set([...previous, ...group.branches])],
                          )
                        }
                      >
                        {allPicked ? "Clear" : "Select All"}
                      </Button>
                    </header>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {group.branches.map((branch) => (
                        <label
                          key={`${group.degree}-${branch}`}
                          className="hover:bg-accent flex items-center gap-3 rounded-md border p-3 text-sm font-medium"
                        >
                          <Checkbox
                            checked={allowedBranches.includes(branch)}
                            onCheckedChange={() =>
                              setAllowedBranches((previous) => toggle(previous, branch))
                            }
                          />
                          {branch}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-muted-foreground text-sm">
                {branchQuery.trim()
                  ? `No branch matches “${branchQuery.trim()}”.`
                  : "The selected degrees have no branches on the roster yet."}
              </p>
            )}
          </ScrollArea>
        </PickerModal>
      ) : null}
    </div>
  );
}
