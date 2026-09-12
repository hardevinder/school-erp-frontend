import { useEffect } from "react";
import { useInstitution } from "./InstitutionContext";

// Visible UI terminology is translated at the protected-app shell so old pages
// do not each need a separate School/College implementation. Database/API field
// names remain unchanged for backwards compatibility.

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA"]);
const ATTRS = ["placeholder", "title", "aria-label"];
const ORIGINAL_TEXT = Symbol("edubridgeOriginalInstitutionText");
const ORIGINAL_ATTRS = Symbol("edubridgeOriginalInstitutionAttrs");

const phraseRules = [
  [/\bSchool administration & operations\b/g, "College administration & operations"],
  [/\bSchool Administration & Operations\b/g, "College Administration & Operations"],
  [/\bSchool Command Center\b/g, "College Command Center"],
  [/\bSchool Fee Summary\b/g, "College Fee Summary"],
  [/\bInstitution Fee Summary\b/g, "College Fee Summary"],
  [/\bSchool Bank Accounts\b/g, "College Bank Accounts"],
  [/\bInstitution Bank Accounts\b/g, "College Bank Accounts"],
  [/\bSecure School Chat\b/g, "Secure College Chat"],
  [/\bSchool Info\b/g, "College Info"],
  [/\bInstitution Info\b/g, "College Info"],
  [/\bSchool Information\b/g, "College Information"],
  [/\bSchool Details\b/g, "College Details"],
  [/\bSchool Management Portal\b/g, "College Management Portal"],
  [/\bSchool Name\b/g, "College Name"],
  [/\bSchool Code\b/g, "College Code"],
  [/\bSchool Logo\b/g, "College Logo"],
  [/\bSchool Address\b/g, "College Address"],
  [/\bClass Teachers\b/g, "Faculty Mentors"],
  [/\bClass Teacher\b/g, "Faculty Mentor"],
  [/\bclass teachers\b/g, "faculty mentors"],
  [/\bclass teacher\b/g, "faculty mentor"],

  [/\bReport Cards\b/g, "Grade Cards"],
  [/\bReport Card\b/g, "Grade Card"],
  [/\breport cards\b/g, "grade cards"],
  [/\breport card\b/g, "grade card"],

  [/\bAcademic Sessions\b/g, "Academic Years"],
  [/\bAcademic Session\b/g, "Academic Year"],
  [/\bacademic sessions\b/g, "academic years"],
  [/\bacademic session\b/g, "academic year"],

  [/\bClass-wise\b/g, "Program-wise"],
  [/\bClasswise\b/g, "Program-wise"],
  [/\bclass-wise\b/g, "program-wise"],
  [/\bclasswise\b/g, "program-wise"],

  [/\bClasses\b/g, "Programs / Semesters"],
  [/\bClass\b/g, "Program / Semester"],
  [/\bclasses\b/g, "programs / semesters"],
  [/\bclass\b/g, "program / semester"],

  [/\bSections\b/g, "Batches / Sections"],
  [/\bSection\b/g, "Batch / Section"],
  [/\bsections\b/g, "batches / sections"],
  [/\bsection\b/g, "batch / section"],

  [/\bSubjects\b/g, "Papers / Subjects"],
  [/\bSubject\b/g, "Paper / Subject"],
  [/\bsubjects\b/g, "papers / subjects"],
  [/\bsubject\b/g, "paper / subject"],

  [/\bTeachers\b/g, "Faculty"],
  [/\bTeacher\b/g, "Faculty"],
  [/\bteachers\b/g, "faculty"],
  [/\bteacher\b/g, "faculty"],

  [/\bHomework\b/g, "Assignments"],
  [/\bhomework\b/g, "assignments"],
];

const exactSchoolUi = new Map([
  ["School Info", "College Info"],
  ["School Information", "College Information"],
  ["School Details", "College Details"],
  ["School Name", "College Name"],
  ["School Code", "College Code"],
  ["School Logo", "College Logo"],
  ["School Address", "College Address"],
  ["School Command Center", "College Command Center"],
  ["School Fee Summary", "College Fee Summary"],
  ["School Bank Accounts", "College Bank Accounts"],
  ["Secure School Chat", "Secure College Chat"],
  ["School Management Portal", "College Management Portal"],
  ["School administration & operations", "College administration & operations"],
  ["School Administration & Operations", "College Administration & Operations"],
  ["School-specific", "College-specific"],
  ["All Schools", "All Colleges"],
  ["Select School", "Select College"],
]);

