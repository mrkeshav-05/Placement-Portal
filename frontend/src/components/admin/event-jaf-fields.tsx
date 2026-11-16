"use client";

import { EventAttachmentUploader } from "@/components/admin/event-attachment-uploader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  COMPENSATION_DEGREES,
  SELECTION_ROUND_KEYS,
  SELECTION_ROUND_LABELS,
  WORK_MODES,
  WORK_MODE_LABELS,
  employmentFlags,
  type CompensationEntry,
  type EventAttachment,
  type SelectionRound,
} from "@/lib/job-profile-schema";

/** A yes/no answer the cell may leave unanswered ("") — unanswered is not "No". */
type Tri = "" | "yes" | "no";

export type JafFormState = {
  workMode: string;
  joiningDate: string;
  ppoCtcLpa: string;
  compensation: Record<string, { fixed: string; variable: string; ctc: string }>;
  hasBond: Tri;
  ppt: Tri;
  resumeShortlisting: Tri;
  shortlistCriteria: string;
  selectionRounds: Record<string, { conducted: Tri; duration: string; rounds: string; sequence: string }>;
  selectionNotes: string;
  jd: EventAttachment[];
};

/** The stored JAF columns of a drive, as the edit page reads them. */
export type JafStoredValues = {
  workMode: string | null;
  joiningDate: string | null;
  ppoCtcLpa: number | null;
  compensation: Record<string, CompensationEntry> | null;
  hasBond: boolean | null;
  ppt: boolean | null;
  resumeShortlisting: boolean | null;
  shortlistCriteria: string | null;
  selectionRounds: Record<string, SelectionRound> | null;
  selectionNotes: string | null;
  jdFile: EventAttachment | null;
};

const fromBool = (value: boolean | null | undefined): Tri => (value === true ? "yes" : value === false ? "no" : "");
const toBool = (value: Tri) => (value === "yes" ? true : value === "no" ? false : null);
const num = (value: number | null | undefined) => (value == null ? "" : String(value));

export function jafStateFromStored(stored: JafStoredValues | null, companyBond?: string | null): JafFormState {
  return {
    workMode: stored?.workMode ?? "",
    joiningDate: stored?.joiningDate ?? "",
    ppoCtcLpa: num(stored?.ppoCtcLpa),
    compensation: Object.fromEntries(
      COMPENSATION_DEGREES.map((degree) => {
        const entry = stored?.compensation?.[degree];
        return [degree, { fixed: num(entry?.fixed), variable: num(entry?.variable), ctc: num(entry?.ctc) }];
      }),
    ),
    // A drive saved before the Yes/No existed has bond terms but no answer.
    hasBond: stored?.hasBond != null ? fromBool(stored.hasBond) : companyBond?.trim() ? "yes" : "",
    ppt: fromBool(stored?.ppt),
    resumeShortlisting: fromBool(stored?.resumeShortlisting),
    shortlistCriteria: stored?.shortlistCriteria ?? "",
    selectionRounds: Object.fromEntries(
      SELECTION_ROUND_KEYS.map((key) => {
        const round = stored?.selectionRounds?.[key];
        return [
          key,
          {
            conducted: fromBool(round?.conducted),
            duration: round?.duration ?? "",
            rounds: num(round?.rounds),
            sequence: round?.sequence ?? "",
          },
        ];
      }),
    ),
    selectionNotes: stored?.selectionNotes ?? "",
    jd: stored?.jdFile ? [stored.jdFile] : [],
  };
}

/** The JSON the server action's `jaf` field expects. Blanks stay blank. */
export function jafPayload(state: JafFormState) {
  return {
    workMode: state.workMode || null,
    joiningDate: state.joiningDate,
    ppoCtcLpa: state.ppoCtcLpa,
    compensation: state.compensation,
    hasBond: toBool(state.hasBond),
    ppt: toBool(state.ppt),
    resumeShortlisting: toBool(state.resumeShortlisting),
    shortlistCriteria: state.shortlistCriteria,
    selectionRounds: Object.fromEntries(
      Object.entries(state.selectionRounds).map(([key, round]) => [
        key,
        { ...round, conducted: toBool(round.conducted) },
      ]),
    ),
    selectionNotes: state.selectionNotes,
    jdFile: state.jd[0] ?? null,
  };
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 rounded-lg border p-4">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {hint ? <p className="text-muted-foreground -mt-2 text-xs">{hint}</p> : null}
      {children}
    </fieldset>
  );
}

