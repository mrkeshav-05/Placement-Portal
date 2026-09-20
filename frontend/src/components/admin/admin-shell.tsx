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
  MessageSquareText,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { handleSignOut } from "@/lib/actions/auth";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

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
      { label: "All companies", href: "/admin/companies" },
      { label: "Add company", href: "/admin/companies/add" },
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
  {
    label: "Placement records",
    icon: Award,
    children: [
      { label: "View placement records", href: "/admin/placement-records" },
      { label: "Add placement records", href: "/admin/placement-records/add" },
    ],
  },
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
  const [profileOpen, setProfileOpen] = useState(false);
  const isOverview = path === "/admin/dashboard";

  // Theme toggle and the profile/sign-out menu live in the topbar on the
  // Overview and nowhere else on every other page, so this renders the same
  // button and dropdown in either spot rather than keeping two copies of the
  // sign-out form in sync. `align` only changes which corner the dropdown
  // opens from — "down" for the topbar near the top of the screen, "up" for
  // the sidebar footer near the bottom, so it never opens off-screen.
  function renderProfileMenu(align: "down" | "up") {
    return (
      <div className="relative">
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className="admin-user bg-transparent border-none p-0 text-left cursor-pointer"
        >
          <span>{admin.initials}</span>
          {/* Collapsed to an icon rail, the sidebar is too narrow for a name
              and role next to the avatar — only relevant when this renders
              in the footer, since the topbar never shares that width. */}
          <div className="group-data-[collapsible=icon]:hidden">
            <strong>{admin.name}</strong>
            <small>{admin.title || (admin.role ? admin.role.replace("_", " ") : "Administrator")}</small>
          </div>
        </button>
        {profileOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
            <div
              className={
                align === "down"
                  ? "absolute right-0 top-full mt-3 w-48 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-xl z-50 overflow-hidden animate-[fadeSlideUp_0.15s_ease]"
                  : "absolute left-0 bottom-full mb-2 w-48 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-xl z-50 overflow-hidden animate-[fadeSlideUp_0.15s_ease]"
              }
            >
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
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[var(--badge-red-text)] hover:bg-[var(--badge-red-bg)] font-semibold bg-transparent border-none cursor-pointer text-left transition-colors"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <SidebarProvider>
      {/* Collapses to an icon rail rather than sliding away: the data grids
          behind this are wide and regularly want the room, but an admin
          halfway through a task should not have to reopen the whole nav to
          move to the next screen. The rail is what makes `tooltip` below
          worth setting. */}
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border px-4 py-4 group-data-[collapsible=icon]:px-2">
          <div className="flex items-center gap-3">
            {/* The PNG already carries its own alpha channel; the white card
                behind it (bg-white + border) was covering that up and reading
                as an opaque tile rather than a mark. Sized up and dropped
                onto the sidebar's own background instead. */}
            <Image
              className="size-12 shrink-0 object-contain group-data-[collapsible=icon]:size-8"
              src="/iiitl-emblem.png"
              alt=""
              width={48}
              height={48}
              priority
            />
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <strong className="block truncate text-[15px] font-semibold text-[var(--ink)]">
                T&amp;P Admin
              </strong>
              <span className="block truncate text-[12px] font-medium text-[var(--muted)]">
                IIIT Lucknow
              </span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {visibleNav.map(({ label, href, icon: Icon, children }) => {
                if (!children) {
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton asChild isActive={path === href} tooltip={label}>
                        <Link href={href!}>
                          <Icon />
                          <span>{label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                // A group starts open when the current page is inside it. It is
                // uncontrolled from there on, so the viewer can collapse a group
                // they are standing in without the state fighting them back open.
                const holdsCurrentPage = children.some((child) => child.href === path);

                return (
                  <Collapsible
                    key={label}
                    asChild
                    defaultOpen={holdsCurrentPage}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={label}
                          className={holdsCurrentPage ? "text-[var(--navy)]" : undefined}
                        >
                          <Icon />
                          <span>{label}</span>
                          <ChevronDown className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {children.map((child) => (
                            <SidebarMenuSubItem key={child.href}>
                              <SidebarMenuSubButton asChild isActive={path === child.href}>
                                <Link href={child.href}>
                                  <span>{child.label}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        {!isOverview ? (
          <SidebarFooter className="border-t border-sidebar-border">
            {/* The topbar drops entirely off every page but the Overview (see
                below), so the controls it would otherwise carry — collapse,
                theme, sign-out — live here instead. They open upward: this
                sits at the bottom of the screen, and a menu opening downward
                from here would run off it. Collapsed to the icon rail, the
                rail is narrower than trigger+toggle+avatar laid out in a row,
                so everything stacks into one column instead of overflowing
                past the rail's edge. */}
            <div className="flex items-center justify-between gap-2 px-2 py-3 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
              <div className="flex items-center gap-1.5 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
                <SidebarTrigger />
                <ThemeToggle />
              </div>
              {renderProfileMenu("up")}
            </div>
          </SidebarFooter>
        ) : null}
      </Sidebar>

      <SidebarInset>
        {/* Overview keeps the full topbar — trigger, title, theme, profile.
            Every other page removes it outright rather than leaving an empty
            bar with just the trigger: those controls moved to the sidebar
            footer above, so nothing here would be load-bearing. */}
        {isOverview ? (
          <header className="admin-topbar">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="-ml-1" />
              <div>
                <span className="eyebrow">Administration</span>
                <strong>Placement Operations</strong>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {renderProfileMenu("down")}
            </div>
          </header>
        ) : null}
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
