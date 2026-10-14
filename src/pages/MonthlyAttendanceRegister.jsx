import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import ExcelJS from "exceljs";
import "./MonthlyAttendanceRegister.css";
import "./MonthlyAttendanceColors.css";

const list = (value) => (Array.isArray(value) ? value : value?.data || value?.classes || value?.sections || value?.sessions || []);
const current = new Date();
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const codeClass = (code) => ({ P: "is-present", A: "is-absent", L: "is-leave", LT: "is-late", HD: "is-halfday", PO: "is-holiday", LA: "is-off", H: "is-holiday", WO: "is-off", "—": "is-unmarked" }[code] || "");
const sectionClassId = (section) => section?.class_id ?? section?.classId ?? section?.ClassId ?? section?.class?.id ?? section?.Class?.id;
const rowId = (item, alternate) => item?.id ?? item?.[alternate];
const hasSelection = (value) => value !== "" && value !== null && value !== undefined;

export default function MonthlyAttendanceRegister() {
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [filters, setFilters] = useState({ session_id: "", class_id: "", section_id: "", month: String(current.getMonth() + 1), year: String(current.getFullYear()) });
  const [report, setReport] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Custom Date Range Export - EduBridge
  const [customExportOpen, setCustomExportOpen] = useState(false);
  const [customExportBusy, setCustomExportBusy] = useState(false);
  const [customExportError, setCustomExportError] = useState("");
  const [customExport, setCustomExport] = useState({
    from: `${current.getFullYear()}-04-01`,
    to: current.toISOString().slice(0, 10),
    section: "selected",
    type: "all",
    format: "both",
  });

  useEffect(() => {
    Promise.all([
      api.get("/sessions"),
      api.get("/classes"),
      api.get("/sections").catch(() => ({ data: [] })),
    ])
      .then(([sessionRes, classRes, sectionRes]) => {
        const sessionRows = list(sessionRes.data);
        setSessions(sessionRows);
        setClasses(list(classRes.data));
        setSections(list(sectionRes.data));
        const active = sessionRows.find((item) => item.is_active || item.is_current || item.status === "active") || sessionRows[0];
        if (active) setFilters((previous) => ({ ...previous, session_id: String(active.id || active.session_id) }));
      })
      .catch((err) => setError(err.response?.data?.message || "Unable to load filters."));
  }, []);

  const availableSections = useMemo(
    () => sections.filter((section) => {
      if (!hasSelection(filters.class_id)) return true;
      const linkedClassId = sectionClassId(section);
      // This installation uses shared sections (A/B/C) without a class link.
      return linkedClassId === null || linkedClassId === undefined || linkedClassId === "" || Number(linkedClassId) === Number(filters.class_id);
    }),
    [sections, filters.class_id]
  );

  const handleClassChange = async (classId) => {
    setFilters((previous) => ({ ...previous, class_id: classId, section_id: "" }));
    if (!hasSelection(classId)) return;
    try {
      const response = await api.get("/sections", { params: { class_id: classId } });
      const fetched = list(response.data);
      const compatible = Array.isArray(fetched)
        ? fetched.filter((section) => {
            const linkedClassId = sectionClassId(section);
            return linkedClassId === null || linkedClassId === undefined || linkedClassId === "" || Number(linkedClassId) === Number(classId);
          })
        : [];
      if (compatible.length) {
        setSections((previous) => {
          const byId = new Map(previous.map((section) => [String(rowId(section, "section_id")), section]));
          compatible.forEach((section) => byId.set(String(rowId(section, "section_id")), section));
          return [...byId.values()];
        });
        return;
      }
    } catch (_) {
      // Hosted installations with the legacy global Sections table can return
      // an error here. The student-derived fallback below handles that schema.
    }

    try {
      const studentResponse = await api.get("/students");
      const studentRows = list(studentResponse.data);
      const derived = new Map();
      studentRows
        .filter(
          (student) =>
            Number(student.class_id ?? student.classId) === Number(classId) &&
            (!filters.session_id || Number(student.session_id ?? student.sessionId) === Number(filters.session_id))
        )
        .forEach((student) => {
          const id = student.section_id ?? student.sectionId ?? student.Section?.id;
          const name = student.section_name ?? student.Section?.section_name ?? student.section?.section_name;
          if (id !== null && id !== undefined && name) derived.set(String(id), { id, section_id: id, section_name: name, class_id: null });
        });
      if (derived.size) {
        const derivedSections = [...derived.values()];
        setSections(derivedSections);
        if (derivedSections.length === 1) {
          setFilters((previous) => ({ ...previous, section_id: String(derivedSections[0].id) }));
        }
      } else {
        setSections([]);
        setError("No sections or enabled students are configured for the selected class and session.");
      }
    } catch (studentError) {
      setSections([]);
      setError(studentError.response?.data?.message || "Unable to load sections for the selected class.");
    }
  };

  const visibleStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    const students = report?.students || [];
    if (!query) return students;
    return students.filter((student) => [student.roll_number, student.admission_number, student.name, student.father_name].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)));
  }, [report, search]);

  const loadReport = async () => {
    if (!hasSelection(filters.class_id) || !hasSelection(filters.section_id) || !filters.month || !filters.year) {
      setError("Please select class, section, month and year.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/attendance/monthly-register", { params: filters });
      setReport(response.data);
    } catch (err) {
      setReport(null);
      setError(err.response?.data?.message || "Unable to load monthly attendance.");
    } finally {
      setLoading(false);
    }
  };

  // Custom Date Range Export - EduBridge
  const downloadDateRange = async () => {
    setCustomExportError("");
    if (!filters.session_id || !filters.class_id) {
      setCustomExportError("Select a session and class first."); return;
    }
    if (customExport.section === "selected" && !filters.section_id) {
      setCustomExportError("Select a section, or choose All Sections."); return;
    }
    const from = customExport.from;
    const to = customExport.to;
    const parseDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(NaN);
    const start = parseDay(from);
    const end = parseDay(to);
    const dayCount = Math.round((end - start) / 86400000) + 1;
    if (!Number.isFinite(dayCount) || dayCount < 1 || dayCount > 370 || start.toISOString().slice(0, 10) !== from || end.toISOString().slice(0, 10) !== to) {
      setCustomExportError("Choose a valid From/To date range (maximum 370 days)."); return;
    }
    const selection = customExport.section === "all" ? availableSections : availableSections.filter((row) => String(rowId(row, "section_id")) === String(filters.section_id));
    if (!selection.length) { setCustomExportError("No sections available for the selected class."); return; }
    const requested = [];
    for (let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)); d <= end; d.setUTCMonth(d.getUTCMonth() + 1)) {
      requested.push({ month: d.getUTCMonth() + 1, year: d.getUTCFullYear() });
    }
    setCustomExportBusy(true);
    try {
      const responses = [];
      // Sequential requests avoid excessive simultaneous attendance queries.
      for (const section of selection) {
        const sectionId = rowId(section, "section_id");
        for (const item of requested) {
          const response = await api.get("/attendance/monthly-register", { params: {
            session_id: filters.session_id, class_id: filters.class_id,
            section_id: sectionId, month: item.month, year: item.year,
          } });
          responses.push({ section, payload: response.data });
        }
      }
      const byStudent = new Map();
      const daySummary = new Map();
      const monthSummary = new Map();
      const treatPoAsPresent = responses[0]?.payload?.preparatory_off_treatment === "present";
      for (const { section, payload } of responses) {
        const sectionName = section.section_name || section.name || String(rowId(section, "section_id"));
        const sid = String(rowId(section, "section_id"));
        const days = (payload.days || []).filter((day) => day.date >= from && day.date <= to);
        for (const day of days) {
          const monthKey = day.date.slice(0, 7);
          const key = `${sid}|${monthKey}`;
          if (!monthSummary.has(key)) monthSummary.set(key, { Section: sectionName, Month: monthKey, "Working Days": 0, Holidays: 0, "Weekly Off": 0, "Preparatory Off (non-working)": 0 });
          const rec = monthSummary.get(key);
          if (day.is_working_day) rec["Working Days"] += 1;
          if (day.code === "H") rec.Holidays += 1;
          if (day.code === "WO") rec["Weekly Off"] += 1;
          if (day.code === "PO") rec["Preparatory Off (non-working)"] += 1;
          daySummary.set(`${sid}|${day.date}`, { date: day.date, section: sectionName, ...day });
        }
        for (const student of (payload.students || [])) {
          const studentId = String(student.id ?? student.admission_number);
          const key = `${sid}|${studentId}`;
          if (!byStudent.has(key)) byStudent.set(key, {
            Section: sectionName, "Roll No": student.roll_number ?? "", "Admission No": student.admission_number ?? "",
            "Student Name": student.name || "", "Father Name": student.father_name || "", values: {}, monthStats: {},
          });
          const data = byStudent.get(key);
          for (const day of days) {
            const code = student.attendance?.[day.date] || "—";
            data.values[day.date] = code;
            const m = day.date.slice(0, 7);
            if (!data.monthStats[m]) data.monthStats[m] = { P: 0, A: 0, L: 0, LT: 0, HD: 0, PO: 0, LA: 0, UM: 0, WD: 0 };
            const stat = data.monthStats[m];
            if (day.is_working_day) stat.WD++;
            if (code === "P" || code === "A" || code === "L" || code === "LT" || code === "HD" || code === "PO" || code === "LA") stat[code]++;
            else if (day.is_working_day && code === "—") stat.UM++;
          }
        }
      }
      const dates = [];
      for (let t = start.getTime(); t <= end.getTime(); t += 86400000) dates.push(new Date(t).toISOString().slice(0, 10));
      const allowed = {
        all: null, present: new Set(["P"]), absent: new Set(["A"]),
        present_absent: new Set(["P", "A"]), present_absent_leave: new Set(["P", "A", "L"]),
      }[customExport.type];
      const shown = (code) => (!allowed || allowed.has(code)) ? code : "";
      const months = [...new Set(dates.map((d) => d.slice(0, 7)))];
      const stats = (entries) => entries.reduce((acc, item) => {
        for (const field of ["P", "A", "L", "LT", "HD", "PO", "LA", "UM", "WD"]) acc[field] = (acc[field] || 0) + (item[field] || 0);
        return acc;
      }, {});
      const effectiveP = (stat) => (stat.P || 0) + (stat.LT || 0) + (stat.HD || 0) * 0.5 + (treatPoAsPresent ? (stat.PO || 0) : 0);
      const summary = [];
      const details = [];
      for (const student of byStudent.values()) {
        const all = stats(Object.values(student.monthStats));
        const base = { Section: student.Section, "Roll No": student["Roll No"], "Admission No": student["Admission No"], "Student Name": student["Student Name"], "Father Name": student["Father Name"] };
        const row = { ...base };
        for (const month of months) {
          const m = student.monthStats[month] || {};
          row[`${month} P`] = m.P || 0;
          row[`${month} A`] = m.A || 0;
        }
        Object.assign(row, { "Actual P": all.P || 0, "Absent": all.A || 0, "Leave": all.L || 0, "Late": all.LT || 0, "Half Day": all.HD || 0, "PO": all.PO || 0,
          "Late Admission": all.LA || 0, "Unmarked": all.UM || 0, "Working Days": Math.max(0, (all.WD || 0) - (all.LA || 0)),
          "Effective Present": effectiveP(all),
          "Marked": (all.P || 0) + (all.A || 0) + (all.L || 0) + (all.LT || 0) + (all.HD || 0) + (treatPoAsPresent ? (all.PO || 0) : 0),
        });
        row["Attendance %"] = row.Marked ? Math.round(row["Effective Present"] * 10000 / row.Marked) / 100 : 0;
        summary.push(row);
        const detail = { ...base };
        dates.forEach((date) => { detail[date] = shown(student.values[date] || "—"); });
        Object.assign(detail, { "Actual P": all.P || 0, "Absent": all.A || 0, "Effective Present": effectiveP(all) });
        details.push(detail);
      }
      // EduBridge Professional Attendance Excel Export (ExcelJS)
      const schoolName = (document.title || "").split("|")[0].trim() || "School Attendance Register";
      const className = classes.find((c) => String(rowId(c, "class_id")) === String(filters.class_id))?.class_name || String(filters.class_id);
      const selectedSectionName = customExport.section === "all" ? "All Sections" : (selection[0]?.section_name || selection[0]?.name || "Selected Section");
      const prettyDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
      const prettyMonth = (iso) => new Date(`${iso}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
      const excel = new ExcelJS.Workbook();
      excel.creator = "EduBridge ERP";
      excel.subject = "Student Attendance Register";
      const navy = "11355B", dark = "082B4D", blue = "14588A", teal = "087E8B", pale = "EAF4FA", white = "FFFFFF";
      const idKeys = ["Section", "Roll No", "Admission No", "Student Name", "Father Name"];
      const summaryKeys = Object.keys(summary[0] || {});
      const detailKeys = Object.keys(details[0] || {});
      const workingRows = [...monthSummary.values()].map((row) => ({ ...row, Month: prettyMonth(row.Month) }));
      const settingsRows = [
        { Setting: "School", Value: schoolName }, { Setting: "Session", Value: sessions.find((s) => String(rowId(s,"session_id")) === String(filters.session_id))?.session_name || filters.session_id },
        { Setting: "Class", Value: className }, { Setting: "Section", Value: selectedSectionName },
        { Setting: "From Date", Value: prettyDate(from) }, { Setting: "To Date", Value: prettyDate(to) },
        { Setting: "Attendance Filter", Value: {all:"All Attendance",present:"Present Only",absent:"Absent Only",present_absent:"Present & Absent",present_absent_leave:"Present, Absent & Leave"}[customExport.type] },
        { Setting: "PO Treatment", Value: responses[0]?.payload?.preparatory_off_treatment || "excluded" },
        { Setting: "Note", Value: "Daily cells follow the selected filter; totals use actual saved attendance codes. PO is never re-labelled P." },
      ];
      const mergeBand = (sheet, row, first, last, title, color, size = 12) => {
        sheet.mergeCells(row, first, row, last);
        const c = sheet.getCell(row, first); c.value = title;
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${color}` } };
        c.font = { name: "Aptos Display", size, bold: true, color: { argb: `FF${white}` } };
        c.alignment = { vertical: "middle", horizontal: "center" };
      };
      const newSheet = (name, keys, rows, opts = {}) => {
        const sheet = excel.addWorksheet(name, { views: [{ state: "frozen", xSplit: opts.frozenCols ?? Math.min(5, keys.length), ySplit: 7, topLeftCell: "A8" }], pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
        const last = keys.length;
        sheet.properties.defaultRowHeight = 21;
        sheet.getRow(1).height = 33; mergeBand(sheet, 1, 1, last, schoolName.toUpperCase(), navy, 18);
        sheet.getRow(2).height = 26; mergeBand(sheet, 2, 1, last, `STUDENT ATTENDANCE • ${name.toUpperCase()}`, blue, 12);
        sheet.getRow(3).height = 25; mergeBand(sheet, 3, 1, last, `Class: ${className}  |  Section: ${selectedSectionName}  |  ${prettyDate(from)} – ${prettyDate(to)}`, teal, 11);
        sheet.getRow(4).height = 24; mergeBand(sheet, 4, 1, last, `Session: ${settingsRows[1].Value}     •     Students: ${byStudent.size}     •     Filter: ${settingsRows[6].Value}`, navy, 10);
        sheet.getRow(5).height = 10;
        sheet.getRow(6).height = 24;
        sheet.getRow(7).height = 31;
        for (let j = 0; j < last; j++) {
          const key = keys[j], letter = j + 1;
          const width = key === "Student Name" || key === "Father Name" ? 25 : key === "Setting" ? 30 : key === "Value" ? 75 : key === "Section" ? 13 : key === "Admission No" ? 17 : key === "Roll No" ? 12 : key.length > 18 ? 19 : key.length > 10 ? 16 : 12;
          sheet.getColumn(letter).width = opts.detail && j >= 5 && /^\d{4}-/.test(key) ? 9 : Math.min(width, 75);
          const h = sheet.getCell(7, letter); h.value = opts.detail && /^\d{4}-\d{2}-\d{2}$/.test(key) ? key.slice(8,10) : (/^\d{4}-\d{2} P$/.test(key) ? "Present (P)" : /^\d{4}-\d{2} A$/.test(key) ? "Absent (A)" : key);
          h.fill = {type:"pattern",pattern:"solid",fgColor:{argb:`FF${navy}`}};
          h.font = {name:"Aptos",bold:true,color:{argb:"FFFFFFFF"},size:10};
          h.alignment = {horizontal:"center",vertical:"middle",wrapText:true};
          h.border = {bottom:{style:"medium",color:{argb:"FF46AFC0"}}};
        }
        if (opts.monthGroups) {
          keys.forEach((key, idx) => {
            const m = key.match(/^(\d{4}-\d{2}) P$/);
            if (m) { const first = idx + 1; mergeBand(sheet, 6, first, first + 1, prettyMonth(m[1]), teal, 10); }
          });
          if (keys.length >= 5) mergeBand(sheet, 6, 1, 5, "STUDENT INFORMATION", blue, 10);
          const lastMonthCol = 5 + months.length * 2;
          if (lastMonthCol < last) mergeBand(sheet, 6, lastMonthCol + 1, last, "OVERALL TOTALS", blue, 10);
        } else if (opts.detail) {
          mergeBand(sheet, 6, 1, 5, "STUDENT INFORMATION", blue, 10);
          const dateList = keys.filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k));
          const groups = new Map();
          keys.forEach((key, idx) => {if (/^\d{4}-\d{2}-\d{2}$/.test(key)) { const m = key.slice(0,7); if(!groups.has(m)) groups.set(m, [idx+1,idx+1]); else groups.get(m)[1] = idx+1; }});
          groups.forEach(([f,l],m)=>mergeBand(sheet,6,f,l,prettyMonth(m),teal,10));
          if(dateList.length + 5 < last) mergeBand(sheet, 6, dateList.length+6, last, "TOTALS", blue, 10);
        } else mergeBand(sheet,6,1,last,"REPORT DETAILS",blue,10);
        if (rows.length === 0) rows = [{ [keys[0]]: "No records for the selected filters" }];
        for (const [ri, record] of rows.entries()) {
          const r = sheet.getRow(ri + 8); r.height = 23;
          keys.forEach((key, j) => {
            const c = r.getCell(j+1);
            c.value = record[key] ?? "";
            c.font = {name:"Aptos",size:10,color:{argb:"FF18324A"},bold:key === "Student Name"};
            c.fill = {type:"pattern",pattern:"solid",fgColor:{argb:ri % 2 ? "FFF0F6FA":"FFFFFFFF"}};
            c.alignment = {vertical:"middle",horizontal: j < 5 ? "left" : "center",wrapText:j<5};
            c.border = {bottom:{style:"hair",color:{argb:"FFDCE7EF"}}};
            if (typeof c.value === "string" && ({P:"D8F4E4",A:"FFE0E0",PO:"EADFFF",H:"E8E1FA",WO:"E2E8F0",L:"FFF1CE",LT:"DEEDFA",HD:"DEEDFA"}[c.value])) {
              c.fill = {type:"pattern",pattern:"solid",fgColor:{argb:`FF${({P:"D8F4E4",A:"FFE0E0",PO:"EADFFF",H:"E8E1FA",WO:"E2E8F0",L:"FFF1CE",LT:"DEEDFA",HD:"DEEDFA"})[c.value]}`}};
              c.font = {bold:true,color:{argb: c.value === "A" ? "FF9F1239" : "FF155E4B"}};
            }
            if (key === "Attendance %" && typeof c.value === "number") c.numFmt = '0.00"%"';
          });
        }
        sheet.autoFilter = {from:{row:7,column:1},to:{row:7,column:last}};
        sheet.headerFooter.oddFooter = 'EduBridge ERP • Confidential School Report &P / &N';
        return sheet;
      };
      if (customExport.format !== "detailed") newSheet("Attendance Summary", summaryKeys.length ? summaryKeys : idKeys, summary, {monthGroups:true});
      if (customExport.format !== "summary") newSheet("Daily Attendance", detailKeys.length ? detailKeys : idKeys, details, {detail:true});
      newSheet("Working Days", ["Section","Month","Working Days","Holidays","Weekly Off","Preparatory Off (non-working)"], workingRows, {frozenCols:2});
      newSheet("Export Settings", ["Setting","Value"], settingsRows, {frozenCols:1});
      const bytes = await excel.xlsx.writeBuffer();
      const blob = new Blob([bytes], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = `attendance-${from}-to-${to}.xlsx`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setCustomExportOpen(false);
    } catch (err) {
      setCustomExportError(err.response?.data?.message || err.message || "Could not export attendance.");
    } finally { setCustomExportBusy(false); }
  };

  const exportCsv = () => {
    if (!report) return;
    const headers = ["Roll Number", "Admission Number", "Student Name", "Father Name", ...report.days.map((day) => `${day.day} ${day.weekday}`), "Working Days", "Marked", "Present", "Absent", "Leave", "Late", "Half Day", "Unmarked", "Month Attendance %", "Previous Marked", "Previous Present", "Previous Attendance %", "Till Month Marked", "Till Month Present", "Till Month Attendance %"];
    const csvRows = visibleStudents.map((student) => [student.roll_number, student.admission_number, student.name, student.father_name, ...report.days.map((day) => { const code = student.attendance?.[day.date] || "—"; const reason = day.code === "H" ? day.description : student.attendance_remarks?.[day.date]; return code === "H" && reason ? `H - ${reason}` : code; }), student.working_days ?? report.working_days, student.totals.marked, student.totals.present, student.totals.absent, student.totals.leave, student.totals.late, student.totals.halfday, student.totals.unmarked, student.attendance_percentage, student.previous_totals?.marked || 0, student.previous_totals?.present || 0, student.previous_totals?.attendance_percentage || 0, student.cumulative_totals?.marked || 0, student.cumulative_totals?.present || 0, student.cumulative_totals?.attendance_percentage || 0]);
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const blob = new Blob([[headers, ...csvRows].map((row) => row.map(escape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `attendance-${report.class?.class_name}-${report.section?.section_name}-${report.year}-${String(report.month).padStart(2, "0")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="monthly-register-page container-fluid py-3">
      <section className="monthly-register-hero">
        <div><div className="hero-kicker">Academic Operations</div><h2>Monthly Attendance Register</h2><p>Complete student attendance, daily status and monthly totals in one register.</p></div>
        <div className="hero-icon"><i className="bi bi-calendar2-check" /></div>
      </section>

      <section className="card border-0 shadow-sm filter-card">
        <div className="card-body"><div className="row g-3 align-items-end">
          <div className="col-sm-6 col-xl-2"><label className="form-label">Session</label><select className="form-select" value={filters.session_id} onChange={(event) => setFilters({ ...filters, session_id: event.target.value })}><option value="">All sessions</option>{sessions.map((item) => <option key={rowId(item, "session_id")} value={rowId(item, "session_id")}>{item.name || item.session_name}</option>)}</select></div>
          <div className="col-sm-6 col-xl-2"><label className="form-label">Class</label><select className="form-select" value={filters.class_id} onChange={(event) => handleClassChange(event.target.value)}><option value="">Select class</option>{classes.map((item) => <option key={rowId(item, "class_id")} value={rowId(item, "class_id")}>{item.class_name || item.name}</option>)}</select></div>
          <div className="col-sm-6 col-xl-2"><label className="form-label">Section</label><select className="form-select" value={filters.section_id} onChange={(event) => setFilters({ ...filters, section_id: event.target.value })}><option value="">Select section</option>{availableSections.map((item) => <option key={rowId(item, "section_id")} value={rowId(item, "section_id")}>{item.section_name || item.name}</option>)}</select></div>
          <div className="col-sm-6 col-xl-2"><label className="form-label">Month</label><select className="form-select" value={filters.month} onChange={(event) => setFilters({ ...filters, month: event.target.value })}>{monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></div>
          <div className="col-sm-6 col-xl-2"><label className="form-label">Year</label><input className="form-control" type="number" min="2000" max="2200" value={filters.year} onChange={(event) => setFilters({ ...filters, year: event.target.value })} /></div>
          <div className="col-sm-6 col-xl-2"><button className="btn btn-primary w-100" onClick={loadReport} disabled={loading}>{loading ? <><span className="spinner-border spinner-border-sm me-2" />Loading</> : <><i className="bi bi-search me-2" />View Register</>}</button></div>
        </div></div>
      </section>

      <div className="d-flex justify-content-end mt-3 mb-2">
        <button className="btn btn-outline-primary" onClick={() => { setCustomExportError(""); setCustomExportOpen(true); }}>
          <i className="bi bi-calendar-range me-2" />Custom Date Range Export
        </button>
      </div>
      {customExportOpen && <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true" style={{ background: "rgba(0,0,0,.55)" }}>
        <div className="modal-dialog modal-lg modal-dialog-centered"><div className="modal-content">
          <div className="modal-header"><h5 className="modal-title">Export Attendance by Date Range</h5><button type="button" className="btn-close" disabled={customExportBusy} onClick={() => setCustomExportOpen(false)} aria-label="Close" /></div>
          <div className="modal-body"><div className="row g-3">
            <div className="col-md-6"><label className="form-label">From Date</label><input className="form-control" type="date" value={customExport.from} onChange={(e) => setCustomExport({ ...customExport, from: e.target.value })} /></div>
            <div className="col-md-6"><label className="form-label">To Date</label><input className="form-control" type="date" value={customExport.to} onChange={(e) => setCustomExport({ ...customExport, to: e.target.value })} /></div>
            <div className="col-md-6"><label className="form-label">Sections</label><select className="form-select" value={customExport.section} onChange={(e) => setCustomExport({ ...customExport, section: e.target.value })}><option value="selected">Selected Section</option><option value="all">All Sections</option></select></div>
            <div className="col-md-6"><label className="form-label">Attendance Type</label><select className="form-select" value={customExport.type} onChange={(e) => setCustomExport({ ...customExport, type: e.target.value })}><option value="all">All Attendance</option><option value="present">Present Only (P)</option><option value="absent">Absent Only (A)</option><option value="present_absent">Present &amp; Absent</option><option value="present_absent_leave">Present, Absent &amp; Leave</option></select></div>
            <div className="col-md-6"><label className="form-label">Report Format</label><select className="form-select" value={customExport.format} onChange={(e) => setCustomExport({ ...customExport, format: e.target.value })}><option value="both">Summary + Detailed Register</option><option value="summary">Summary Only</option><option value="detailed">Detailed Register Only</option></select></div>
            <div className="col-12"><small className="text-muted">Exports exact selected dates. Non-selected statuses show blank in daily columns; totals are calculated using original records. PO is counted according to school settings and never silently changed into P.</small></div>
            {customExportError && <div className="col-12"><div className="alert alert-danger mb-0">{customExportError}</div></div>}
          </div></div>
          <div className="modal-footer"><button className="btn btn-outline-secondary" disabled={customExportBusy} onClick={() => setCustomExportOpen(false)}>Cancel</button><button className="btn btn-success" disabled={customExportBusy} onClick={downloadDateRange}>{customExportBusy ? "Preparing Excel…" : "Download Excel (.xlsx)"}</button></div>
        </div></div>
      </div>}

      {error && <div className="alert alert-danger mt-3 mb-0"><i className="bi bi-exclamation-circle me-2" />{error}</div>}

      {report && <>
        <section className="register-summary-grid">
          <Summary icon="bi-people" label="Students" value={report.total_students} tone="blue" />
          <Summary icon="bi-calendar-check" label="Working Days" value={report.working_days} tone="green" />
          <Summary icon="bi-building" label="Class & Section" value={`${report.class?.class_name || "—"} - ${report.section?.section_name || "—"}`} tone="purple" />
          <Summary icon="bi-calendar3" label="Register Month" value={`${monthNames[report.month - 1]} ${report.year}`} tone="orange" />
        </section>

        <section className="card border-0 shadow-sm register-card">
          <div className="register-toolbar"><div><h5>Student Attendance Register</h5><small>{visibleStudents.length} of {report.total_students} students</small></div><div className="register-actions"><div className="input-group"><span className="input-group-text"><i className="bi bi-search" /></span><input className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student, roll or admission no." /></div><button className="btn btn-outline-success" onClick={exportCsv}><i className="bi bi-file-earmark-spreadsheet me-2" />Export Excel</button></div></div>
          <div className="attendance-legend">{Object.entries(report.legend || {}).map(([code, label]) => <span key={code}><b className={codeClass(code)}>{code}</b>{label}</span>)}</div>
          <div className="monthly-register-scroll">
            <table className="table monthly-register-table">
              <thead><tr>
                <th className="sticky-col col-roll">Roll No.</th><th className="sticky-col col-admission">Admission No.</th><th className="sticky-col col-student">Student Name</th><th className="sticky-col col-father">Father Name</th>
                {report.days.map((day) => <th key={day.date} className={`day-column ${!day.is_working_day ? "non-working" : ""}`} title={day.description || day.weekday}><span>{day.day}</span><small>{day.weekday}</small></th>)}
                <th>WD</th><th title="Marked days">MK</th><th>P</th><th>A</th><th>L</th><th>LT</th><th>HD</th><th>UM</th><th title="Selected month, marked days only">Month %</th>
                <th className="carry-column" title="Previous months: Present / Marked">Previous P/MK</th><th className="carry-column" title="Previous months, marked days only">Previous %</th>
                <th className="cumulative-column" title="Through selected month: Present / Marked">Till Month P/MK</th><th className="cumulative-column" title="Through selected month, marked days only">Till Month %</th>
              </tr></thead>
              <tbody>
                {visibleStudents.map((student, studentIndex) => <tr key={student.id}>
                  <td className="sticky-col col-roll">{student.roll_number || "—"}</td><td className="sticky-col col-admission">{student.admission_number || "—"}</td><td className="sticky-col col-student student-name">{student.name || "—"}</td><td className="sticky-col col-father">{student.father_name || "—"}</td>
                  {report.days.map((day) => {
                    const code = student.attendance?.[day.date] || "—";
                    if (day.code === "H") {
                      if (studentIndex > 0) return null;
                      return <td key={day.date} rowSpan={visibleStudents.length} className="attendance-code is-holiday merged-holiday" title={day.description || "Holiday"}>
                        <span>{day.description && day.description !== "Holiday" ? `Holiday — ${day.description}` : "Holiday"}</span>
                      </td>;
                    }
                    return <td key={day.date} title={student.attendance_remarks?.[day.date] || undefined} className={`attendance-code ${codeClass(code)}`}>{code}</td>;
                  })}
                  <td className="total-cell">{student.working_days ?? report.working_days}</td><td className="total-cell">{student.totals.marked}</td><td className="total-cell text-success">{student.totals.present}</td><td className="total-cell text-danger">{student.totals.absent}</td><td className="total-cell text-warning">{student.totals.leave}</td><td>{student.totals.late}</td><td>{student.totals.halfday}</td><td>{student.totals.unmarked}</td>
                  <td><Percent value={student.attendance_percentage} /></td>
                  <td className="carry-column total-cell">{student.previous_totals?.present || 0}/{student.previous_totals?.marked || 0}</td><td className="carry-column"><Percent value={student.previous_totals?.attendance_percentage || 0} /></td>
                  <td className="cumulative-column total-cell">{student.cumulative_totals?.present || 0}/{student.cumulative_totals?.marked || 0}</td><td className="cumulative-column"><Percent value={student.cumulative_totals?.attendance_percentage || 0} /></td>
                </tr>)}
                {!visibleStudents.length && <tr><td colSpan={(report.days?.length || 0) + 17} className="text-center py-5 text-muted">No matching students found.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </>}
    </div>
  );
}

function Summary({ icon, label, value, tone }) { return <div className={`summary-card tone-${tone}`}><div className="summary-icon"><i className={`bi ${icon}`} /></div><div><small>{label}</small><strong>{value}</strong></div></div>; }
function Percent({ value = 0 }) { return <span className={`percentage-pill ${Number(value) >= 75 ? "good" : "low"}`}>{value}%</span>; }
