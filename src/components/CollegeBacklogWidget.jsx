import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
export default function CollegeBacklogWidget(){
 const [rows,setRows]=useState([]); useEffect(()=>{let on=true;api.get("/college-backlogs/my").then(({data})=>on&&setRows(data?.backlogs||[])).catch(()=>{});return()=>{on=false};},[]);
 const pending=rows.filter(r=>r.status!=="cleared"); if(!pending.length)return null;
 return <div className="card border-0 shadow-sm mb-3"><div className="card-body d-flex align-items-center justify-content-between gap-3"><div><span className="badge text-bg-danger mb-2">Academic Alert</span><h5 className="mb-1">{pending.length} Pending Backlog{pending.length>1?"s":""}</h5><p className="text-muted mb-0 small">Register for reappear and track clearance attempts.</p></div><Link to="/college-backlogs" className="btn btn-outline-danger btn-sm">View Backlogs</Link></div></div>;
}
