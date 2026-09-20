// controllers/reportCardController.js
"use strict";

const { Op } = require("sequelize");
const {
  sequelize,
  Student,
  Subject,
  ExamSchedule,
  ExamScheme,
  Exam,
  AssessmentComponent,
  StudentExamResult,
  GradeScheme,
  Incharge,
  Class,
  Section,
  ClassCoScholasticArea,
  CoScholasticArea,
  StudentCoScholasticEvaluation,
  CoScholasticGrade,
  StudentRemark,
  Attendance,
  Term,
  AcademicYear,
  ReportCardFormatClass,
  ReportCardFormat,
  // ✅ IMPORTANT: prevent ReferenceError in attendance summary
  StudentTermAttendance, // may be undefined if not exported; we guard below

  // ✅ NEW: needed to include students who were promoted after previous-session result
  StudentPromotionDecision, // may be undefined if not exported; we guard below
} = require("../models");

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const axios = require("axios");

const {
  PRESENT_CODES,
  normalizeCalculationMethod,
  normalizeMissingMarksPolicy,
  buildDisplayDefinitions,
  calculateDisplayResult,
  effectiveMaxMarks,
  finalWeightage,
} = require("../utils/examSchemeRules");

/* ============================================================
 * ✅ CONFIG
 * ============================================================ */
const PDF_ENDPOINT_NAME = "FinalWeightedReport";

/* ============================================================
 * ✅ Small helpers
 * ============================================================ */
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const hasValue = (v) =>
  v !== undefined && v !== null && String(v).trim() !== "";

const asIdArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0);
  }

  if (!hasValue(value)) return [];

  const str = String(value).trim();

  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) {
      return parsed.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0);
    }
  } catch (_) {}

  return str
    .split(",")
    .map((x) => Number(String(x).trim()))
    .filter((x) => Number.isFinite(x) && x > 0);
};

const normalizeSubjectComponents = (subjectComponents, subjectIdsInput) => {
  let rows = [];

  if (Array.isArray(subjectComponents)) {
    rows = subjectComponents;
  } else if (hasValue(subjectComponents)) {
    try {
      const parsed = JSON.parse(String(subjectComponents));
      if (Array.isArray(parsed)) rows = parsed;
    } catch (_) {}
  }

  if (!rows.length) {
    const subjectIds = asIdArray(subjectIdsInput);
    rows = subjectIds.map((subject_id) => ({ subject_id }));
  }

  return rows
    .map((row) => {
      if (typeof row === "number" || typeof row === "string") {
        return { subject_id: Number(row) };
      }
      return {
        ...row,
        subject_id: Number(row?.subject_id ?? row?.id),
      };
    })
    .filter((row) => Number.isFinite(Number(row.subject_id)) && Number(row.subject_id) > 0);
};

const uniqueNumbers = (arr = []) =>
  [...new Set((arr || []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))];

const hasRawAttr = (model, attr) => !!model?.rawAttributes?.[attr];

/**
 * ✅ For previous-session report cards:
 * Students may now be promoted to next class in students.class_id.
 * So report must include:
 * 1) students still currently in selected class/section
 * 2) students found in StudentPromotionDecisions for selected old class/section/session/term
 *
 * This helper safely falls back to old behavior if:
 * - session_id not passed
 * - StudentPromotionDecision not exported
 * - no promotion rows exist
 */
const getStudentsForReportClassSection = async ({
  session_id,
  class_id,
  section_id,
  termIds = [],
  attributes = null,
  include = null,
}) => {
  const classIdNum = toNum(class_id);
  const sectionIdNum = toNum(section_id);
  const sessionIdNum = toNum(session_id);
  const selectedTermIds = uniqueNumbers(termIds);

  const baseWhere = {
    class_id: classIdNum,
    section_id: sectionIdNum,
    status: "enabled",
  };

  const findOptions = {
    where: baseWhere,
    order: [["roll_number", "ASC"], ["name", "ASC"]],
  };

  if (attributes) findOptions.attributes = attributes;
  if (include) findOptions.include = include;

  const normalStudents = await Student.findAll(findOptions);

  let promotedStudentIds = [];

  if (StudentPromotionDecision && sessionIdNum && selectedTermIds.length > 0) {
    try {
      const promotedRows = await StudentPromotionDecision.findAll({
        where: {
          session_id: sessionIdNum,
          class_id: classIdNum,
          section_id: sectionIdNum,
          term_id: { [Op.in]: selectedTermIds },
          promotion_status: "PROMOTED",
        },
        attributes: ["student_id"],
      });

      promotedStudentIds = uniqueNumbers(promotedRows.map((r) => r.student_id));
    } catch (e) {
      console.warn(
        "⚠️ StudentPromotionDecision lookup failed. Continuing with normal students only:",
        e.message
      );
      promotedStudentIds = [];
    }
  }

  const allStudentIds = uniqueNumbers([
    ...normalStudents.map((s) => s.id),
    ...promotedStudentIds,
  ]);

  if (!allStudentIds.length) {
    return {
      students: [],
      normalStudentCount: normalStudents.length,
      promotedStudentIds,
    };
  }

  const finalOptions = {
    where: {
      id: { [Op.in]: allStudentIds },
      status: "enabled",
    },
    order: [["roll_number", "ASC"], ["name", "ASC"]],
  };

  if (attributes) finalOptions.attributes = attributes;
  if (include) finalOptions.include = include;

  const students = await Student.findAll(finalOptions);

  return {
    students,
    normalStudentCount: normalStudents.length,
    promotedStudentIds,
  };
};

/* ============================================================
 * ✅ GET /report-card/students
 * ============================================================ */
