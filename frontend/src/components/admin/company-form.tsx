"use client";

import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { saveCompany, type CompanyActionResult } from "@/app/admin/companies/actions";
import { useDismissOnOutsideClick } from "@/components/common/picker";
import { COMPANY_CATEGORIES } from "@/lib/company-schema";

export type CompanyFormValues = {
  id: string;
  name: string;
  category: string | null;
  placementSession: number | null;
  turnover: string | null;
  description: string | null;
};

/** A decade of sessions around the current one, newest years last. */
function sessionOptions() {
  const current = new Date().getFullYear();
  return Array.from({ length: 10 }, (_, index) => current - 3 + index);
}

export function CompanyForm({ company }: { company: CompanyFormValues | null }) {
  const router = useRouter();
  const sessions = useMemo(() => sessionOptions(), []);

  const [name, setName] = useState(company?.name ?? "");
  const [category, setCategory] = useState(company?.category ?? COMPANY_CATEGORIES[0]);
  const [placementSession, setPlacementSession] = useState(
    company?.placementSession ?? new Date().getFullYear() + 1,
  );
  const [turnover, setTurnover] = useState(company?.turnover ?? "");
  const [description, setDescription] = useState(company?.description ?? "");
  // An editor already knows the record exists, so the duplicate check only
  // stands in the way of creating a second one.
  const [confirmed, setConfirmed] = useState(Boolean(company));

  const [sessionOpen, setSessionOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CompanyActionResult>({});

  const sessionRef = useDismissOnOutsideClick(() => setSessionOpen(false));

  async function submit() {
    const formData = new FormData();
    formData.set("id", company?.id ?? "");
    formData.set("name", name);
    formData.set("category", category);
    formData.set("placementSession", String(placementSession));
    formData.set("turnover", turnover);
    formData.set("description", description);

    setSaving(true);
    const next = await saveCompany(formData);
    setResult(next);
    setSaving(false);
    if (next.success) {
      router.push("/admin/companies");
      router.refresh();
    }
  }

  const missing = [
    name.trim().length >= 2 ? null : "company name",
    description.trim() ? null : "company info",
  ].filter(Boolean) as string[];

  return (
    <div className="form-card">
      <header className="form-card-header">
        <h2>Company Details</h2>
        <p>
          {company
            ? "Correct the company information held by the placement portal."
            : "Enter the company information to add it to the placement portal."}
        </p>
      </header>

      {result.success ? <div className="admin-success">{result.success}</div> : null}
      {result.error ? <div className="admin-error">{result.error}</div> : null}

      <div className="event-form">
        <label className="event-field">
          <span className="field-label required">Company Name</span>
          <input
            value={name}
            maxLength={120}
            onChange={(input) => setName(input.target.value)}
            placeholder="Enter company name"
          />
        </label>

        <div className="event-field">
          <span className="field-label">Company Category</span>
          <div className="choice-row">
            {COMPANY_CATEGORIES.map((option) => (
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
          <small className="field-hint">
            A dream-round company stays open to students who already hold an offer.
          </small>
        </div>

        <div className="event-field narrow">
          <span className="field-label">Placement Session</span>
          <div className="event-picker" ref={sessionRef}>
            <button
              type="button"
              className="composer-field filled"
              onClick={() => setSessionOpen((open) => !open)}
            >
              <CalendarDays />
              <b className="field-value">{placementSession}</b>
              <ChevronDown className={sessionOpen ? "tick open" : "tick"} />
            </button>
            {sessionOpen ? (
              <div className="composer-dropdown">
                {sessions.map((session) => (
                  <button
                    type="button"
                    key={session}
                    className={`dropdown-option${session === placementSession ? " selected" : ""}`}
                    onClick={() => {
                      setPlacementSession(session);
                      setSessionOpen(false);
                    }}
                  >
                    {session}
                    {session === placementSession ? <Check /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <label className="event-field">
          <span className="field-label">Company Turnover</span>
          <input
            value={turnover}
            maxLength={120}
            onChange={(input) => setTurnover(input.target.value)}
            placeholder="Leave Blank if not applicable"
          />
        </label>

        <label className="event-field">
          <span className="field-label required">Company Info</span>
          <textarea
            value={description}
            rows={5}
            maxLength={2000}
            onChange={(input) => setDescription(input.target.value)}
            placeholder="Enter company information"
          />
        </label>

        {company ? null : (
          <button
            type="button"
            className="confirm-row"
            aria-pressed={confirmed}
            onClick={() => setConfirmed((checked) => !checked)}
          >
            <i className={confirmed ? "box checked" : "box"} />
            <span>Are you sure this company doesn&apos;t already exist?</span>
          </button>
        )}

        <div className="event-form-actions">
          {missing.length ? <p className="field-hint">Still needed: {missing.join(", ")}.</p> : null}
          <div>
            <button type="button" className="ghost" onClick={() => router.push("/admin/companies")}>
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || missing.length > 0 || !confirmed}
              onClick={submit}
            >
              {saving ? "Saving…" : company ? "Save Changes" : "Add Company"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
