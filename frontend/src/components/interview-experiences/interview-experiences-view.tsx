"use client";

import {
  Braces,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  Cpu,
  FileText,
  Lightbulb,
  MessageSquareText,
  Plus,
  Search,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { submitInterviewExperienceAction } from "@/app/interview-experiences/actions";
import { CompanyPicker } from "@/components/common/company-picker";
import { PortalDialog } from "@/components/common/portal-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { COMPANY_OPTIONS } from "@/lib/company-options";
import { INTERVIEW_TYPE_OPTIONS } from "@/lib/interview-experience-schema";

export type InterviewExperienceItem = {
  id: string;
  companyName: string;
  role: string;
  batch: number;
  interviewType: string;
  dsaQuestions?: string | null;
  oopsQuestions?: string | null;
  dbmsQuestions?: string | null;
  osQuestions?: string | null;
  cnQuestions?: string | null;
  sqlQuestions?: string | null;
  systemDesignQuestions?: string | null;
  csFundamentalsQuestions?: string | null;
  resumeQuestions?: string | null;
  projectsDiscussed?: string | null;
  codingQuestions?: string | null;
  aptitudeQuestions?: string | null;
  hrQuestions?: string | null;
  behavioralQuestions?: string | null;
  resources?: string | null;
  unansweredQuestions?: string | null;
  tips?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  reviewNote?: string | null;
  createdAt: string;
};

type SectionKey = keyof InterviewExperienceItem;

type Section = { key: SectionKey; label: string; placeholder: string };

/**
 * The seventeen optional sections, in five themed groups.
 *
 * The composer used to present all seventeen as one flat column of empty
 * textareas, which reads as seventeen obligations rather than a menu to pick
 * from. Grouping lets the form open with one group expanded, and gives the
 * browse list a vocabulary of topics to tag and filter by, so a student
 * hunting for system-design rounds does not have to open every card.
 */
const SECTION_GROUPS: {
  id: string;
  label: string;
  /** The short form used for card tags and the topic filter. */
  tag: string;
  icon: typeof Braces;
  sections: Section[];
}[] = [
  {
    id: "coding",
    label: "Coding and DSA",
    tag: "DSA",
    icon: Braces,
    sections: [
      {
        key: "dsaQuestions",
        label: "DSA questions asked",
        placeholder: "e.g. Reverse a linked list, find the LCA of a BST...",
      },
      {
        key: "codingQuestions",
        label: "Coding question(s) asked",
        placeholder: "Describe the full coding problem statement(s)...",
      },
    ],
  },
  {
    id: "fundamentals",
    label: "CS fundamentals",
    tag: "CS fundamentals",
    icon: Cpu,
    sections: [
      {
        key: "oopsQuestions",
        label: "OOPS questions",
        placeholder: "e.g. Explain polymorphism with an example...",
      },
      {
        key: "dbmsQuestions",
        label: "DBMS questions",
        placeholder: "e.g. Normalization, indexing, ACID properties...",
      },
      {
        key: "sqlQuestions",
        label: "SQL questions",
        placeholder: "Any SQL queries or concepts asked...",
      },
      {
        key: "osQuestions",
        label: "Operating System questions",
        placeholder: "e.g. Deadlocks, paging, scheduling algorithms...",
      },
      {
        key: "cnQuestions",
        label: "Computer Networks questions",
        placeholder: "e.g. TCP vs UDP, OSI layers...",
      },
      {
        key: "systemDesignQuestions",
        label: "System Design / LLD / HLD questions",
        placeholder: "e.g. Design a URL shortener...",
      },
      {
        key: "csFundamentalsQuestions",
        label: "CS fundamentals / miscellaneous",
        placeholder: "Any other CS fundamentals asked...",
      },
    ],
  },
  {
    id: "resume",
    label: "Resume and projects",
    tag: "Resume",
    icon: FileText,
    sections: [
      {
        key: "resumeQuestions",
        label: "Resume-based questions",
        placeholder: "Questions asked specifically about your resume...",
      },
      {
        key: "projectsDiscussed",
        label: "Projects discussed",
        placeholder: "Which projects came up and what was asked...",
      },
    ],
  },
  {
    id: "hr",
    label: "Aptitude, HR and behavioural",
    tag: "HR",
    icon: Users,
    sections: [
      {
        key: "aptitudeQuestions",
        label: "Puzzle / aptitude questions",
        placeholder: "Any puzzles or aptitude questions...",
      },
      {
        key: "hrQuestions",
        label: "HR questions",
        placeholder: "e.g. Why this company, salary expectations...",
      },
      {
        key: "behavioralQuestions",
        label: "Behavioural questions",
        placeholder: "e.g. Tell me about a time you faced conflict in a team...",
      },
    ],
  },
  {
    id: "advice",
    label: "Reflection and advice",
    tag: "Tips",
    icon: Lightbulb,
    sections: [
      {
        key: "unansweredQuestions",
        label: "Questions you could not answer",
        placeholder: "Be honest — this helps others prepare better.",
      },
      {
        key: "resources",
        label: "Resources that helped",
        placeholder: "Books, courses, playlists, sheets...",
      },
      {
        key: "tips",
        label: "Tips for future candidates",
        placeholder: "Your advice for students appearing next...",
      },
    ],
  },
];

const ALL_SECTIONS = SECTION_GROUPS.flatMap((group) => group.sections);

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

function text(item: InterviewExperienceItem, key: SectionKey): string {
  const value = item[key];
  return typeof value === "string" ? value : "";
}

function groupsPresent(item: InterviewExperienceItem) {
  return SECTION_GROUPS.filter((group) =>
    group.sections.some((section) => text(item, section.key).trim()),
  );
}

function sectionsPresent(item: InterviewExperienceItem) {
  return ALL_SECTIONS.filter((section) => text(item, section.key).trim());
}

/** Every word a submission contains, so search reaches the answers too. */
function haystack(item: InterviewExperienceItem) {
  return [
    item.companyName,
    item.role,
    item.interviewType,
    String(item.batch),
    ...ALL_SECTIONS.map((section) => text(item, section.key)),
  ]
    .join(" ")
    .toLowerCase();
}

function StatusBadge({ status }: { status: string }) {
  if (status === "PENDING") {
    return (
      <Badge
        variant="outline"
        className="border-[var(--orange)] bg-[var(--badge-orange-bg)] text-[var(--badge-orange-text)]"
      >
        <Clock3 />
        Pending review
      </Badge>
    );
  }
  if (status === "APPROVED") {
    return (
      <Badge
        variant="outline"
        className="border-[var(--green)] bg-[var(--badge-green-bg)] text-[var(--badge-green-text)]"
      >
        <CheckCircle2 />
        Live
      </Badge>
    );
  }
  return (
    <Badge variant="destructive">
      <XCircle />
      Not approved
    </Badge>
  );
}

function ExperienceCard({
  item,
  onOpen,
  showStatus = false,
}: {
  item: InterviewExperienceItem;
  onOpen: () => void;
  showStatus?: boolean;
}) {
  const topics = groupsPresent(item);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="bg-card hover:border-[var(--blue)] focus-visible:border-ring focus-visible:ring-ring/50 grid w-full gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-foreground flex items-center gap-2 text-sm font-semibold">
          <Building2 className="size-4 shrink-0" />
          {item.companyName}
        </span>
        <span className="text-muted-foreground shrink-0 text-xs">
          {new Date(item.createdAt).toLocaleDateString("en-IN", DATE_FORMAT)}
        </span>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <Briefcase className="size-3.5" />
          {item.role}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="size-3.5" />
          Batch {item.batch}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MessageSquareText className="size-3.5" />
          {item.interviewType}
        </span>
      </div>

      {(topics.length > 0 || showStatus) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {showStatus && <StatusBadge status={item.status} />}
          {topics.map((topic) => (
            <Badge key={topic.id} variant="secondary">
              <topic.icon />
              {topic.tag}
            </Badge>
          ))}
        </div>
      )}
    </button>
  );
}

