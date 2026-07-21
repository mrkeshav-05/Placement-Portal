"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BriefcaseBusiness, Building2, CircleUserRound, ClipboardList, FileQuestion, FileText, LayoutDashboard, Menu, Phone, Users, X } from "lucide-react";
import { useState } from "react";

const navigation = [
  ["Dashboard", "/dashboard", LayoutDashboard], ["Company events", "/company-events", Building2],
  ["Applications", "/applications", ClipboardList], ["Feedback or query", "/feedback/new", FileQuestion],
  ["My feedbacks", "/feedback", BriefcaseBusiness], ["Profile", "/profile", CircleUserRound],
  ["Forms & documents", "/forms", FileText], ["Contact us", "/contact", Phone], ["Our team", "/team", Users]
] as const;

export function PortalShell({ children, student }: { children: React.ReactNode; student: { name: string; initials: string; subtitle: string } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return <div className="portal-shell">
    <button className="menu-button" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu /></button>
    {open && <button className="backdrop" onClick={() => setOpen(false)} aria-label="Close navigation" />}
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <button className="close-button" onClick={() => setOpen(false)} aria-label="Close navigation"><X /></button>
      <div className="brand"><div className="brand-mark">T&P</div><div><strong>Placement Cell</strong><span>IIIT Lucknow</span></div></div>
      <nav aria-label="Main navigation">{navigation.map(([label, href, Icon]) => <Link key={href} href={href} onClick={() => setOpen(false)} className={pathname === href ? "active" : ""}><Icon size={19} /><span>{label}</span></Link>)}</nav>
      <div className="sidebar-help"><Bell size={18} /><div><strong>Need assistance?</strong><span>Contact the placement team</span></div></div>
    </aside>
    <main><header className="topbar"><div><span className="eyebrow">Student portal</span><strong>Training & Placement Cell</strong></div><div className="student"><div className="avatar">{student.initials}</div><div><strong>{student.name}</strong><span>{student.subtitle}</span></div></div></header>{children}</main>
  </div>;
}
