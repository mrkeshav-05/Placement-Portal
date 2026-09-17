"use client";

import {
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  GraduationCap,
  ListChecks,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { saveJobProfile, type JobProfileActionResult } from "@/app/admin/events/actions";
import { PickerModal, useDismissOnOutsideClick } from "@/components/common/picker";
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

  const [yearOpen, setYearOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [companyQuery, setCompanyQuery] = useState("");
  const [degreePickerOpen, setDegreePickerOpen] = useState(false);
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const [branchQuery, setBranchQuery] = useState("");

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<JobProfileActionResult>({});

  const yearRef = useDismissOnOutsideClick(() => setYearOpen(false));
  const batchRef = useDismissOnOutsideClick(() => setBatchOpen(false));
  const deadlineRef = useDismissOnOutsideClick(() => setDeadlineOpen(false));

  const selectedCompany = companies.find((company) => company.id === companyId) ?? null;

  const filteredCompanies = useMemo(() => {
    const term = companyQuery.trim().toLowerCase();
    return term ? companies.filter((company) => company.name.toLowerCase().includes(term)) : companies;
  }, [companies, companyQuery]);

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

  return (
    <div className="event-form">
      {blockedReason ? <div className="admin-info">{blockedReason}</div> : null}
      {result.success ? <div className="admin-success">{result.success}</div> : null}
      {result.error ? <div className="admin-error">{result.error}</div> : null}

      <div className="event-form-row two">
        <div className="event-picker" ref={yearRef}>
          <button
            type="button"
            className="composer-field filled"
            onClick={() => setYearOpen((open) => !open)}
          >
            <CalendarDays />
            <span>Placement Year</span>
            <b className="field-value">{placementYear}</b>
            <ChevronDown className={yearOpen ? "tick open" : "tick"} />
          </button>
          {yearOpen ? (
            <div className="composer-dropdown">
              {years.map((year) => (
                <button
                  type="button"
                  key={year}
                  className={`dropdown-option${year === placementYear ? " selected" : ""}`}
                  onClick={() => {
                    setPlacementYear(year);
                    setYearOpen(false);
                  }}
                >
                  {year}
                  {year === placementYear ? <Check /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className={`composer-field${selectedCompany ? " filled" : ""}`}
          onClick={() => {
            setCompanyQuery("");
            setCompanyPickerOpen(true);
          }}
        >
          <Building2 />
          <span>{selectedCompany?.name ?? "Select Company"}</span>
          {selectedCompany ? <Check className="tick" /> : <ChevronDown className="tick" />}
        </button>
      </div>

      <label className="event-field">
        <span className="field-label required">Job Title</span>
        <input
          value={title}
          maxLength={160}
          onChange={(input) => setTitle(input.target.value)}
          placeholder="Title of the Job"
        />
      </label>

      <label className="event-field">
        <span className="field-label required">Description</span>
        <textarea
          value={description}
          rows={4}
          maxLength={5000}
          onChange={(input) => setDescription(input.target.value)}
          placeholder="Description of the Job"
        />
      </label>

      <div className="event-field">
        <span className="field-label required">Category</span>
        <div className="choice-row">
          {JOB_CATEGORIES.map((option) => (
            <button
              type="button"
              key={option}
              className={`choice-pill${category === option ? " selected" : ""}`}
              aria-pressed={category === option}
              onClick={() => setCategory(option)}
            >
              <i />
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="event-field">
        <span className="field-label required">Employment Type</span>
        <div className="choice-row">
          {EMPLOYMENT_TYPES.map((option) => (
            <button
              type="button"
              key={option}
              className={`choice-pill${type === option ? " selected" : ""}`}
              aria-pressed={type === option}
              onClick={() => setType(option)}
            >
              <i />
              {EMPLOYMENT_TYPE_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="event-form-row two">
        <div className="event-field">
          <span className="field-label required">Batch</span>
          <div className="event-picker" ref={batchRef}>
            <button
              type="button"
              className={`composer-field${batch ? " filled" : ""}`}
              onClick={() => setBatchOpen((open) => !open)}
            >
              <GraduationCap />
              <span>Select Batch</span>
              <b className="field-value">{batch ?? "--"}</b>
              <ChevronDown className={batchOpen ? "tick open" : "tick"} />
            </button>
            {batchOpen ? (
              <div className="composer-dropdown">
                {years.map((year) => (
                  <button
                    type="button"
                    key={year}
                    className={`dropdown-option${year === batch ? " selected" : ""}`}
                    onClick={() => {
                      setBatch(year);
                      setBatchOpen(false);
                    }}
                  >
                    {year}
                    {year === batch ? <Check /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="event-field">
          <span className="field-label required">Last Date to Apply</span>
          <div className="event-picker" ref={deadlineRef}>
            <button
              type="button"
              className={`composer-field${deadline ? " filled" : ""}`}
              onClick={() => setDeadlineOpen((open) => !open)}
            >
              <CalendarDays />
              <span>
                {deadline
                  ? `${dayFormat.format(deadline)} at ${timeFormat.format(deadline)}`
                  : "e.g. Tomorrow at 10am"}
              </span>
              {deadline ? <Check className="tick" /> : <ChevronDown className="tick" />}
            </button>
            {deadlineOpen ? (
              <div className="composer-dropdown deadline-popover">
                <DayPicker
                  mode="single"
                  selected={deadline ?? undefined}
                  defaultMonth={deadline ?? undefined}
                  disabled={{ before: startOfToday() }}
                  onSelect={(day) => {
                    if (!day) return;
                    setDeadline((previous) =>
                      withTime(
                        day,
                        previous?.getHours() ?? 23,
                        previous?.getMinutes() ?? 45,
                      ),
                    );
                  }}
                />
                <div className="time-column">
                  <span className="field-label">Time</span>
                  <div className="time-list">
                    {TIME_SLOTS.map(({ hours, minutes }) => {
                      const active =
                        deadline?.getHours() === hours && deadline?.getMinutes() === minutes;
                      return (
                        <button
                          type="button"
                          key={`${hours}-${minutes}`}
                          className={active ? "selected" : ""}
                          onClick={() =>
                            setDeadline((previous) =>
                              withTime(previous ?? startOfToday(), hours, minutes),
                            )
                          }
                        >
                          {slotLabel(hours, minutes)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="event-field">
        <span className="field-label required">Allowed Degrees</span>
        <button
          type="button"
          className={`composer-field${allowedDegrees.length ? " filled" : ""}`}
          onClick={() => setDegreePickerOpen(true)}
        >
          <GraduationCap />
          <span>{allowedDegrees.length ? allowedDegrees.join(", ") : "Select Degrees"}</span>
          {allowedDegrees.length ? <Check className="tick" /> : <ChevronDown className="tick" />}
        </button>
      </div>

      <div className="event-field">
        <span className="field-label required">Allowed Branches</span>
        <button
          type="button"
          className={`composer-field${allowedBranches.length ? " filled" : ""}`}
          disabled={allowedDegrees.length === 0}
          title={allowedDegrees.length ? "Select branches" : "Choose the degrees first"}
          onClick={() => {
            setBranchQuery("");
            setBranchPickerOpen(true);
          }}
        >
          <ListChecks />
          <span>
            {allowedBranches.length
              ? `${allowedBranches.length} selected · ${allowedBranches.join(", ")}`
              : "Select Branches"}
          </span>
          {allowedBranches.length ? <Check className="tick" /> : <ChevronDown className="tick" />}
        </button>
      </div>

      <div className="event-form-row two">
        <label className="event-field">
          <span className="field-label">CGPA</span>
          <input
            value={minCGPA}
            type="number"
            min={0}
            max={10}
            step="0.01"
            onChange={(input) => setMinCGPA(input.target.value)}
            placeholder="Minimum CGPA"
          />
        </label>
        <label className="event-field">
          <span className="field-label">Backlogs</span>
          <input
            value={maxBacklogs}
            type="number"
            min={0}
            step="1"
            onChange={(input) => setMaxBacklogs(input.target.value)}
            placeholder="Maximum Backlogs"
          />
        </label>
      </div>

      <div className="switch-field">
        <span className="field-label">Enable Optional Eligibility Criteria</span>
        <button
          type="button"
          role="switch"
          aria-checked={optionalOpen}
          className={`switch${optionalOpen ? " on" : ""}`}
          onClick={() => setOptionalOpen((open) => !open)}
        >
          <i />
        </button>
      </div>

      {optionalOpen ? (
        <div className="event-form-row two">
          <div className="event-field">
            <span className="field-label">Allowed Genders</span>
            <div className="choice-row">
              {GENDERS.map((gender) => (
                <button
                  type="button"
                  key={gender}
                  className={`choice-pill${allowedGenders.includes(gender) ? " selected" : ""}`}
                  aria-pressed={allowedGenders.includes(gender)}
                  onClick={() => setAllowedGenders((previous) => toggle(previous, gender))}
                >
                  <i />
                  {gender}
                </button>
              ))}
            </div>
            <small className="field-hint">Leave both unpicked to open the drive to everyone.</small>
          </div>
          <label className="event-field">
            <span className="field-label">Maximum Placement Bans</span>
            <input
              value={maxBans}
              type="number"
              min={0}
              step="1"
              onChange={(input) => setMaxBans(input.target.value)}
            />
          </label>
        </div>
      ) : null}

      <div className="event-form-row two">
        <label className="event-field">
          <span className="field-label">Cap</span>
          <input value={cap} maxLength={100} onChange={(input) => setCap(input.target.value)} placeholder="Enter CAP" />
        </label>
        <label className="event-field">
          <span className="field-label">Company Bond</span>
          <input
            value={companyBond}
            maxLength={200}
            onChange={(input) => setCompanyBond(input.target.value)}
            placeholder="e.g. 2 years bond"
          />
        </label>
      </div>

      <div className="event-form-row two">
        <label className="event-field">
          <span className="field-label required">Place of Posting</span>
          <input
            value={locations}
            onChange={(input) => setLocations(input.target.value)}
            placeholder="e.g. Bengaluru, Remote"
          />
        </label>
        <label className="event-field">
          <span className="field-label">Duration</span>
          <input
            value={duration}
            maxLength={100}
            onChange={(input) => setDuration(input.target.value)}
            placeholder="e.g. 6 months, leave blank for placement"
          />
        </label>
      </div>

      <label className="event-field">
        <span className="field-label">CTC / Stipend</span>
        <input
          value={ctcStipend}
          type="number"
          min={0}
          step="any"
          onChange={(input) => setCtcStipend(input.target.value)}
          placeholder="e.g. 1200000"
        />
      </label>

      <label className="event-field">
        <span className="field-label">Additional CTC / Stipend Info</span>
        <input
          value={ctcStipendInfo}
          maxLength={500}
          onChange={(input) => setCtcStipendInfo(input.target.value)}
        />
      </label>

      <label className="event-field">
        <span className="field-label">Additional Info</span>
        <textarea
          value={openingOverview}
          rows={4}
          maxLength={10000}
          onChange={(input) => setOpeningOverview(input.target.value)}
          placeholder="Any other info or instructions…"
        />
      </label>

      <label className="event-field">
        <span className="field-label">Optional Redirect Link</span>
        <input
          value={redirectUrl}
          maxLength={500}
          onChange={(input) => setRedirectUrl(input.target.value)}
          placeholder="https://careers.example.com/apply"
        />
      </label>

      <div className="event-field">
        <span className="field-label">Visibility</span>
        <div className="choice-row">
          {(Object.keys(STATUS_LABELS) as EventFormValues["status"][]).map((option) => (
            <button
              type="button"
              key={option}
              className={`choice-pill${status === option ? " selected" : ""}`}
              aria-pressed={status === option}
              onClick={() => setStatus(option)}
            >
              <i />
              {STATUS_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="event-form-actions">
        {missing.length ? <p className="field-hint">Still needed: {missing.join(", ")}.</p> : null}
        <div>
          <button type="button" className="ghost" onClick={() => router.push("/admin/events")}>
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || missing.length > 0 || Boolean(blockedReason)}
            onClick={submit}
          >
            {saving ? "Saving…" : event ? "Save changes" : "Create event"}
          </button>
        </div>
      </div>

      {companyPickerOpen ? (
        <PickerModal title="Select a Company" onClose={() => setCompanyPickerOpen(false)}>
          <label className="dropdown-search">
            <Search />
            <input
              autoFocus
              value={companyQuery}
              onChange={(input) => setCompanyQuery(input.target.value)}
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

      {degreePickerOpen ? (
        <PickerModal
          title="Select Degrees"
          onClose={() => setDegreePickerOpen(false)}
          footer={
            <button type="button" onClick={() => setDegreePickerOpen(false)}>
              Continue
            </button>
          }
        >
          {degrees.length ? (
            <div className="check-list">
              <button
                type="button"
                className="check-row all"
                onClick={() =>
                  pickDegrees(allowedDegrees.length === degrees.length ? [] : [...degrees])
                }
              >
                <ListChecks />
                <i className={allowedDegrees.length === degrees.length ? "box checked" : "box"} />
                <span>Select All</span>
              </button>
              {degrees.map((degree) => (
                <button
                  type="button"
                  key={degree}
                  className="check-row"
                  onClick={() => pickDegrees(toggle(allowedDegrees, degree))}
                >
                  <GraduationCap />
                  <i className={allowedDegrees.includes(degree) ? "box checked" : "box"} />
                  <span>{degree}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="dropdown-empty">
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
              <button type="button" onClick={() => setBranchPickerOpen(false)}>
                Continue
              </button>
              <small>
                Clearing a degree above also clears the branches it offered.
              </small>
            </>
          }
        >
          <div className="branch-search">
            <label className="dropdown-search">
              <Search />
              <input
                autoFocus
                value={branchQuery}
                onChange={(input) => setBranchQuery(input.target.value)}
                placeholder="Search branches…"
              />
            </label>
            <button
              type="button"
              className="clear-branches"
              onClick={() => setAllowedBranches([])}
              aria-label="Clear every selected branch"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          {offeredBranchGroups.length ? (
            offeredBranchGroups.map((group) => {
              const allPicked = group.branches.every((branch) =>
                allowedBranches.includes(branch),
              );
              return (
                <div className="branch-group" key={group.degree}>
                  <header>
                    <strong>{group.degree}</strong>
                    <button
                      type="button"
                      onClick={() =>
                        setAllowedBranches((previous) =>
                          allPicked
                            ? previous.filter((branch) => !group.branches.includes(branch))
                            : [...new Set([...previous, ...group.branches])],
                        )
                      }
                    >
                      {allPicked ? "Clear" : "Select All"}
                    </button>
                  </header>
                  <div className="branch-grid">
                    {group.branches.map((branch) => (
                      <button
                        type="button"
                        key={`${group.degree}-${branch}`}
                        className="check-row"
                        onClick={() =>
                          setAllowedBranches((previous) => toggle(previous, branch))
                        }
                      >
                        <i className={allowedBranches.includes(branch) ? "box checked" : "box"} />
                        <span>{branch}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="dropdown-empty">
              {branchQuery.trim()
                ? `No branch matches “${branchQuery.trim()}”.`
                : "The selected degrees have no branches on the roster yet."}
            </p>
          )}
        </PickerModal>
      ) : null}
    </div>
  );
}
