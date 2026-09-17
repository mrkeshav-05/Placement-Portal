"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Award,
  BarChart3,
  BellRing,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  FileQuestion,
  FileText,
  GraduationCap,
  KeyRound,
  LogOut,
  Menu,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { handleSignOut } from "@/lib/actions/auth";
import { ThemeToggle } from "@/components/shared/theme-toggle";

type NavLink = { label: string; href: string };
type NavItem = {
  label: string;
  icon: typeof BarChart3;
  /** Either a page of its own, or a group that expands into several. */
  href?: string;
  children?: NavLink[];
};

const nav: NavItem[] = [
  { label: "Overview", href: "/admin/dashboard", icon: BarChart3 },
  {
    label: "Announcements",
    icon: BellRing,
    children: [
      { label: "Company event announcement", href: "/admin/announcements/company-event" },
      { label: "General announcement", href: "/admin/announcements/general" },
      { label: "Active & drafts", href: "/admin/announcements" },
    ],
  },
  {
    label: "Companies",
    icon: Building2,
    children: [
      { label: "Add company", href: "/admin/companies" },
      { label: "View registrations", href: "/admin/applications" },
    ],
  },
  {
    label: "Events",
    icon: BriefcaseBusiness,
    children: [
      { label: "All events", href: "/admin/events" },
      { label: "Add event", href: "/admin/events/add" },
    ],
  },
  { label: "Placement records", href: "/admin/placement-records", icon: Award },
  { label: "Students", href: "/admin/students", icon: GraduationCap },
  { label: "Users & RBAC", href: "/admin/users", icon: ShieldCheck },
  { label: "Feedbacks", href: "/admin/feedbacks", icon: FileQuestion },
  { label: "NOC requests", href: "/admin/noc-requests", icon: FileText },
  { label: "Interview experiences", href: "/admin/interview-experiences", icon: MessageSquareText },
  { label: "Team", href: "/admin/team", icon: Users },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminShell({
  children,
  admin,
  allowedPaths,
}: {
  children: React.ReactNode;
  admin: { name: string; initials: string; role?: string; title?: string | null };
  /** Routes this account may open, computed from ROUTE_PERMISSIONS on the server. */
  allowedPaths: string[];
}) {
  const path = usePathname();
  // A group keeps only the children this account may open, and disappears
  // entirely when none are left, the same rule single links follow.
  const visibleNav = nav
    .map((item) =>
      item.children
        ? { ...item, children: item.children.filter((child) => allowedPaths.includes(child.href)) }
        : item,
    )
    .filter((item) => (item.children ? item.children.length > 0 : allowedPaths.includes(item.href!)));
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  // A group starts open when the current page is inside it, and the viewer can
  // then expand or collapse any of them.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <div className="admin-shell">
      <button
        className="menu-button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu />
      </button>
      {open && (
        <button
          className="backdrop"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        />
      )}
      <aside className={open ? "sidebar-open" : ""}>
        <button
          className="close-button"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        >
          <X />
        </button>
        <div className="admin-brand">
          <Image
            src="/iiitl-emblem.png"
            alt=""
            width={40}
            height={32}
            priority
          />
          <div>
            <strong>T&P Admin</strong>
            <span>IIIT Lucknow</span>
          </div>
        </div>
        <nav>
          {visibleNav.map(({ label, href, icon: Icon, children }) => {
            if (!children) {
              return (
                <Link
                  className={path === href ? "active" : ""}
                  href={href!}
                  key={href}
                  onClick={() => setOpen(false)}
                >
                  <Icon />
                  <span>{label}</span>
                </Link>
              );
            }

            const holdsCurrentPage = children.some((child) => child.href === path);
            const expanded = collapsed[label] ?? holdsCurrentPage;

            return (
              <div className="nav-group" key={label}>
                <button
                  type="button"
                  className={holdsCurrentPage ? "nav-group-toggle current" : "nav-group-toggle"}
                  aria-expanded={expanded}
                  onClick={() =>
                    setCollapsed((previous) => ({ ...previous, [label]: !expanded }))
                  }
                >
                  <Icon />
                  <span>{label}</span>
                  <ChevronDown className={expanded ? "chevron open" : "chevron"} />
                </button>
                {expanded ? (
                  <div className="nav-group-links">
                    {children.map((child) => (
                      <Link
                        className={path === child.href ? "active" : ""}
                        href={child.href}
                        key={child.href}
                        onClick={() => setOpen(false)}
                      >
                        <span>{child.label}</span>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        <Link className="student-portal-link" href="/dashboard">
          Open student portal →
        </Link>
      </aside>
      <main>
        <header className="admin-topbar">
          <div>
            <span className="eyebrow">Administration</span>
            <strong>Placement Operations</strong>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="admin-user bg-transparent border-none p-0 text-left cursor-pointer"
              >
                <span>{admin.initials}</span>
                <div>
                  <strong>{admin.name}</strong>
                  <small>{admin.title || (admin.role ? admin.role.replace("_", " ") : "Administrator")}</small>
                </div>
              </button>
              {profileOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div className="absolute right-0 mt-3 w-48 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-xl z-50 overflow-hidden animate-[fadeSlideUp_0.15s_ease]">
                    <Link
                      href="/account/password"
                      onClick={() => setProfileOpen(false)}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[var(--ink)] hover:bg-[var(--surface-alt)] font-semibold no-underline transition-colors"
                    >
                      <KeyRound size={16} />
                      Password
                    </Link>
                    <form action={handleSignOut}>
                      <button
                        type="submit"
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-500 hover:bg-[var(--badge-red-bg)] font-semibold bg-transparent border-none cursor-pointer text-left transition-colors"
                      >
                        <LogOut size={16} />
                        Sign out
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
