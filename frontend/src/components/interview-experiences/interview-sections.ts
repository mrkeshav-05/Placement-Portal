import { Braces, Cpu, FileText, Lightbulb, Users } from "lucide-react";

export type InterviewExperienceItem = {
  id: string;
  companyName: string;
  role: string;
  batch: number;
  interviewType: string;
  opportunityType?: string | null;
  difficulty?: string | null;
  outcome?: string | null;
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

export type SectionKey = keyof InterviewExperienceItem;

export type Section = { key: SectionKey; label: string; placeholder: string };

/**
 * The seventeen optional sections, in five themed groups.
 *
 * The composer used to present all seventeen as one flat column of empty
 * textareas, which reads as seventeen obligations rather than a menu to pick
 * from. Grouping lets the form open with one group expanded, and gives the
 * browse list a vocabulary of topics to tag and filter by, so a student
 * hunting for system-design rounds does not have to open every card.
 */
export const SECTION_GROUPS: {
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
        label: "DSA question - 1",
        placeholder: "e.g. Reverse a linked list, find the LCA of a BST...",
      },
      {
        key: "codingQuestions",
        label: "DSA question - 2",
        placeholder: "Describe the full problem statement, and how you approached it...",
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

export const ALL_SECTIONS = SECTION_GROUPS.flatMap((group) => group.sections);

export const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

export function text(item: InterviewExperienceItem, key: SectionKey): string {
  const value = item[key];
  return typeof value === "string" ? value : "";
}

export function groupsPresent(item: InterviewExperienceItem) {
  return SECTION_GROUPS.filter((group) =>
    group.sections.some((section) => text(item, section.key).trim()),
  );
}

export function sectionsPresent(item: InterviewExperienceItem) {
  return ALL_SECTIONS.filter((section) => text(item, section.key).trim());
}


/** One company in the question bank's search list. */
export type BankCompany = {
  company: string;
  count: number;
  roles: string[];
  latestBatch: number;
  lastSharedAt: string;
};

/** Every experience for one role + opportunity type at a company. */
export type BankGroup = {
  role: string;
  /** INTERN / INTERN_FTE / FTE, or UNSPECIFIED for older submissions. */
  opportunityType: string;
  count: number;
  batches: number[];
  interviewTypes: string[];
  experiences: InterviewExperienceItem[];
};

export type BankCompanyDetail = {
  company: string;
  total: number;
  groups: BankGroup[];
};
