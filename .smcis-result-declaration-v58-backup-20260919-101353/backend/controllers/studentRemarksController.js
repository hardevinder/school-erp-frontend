"use strict";

const {
  Student,
  StudentRemark,
  Incharge,
  Class,
  Section,
  Session,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");

/* =========================
   Helpers
========================= */

// roles can be: ["admin"] OR [{ slug: "admin" }]
function getRoleSlugs(req) {
  return (req.user?.roles || [])
    .map((r) => {
      if (!r) return null;
      if (typeof r === "string") return r;
      return r?.slug || r?.name || r?.role || null;
    })
    .filter(Boolean)
    .map((x) => String(x).trim().toLowerCase());
}

function isGlobalMarksRole(roleSlugs) {
  return (
    roleSlugs.includes("admin") ||
    roleSlugs.includes("superadmin") ||
    roleSlugs.includes("examination")
  );
}

function toInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

// ✅ SAFE: Returns flat list for dropdown without Class->Section eager loading
// Output: [{ class_id, class_name, section_id, section_name }]
async function getAllClassSectionsFlat() {
  const [classes, sections] = await Promise.all([
    Class.findAll({
      attributes: ["id", "class_name"],
      order: [["id", "ASC"]],
    }),
    Section.findAll({
      attributes: ["id", "section_name"],
      order: [["id", "ASC"]],
    }),
  ]);

  const out = [];
  for (const c of classes) {
    for (const s of sections) {
      out.push({
        class_id: c.id,
        class_name: c.class_name || c.name,
        section_id: s.id,
        section_name: s.section_name || s.name,
      });
    }
  }
  return out;
}

/* =========================
   ✅ GET: Students + Existing Remarks
   ✅ ALSO supports: ?meta=1  (global roles only) -> returns all class/sections for dropdown
========================= */
exports.getRemarks = async (req, res) => {
  try {
    const userId = req.user?.id;
    const roleSlugs = getRoleSlugs(req);

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // ✅ If admin/superadmin/examination wants dropdown meta
    // Call: GET /student-remarks?meta=1
    if (String(req.query.meta) === "1" || String(req.query.meta) === "true") {
      if (!isGlobalMarksRole(roleSlugs)) {
        return res
          .status(403)
          .json({ message: "Not authorized to view all classes." });
      }

      const classSections = await getAllClassSectionsFlat();
      const sessions = await Session.findAll({
        attributes: ["id", "name", "is_active"],
        order: [
          ["is_active", "DESC"],
          ["id", "DESC"],
        ],
      });

      return res.json({ classSections, sessions });
    }

    const sessionId = toInt(req.query.session_id);
    const classId = toInt(req.query.class_id);
    const sectionId = toInt(req.query.section_id);
    const termId = toInt(req.query.term_id);

    // ✅ session_id now required
    if (!sessionId || !classId || !sectionId || !termId) {
      if (isGlobalMarksRole(roleSlugs)) {
        const classSections = await getAllClassSectionsFlat();
        const sessions = await Session.findAll({
          attributes: ["id", "name", "is_active"],
          order: [
            ["is_active", "DESC"],
            ["id", "DESC"],
          ],
        });

        return res.json({
          classSections,
          sessions,
          students: [],
          existingRemarks: [],
        });
      }

      return res.status(400).json({
        message: "session_id, class_id, section_id, term_id are required",
      });
    }

    // ✅ Incharge access check (unless admin/superadmin/examination)
    if (!isGlobalMarksRole(roleSlugs)) {
      const isAssigned = await Incharge.findOne({
        where: { teacherId: userId, classId, sectionId },
      });

      if (!isAssigned) {
        return res
          .status(403)
          .json({ message: "Not authorized for this class-section." });
      }
    }

    // ✅ Fetch students
    const students = await Student.findAll({
      where: {
        class_id: classId,
        section_id: sectionId,
        status: "enabled",
        visible: { [Op.in]: [true, 1] },
      },
      order: [["roll_number", "ASC"], ["name", "ASC"], ["id", "ASC"]],
    });

    // ✅ Fetch existing remarks SESSION-WISE
    const existingRemarks = await StudentRemark.findAll({
      where: {
        session_id: sessionId,
        class_id: classId,
        section_id: sectionId,
        term_id: termId,
      },
    });

    return res.json({
      session_id: sessionId,
      students,
      existingRemarks,
    });
  } catch (err) {
    console.error("🔥 Error in getRemarks:", err);
    return res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
};

/* =========================
   ✅ POST: Save or Update Remarks
========================= */
exports.saveRemarks = async (req, res) => {
  const userId = req.user?.id;
  const roleSlugs = getRoleSlugs(req);

  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const remarks = Array.isArray(req.body?.remarks) ? req.body.remarks : [];

  const t = await sequelize.transaction();
  try {
    for (const r of remarks) {
      const studentId = toInt(r.student_id);
      const sessionId = toInt(r.session_id);
      const classId = toInt(r.class_id);
      const sectionId = toInt(r.section_id);
      const termId = toInt(r.term_id);
      const remark = (r.remark || "").toString().trim();

      if (!studentId || !sessionId || !classId || !sectionId || !termId) {
        continue;
      }

      // ✅ Safe authorization even on POST
      if (!isGlobalMarksRole(roleSlugs)) {
        const isAssigned = await Incharge.findOne({
          where: { teacherId: userId, classId, sectionId },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!isAssigned) {
          await t.rollback();
          return res.status(403).json({
            message: `Not authorized for class-section ${classId}-${sectionId}.`,
          });
        }
      }

      await StudentRemark.upsert(
        {
          student_id: studentId,
          session_id: sessionId,
          class_id: classId,
          section_id: sectionId,
          term_id: termId,
          remark,
        },
        { transaction: t }
      );
    }

    await t.commit();
    return res.json({ message: "Remarks saved successfully" });
  } catch (err) {
    await t.rollback();
    console.error("🔥 Error in saveRemarks:", err);
    return res.status(500).json({
      message: "Failed to save remarks",
      error: err.message,
    });
  }
};