function Field({ label, id, children }: { label: string; id?: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/** Yes / No that can be switched back off, so "not provided" stays reachable. */
function YesNo({ value, onChange, label }: { value: Tri; onChange: (next: Tri) => void; label: string }) {
  return (
    <Field label={label}>
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={2}
        value={value}
        onValueChange={(next) => onChange((next as Tri) ?? "")}
      >
        <ToggleGroupItem value="yes">Yes</ToggleGroupItem>
        <ToggleGroupItem value="no">No</ToggleGroupItem>
      </ToggleGroup>
    </Field>
  );
}

/**
 * The JAF 2026-27 details. Every control is optional: students see only what
 * is filled in here, so a detail the recruiter has not sent yet can simply be
 * left blank and added later.
 */
export function EventJafFields({
  state,
  onChange,
  type,
  companyBond,
  onCompanyBondChange,
}: {
  state: JafFormState;
  onChange: (next: JafFormState) => void;
  /** The employment type chosen above: decides which compensation fields apply. */
  type: string;
  companyBond: string;
  onCompanyBondChange: (next: string) => void;
}) {
  const flags = employmentFlags(type);
  const set = <K extends keyof JafFormState>(key: K, value: JafFormState[K]) => onChange({ ...state, [key]: value });

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h2 className="text-base font-semibold">Recruiter details (JAF)</h2>
        <p className="text-muted-foreground text-sm">
          All optional. Students see only the fields you fill in, so leave anything the recruiter has not
          confirmed yet blank and add it later.
        </p>
      </div>

      <Section title="Job description document">
        <EventAttachmentUploader
          attachments={state.jd}
          onChange={(next) => set("jd", next)}
          label="Job Description (PDF)"
          hint="Students can view and download this from the opportunity page."
          max={1}
        />
      </Section>

      <Section title="Role details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Work mode">
            <ToggleGroup
              type="single"
              variant="outline"
              spacing={2}
              value={state.workMode}
              onValueChange={(next) => set("workMode", next ?? "")}
            >
              {WORK_MODES.map((mode) => (
                <ToggleGroupItem key={mode} value={mode}>
                  {WORK_MODE_LABELS[mode]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <Field label="Tentative joining date" id="jaf-joining">
            <Input
              id="jaf-joining"
              value={state.joiningDate}
              maxLength={100}
              onChange={(event) => set("joiningDate", event.target.value)}
              placeholder="e.g. July 2027"
            />
          </Field>
        </div>
      </Section>

      {flags.expectedCtc || flags.fullTime ? (
        <Section
          title="Compensation details"
          hint={
            type === "INTERNSHIP_PPO"
              ? "The stipend is the CTC / Stipend field above. Add the expected PPO CTC and, if the company shares it, a breakup."
              : type === "INTERNSHIP_FTE"
                ? "The stipend is the CTC / Stipend field above. Add the full-time conversion details here."
                : "The yearly CTC is the CTC / Stipend field above. A breakup by degree is optional."
          }
        >
          {flags.expectedCtc ? (
            <Field
              label={type === "INTERNSHIP_PPO" ? "Expected PPO CTC (LPA)" : "Expected full-time CTC (LPA)"}
              id="jaf-ppo-ctc"
            >
              <Input
                id="jaf-ppo-ctc"
                type="number"
                min={0}
                step="any"
                className="sm:max-w-xs"
                value={state.ppoCtcLpa}
                onChange={(event) => set("ppoCtcLpa", event.target.value)}
                placeholder="e.g. 24"
              />
            </Field>
          ) : null}

          <div className="grid gap-2">
            <Label>
              {type === "INTERNSHIP_PPO"
                ? "PPO compensation breakup (optional)"
                : type === "INTERNSHIP_FTE"
                  ? "Full-time compensation breakup (optional)"
                  : "Compensation breakup by degree (optional)"}
            </Label>
            <p className="text-muted-foreground text-xs">Yearly, in INR. Leave a degree blank if it was not provided.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr className="text-muted-foreground text-left text-xs">
                    <th className="pb-2 pr-3 font-medium">Degree</th>
                    <th className="pb-2 pr-3 font-medium">Fixed</th>
                    <th className="pb-2 pr-3 font-medium">Variable</th>
                    <th className="pb-2 font-medium">CTC</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPENSATION_DEGREES.map((degree) => (
                    <tr key={degree}>
                      <td className="py-1 pr-3 font-medium">{degree}</td>
                      {(["fixed", "variable", "ctc"] as const).map((column) => (
                        <td key={column} className="py-1 pr-3 last:pr-0">
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            aria-label={`${degree} ${column}`}
                            value={state.compensation[degree]?.[column] ?? ""}
                            onChange={(event) =>
                              set("compensation", {
                                ...state.compensation,
                                [degree]: { ...state.compensation[degree], [column]: event.target.value },
                              })
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <YesNo label="Service bond / contract" value={state.hasBond} onChange={(next) => set("hasBond", next)} />
          {state.hasBond === "yes" ? (
            <Field label="Bond duration, amount and conditions" id="jaf-bond">
              <Input
                id="jaf-bond"
                value={companyBond}
                maxLength={200}
                onChange={(event) => onCompanyBondChange(event.target.value)}
                placeholder="e.g. 2 years, ₹2,00,000 recovery if left early"
              />
            </Field>
          ) : null}
        </Section>
      ) : null}

      <Section title="Selection process">
        <div className="grid gap-4 sm:grid-cols-2">
          <YesNo label="Pre-placement talk" value={state.ppt} onChange={(next) => set("ppt", next)} />
          <YesNo
            label="Shortlisting from resumes"
            value={state.resumeShortlisting}
            onChange={(next) => set("resumeShortlisting", next)}
          />
        </div>
        <Field label="Resume shortlisting criteria" id="jaf-shortlist">
          <Textarea
            id="jaf-shortlist"
            rows={2}
            maxLength={1000}
            value={state.shortlistCriteria}
            onChange={(event) => set("shortlistCriteria", event.target.value)}
          />
        </Field>

        <div className="grid gap-3">
          {SELECTION_ROUND_KEYS.map((key) => {
            const round = state.selectionRounds[key];
            const update = (patch: Partial<typeof round>) =>
              set("selectionRounds", { ...state.selectionRounds, [key]: { ...round, ...patch } });
            return (
              <div key={key} className="grid gap-3 rounded-md border p-3 sm:grid-cols-4">
                <div className="grid content-start gap-2 sm:col-span-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <span className="text-sm font-medium">{SELECTION_ROUND_LABELS[key]}</span>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    spacing={2}
                    value={round.conducted}
                    onValueChange={(next) => update({ conducted: (next as Tri) ?? "" })}
                  >
                    <ToggleGroupItem value="yes">Conducted</ToggleGroupItem>
                    <ToggleGroupItem value="no">Not conducted</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <Input
                  aria-label={`${SELECTION_ROUND_LABELS[key]} duration`}
                  placeholder="Duration, e.g. 60 min"
                  maxLength={100}
                  value={round.duration}
                  onChange={(event) => update({ duration: event.target.value })}
                />
                <Input
                  aria-label={`${SELECTION_ROUND_LABELS[key]} number of rounds`}
                  type="number"
                  min={0}
                  placeholder="No. of rounds"
                  value={round.rounds}
                  onChange={(event) => update({ rounds: event.target.value })}
                />
                <Input
                  className="sm:col-span-2"
                  aria-label={`${SELECTION_ROUND_LABELS[key]} sequence`}
                  placeholder="Sequence, e.g. Round 1 of 3"
                  maxLength={200}
                  value={round.sequence}
                  onChange={(event) => update({ sequence: event.target.value })}
                />
              </div>
            );
          })}
        </div>

        <Field label="Additional details on the selection process" id="jaf-selection-notes">
          <Textarea
            id="jaf-selection-notes"
            rows={3}
            maxLength={3000}
            value={state.selectionNotes}
            onChange={(event) => set("selectionNotes", event.target.value)}
          />
        </Field>
      </Section>
    </div>
  );
}
