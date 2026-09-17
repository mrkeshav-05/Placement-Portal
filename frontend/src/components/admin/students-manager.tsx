"use client";

import Link from "next/link";
import { AlertTriangle, Eye, GraduationCap } from "lucide-react";
import { useMemo, useState } from "react";
import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
} from "@/components/common/data-table";

export type AdminStudentListItem = {
  id: string;
  name: string;
  email: string;
  rollNumber: string | null;
  branch: string | null;
  batch: number | null;
  cgpa: number | null;
  completion: number;
  applicationCount: number;
  missedStreak: number;
  missedCompanies: string[];
};

export function StudentsManager({ students }: { students: AdminStudentListItem[] }) {
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  const flaggedCount = useMemo(() => students.filter((s) => s.missedStreak >= 3).length, [students]);

  const visible = useMemo(
    () => (onlyFlagged ? students.filter((student) => student.missedStreak >= 3) : students),
    [students, onlyFlagged],
  );

  const columns = useMemo<DataTableColumn<AdminStudentListItem>[]>(
    () => [
      {
        id: "student",
        header: "Student",
        width: "220px",
        sortValue: (student) => student.name,
        hideable: false,
        cell: (student) => (
          <span className="company-admin-name">
            <i>
              <GraduationCap />
            </i>
            <span>
              <strong>{student.name}</strong>
              <small>{student.email}</small>
            </span>
          </span>
        ),
      },
      {
        id: "academic",
        header: "Academic profile",
        width: "200px",
        sortValue: (student) => student.rollNumber,
        cell: (student) => (
          <span>
            {student.rollNumber ?? "Roll not added"}
            <br />
            <small>
              {student.branch ?? "Branch not added"}
              {student.batch ? ` · ${student.batch}` : ""} · {student.completion}% complete
            </small>
          </span>
        ),
      },
      {
        id: "cgpa",
        header: "CGPA",
        width: "100px",
        sortValue: (student) => student.cgpa,
        cell: (student) => <span className="dt-numeric">{student.cgpa ?? "Not added"}</span>,
      },
      {
        id: "applications",
        header: "Applications",
        width: "130px",
        sortValue: (student) => student.applicationCount,
        cell: (student) => <span className="dt-numeric">{student.applicationCount}</span>,
      },
      {
        id: "followUp",
        header: "Follow-up",
        width: "180px",
        sortValue: (student) => student.missedStreak,
        cell: (student) =>
          student.missedStreak >= 3 ? (
            <span
              title={`Eligible but did not apply to ${student.missedStreak} companies in a row: ${student.missedCompanies.join(", ")}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 8px",
                borderRadius: "9999px",
                fontSize: "10px",
                fontWeight: 800,
                background: "var(--badge-orange-bg)",
                color: "var(--badge-orange-text)",
                cursor: "help",
              }}
            >
              <AlertTriangle size={11} /> Missed {student.missedStreak} in a row
            </span>
          ) : (
            <small className="dt-muted">—</small>
          ),
      },
      {
        id: "actions",
        header: "Actions",
        width: "90px",
        hideable: false,
        cell: (student) => (
          <span className="row-actions">
            <Link
              className="admin-icon-link"
              href={`/admin/students/${student.id}`}
              title={`View ${student.name}`}
              aria-label={`View ${student.name}`}
            >
              <Eye />
            </Link>
          </span>
        ),
      },
    ],
    [],
  );

  const filters = useMemo<DataTableFilter<AdminStudentListItem>[]>(() => {
    const batches = Array.from(
      new Set(students.map((student) => student.batch).filter((batch): batch is number => batch !== null)),
    ).sort((a, b) => b - a);
    const branches = Array.from(
      new Set(students.map((student) => student.branch).filter((branch): branch is string => Boolean(branch))),
    ).sort((a, b) => a.localeCompare(b));

    return [
      {
        id: "batch",
        label: "Batch",
        value: (student) => (student.batch === null ? null : String(student.batch)),
        options: batches.map((batch) => ({ value: String(batch), label: String(batch) })),
      },
      {
        id: "branch",
        label: "Branch",
        value: (student) => student.branch,
        options: branches.map((branch) => ({ value: branch, label: branch })),
      },
    ];
  }, [students]);

  return (
    <div className="admin-page">
      <section className="admin-heading">
        <div>
          <span className="eyebrow">Live student records</span>
          <h1>Students</h1>
          <p>Profiles created from registered institute accounts.</p>
        </div>
      </section>

      {flaggedCount > 0 && (
        <div
          className="notice warning"
          style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}
        >
          <AlertTriangle size={18} />
          <div>
            <strong>
              {flaggedCount} student{flaggedCount === 1 ? "" : "s"} {flaggedCount === 1 ? "needs" : "need"} follow-up.
            </strong>{" "}
            They were eligible for 3 or more companies in a row but did not apply to any of them.
          </div>
        </div>
      )}

      <DataTable
        title="Student Records"
        data={visible}
        columns={columns}
        getRowId={(student) => student.id}
        searchText={(student) =>
          `${student.name} ${student.email} ${student.rollNumber ?? ""} ${student.branch ?? ""}`
        }
        searchPlaceholder="Search name, email, roll number, or branch"
        filters={filters}
        columnStorageKey="students"
        minWidth={940}
        toolbarExtras={
          <label className="dt-check">
            <input
              type="checkbox"
              checked={onlyFlagged}
              onChange={(event) => setOnlyFlagged(event.target.checked)}
            />
            <span>Needs follow-up only ({flaggedCount})</span>
          </label>
        }
        emptyIcon={<GraduationCap />}
        emptyTitle={students.length ? "No matching students" : "No students yet"}
        emptyDescription={
          students.length
            ? "Change the search query or follow-up filter."
            : "Students appear once they register with their institute address."
        }
      />
    </div>
  );
}
