export type StudentEligibility={cgpa:number;batch:number;branch:string;degree:string|null;gender:string|null;backlogs:number;bans:number;documentsComplete:boolean;class10Percent:number|null;class12Percent:number|null};
export type JobEligibility={minCgpa:number;batch:number;branches:readonly string[];degrees:readonly string[];genders:readonly string[];maxBacklogs:number;maxBans?:number;min10Percent?:number|null;min12Percent?:number|null};
export type EligibilityCheck={key:string;label:string;pass:boolean};

function normalizeBranch(branch:string):string{return branch.trim().toUpperCase()}

/**
 * Degree and gender are free text on both sides: the student types them into
 * their profile and the administrator types a comma-separated list into the
 * job form. Punctuation and spacing therefore differ constantly ("B.Tech",
 * "b tech", "BTech"), so matching compares letters and digits only. Branch
 * keeps its looser trim-and-uppercase rule, because branch codes carry no
 * punctuation and widening that comparison would quietly make students
 * eligible for jobs they are currently excluded from.
 */
function normalizeToken(value:string):string{return value.trim().toUpperCase().replace(/[^A-Z0-9]/g,"")}

/**
 * An empty list means the job places no restriction on this attribute, which
 * is how every job created before these criteria were evaluated behaves. An
 * explicit "all" or "any" means the same thing, because the form invites free
 * text and administrators write it.
 */
function unrestricted(allowed:readonly string[]):boolean{
  const tokens=allowed.map(normalizeToken).filter(Boolean);
  return tokens.length===0||tokens.some(token=>token==="ALL"||token==="ANY");
}

/**
 * A restriction the student's profile cannot answer fails. Leaving it open
 * would let an unset field satisfy a criterion the placement cell set
 * deliberately.
 */
function matchesRestriction(value:string|null,allowed:readonly string[]):boolean{
  if(unrestricted(allowed))return true;
  const normalized=value?normalizeToken(value):"";
  if(!normalized)return false;
  return allowed.map(normalizeToken).includes(normalized);
}

/**
 * An unset floor restricts nothing, the same convention `minCgpa`'s own
 * default of 0 already carries. A set floor the student's profile cannot
 * answer fails it, rather than silently passing an unset field.
 */
function meetsPercentFloor(value:number|null,floor:number|null|undefined):boolean{
  if(floor==null)return true;
  return value!=null&&value>=floor;
}

export function evaluateEligibility(student:StudentEligibility,job:JobEligibility):EligibilityCheck[]{
  return[
    {key:"cgpa",label:`CGPA ${student.cgpa} ≥ ${job.minCgpa}`,pass:student.cgpa>=job.minCgpa},
    {key:"class10Percent",label:job.min10Percent==null?"10th percentage: no minimum":`10th percentage ${student.class10Percent??"not set"} ≥ ${job.min10Percent}`,pass:meetsPercentFloor(student.class10Percent,job.min10Percent)},
    {key:"class12Percent",label:job.min12Percent==null?"12th percentage: no minimum":`12th percentage ${student.class12Percent??"not set"} ≥ ${job.min12Percent}`,pass:meetsPercentFloor(student.class12Percent,job.min12Percent)},
    {key:"batch",label:`Batch ${student.batch}`,pass:student.batch===job.batch},
    {key:"branch",label:`Branch ${student.branch}`,pass:job.branches.map(normalizeBranch).includes(normalizeBranch(student.branch))},
    {key:"degree",label:unrestricted(job.degrees)?"Degree: open to all":`Degree ${student.degree||"not set"}`,pass:matchesRestriction(student.degree,job.degrees)},
    {key:"gender",label:unrestricted(job.genders)?"Open to all genders":`Gender ${student.gender||"not set"}`,pass:matchesRestriction(student.gender,job.genders)},
    {key:"backlogs",label:`Backlogs ${student.backlogs} ≤ ${job.maxBacklogs}`,pass:student.backlogs<=job.maxBacklogs},
    {key:"bans",label:`Placement bans ${student.bans} ≤ ${job.maxBans??0}`,pass:student.bans<=(job.maxBans??0)},
    {key:"documents",label:"Profile documents complete",pass:student.documentsComplete},
  ];
}

export function isEligible(checks:EligibilityCheck[]){return checks.every(check=>check.pass)}