exports.getReportCardStudents = async (req, res) => {
  try {
    let { class_id, section_id, student_ids } = req.query;
    const userId = req.user.id;
    const userRoles = (req.user.roles || []).map((r) => r.slug || r);

    // Normalize student_ids from query
    let idList = [];
    if (student_ids) {
      if (Array.isArray(student_ids)) idList = student_ids;
      else idList = String(student_ids).split(",");
      idList = idList.map((id) => parseInt(id, 10)).filter(Boolean);
    }

    // CASE 1: student_ids provided → fetch only by IDs.
    // ✅ Previous-session safe:
    // Frontend sends class_id + section_id + student_ids for report card.
    // If a student is promoted, Student.Class is now the NEW/current class.
    // For report cards, we must display the SELECTED report class/section,
    // not the student's current promoted class.
    if (idList.length > 0) {
      const studentsRows = await Student.findAll({
        where: {
          id: { [Op.in]: idList },
          status: "enabled",
        },
        order: [["roll_number", "ASC"], ["name", "ASC"]],
        include: [
          { model: Class, as: "Class", attributes: ["class_name"] },
          { model: Section, as: "Section", attributes: ["section_name"] },
        ],
      });

      const selectedClass = class_id
        ? await Class.findByPk(class_id, { attributes: ["id", "class_name"] })
        : null;

      const selectedSection = section_id
        ? await Section.findByPk(section_id, { attributes: ["id", "section_name"] })
        : null;

      const students = studentsRows.map((s) => {
        const obj = s.toJSON();

        // ✅ These fields are explicit and safe for frontend use
        obj.report_class_id = selectedClass?.id ?? obj.class_id ?? null;
        obj.report_class_name =
          selectedClass?.class_name || obj.Class?.class_name || "-";

        obj.report_section_id = selectedSection?.id ?? obj.section_id ?? null;
        obj.report_section_name =
          selectedSection?.section_name || obj.Section?.section_name || "-";

        // ✅ Backward compatible: existing frontend uses info.Class.class_name
        // and info.Section.section_name, so override only for this report-card call.
        if (selectedClass) {
          obj.Class = {
            ...(obj.Class || {}),
            id: selectedClass.id,
            class_name: selectedClass.class_name,
          };
        }

        if (selectedSection) {
          obj.Section = {
            ...(obj.Section || {}),
            id: selectedSection.id,
            section_name: selectedSection.section_name,
          };
        }

        return obj;
      });

      return res.status(200).json({ students });
    }

    // CASE 2: No student_ids → class/section based
    if (!class_id || !section_id) {
      const assigned = await Incharge.findOne({ where: { teacherId: userId } });

      if (!assigned) {
        return res.status(400).json({
          message:
            "class_id / section_id or student_ids required (and you're not an incharge).",
        });
      }

      class_id = assigned.classId;
      section_id = assigned.sectionId;
    }

    // If not admin/superadmin → ensure incharge of requested class/section
    if (!userRoles.includes("admin") && !userRoles.includes("superadmin")) {
      const isIncharge = await Incharge.findOne({
        where: { classId: class_id, sectionId: section_id, teacherId: userId },
      });

      if (!isIncharge) {
        return res.status(403).json({
          message: "Access denied. You are not incharge of this class-section.",
        });
      }
    }

    const students = await Student.findAll({
      where: {
        class_id,
        section_id,
        status: "enabled",
      },
      order: [["roll_number", "ASC"], ["name", "ASC"]],
      include: [
        { model: Class, as: "Class", attributes: ["class_name"] },
        { model: Section, as: "Section", attributes: ["section_name"] },
      ],
    });

    return res.status(200).json({ students });
  } catch (error) {
    console.error("Error in getReportCardStudents:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

/* ============================================================
 * ✅ POST /report-card/scholastic-summary
 * NOTE: This calls your existing helper getScholasticSummaryForReportCard
 * ============================================================ */
exports.getScholasticSummary = async (req, res) => {
  try {
    let {
      class_id,
      section_id,
      exam_ids,
      subjectComponents,
      grade_scheme_id,
      student_ids = [],
    } = req.body;

    const userId = req.user.id;

    // Auto-detect class/section for incharge
    if (!class_id || !section_id) {
      const assigned = await Incharge.findOne({ where: { teacherId: userId } });

      if (!assigned) {
        return res.status(400).json({
          message: "Class/Section not provided and you're not an incharge.",
        });
      }

      class_id = assigned.classId;
      section_id = assigned.sectionId;
    }

    // Check if this incharge is allowed (teacher-only gate)
    const isIncharge = await Incharge.findOne({
      where: { classId: class_id, sectionId: section_id, teacherId: userId },
    });
    if (!isIncharge) {
      return res.status(403).json({
        message: "You are not incharge of this class-section.",
      });
    }

    if (!Array.isArray(exam_ids) || exam_ids.length === 0) {
      return res
        .status(400)
        .json({ message: "exam_ids must be a non-empty array." });
    }

    // This helper must exist in your project
    const data = await getScholasticSummaryForReportCard({
      class_id,
      section_id,
      exam_ids,
      subjectComponents,
      gradeSchemeId: grade_scheme_id,
      student_ids,
    });

    return res.json(data);
  } catch (error) {
    console.error("🔥 Error in getScholasticSummary:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error });
  }
};

/* ============================================================
 * ✅ GET /report-card/coscholastic-summary
 * GET Co-Scholastic Grades per Student (term-wise)
 * ============================================================ */
exports.getCoScholasticGradesForStudents = async (req, res) => {
  try {
    const { class_id, section_id, term_id, session_id } = req.query;

    if (!class_id || !section_id || !term_id) {
      return res.status(400).json({
        message: "class_id, section_id, and term_id are required",
      });
    }

    const mappingWhere = { class_id };
    if (ClassCoScholasticArea.rawAttributes?.term_id) {
      mappingWhere[Op.or] = [{ term_id: null }, { term_id }];
    }

    const areaMappings = await ClassCoScholasticArea.findAll({
      where: mappingWhere,
      include: [
        {
          model: CoScholasticArea,
          as: "area",
          attributes: ["id", "name", "serial_order"],
          required: false,
        },
      ],
      order: [
        [{ model: CoScholasticArea, as: "area" }, "serial_order", "ASC"],
      ],
    });

    const areaMap = {};
    for (const m of areaMappings) {
      if (m.area) {
        areaMap[m.area.id] = {
          area_id: m.area.id,
          area_name: m.area.name || "",
          serial_order: m.area.serial_order || 0,
        };
      }
    }

    const evaluationWhere = {
      class_id,
      section_id,
      term_id,
    };

    if (session_id) {
      evaluationWhere.session_id = session_id;
    }

    const evaluations = await StudentCoScholasticEvaluation.findAll({
      where: evaluationWhere,
      include: [
        {
          model: CoScholasticGrade,
          as: "grade",
          attributes: ["id", "grade"],
          required: false,
        },
      ],
      order: [
        ["student_id", "ASC"],
        ["co_scholastic_area_id", "ASC"],
      ],
    });

    const mappedAreas = Object.values(areaMap).sort(
      (a, b) => (a.serial_order || 0) - (b.serial_order || 0)
    );

    const result = {
      _areas: mappedAreas,
    };

    for (const e of evaluations) {
      const sid = String(e.student_id);
      const areaId = String(e.co_scholastic_area_id);

      if (!result[sid]) result[sid] = {};

      result[sid][areaId] = {
        area_id: e.co_scholastic_area_id,
        area_name: areaMap[e.co_scholastic_area_id]?.area_name || "",
        grade: e.grade?.grade || "-",
        remarks: e.remarks || "",
      };
    }

    return res.json(result);
  } catch (err) {
    console.error("🔥 Error in getCoScholasticGradesForStudents:", err);
    return res.status(500).json({
      message: "Failed to fetch co-scholastic grades",
      error: err.message,
    });
  }
};

/* ============================================================
 * ✅ GET /report-card/remarks-summary
 * ============================================================ */
exports.getRemarksSummary = async (req, res) => {
  try {
    const { class_id, section_id, term_id, student_ids = [] } = req.query;

    if (!class_id || !section_id || !term_id) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const whereClause = { class_id, section_id, term_id };

    // student_ids can come as "1,2,3" or as array
    let ids = [];
    if (student_ids) {
      if (Array.isArray(student_ids)) ids = student_ids;
      else ids = String(student_ids).split(",");
      ids = ids.map((x) => parseInt(x, 10)).filter(Boolean);
    }

    if (ids.length > 0) whereClause.student_id = { [Op.in]: ids };

    const remarks = await StudentRemark.findAll({
      where: whereClause,
      include: [
        {
          model: Student,
          as: "student",
          attributes: ["id", "name", "roll_number", "admission_number"],
        },
      ],
      order: [[{ model: Student, as: "student" }, "roll_number", "ASC"]],
    });

    return res.json({ remarks });
  } catch (error) {
    console.error("Error fetching remarks summary:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// ✅ GET /report-card/attendance-summary
// Returns term-wise attendance using StudentTermAttendance table (preferred),
// and falls back to daily Attendance table if no term-entry rows exist.
// ✅ UPDATED: includes promoted students for previous-session reports.
exports.getAttendanceSummary = async (req, res) => {
  try {
    const { class_id, section_id, term_id, session_id, source } = req.query;

    if (!class_id || !section_id || !term_id) {
      return res.status(400).json({
        error: "Missing class_id, section_id or term_id",
      });
    }

    const classId = Number(class_id);
    const sectionId = Number(section_id);
    const termId = Number(term_id);
    const forceAttendanceRegister = ["register", "daily", "attendance_register"].includes(
      String(source || "").trim().toLowerCase()
    );

    const studentResult = await getStudentsForReportClassSection({
      session_id,
      class_id: classId,
      section_id: sectionId,
      termIds: [termId],
      attributes: ["id", "name", "roll_number", "admission_number"],
    });

    const students = studentResult.students || [];
    const studentIds = students.map((s) => Number(s.id));

    if (!studentIds.length) {
      return res.json({
        attendance: [],
        attendanceMap: {},
        meta: { promoted_students_included: 0, source: "no_students" },
      });
    }

    // Keep legacy/manual term summary support unless the caller explicitly asks
    // for the daily Attendance Register (Report Card does this).
    let termRows = [];
    try {
      if (StudentTermAttendance && !forceAttendanceRegister) {
        const termAttendanceWhere = {
          class_id: classId,
          section_id: sectionId,
          term_id: termId,
          student_id: { [Op.in]: studentIds },
        };
        if (session_id && hasRawAttr(StudentTermAttendance, "session_id")) {
          termAttendanceWhere.session_id = Number(session_id);
        }
        termRows = await StudentTermAttendance.findAll({
          where: termAttendanceWhere,
          attributes: ["student_id", "total_days", "present_days", "max_attendance"],
        });
      }
    } catch (e) {
      console.warn("⚠️ StudentTermAttendance failed, fallback to daily attendance:", e.message);
      termRows = [];
    }

    if (Array.isArray(termRows) && termRows.length > 0) {
      const map = new Map();
      for (const r of termRows) {
        map.set(Number(r.student_id), {
          total_days: r.total_days ?? 0,
          present_days: r.present_days ?? 0,
          max_attendance: r.max_attendance ?? null,
        });
      }
      const attendance = students.map((s) => {
        const a = map.get(Number(s.id)) || { total_days: 0, present_days: 0, max_attendance: null };
        const total = Number(a.total_days || 0);
        const present = Number(a.present_days || 0);
        return {
          student_id: s.id,
          name: s.name,
          roll_number: s.roll_number,
          admission_number: s.admission_number,
          total_days: total,
          present_days: present,
          max_attendance: a.max_attendance,
          attendance_percentage: total > 0 ? Number(((present / total) * 100).toFixed(2)) : null,
          absent_days: null,
          leave_days: null,
          holiday_days: null,
          late_days: null,
          source: "student_term_attendances",
        };
      });
      const attendanceMap = {};
      for (const a of attendance) attendanceMap[a.student_id] = a;
      return res.json({
        attendance,
        attendanceMap,
        meta: {
          promoted_students_included: studentResult.promotedStudentIds.length,
          source: "student_term_attendances",
        },
      });
    }

    // REPORT_CARD_ATTENDANCE_REGISTER_V23
    // Read the actual daily Attendance Register. Working days are class-level
    // distinct marked dates, rather than the number of rows present for one
    // student. This avoids 0/0 or understated working days when one pupil has
    // a missing row on a date where the class attendance was marked.
    const term = await Term.findByPk(termId);
    if (!term) return res.status(404).json({ error: "Term not found" });

    const today = new Date().toISOString().slice(0, 10);
    const minDate = (a, b) => {
      if (!a) return b || null;
      if (!b) return a || null;
      return String(a) < String(b) ? String(a) : String(b);
    };

    const fetchRegisterRows = async (startDate, endDate) => {
      if (!startDate || !endDate || String(startDate) > String(endDate)) return [];
      return Attendance.findAll({
        where: {
          studentId: { [Op.in]: studentIds },
          date: { [Op.between]: [startDate, endDate] },
        },
        attributes: ["studentId", "status", "date"],
        order: [["date", "ASC"], ["studentId", "ASC"]],
      });
    };

    let rangeStart = term.start_date;
    let rangeEnd = minDate(term.end_date, today);
    let attendances = await fetchRegisterRows(rangeStart, rangeEnd);
    let fallbackUsed = false;

    // Some legacy Term rows have dates that do not match the attendance
    // register. If the selected term returns no rows at all, safely fall back
    // to the same Academic Year's start through the term end/today.
    if (!attendances.length && AcademicYear && term.academic_year_id) {
      const year = await AcademicYear.findByPk(term.academic_year_id, {
        attributes: ["id", "name", "start_date", "end_date"],
      });
      const fallbackStart = year?.start_date || null;
      const fallbackEnd = minDate(term.end_date || year?.end_date, today);
      if (fallbackStart && fallbackEnd) {
        const fallbackRows = await fetchRegisterRows(fallbackStart, fallbackEnd);
        if (fallbackRows.length) {
          attendances = fallbackRows;
          rangeStart = fallbackStart;
          rangeEnd = fallbackEnd;
          fallbackUsed = true;
        }
      }
    }

    const perStudent = new Map();
    const dateState = new Map();
    for (const sid of studentIds) {
      perStudent.set(Number(sid), {
        present: 0,
        absent: 0,
        late: 0,
        leave: 0,
        holiday: 0,
        halfday: 0,
      });
    }

    for (const row of attendances) {
      const sid = Number(row.studentId);
      const status = String(row.status || "").trim().toLowerCase();
      const dateKey = String(row.date || "").slice(0, 10);
      if (!dateState.has(dateKey)) dateState.set(dateKey, { working: false, rows: 0 });
      const day = dateState.get(dateKey);
      day.rows += 1;
      if (status !== "holiday" && status !== "h") day.working = true;

      if (!perStudent.has(sid)) continue;
      const a = perStudent.get(sid);
      if (["present", "p"].includes(status)) a.present += 1;
      else if (["absent", "a", "ab"].includes(status)) a.absent += 1;
      else if (["late", "l"].includes(status)) a.late += 1;
      else if (["leave", "lv"].includes(status)) a.leave += 1;
      else if (["holiday", "h"].includes(status)) a.holiday += 1;
      else if (["halfday", "half_day", "half-day", "hd"].includes(status)) a.halfday += 1;
    }

    const workingDates = [...dateState.entries()]
      .filter(([, value]) => value.working)
      .map(([date]) => date);
    const workingDays = workingDates.length;

    const attendance = students.map((s) => {
      const a = perStudent.get(Number(s.id)) || {
        present: 0, absent: 0, late: 0, leave: 0, holiday: 0, halfday: 0,
      };
      const presentDays = Number(a.present || 0) + Number(a.late || 0) + Number(a.halfday || 0) * 0.5;
      return {
        student_id: s.id,
        name: s.name,
        roll_number: s.roll_number,
        admission_number: s.admission_number,
        total_days: workingDays,
        present_days: presentDays,
        absent_days: Number(a.absent || 0),
        leave_days: Number(a.leave || 0),
        holiday_days: Number(a.holiday || 0),
        late_days: Number(a.late || 0),
        halfday_days: Number(a.halfday || 0),
        attendance_percentage: workingDays > 0 ? Number(((presentDays / workingDays) * 100).toFixed(2)) : null,
        source: "daily_attendance_register",
      };
    });

    const attendanceMap = {};
    for (const a of attendance) attendanceMap[a.student_id] = a;

    return res.json({
      attendance,
      attendanceMap,
      meta: {
        promoted_students_included: studentResult.promotedStudentIds.length,
        source: "daily_attendance_register",
        range_start: rangeStart || null,
        range_end: rangeEnd || null,
        register_rows: attendances.length,
        working_days: workingDays,
        working_dates: workingDates,
        academic_year_fallback_used: fallbackUsed,
      },
    });
  } catch (err) {
    console.error("Error in attendance summary:", err);
    return res.status(500).json({ error: "Server error", detail: err.message });
  }
};

/* ============================================================
 * ✅ GET /report-card/format-by-class
 * ============================================================ */
exports.getReportCardFormatByClass = async (req, res) => {
  try {
    const { class_id } = req.query;
    if (!class_id) return res.status(400).json({ error: "Missing class_id" });

    const format = await getFormatForClass(class_id);
    if (!format) {
      return res
        .status(404)
        .json({ error: "No format assigned for this class" });
    }

    return res.json({ format });
  } catch (err) {
    console.error("Error fetching report card format:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/* ============================================================
 * 🔒 Internal Utility — used during report card PDF generation
 * ============================================================ */
const getFormatForClass = async (class_id) => {
  const mapping = await ReportCardFormatClass.findOne({
    where: { class_id },
    include: [
      {
        model: ReportCardFormat,
        as: "format",
        attributes: [
          "id",
          "title",
          "header_html",
          "footer_html",
          "school_logo_url",
          "board_logo_url",
        ],
      },
    ],
  });

  return mapping?.format || null;
};
exports.getFormatForClass = getFormatForClass;

/* ============================================================
 * ✅ POST /report-card/detailed-summary
 *
 * ✅ UPDATED:
 * 1) Rank calculated on GRAND TOTAL PERCENTAGE (grand_percent_weighted)
 * 2) Attendance normalization fixes "rank 1 for all" when DB has PRESENT/present etc.
 * 3) Returns all students, but rank only for top 10
 * 4) ✅ Previous-session safe:
 *    Includes promoted students from StudentPromotionDecisions using:
 *    session_id + old class_id + old section_id + selected term_ids
 * ============================================================ */
exports.getMultiExamReportSummary = async (req, res) => {
  try {
    const payload = { ...(req.query || {}), ...(req.body || {}) };
    let {
      session_id,
      class_id,
      section_id,
      exam_ids = [],
      subjectComponents = [],
      subject_ids,
      subject_id,
      sum,
      includeGrades,
    } = payload;

    exam_ids = asIdArray(exam_ids);
    subjectComponents = normalizeSubjectComponents(
      subjectComponents,
      subject_ids ?? subject_id
    );

    if (
      !hasValue(class_id) ||
      !hasValue(section_id) ||
      exam_ids.length === 0 ||
      subjectComponents.length === 0
    ) {
      return res.status(400).json({
        message: "Missing required fields",
        required: {
          class_id: "required",
          section_id: "required",
          exam_ids: "required array or comma-separated ids",
          subjectComponents: "required array, or use subject_ids / subject_id",
        },
      });
    }

    const classIdNum = Number(class_id);
    const sectionIdNum = Number(section_id);
    const sessionIdNum = hasValue(session_id) ? Number(session_id) : null;
    const includeGradesBool = includeGrades === true || includeGrades === "true";

    const [gradeSchemes, exams] = await Promise.all([
      GradeScheme.findAll({ order: [["min_percent", "DESC"]] }),
      Exam.findAll({ where: { id: { [Op.in]: exam_ids } } }),
    ]);
    const selectedTermIds = uniqueNumbers(exams.map((exam) => exam.term_id));
    const examMap = Object.fromEntries(exams.map((exam) => [exam.id, exam.name]));

    // Co-scholastic subjects are included automatically; schedules and schemes
    // below restrict them to the selected class, session and examinations.
    const coSubjects = await Subject.findAll({
      where: { type: "Co-Scholastic" }, attributes: ["id"],
    });
    const requestedIds = new Set(subjectComponents.map((row) => Number(row.subject_id)));
    for (const subject of coSubjects) {
      if (!requestedIds.has(Number(subject.id))) subjectComponents.push({ subject_id: Number(subject.id) });
    }


    const studentResult = await getStudentsForReportClassSection({
      session_id: sessionIdNum,
      class_id: classIdNum,
      section_id: sectionIdNum,
      termIds: selectedTermIds,
    });
    let students = studentResult.students || [];

    const allStudentData = [];
    const summary = { components: {}, total: getEmptyBuckets() };
    const subjectComponentGroups = [];
    const definitionMapBySubject = {};

    for (const requestedSubject of subjectComponents) {
      const subjectId = Number(requestedSubject.subject_id);
      if (!Number.isFinite(subjectId) || definitionMapBySubject[subjectId]) continue;

      const scheduleWhere = {
        class_id: classIdNum,
        section_id: sectionIdNum,
        subject_id: subjectId,
        exam_id: { [Op.in]: exam_ids },
      };
      if (sessionIdNum && hasRawAttr(ExamSchedule, "session_id")) {
        scheduleWhere.session_id = sessionIdNum;
      }

      let schedules = await ExamSchedule.findAll({ where: scheduleWhere });
      if (!schedules.length) {
        const fallbackWhere = {
          class_id: classIdNum,
          subject_id: subjectId,
          exam_id: { [Op.in]: exam_ids },
        };
        if (sessionIdNum && hasRawAttr(ExamSchedule, "session_id")) {
          fallbackWhere.session_id = sessionIdNum;
        }
        schedules = await ExamSchedule.findAll({ where: fallbackWhere });
      }
      if (!schedules.length) continue;

      const subject = await Subject.findByPk(subjectId);
      if (!subject) continue;

      // Report-card section is controlled at SUBJECT level.
      // The same assessment component (for example HY Exam) can be reused by
      // both scholastic and co-scholastic subjects, so component-level
      // classification is not reliable for report-card placement.
      const subjectType =
        String(subject.type || "Scholastic").trim() === "Co-Scholastic"
          ? "Co-Scholastic"
          : "Scholastic";
      const isCoScholasticSubject = subjectType === "Co-Scholastic";

      const displayEntries = [];
      for (const schedule of schedules) {
        const schemeWhere = {
          class_id: classIdNum,
          subject_id: subjectId,
          term_id: schedule.term_id,
        };
        if (sessionIdNum && hasRawAttr(ExamScheme, "session_id")) {
          schemeWhere.session_id = sessionIdNum;
        }

        const schemeEntries = await ExamScheme.findAll({
          where: schemeWhere,
          include: [{ model: AssessmentComponent, as: "component" }],
          order: [["serial_order", "ASC"], ["id", "ASC"]],
        });

        for (const definition of buildDisplayDefinitions(schemeEntries)) {
          displayEntries.push({
            ...definition,
            schedule_id: schedule.id,
            exam_id: schedule.exam_id,
            exam_name: examMap[schedule.exam_id] || "",
            term_id: schedule.term_id,
          });
        }
      }
      if (!displayEntries.length) continue;

      definitionMapBySubject[subjectId] = displayEntries;
      const totalWeightage = displayEntries.reduce(
        (total, definition) => total + Number(definition.weightage_percent || 0),
        0
      );

      subjectComponentGroups.push({
        subject_id: subjectId,
        subject_name: subject.name,
        subject_type: subjectType,
        report_card_section: isCoScholasticSubject ? "CO_SCHOLASTIC" : "SCHOLASTIC",
        total_weightage: Number(totalWeightage.toFixed(2)),
        components: displayEntries.map((definition) => ({
          component_id: definition.component_id,
          source_component_ids: definition.source_component_ids,
          name: definition.name,
          component_name: definition.name,
          abbreviation: definition.abbreviation,
          max_marks: Number(definition.max_marks || 0),
          weightage_percent: Number(definition.weightage_percent || 0),
          exam_id: definition.exam_id,
          exam_name: definition.exam_name,
          term_id: definition.term_id,
          is_result_group: Boolean(definition.is_result_group),
          result_group_code: definition.result_group_code || null,
          calculation_method: definition.calculation_method,
          missing_marks_policy: definition.missing_marks_policy,
          group_validation: definition.group_validation || null,
        })),
      });

      for (const definition of displayEntries) {
        const key = `${definition.abbreviation || definition.name} (${subject.name})`;
        if (!summary.components[key]) {
          summary.components[key] = getEmptyBuckets(Number(definition.max_marks || 100));
        }
      }

      const scheduleIds = schedules.map((schedule) => schedule.id);
      const resultWhere = { exam_schedule_id: { [Op.in]: scheduleIds } };
      if (students.length) {
        resultWhere.student_id = { [Op.in]: students.map((student) => student.id) };
      }
      const allResults = await StudentExamResult.findAll({ where: resultWhere });

      if (!students.length && allResults.length) {
        const studentIds = uniqueNumbers(allResults.map((result) => result.student_id));
        students = await Student.findAll({
          where: { id: { [Op.in]: studentIds }, status: "enabled" },
          order: [["roll_number", "ASC"], ["name", "ASC"]],
        });
      }

      for (const student of students) {
        let studentOutput = allStudentData.find(
          (candidate) => Number(candidate.id) === Number(student.id)
        );
        if (!studentOutput) {
          studentOutput = {
            id: student.id,
            name: student.name,
            roll_number: student.roll_number,
            components: [],
            subject_totals_raw: {},
            subject_totals_weighted: {},
            subject_grades: {},
            total_raw: 0,
            total_weighted: 0,
            grand_percent_weighted: null,
            rank: null,
            isTop10: false,
            is_promoted_from_selected_class: studentResult.promotedStudentIds.includes(
              Number(student.id)
            ),
          };
          allStudentData.push(studentOutput);
        }

        let rawTotal = 0;
        let weightedTotal = 0;
        let rawMaximum = 0;
        let weightedMaximum = 0;

        for (const definition of displayEntries) {
          const resultMap = new Map();
          for (const result of allResults) {
            if (
              Number(result.student_id) === Number(student.id) &&
              Number(result.exam_schedule_id) === Number(definition.schedule_id)
            ) {
              resultMap.set(Number(result.component_id), result);
            }
          }

          const calculated = calculateDisplayResult(definition, resultMap);
          const marks = calculated?.marks ?? null;
          const weightedMarks = calculated?.weighted_marks ?? null;
          const attendance = calculated?.attendance || "P";
          const maxMarks = Number(definition.max_marks || 0);
          const weightage = Number(definition.weightage_percent || 0);
          const percent =
            marks != null && maxMarks > 0 ? (Number(marks) / maxMarks) * 100 : null;
          const key = `${definition.abbreviation || definition.name} (${subject.name})`;

          // Co-scholastic subjects may still use exam/result infrastructure,
          // but they must not affect scholastic distributions, totals or rank.
          if (!isCoScholasticSubject && percent != null) {
            summary.components[key][getBucket(percent)] += 1;
          }
          rawMaximum += maxMarks;
          weightedMaximum += weightage;
          if (marks != null && PRESENT_CODES.has(String(attendance).toUpperCase())) {
            rawTotal += Number(marks);
            weightedTotal += Number(weightedMarks || 0);
          }

          let directGrade = null;
          if (!definition.is_result_group && definition.source_component_ids.length === 1) {
            const rawResult = resultMap.get(Number(definition.source_component_ids[0]));
            directGrade =
              rawResult?.grade_obtained ??
              rawResult?.grade ??
              rawResult?.grade_value ??
              null;
          }

          const grade =
            directGrade != null && String(directGrade).trim() !== ""
              ? String(directGrade).trim()
              : percent != null
              ? getGrade(percent, gradeSchemes)
              : null;

          // SMCIS_PT_SOURCE_BREAKDOWN_V55
          // Keep grouped assessment totals intact, but expose each source component
          // (for example PT-1 and PT-2) so the SMCIS coded report can render them
          // as separate 5-mark columns without guessing/splitting the group score.
          const sourceComponents = Boolean(definition.is_result_group)
            ? (definition.source_schemes || []).map((sourceScheme) => {
                const sourceComponentId = Number(sourceScheme?.component_id);
                const sourceResult = resultMap.get(sourceComponentId) || {};
                const sourceAttendance = String(sourceResult?.attendance || "P")
                  .trim()
                  .toUpperCase();
                const sourceMarksRaw =
                  sourceResult?.marks_obtained ?? sourceResult?.marks ?? null;
                const sourceMarks = toNum(sourceMarksRaw);
                const sourceMaxMarks = Number(effectiveMaxMarks(sourceScheme) || 0);
                const sourceWeightage = Number(finalWeightage(sourceScheme) || 0);
                const sourcePresent = PRESENT_CODES.has(sourceAttendance);
                const sourceWeightedMarks =
                  sourcePresent && sourceMarks != null && sourceMaxMarks > 0
                    ? Number(((Number(sourceMarks) / sourceMaxMarks) * sourceWeightage).toFixed(2))
                    : null;
                const sourceComponent = sourceScheme?.component || {};

                return {
                  component_id: sourceComponentId,
                  name:
                    sourceComponent?.name ||
                    sourceComponent?.abbreviation ||
                    `Assessment ${sourceComponentId}`,
                  component_name:
                    sourceComponent?.name ||
                    sourceComponent?.abbreviation ||
                    `Assessment ${sourceComponentId}`,
                  abbreviation:
                    sourceComponent?.abbreviation || sourceComponent?.name || "",
                  marks: sourcePresent ? sourceMarks : null,
                  max_marks: sourceMaxMarks,
                  weighted_marks: sourceWeightedMarks,
                  attendance: sourceAttendance,
                  weightage_percent: sourceWeightage,
                  serial_order: Number(sourceScheme?.serial_order || 0),
                };
              })
            : [];

          studentOutput.components.push({
            exam_id: definition.exam_id,
            exam_name: definition.exam_name,
            term_id: definition.term_id,
            component_id: definition.component_id,
            source_component_ids: definition.source_component_ids,
            source_components: sourceComponents,
            subject_id: subjectId,
            subject_name: subject.name,
            subject_type: subjectType,
            report_card_section: isCoScholasticSubject ? "CO_SCHOLASTIC" : "SCHOLASTIC",
            name: key,
            component_name: definition.name,
            abbreviation: definition.abbreviation,
            marks,
            max_marks: maxMarks,
            weighted_marks: weightedMarks,
            attendance,
            weightage_percent: weightage,
            grade,
            weighted_grade:
              weightedMarks != null && weightage > 0
                ? getGrade((Number(weightedMarks) / weightage) * 100, gradeSchemes)
                : grade,
            is_result_group: Boolean(definition.is_result_group),
            result_group_code: definition.result_group_code || null,
            calculation_method: normalizeCalculationMethod(
              definition.calculation_method
            ),
            missing_marks_policy: normalizeMissingMarksPolicy(
              definition.missing_marks_policy
            ),
            group_validation: definition.group_validation || null,
          });
        }

        studentOutput.subject_totals_raw[subjectId] = Number(rawTotal.toFixed(2));
        studentOutput.subject_totals_weighted[subjectId] = Number(
          weightedTotal.toFixed(2)
        );
        studentOutput[`subject_max_raw_${subjectId}`] = rawMaximum;
        studentOutput[`subject_max_weighted_${subjectId}`] = weightedMaximum;

        if (includeGradesBool) {
          if (isCoScholasticSubject) {
            const subjectRows = studentOutput.components.filter(
              (component) => Number(component.subject_id) === subjectId
            );
            const hasMarks = subjectRows.some((row) => row.weighted_marks != null);
            const complete = subjectRows.every((row) =>
              row.weightage_percent <= 0 || row.weighted_marks != null
            );
            studentOutput.subject_grades[subjectId] = hasMarks
              ? (complete && weightedMaximum > 0
                  ? getGrade((weightedTotal / weightedMaximum) * 100, gradeSchemes)
                  : null)
              : subjectRows.find((row) => row.grade)?.grade || null;
          } else {
            studentOutput.subject_grades[subjectId] =
              weightedMaximum > 0
                ? getGrade((weightedTotal / weightedMaximum) * 100, gradeSchemes)
                : null;
          }
        }
      }
    }

    let grandRaw = 0;
    let grandRawMax = 0;
    let grandWeighted = 0;
    let grandWeightMax = 0;
    // Only Scholastic subjects contribute to grand totals / percentage / rank.
    // Co-Scholastic subjects are returned in student.components so the frontend
    // can render their grades in the Co-Scholastic section.
    const subjectIds = subjectComponentGroups
      .filter((group) => group.subject_type !== "Co-Scholastic")
      .map((group) => Number(group.subject_id));

    for (const student of allStudentData) {
      let raw = 0;
      let rawMax = 0;
      let weighted = 0;
      let weightedMax = 0;

      for (const subjectId of subjectIds) {
        raw += Number(student.subject_totals_raw[subjectId] || 0);
        weighted += Number(student.subject_totals_weighted[subjectId] || 0);
        rawMax += Number(student[`subject_max_raw_${subjectId}`] || 0);
        weightedMax += Number(student[`subject_max_weighted_${subjectId}`] || 0);
      }

      student.total_raw = Number(raw.toFixed(2));
      student.total_weighted = Number(weighted.toFixed(2));
      student.grand_percent_weighted =
        weightedMax > 0 ? Number(((weighted / weightedMax) * 100).toFixed(2)) : null;

      grandRaw += raw;
      grandRawMax += rawMax;
      grandWeighted += weighted;
      grandWeightMax += weightedMax;

      if (includeGradesBool) {
        student.grand_percent_raw =
          rawMax > 0 ? Number(((raw / rawMax) * 100).toFixed(2)) : null;
        student.total_grade_raw =
          rawMax > 0 ? getGrade((raw / rawMax) * 100, gradeSchemes) : null;
        student.total_grade_weighted =
          weightedMax > 0
            ? getGrade((weighted / weightedMax) * 100, gradeSchemes)
            : null;
      }

      if (sum && weightedMax > 0) {
        summary.total[getBucket((weighted / weightedMax) * 100)] += 1;
      }
    }

    assignRanks(allStudentData, "grand_percent_weighted");
    for (const student of allStudentData) {
      student.isTop10 = student.rank != null && student.rank <= 10;
      if (!student.isTop10) student.rank = null;
    }

    const count = allStudentData.length;
    summary.grand_total_raw = count ? Number((grandRaw / count).toFixed(2)) : 0;
    summary.grand_total_weighted = count
      ? Number((grandWeighted / count).toFixed(2))
      : 0;
    summary.grand_percent_weighted =
      grandWeightMax > 0
        ? Number(((grandWeighted / grandWeightMax) * 100).toFixed(2))
        : null;

    if (includeGradesBool) {
      summary.grand_percent_raw =
        grandRawMax > 0 ? Number(((grandRaw / grandRawMax) * 100).toFixed(2)) : null;
      summary.grand_total_grade_raw =
        summary.grand_percent_raw != null
          ? getGrade(summary.grand_percent_raw, gradeSchemes)
          : null;
      summary.grand_total_grade_weighted =
        summary.grand_percent_weighted != null
          ? getGrade(summary.grand_percent_weighted, gradeSchemes)
          : null;
    }

    return res.json({
      students: allStudentData,
      summary,
      subjectComponentGroups,
      total_weightage: subjectComponentGroups.reduce(
        (total, group) => total + Number(group.total_weightage || 0),
        0
      ),
      meta: {
        total_students_in_class: allStudentData.length,
        returned_students: allStudentData.length,
        rank_basis: "grand_percent_weighted",
        ranks_visible_only_for_top10: true,
        previous_session_promoted_support: true,
        selected_session_id: sessionIdNum,
        selected_term_ids: selectedTermIds,
        promoted_students_included: studentResult.promotedStudentIds.length,
        promoted_student_ids: studentResult.promotedStudentIds,
      },
    });
  } catch (err) {
    console.error("🔥 Error in getMultiExamReportSummary:", err);
    return res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
};

/* ============================================================
 * Helpers
 * ============================================================ */
function getBucket(percent) {
  if (percent === 100) return "100";
  if (percent >= 90) return "90-99";
  if (percent >= 80) return "80-89";
  if (percent >= 70) return "70-79";
  if (percent >= 60) return "60-69";
  if (percent >= 50) return "50-59";
  return "0-49";
}

function getGrade(percent, gradeSchemes) {
  const rounded = Math.round(percent * 1000) / 1000;
  for (const scheme of gradeSchemes) {
    const min = parseFloat(scheme.min_percent);
    const max = parseFloat(scheme.max_percent);
    if (rounded >= min && rounded <= max) return scheme.grade;
  }
  return null;
}

function getEmptyBuckets(max_marks = 100) {
  return {
    max_marks,
    "100": 0,
    "90-99": 0,
    "80-89": 0,
    "70-79": 0,
    "60-69": 0,
    "50-59": 0,
    "0-49": 0,
  };
}

/**
 * ✅ Rank helper (competition ranking)
 * - Rank 1,1,3... for ties
 * - Adds: rank, isTop10 (rank <= 10)
 */
function assignRanks(arr, scoreKey) {
  const sorted = [...(arr || [])].sort((a, b) => {
    const av = Number(a?.[scoreKey]);
    const bv = Number(b?.[scoreKey]);

    const aOk = Number.isFinite(av);
    const bOk = Number.isFinite(bv);

    if (!aOk && !bOk) return 0;
    if (!aOk) return 1;
    if (!bOk) return -1;

    return bv - av; // desc
  });

  let rank = 0;
  let prevScore = null;

  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const score = Number(s?.[scoreKey]);

    if (!Number.isFinite(score)) {
      s.rank = null;
      continue;
    }

    if (prevScore === null || score !== prevScore) {
      rank = i + 1;
      prevScore = score;
    }
    s.rank = rank;
  }

  const top10Ids = new Set(
    sorted.filter((x) => x.rank != null && x.rank <= 10).map((x) => x.id)
  );

  for (const s of arr || []) {
    const r = sorted.find((x) => x.id === s.id)?.rank ?? null;
    s.rank = r;
    s.isTop10 = top10Ids.has(s.id);
  }
}

/* ============================================================
 * ✅ Watermark helper: Convert remote image URL → base64 data URI
 * ============================================================ */
async function urlToDataUri(url) {
  if (!url) return null;
  if (String(url).startsWith("data:image/")) return url;

  try {
    const resp = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 15000,
    });
    const contentType = resp.headers["content-type"] || "image/png";
    const base64 = Buffer.from(resp.data, "binary").toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch (e) {
    console.warn("⚠️ Failed to fetch logo for watermark:", e.message);
    return null;
  }
}

/* ============================================================
 * ✅ POST /report-card/generate-pdf/report-card
 * Body: { format_id, html?, fileName? }
 * Legacy fallback still accepts { html, orientation? } only when format_id is not sent.
 * ============================================================ */
exports.generateFinalReportPDF = async (req, res) => {
  let browser = null;
  let filePath = null;

  // ✅ Old puppeteer compatible sleep
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    const {
      html: bodyHtml,
      format_id,
      fileName = PDF_ENDPOINT_NAME,
      orientation = "portrait",
    } = req.body;

    let html = null;
    let finalOrientation = orientation;

    if (format_id) {
      const selectedFormat = await ReportCardFormat.findByPk(format_id);

      if (!selectedFormat) {
        return res.status(404).json({ message: "Selected report card format not found" });
      }

      if (selectedFormat.body_template_html) {
        html = selectedFormat.body_template_html
          .replace(/{{{\s*content_html\s*}}}/g, bodyHtml || "")
          .replace(/{{\s*content_html\s*}}/g, bodyHtml || "")
          .replace(/{{{\s*content\s*}}}/g, bodyHtml || "")
          .replace(/{{\s*content\s*}}/g, bodyHtml || "");
      } else if (bodyHtml) {
        html = bodyHtml;
      } else {
        return res.status(400).json({
          message: "Selected report card format does not have body_template_html and no report content was provided.",
        });
      }

      if (selectedFormat.orientation) {
        finalOrientation = selectedFormat.orientation;
      }
    } else {
      html = bodyHtml;
    }

    if (!html) {
      return res.status(400).json({
        message: "format_id is required, or send html for legacy PDF generation.",
      });
    }

    const downloadName = String(fileName).toLowerCase().endsWith(".pdf")
      ? fileName
      : `${fileName}.pdf`;

    // ensure exports dir exists
    const exportDir = path.join(__dirname, "../exports");
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

    filePath = path.join(exportDir, `${Date.now()}-${downloadName}`);

    // ✅ Keep fonts local/system (avoid google fonts in PDF)
    const baseCss = `
      @page { margin: 40px 20px; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 11px;
        position: relative;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        color: #111827;
      }
      .content-wrapper { position: relative; z-index: 1; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #cbd5e1; padding: 4px 6px; vertical-align: middle; }
      tr, td, th { page-break-inside: avoid; }
      img { image-rendering: -webkit-optimize-contrast; }
    `;

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>${baseCss}</style>
      </head>
      <body>
        <div class="content-wrapper">
          ${html}
        </div>
      </body>
      </html>
    `;

    // ✅ Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // ✅ Bigger timeouts (avoid 30s death)
    if (page.setDefaultNavigationTimeout) page.setDefaultNavigationTimeout(120000);
    if (page.setDefaultTimeout) page.setDefaultTimeout(120000);

    await page.setViewport({ width: 1200, height: 800 });

    // Some old puppeteer versions may not have emulateMediaType
    try {
      await page.emulateMediaType("print");
    } catch (e) {}

    // ✅ Prevent hanging due to external network requests
    // Allow only your own hosts + local, block everything else.
    const ALLOW_HOSTS = new Set([
      "milton-api.edubridgeerp.in",
      "103.127.29.184",
      "localhost",
      "127.0.0.1",
    ]);

    try {
      await page.setRequestInterception(true);

      page.on("request", (r) => {
        const url = r.url() || "";
        const type = r.resourceType ? r.resourceType() : "";

        // Allow data URIs always
        if (url.startsWith("data:")) return r.continue();

        // Block heavy media
        if (type === "media") return r.abort();

        // Allow only selected hosts for http/https
        if (url.startsWith("http://") || url.startsWith("https://")) {
          try {
            const host = new URL(url).hostname;
            if (!ALLOW_HOSTS.has(host)) return r.abort();
          } catch (e) {
            return r.abort();
          }
        }

        return r.continue();
      });
    } catch (e) {
      // If interception fails (very old versions), ignore
      console.warn("⚠️ Request interception not supported:", e.message);
    }

    // ✅ IMPORTANT: don’t use networkidle0 (hangs when resources keep loading)
    await page.setContent(fullHtml, {
      waitUntil: ["domcontentloaded"],
      timeout: 120000,
    });

    // ✅ small settle wait (old puppeteer compatible)
    await sleep(300);

    await page.pdf({
      path: filePath,
      format: "A4",
      landscape: finalOrientation === "landscape",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "40px", bottom: "40px", left: "20px", right: "20px" },
    });

    // Close browser
    try {
      await browser.close();
      browser = null;
    } catch (_) {}

    return res.download(filePath, downloadName, (err) => {
      try {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (_) {}

      if (err) console.error("❌ res.download error:", err);
    });
  } catch (error) {
    console.error("🔥 PDF generation error:", error);

    try {
      if (browser) await browser.close();
    } catch (_) {}

    try {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (_) {}

    return res.status(500).json({
      message: "Failed to generate PDF",
      error: error.message,
    });
  }
};
