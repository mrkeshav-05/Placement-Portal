"use client";

import Link from "next/link";
import { BriefcaseBusiness, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { jobProfiles } from "@/lib/mock-data";

export function JobsList(){
  const [query,setQuery]=useState(""); const [type,setType]=useState("All"); const [status,setStatus]=useState("All");
  const jobs=useMemo(()=>jobProfiles.filter(job=>(type==="All"||job.type===type)&&(status==="All"||job.status===status)&&`${job.company} ${job.title} ${job.location}`.toLowerCase().includes(query.toLowerCase())),[query,type,status]);
  return <div className="jobs-page"><section className="page-heading"><div><span className="eyebrow">Opportunities</span><h1>Company events</h1><p>Explore roles and check your eligibility before applying.</p></div><div className="job-count"><BriefcaseBusiness/><strong>{jobProfiles.filter(j=>j.status==="Active").length}</strong><span>active roles</span></div></section><section className="job-filters"><label><Search/><input placeholder="Search company, role, or location" value={query} onChange={e=>setQuery(e.target.value)}/></label><div><SlidersHorizontal/>{["All","Internship","Internship + PPO","FTE"].map(item=><button className={type===item?"selected":""} onClick={()=>setType(item)} key={item}>{item}</button>)}</div><select value={status} onChange={e=>setStatus(e.target.value)} aria-label="Filter by status"><option>All</option><option>Active</option><option>Closed</option></select></section><section className="jobs-table"><div className="jobs-row jobs-head"><span>Company & role</span><span>Location</span><span>Deadline</span><span>Status</span><span/></div>{jobs.map(job=><Link className="jobs-row" href={`/company-events/${job.id}`} key={job.id}><span className="job-company"><i style={{background:job.color}}>{job.initials}</i><span><strong>{job.title}</strong><small>{job.company} · {job.type}</small></span></span><span className="job-location"><MapPin/>{job.location}</span><span>{job.deadline}</span><span><b className={`status ${job.status.toLowerCase()}`}>{job.status}</b></span><span className="view-job">View role →</span></Link>)}{!jobs.length&&<div className="empty"><Search/><h3>No matching roles</h3><p>Change your search or filters.</p></div>}</section></div>
}
