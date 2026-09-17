"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { saveCompany, type CompanyActionResult } from "@/app/admin/companies/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CompanyActionResult>({});

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
    <Card className="mt-[18px]">
      <CardHeader>
        <CardTitle>Company Details</CardTitle>
        <CardDescription>
          {company
            ? "Correct the company information held by the placement portal."
            : "Enter the company information to add it to the placement portal."}
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4">
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

        <div className="grid gap-2">
          <Label htmlFor="company-name">
            Company Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="company-name"
            value={name}
            maxLength={120}
            onChange={(input) => setName(input.target.value)}
            placeholder="Enter company name"
          />
        </div>

        <div className="grid gap-2">
          <Label>Company Category</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={2}
            value={category}
            // Radix clears a single toggle group when the active item is
            // pressed again; a company always has a category, so ignore that.
            onValueChange={(next) => next && setCategory(next)}
          >
            {COMPANY_CATEGORIES.map((option) => (
              <ToggleGroupItem
                key={option}
                value={option}
                // The outline variant only tints the active item, which reads
                // as a hover rather than a choice. Fill it with the institute
                // blue, as the reference design fills its selected pill.
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90"
              >
                {option}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-muted-foreground text-xs">
            A dream-round company stays open to students who already hold an offer.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="placement-session">Placement Session</Label>
          <Select
            value={String(placementSession)}
            onValueChange={(next) => setPlacementSession(Number(next))}
          >
            <SelectTrigger id="placement-session" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((session) => (
                <SelectItem key={session} value={String(session)}>
                  {session}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="company-turnover">Company Turnover</Label>
          <Input
            id="company-turnover"
            value={turnover}
            maxLength={120}
            onChange={(input) => setTurnover(input.target.value)}
            placeholder="Leave Blank if not applicable"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="company-info">
            Company Info <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="company-info"
            value={description}
            rows={5}
            maxLength={2000}
            onChange={(input) => setDescription(input.target.value)}
            placeholder="Enter company information"
          />
        </div>

        {company ? null : (
          <div className="flex items-center gap-2">
            <Checkbox
              id="confirm-new"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
            />
            <Label htmlFor="confirm-new" className="font-normal">
              Are you sure this company doesn&apos;t already exist?
            </Label>
          </div>
        )}

        <div className="grid justify-items-end gap-2">
          {missing.length ? (
            <p className="text-muted-foreground text-xs">
              Still needed: {missing.join(", ")}.
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/companies")}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving || missing.length > 0 || !confirmed}
              onClick={submit}
            >
              {saving ? "Saving…" : company ? "Save Changes" : "Add Company"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