function ExperienceDetail({ item }: { item: InterviewExperienceItem }) {
  const groups = groupsPresent(item);

  if (groups.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No additional details were shared for this submission.
      </p>
    );
  }

  return (
    <div className="grid gap-5">
      {groups.map((group) => (
        <section key={group.id} className="grid gap-2">
          <h3 className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
            <group.icon className="size-3.5" />
            {group.label}
          </h3>
          {group.sections
            .filter((section) => text(item, section.key).trim())
            .map((section) => (
              <div
                key={String(section.key)}
                className="bg-[var(--surface-alt)] rounded-lg border p-3"
              >
                <span className="text-muted-foreground text-xs font-semibold">
                  {section.label}
                </span>
                <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap">
                  {text(item, section.key)}
                </p>
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}

export function InterviewExperiencesView({
  approvedExperiences,
  myExperiences,
  companies,
}: {
  approvedExperiences: InterviewExperienceItem[];
  myExperiences: InterviewExperienceItem[];
  companies: string[];
}) {
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [viewing, setViewing] = useState<InterviewExperienceItem | null>(null);
  const [composing, setComposing] = useState(false);
  const [interviewType, setInterviewType] = useState("");
  // Only which sections carry text, not the text itself, so a keystroke
  // re-renders the composer at most twice: on the first character, and on the
  // last one deleted.
  const [filled, setFilled] = useState<Record<string, boolean>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const searchIndex = useMemo(
    () => new Map(approvedExperiences.map((item) => [item.id, haystack(item)])),
    [approvedExperiences],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return approvedExperiences.filter((item) => {
      if (companyFilter && item.companyName !== companyFilter) return false;
      if (topicFilter && !groupsPresent(item).some((group) => group.id === topicFilter)) {
        return false;
      }
      return !needle || (searchIndex.get(item.id) ?? "").includes(needle);
    });
  }, [approvedExperiences, query, companyFilter, topicFilter, searchIndex]);

  const filledCount = Object.values(filled).filter(Boolean).length;
  const isFiltered = Boolean(query.trim() || companyFilter || topicFilter);

  function trackFilled(key: SectionKey) {
    return (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const has = event.target.value.trim().length > 0;
      setFilled((prev) =>
        Boolean(prev[key as string]) === has ? prev : { ...prev, [key as string]: has },
      );
    };
  }

  function openComposer() {
    setFormError(null);
    setInterviewType("");
    setFilled({});
    setComposing(true);
  }

  function clearFilters() {
    setQuery("");
    setCompanyFilter("");
    setTopicFilter("");
  }

  function handleSubmit(formData: FormData) {
    setFormError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const result = await submitInterviewExperienceAction(formData);
      if (result?.error) {
        setFormError(result.error);
        return;
      }
      setComposing(false);
      setActionSuccess(result.message ?? "Submitted successfully.");
    });
  }

  return (
    <div className="module-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Community</span>
          <h1>Interview experiences</h1>
          <p>Real questions asked in real interviews, shared by your seniors and peers.</p>
        </div>
        <button onClick={openComposer}>
          <Plus />
          Share your experience
        </button>
      </section>

      {actionSuccess && (
        <Alert variant="success" className="mb-4">
          <CheckCircle2 />
          <AlertDescription>{actionSuccess}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="browse" className="gap-4">
        <TabsList>
          <TabsTrigger value="browse">Browse ({approvedExperiences.length})</TabsTrigger>
          <TabsTrigger value="mine">My submissions ({myExperiences.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px_200px]">
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                type="search"
                className="pl-9"
                aria-label="Search interview experiences"
                placeholder="Search company, role, or anything that was asked…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            <Select
              value={companyFilter || "__none"}
              onValueChange={(value) => setCompanyFilter(value === "__none" ? "" : value)}
            >
              {/* Radix shows `placeholder` only for an empty value, and it cannot
                  read an item's text before the content has ever opened, so a
                  sentinel value would render a blank trigger. */}
              <SelectTrigger aria-label="Filter by company" className="w-full">
                <SelectValue>{companyFilter || "All companies"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">All companies</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company} value={company}>
                    {company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={topicFilter || "__none"}
              onValueChange={(value) => setTopicFilter(value === "__none" ? "" : value)}
            >
              <SelectTrigger aria-label="Filter by topic" className="w-full">
                <SelectValue>
                  {SECTION_GROUPS.find((group) => group.id === topicFilter)?.label ?? "All topics"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">All topics</SelectItem>
                {SECTION_GROUPS.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isFiltered && (
            <p className="text-muted-foreground flex items-center gap-2 text-xs">
              {visible.length} of {approvedExperiences.length} experiences
              <Button variant="link" size="sm" className="h-auto p-0" onClick={clearFilters}>
                Clear filters
              </Button>
            </p>
          )}

          {visible.length ? (
            <div className="grid gap-3">
              {visible.map((item) => (
                <ExperienceCard key={item.id} item={item} onOpen={() => setViewing(item)} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <Sparkles />
              <h3>{isFiltered ? "Nothing matches that search" : "No interview experiences yet"}</h3>
              <p>
                {isFiltered
                  ? "Try a different company, topic, or keyword."
                  : "Be the first to share what was asked in your interview."}
              </p>
              {isFiltered ? (
                <Button variant="outline" className="mt-4" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button className="mt-4" onClick={openComposer}>
                  <Plus />
                  Share your experience
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mine" className="grid gap-4">
          {myExperiences.length ? (
            <div className="grid gap-3">
              {myExperiences.map((item) => (
                <ExperienceCard
                  key={item.id}
                  item={item}
                  showStatus
                  onOpen={() => setViewing(item)}
                />
              ))}
            </div>
          ) : (
            <div className="empty">
              <MessageSquareText />
              <h3>No submissions yet</h3>
              <p>Share your interview experience to help fellow students prepare.</p>
              <Button className="mt-4" onClick={openComposer}>
                <Plus />
                Share your experience
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {composing && (
        <PortalDialog
          onClose={() => setComposing(false)}
          eyebrow="New submission"
          title="Share your interview experience"
          description="The Placement Cell reviews every submission before it becomes visible to other students. Fill in whichever sections apply — you do not need to answer everything."
          className="flex max-h-[88vh] flex-col gap-0 overflow-hidden sm:max-w-[760px]"
        >
          <form action={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="-mx-2 min-h-0 flex-1 space-y-5 overflow-y-auto px-2 py-4">
              {formError && (
                <Alert variant="destructive">
                  <XCircle />
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="ie-company">Company name</Label>
                  <CompanyPicker id="ie-company" name="companyName" options={COMPANY_OPTIONS} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ie-role">Role</Label>
                  <Input id="ie-role" name="role" required minLength={2} placeholder="e.g. SDE-1" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ie-batch">Batch</Label>
                  <Input
                    id="ie-batch"
                    name="batch"
                    type="number"
                    required
                    min={2000}
                    max={2100}
                    placeholder="e.g. 2026"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ie-type">Interview type</Label>
                  <input type="hidden" name="interviewType" value={interviewType} />
                  <Select value={interviewType} onValueChange={setInterviewType}>
                    <SelectTrigger id="ie-type" className="w-full">
                      <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERVIEW_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Accordion type="multiple" defaultValue={["coding"]} className="border-t">
                {SECTION_GROUPS.map((group) => {
                  const groupFilled = group.sections.filter(
                    (section) => filled[section.key as string],
                  ).length;
                  return (
                    <AccordionItem key={group.id} value={group.id}>
                      <AccordionTrigger className="hover:no-underline">
                        <span className="flex items-center gap-2">
                          <group.icon className="size-4" />
                          {group.label}
                          <span className="text-muted-foreground font-normal">
                            ({group.sections.length})
                          </span>
                        </span>
                        {groupFilled > 0 && (
                          <Badge variant="secondary" className="ml-auto mr-2">
                            {groupFilled} filled
                          </Badge>
                        )}
                      </AccordionTrigger>
                      <AccordionContent className="grid gap-4">
                        {group.sections.map((section) => (
                          <div key={String(section.key)} className="grid gap-2">
                            <Label htmlFor={`ie-${String(section.key)}`}>{section.label}</Label>
                            <Textarea
                              id={`ie-${String(section.key)}`}
                              name={String(section.key)}
                              rows={3}
                              placeholder={section.placeholder}
                              onChange={trackFilled(section.key)}
                            />
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>

            <DialogFooter className="shrink-0 items-center border-t pt-4 sm:justify-between">
              <span className="text-muted-foreground text-xs">
                {filledCount > 0
                  ? `${filledCount} of ${ALL_SECTIONS.length} sections filled`
                  : "Fill at least one section so the submission helps someone."}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setComposing(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending || filledCount === 0}>
                  <Sparkles />
                  {isPending ? "Submitting…" : "Submit for review"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </PortalDialog>
      )}

      {viewing && (
        <PortalDialog
          onClose={() => setViewing(null)}
          eyebrow={viewing.interviewType}
          title={`${viewing.companyName} · ${viewing.role}`}
          className="flex max-h-[88vh] flex-col gap-0 overflow-hidden sm:max-w-[720px]"
        >
          <div className="-mx-2 min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-4">
            <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                Batch {viewing.batch}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                Shared {new Date(viewing.createdAt).toLocaleDateString("en-IN", DATE_FORMAT)}
              </span>
              <span>
                {sectionsPresent(viewing).length} of {ALL_SECTIONS.length} sections
              </span>
              {viewing.status !== "APPROVED" && <StatusBadge status={viewing.status} />}
            </div>

            {viewing.status === "REJECTED" && viewing.reviewNote && (
              <Alert variant="destructive">
                <XCircle />
                <AlertDescription>
                  <strong>Reviewer note: </strong>
                  {viewing.reviewNote}
                </AlertDescription>
              </Alert>
            )}

            <ExperienceDetail item={viewing} />
          </div>

          <DialogFooter className="shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => setViewing(null)}>
              Close
            </Button>
          </DialogFooter>
        </PortalDialog>
      )}
    </div>
  );
}
