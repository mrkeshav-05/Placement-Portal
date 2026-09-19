"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  CircleUserRound,
  ClipboardList,
  FileQuestion,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Phone,
  Users,
} from "lucide-react";
import { useState } from "react";
import { handleSignOut } from "@/lib/actions/auth";
import { ThemeToggle } from "@/components/shared/theme-toggle";
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
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navigation = [
  ["Dashboard", "/dashboard", LayoutDashboard],
  ["Company events", "/company-events", Building2],
  ["Applications", "/applications", ClipboardList],
  ["Interview experiences", "/interview-experiences", MessageSquareText],
  ["Feedback or query", "/feedback/new", FileQuestion],
  ["My feedbacks", "/feedback", BriefcaseBusiness],
  ["Profile", "/profile", CircleUserRound],
  ["Forms & documents", "/forms", FileText],
  ["Contact us", "/contact", Phone],
  ["Our team", "/team", Users],
] as const;

export function PortalShell({
  children,
  student,
}: {
  children: React.ReactNode;
  student: { name: string; initials: string; subtitle: string };
}) {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <SidebarProvider>
      {/* Icon rail on collapse, matching the admin shell. */}
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border px-4 py-4 group-data-[collapsible=icon]:px-2">
          <div className="flex items-center gap-3">
            {/* Matches the admin shell: the PNG already has its own alpha
                channel, so the white card behind it only covered that up. */}
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
                Placement Cell
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
              {navigation.map(([label, href, Icon]) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton asChild isActive={pathname === href} tooltip={label}>
                    <Link href={href}>
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          {/* Not a link: the contact route already has a nav entry, and this
              only says who to ask. Hidden in icon mode, where there is no room
              for two lines of prose. */}
          <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-3 group-data-[collapsible=icon]:hidden">
            <Bell size={18} className="shrink-0 text-[var(--blue)]" />
            <div className="min-w-0">
              <strong className="block truncate text-[13px] font-semibold text-[var(--ink)]">
                Need assistance?
              </strong>
              <span className="block truncate text-[12px] text-[var(--muted)]">
                Contact the placement team
              </span>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="topbar">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-1" />
            <div>
              <span className="eyebrow">Student portal</span>
              <strong>Training &amp; Placement Cell</strong>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="student cursor-pointer"
                aria-label="User account menu"
              >
                <div className="avatar">{student.initials}</div>
                <div>
                  <strong>{student.name}</strong>
                  <span>{student.subtitle}</span>
                </div>
              </button>
              {profileOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div className="absolute right-0 mt-3 w-52 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-2xl z-50 overflow-hidden animate-[fadeSlideUp_0.15s_ease] p-1.5">
                    <div className="px-3 py-2 border-b border-[var(--border)] mb-1">
                      <strong className="block text-xs font-bold text-[var(--ink)] truncate">{student.name}</strong>
                      <span className="block text-[10px] text-[var(--muted)] truncate">{student.subtitle}</span>
                    </div>
                    <Link
                      href="/account/password"
                      onClick={() => setProfileOpen(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[var(--ink)] hover:bg-[var(--surface-alt)] font-semibold rounded-xl no-underline transition-colors"
                    >
                      <KeyRound size={15} />
                      Password
                    </Link>
                    <form action={handleSignOut}>
                      <button
                        type="submit"
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[var(--badge-red-text)] hover:bg-[var(--badge-red-bg)] font-semibold rounded-xl bg-transparent border-none cursor-pointer text-left transition-colors"
                      >
                        <LogOut size={15} />
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
      </SidebarInset>
    </SidebarProvider>
  );
}