const shouldSkipElement = (el) => {
  if (!el) return true;
  if (SKIP_TAGS.has(el.tagName)) return true;
  if (el.closest?.("#swal-institution-type")) return true;
  if (el.closest?.("[data-no-institution-terminology='true']")) return true;
  return false;
};

const transformText = (value) => {
  let out = String(value ?? "");
  const trimmed = out.trim();

  // Keep official institution names (e.g. "Demo Public School") untouched.
  // Only known UI phrases containing School are changed.
  for (const [from, to] of exactSchoolUi.entries()) {
    if (trimmed === from) {
      const start = out.indexOf(trimmed);
      return `${out.slice(0, start)}${to}${out.slice(start + trimmed.length)}`;
    }
  }

  for (const [pattern, replacement] of phraseRules) out = out.replace(pattern, replacement);
  return out;
};

const processTextNode = (node, isCollege) => {
  const parent = node.parentElement;
  if (!parent || shouldSkipElement(parent)) return;

  if (!isCollege) {
    if (Object.prototype.hasOwnProperty.call(node, ORIGINAL_TEXT)) {
      node.nodeValue = node[ORIGINAL_TEXT];
      delete node[ORIGINAL_TEXT];
    }
    return;
  }

  const current = node.nodeValue || "";
  if (!Object.prototype.hasOwnProperty.call(node, ORIGINAL_TEXT)) {
    node[ORIGINAL_TEXT] = current;
  } else {
    const expected = transformText(node[ORIGINAL_TEXT]);
    // React may have refreshed this text node after our previous translation.
    if (current !== expected && current !== node[ORIGINAL_TEXT]) node[ORIGINAL_TEXT] = current;
  }

  const next = transformText(node[ORIGINAL_TEXT]);
  if (next !== current) node.nodeValue = next;
};

const processAttributes = (el, isCollege) => {
  if (!el || shouldSkipElement(el)) return;
  if (el.tagName === "OPTION" || el.tagName === "SELECT") return;

  if (!el[ORIGINAL_ATTRS]) el[ORIGINAL_ATTRS] = {};

  for (const attr of ATTRS) {
    if (!el.hasAttribute?.(attr)) continue;
    const current = el.getAttribute(attr) || "";

    if (!isCollege) {
      if (Object.prototype.hasOwnProperty.call(el[ORIGINAL_ATTRS], attr)) {
        el.setAttribute(attr, el[ORIGINAL_ATTRS][attr]);
        delete el[ORIGINAL_ATTRS][attr];
      }
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(el[ORIGINAL_ATTRS], attr)) {
      el[ORIGINAL_ATTRS][attr] = current;
    } else {
      const expected = transformText(el[ORIGINAL_ATTRS][attr]);
      if (current !== expected && current !== el[ORIGINAL_ATTRS][attr]) {
        el[ORIGINAL_ATTRS][attr] = current;
      }
    }

    const next = transformText(el[ORIGINAL_ATTRS][attr]);
    if (next !== current) el.setAttribute(attr, next);
  }
};

const processTree = (root, isCollege) => {
  if (!root) return;

  if (root.nodeType === Node.TEXT_NODE) {
    processTextNode(root, isCollege);
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

  if (root.nodeType === Node.ELEMENT_NODE) processAttributes(root, isCollege);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) processTextNode(node, isCollege);
    else processAttributes(node, isCollege);
    node = walker.nextNode();
  }
};

export default function InstitutionTerminologyBridge() {
  const { isCollege } = useInstitution();

  useEffect(() => {
    document.body.dataset.institutionType = isCollege ? "college" : "school";

    let applying = false;
    const apply = (root = document.body) => {
      if (applying) return;
      applying = true;
      try {
        processTree(root, isCollege);
      } finally {
        applying = false;
      }
    };

    apply();

    const observer = new MutationObserver((mutations) => {
      if (applying) return;
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          apply(mutation.target);
        } else if (mutation.type === "attributes") {
          apply(mutation.target);
        } else {
          mutation.addedNodes.forEach((node) => apply(node));
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS,
    });

    return () => observer.disconnect();
  }, [isCollege]);

  return null;
}
