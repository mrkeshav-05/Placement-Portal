"use client";
import { Check } from "lucide-react";
import { useState } from "react";
export function ApplyButton({disabled=false}:{disabled?:boolean}){const[applied,setApplied]=useState(false);return <button className={`apply-button ${applied?"applied":""}`} disabled={disabled||applied} onClick={()=>setApplied(true)}>{applied?<><Check/>Application submitted</>:disabled?"Applications closed":"Apply with default resume"}</button>}
