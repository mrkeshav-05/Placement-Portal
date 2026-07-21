"use client";

import Link from "next/link";
import { BarChart3, BellRing, BriefcaseBusiness, Building2, ClipboardCheck, FileQuestion, FileText, GraduationCap, Menu, Settings, ShieldCheck, Users, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

const nav = [
  ["Overview", "/admin/dashboard", BarChart3],
  ["Announcements", "/admin/announcements", BellRing],
  ["Companies", "/admin/companies", Building2],
  ["Job profiles", "/admin/job-profiles", BriefcaseBusiness],
  ["Applications", "/admin/applications", ClipboardCheck],
  ["Students", "/admin/students", GraduationCap],
  ["Feedbacks", "/admin/feedbacks", FileQuestion],
  ["NOC requests", "/admin/noc-requests", FileText],
  ["Team", "/admin/team", Users],
  ["Settings", "/admin/settings", Settings],
] as const;

export function AdminShell({ children, admin }: { children: React.ReactNode; admin: { name: string; initials: string } }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return <div className="admin-shell"><button className="menu-button" onClick={() => setOpen(true)} aria-label="Open menu"><Menu/></button>{open && <button className="backdrop" onClick={() => setOpen(false)} aria-label="Close menu"/>}<aside className={open ? "sidebar-open" : ""}><button className="close-button" onClick={() => setOpen(false)}><X/></button><div className="admin-brand"><ShieldCheck/><div><strong>T&P Admin</strong><span>IIIT Lucknow</span></div></div><nav>{nav.map(([label, href, Icon]) => <Link className={path === href ? "active" : ""} href={href} key={href} onClick={() => setOpen(false)}><Icon/><span>{label}</span></Link>)}</nav><Link className="student-portal-link" href="/dashboard">Open student portal →</Link></aside><main><header className="admin-topbar"><div><span className="eyebrow">Administration</span><strong>Placement Operations</strong></div><div className="admin-user"><span>{admin.initials}</span><div><strong>{admin.name}</strong><small>Administrator</small></div></div></header>{children}</main></div>;
}
