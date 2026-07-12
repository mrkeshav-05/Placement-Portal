"use client";

import { BellRing, BriefcaseBusiness, Building2, CalendarDays, ChevronRight, Clock3, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

const announcements = [
  { company: "Atlassian", title: "Software Engineer Internship", summary: "Build collaboration tools used by teams around the world.", date: "12 Jul 2026", type: "Internship + PPO", category: "Company event", color: "#1868db", initial: "A" },
  { company: "Google", title: "Summer Internship 2027", summary: "Applications are open for the 10-week engineering internship program.", date: "10 Jul 2026", type: "Internship", category: "Company event", color: "#4285f4", initial: "G" },
  { company: "Placement Cell", title: "Pre-placement talk schedule", summary: "The updated presentation schedule is now available in Forms & Documents.", date: "09 Jul 2026", type: "Update", category: "General", color: "#f97316", initial: "P" },
  { company: "Adobe", title: "Member of Technical Staff", summary: "Graduate hiring for engineering and product teams across Noida and Bengaluru.", date: "07 Jul 2026", type: "FTE", category: "Company event", color: "#e11d48", initial: "A" }
];
const filters = ["All", "Company event", "General"];

export function DashboardFeed() {
  const [query, setQuery] = useState(""); const [filter, setFilter] = useState("All");
  const visible = useMemo(() => announcements.filter(a => (filter === "All" || a.category === filter) && `${a.title} ${a.company} ${a.type}`.toLowerCase().includes(query.toLowerCase())), [query, filter]);
  return <div className="dashboard">
    <section className="welcome"><div><span className="eyebrow">Sunday, 12 July</span><h1>Good morning, Aarav <span>👋</span></h1><p>Here’s what’s happening with placements today.</p></div><div className="deadline"><Clock3 /><div><span>Next deadline</span><strong>Atlassian · 18 hours left</strong></div><ChevronRight /></div></section>
    <section className="metrics">
      <article><div className="metric-icon blue"><BriefcaseBusiness /></div><div><span>Open opportunities</span><strong>12</strong><small>4 closing this week</small></div></article>
      <article><div className="metric-icon orange"><CalendarDays /></div><div><span>My applications</span><strong>06</strong><small>2 under review</small></div></article>
      <article><div className="metric-icon green"><Sparkles /></div><div><span>Eligible roles</span><strong>09</strong><small>Based on your profile</small></div></article>
    </section>
    <section className="feed-header"><div><div className="section-icon"><BellRing /></div><div><h2>Announcements</h2><p>Latest opportunities and important updates</p></div></div><button>View all <ChevronRight size={17} /></button></section>
    <section className="filters"><label><Search size={19} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search announcements or companies" /></label><div>{filters.map(item => <button className={filter === item ? "selected" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div></section>
    <section className="announcement-list">{visible.length ? visible.map(item => <article key={item.title}><div className="company-logo" style={{ background: item.color }}>{item.initial}</div><div className="announcement-copy"><div className="announcement-meta"><span>{item.company}</span><i>•</i><span>{item.date}</span></div><h3>{item.title}</h3><p>{item.summary}</p><span className={`tag ${item.type.toLowerCase().replaceAll(" ", "-")}`}>{item.type}</span></div><button aria-label={`Open ${item.title}`}><ChevronRight /></button></article>) : <div className="empty"><Building2 /><h3>No announcements found</h3><p>Try a different search or category.</p></div>}</section>
  </div>;
}
