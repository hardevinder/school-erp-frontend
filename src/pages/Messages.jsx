"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Container,
  Form,
  InputGroup,
  ListGroup,
  Modal,
  Row,
  Spinner,
  Toast,
  ToastContainer,
} from "react-bootstrap";
import api from "../api";
import "./Messages.css";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const safeStr = (v) => (v === null || v === undefined ? "" : String(v));

const getAuthUser = () => {
  try {
    const raw =
      localStorage.getItem("user") ||
      localStorage.getItem("authUser") ||
      localStorage.getItem("currentUser");

    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const safeJsonArray = (raw) => {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getStoredRoles = () => {
  const user = getAuthUser();

  const fromUser =
    user?.normalizedRoles ||
    user?.roles ||
    (user?.role ? [user.role] : []);

  const localRoles = safeJsonArray(localStorage.getItem("roles"));
  const sessionRoles = safeJsonArray(sessionStorage.getItem("roles"));

  const singleRoles = [
    localStorage.getItem("userRole"),
    sessionStorage.getItem("userRole"),
    localStorage.getItem("role"),
    sessionStorage.getItem("role"),
  ].filter(Boolean);

  return Array.from(
    new Set(
      [...fromUser, ...localRoles, ...sessionRoles, ...singleRoles]
        .map((r) => String(r || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
};

const hasAnyRole = (roles, list) => {
  return (roles || []).some((r) => list.includes(String(r).toLowerCase()));
};

const pickRows = (data, keys = []) => {
  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.items)) return data.items;

  return [];
};

const getClassId = (c) =>
  c?.id ?? c?.class_id ?? c?.classId ?? c?.Class_ID ?? c?.classID ?? "";

const getClassName = (c) =>
  c?.class_name ??
  c?.className ??
  c?.name ??
  c?.ClassName ??
  c?.Class_Name ??
  (getClassId(c) ? `Class ${getClassId(c)}` : "Class");

const getSectionId = (s) =>
  s?.id ?? s?.section_id ?? s?.sectionId ?? s?.Section_ID ?? s?.sectionID ?? "";

const getSectionName = (s) =>
  s?.section_name ??
  s?.sectionName ??
  s?.name ??
  s?.SectionName ??
  s?.Section_Name ??
  (getSectionId(s) ? `Section ${getSectionId(s)}` : "Section");

const getSectionClassId = (s) =>
  s?.class_id ??
  s?.classId ??
  s?.Class_ID ??
  s?.classID ??
  s?.class?.id ??
  s?.Class?.id ??
  "";

const getStudentId = (s) =>
  s?.id ?? s?.student_id ?? s?.studentId ?? s?.Student_ID ?? "";

const getStudentName = (s) =>
  s?.name ??
  s?.student_name ??
  s?.studentName ??
  s?.Student_Name ??
  s?.fullName ??
  "";

const getStudentAdmission = (s) =>
  s?.admission_number ??
  s?.admissionNumber ??
  s?.AdmissionNumber ??
  s?.admission_no ??
  "";

const getStudentClassId = (s) =>
  s?.class_id ?? s?.classId ?? s?.Class_ID ?? s?.class?.id ?? s?.Class?.id ?? "";

const getStudentSectionId = (s) =>
  s?.section_id ??
  s?.sectionId ??
  s?.Section_ID ??
  s?.section?.id ??
  s?.Section?.id ??
  "";

const getUserId = (u) => u?.id ?? u?.user_id ?? u?.userId ?? u?.User_ID ?? "";

const getUserName = (u) =>
  u?.name ??
  u?.fullName ??
  u?.displayName ??
  u?.username ??
  u?.email ??
  (getUserId(u) ? `User ${getUserId(u)}` : "");

const getParticipantDisplayName = (p, studentMap, userMap) => {
  if (!p) return "User";

  const studentId = p.participantStudentId || p.studentId;
  const userId = p.participantUserId || p.userId;

  const student =
    p.participantStudent ||
    p.student ||
    (studentId ? studentMap.get(String(studentId)) : null) ||
    (p.admissionNumber ? studentMap.get(`adm:${String(p.admissionNumber)}`) : null);

  if (student) {
    const name = getStudentName(student);
    const adm = getStudentAdmission(student) || p.admissionNumber;
    return name ? `${name}${adm ? ` (${adm})` : ""}` : adm || "Student";
  }

  const user = p.participantUser || p.user || (userId ? userMap.get(String(userId)) : null);
  if (user) return getUserName(user);

  if (p.admissionNumber) return `Student (${p.admissionNumber})`;

  const role = safeStr(p.participantRole || p.role || "User");
  return role.charAt(0).toUpperCase() + role.slice(1);
};

const getMessageSenderName = (m, participants, studentMap, userMap) => {
  if (!m) return "User";

  if (m.senderStudent) {
    const name = getStudentName(m.senderStudent);
    const adm = getStudentAdmission(m.senderStudent);
    return name ? `${name}${adm ? ` (${adm})` : ""}` : adm || "Student";
  }

  if (m.senderUser) return getUserName(m.senderUser);

  if (m.senderStudentId) {
    const student = studentMap.get(String(m.senderStudentId));
    if (student) {
      const name = getStudentName(student);
      const adm = getStudentAdmission(student);
      return name ? `${name}${adm ? ` (${adm})` : ""}` : adm || "Student";
    }

    const p = (participants || []).find(
      (x) => Number(x.participantStudentId) === Number(m.senderStudentId)
    );
    if (p) return getParticipantDisplayName(p, studentMap, userMap);

    return "Student";
  }

  if (m.senderUserId) {
    const user = userMap.get(String(m.senderUserId));
    if (user) return getUserName(user);

    const p = (participants || []).find(
      (x) => Number(x.participantUserId) === Number(m.senderUserId)
    );
    if (p) return getParticipantDisplayName(p, studentMap, userMap);
  }

  const role = safeStr(m.senderRole || "User");
  return role.charAt(0).toUpperCase() + role.slice(1);
};

const buildMessageFormData = (payload, files = []) => {
  const formData = new FormData();

  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (typeof value === "object") {
      formData.append(key, JSON.stringify(value));
    } else {
      formData.append(key, String(value));
    }
  });

  (files || []).forEach((file) => {
    formData.append("files", file);
  });

  return formData;
};

const fileNamesText = (files = []) =>
  Array.from(files || [])
    .map((f) => f?.name)
    .filter(Boolean)
    .join(", ");

const formatDateTime = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return safeStr(value);
  }
};

const latestMessage = (participantRow) => {
  const msgs = participantRow?.thread?.messages || [];
  return msgs[0] || null;
};

const typeLabel = (type) => {
  switch (type) {
    case "FEE_REMINDER":
      return "Fee Reminder";
    case "TEACHER_MESSAGE":
      return "Teacher Message";
    case "STUDENT_QUERY":
      return "Student Query";
    case "ADMIN_MESSAGE":
      return "Admin Message";
    case "ACCOUNT_MESSAGE":
      return "Accounts Message";
    default:
      return type || "General";
  }
};

const typeVariant = (type) => {
  switch (type) {
    case "FEE_REMINDER":
      return "danger";
    case "TEACHER_MESSAGE":
      return "primary";
    case "STUDENT_QUERY":
      return "success";
    case "ADMIN_MESSAGE":
      return "dark";
    case "ACCOUNT_MESSAGE":
      return "warning";
    default:
      return "secondary";
  }
};

const initials = (name) => {
  const s = safeStr(name).trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
};

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

const Messages = () => {
  const authUser = useMemo(() => getAuthUser(), []);
  const roles = useMemo(() => getStoredRoles(), []);

  const isStudent = roles.includes("student");
  const isTeacher = roles.includes("teacher");

  const isAdminLike = hasAnyRole(roles, [
    "superadmin",
    "super_admin",
    "admin",
    "academic_coordinator",
    "hr",
  ]);

  const isAccountsLike = hasAnyRole(roles, [
    "accounts",
    "accountant",
    "superadmin",
    "super_admin",
    "admin",
  ]);

  const canStaffCompose = !isStudent && (isTeacher || isAdminLike || isAccountsLike);

  const [loading, setLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const [error, setError] = useState("");
  const [inbox, setInbox] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const [showCompose, setShowCompose] = useState(false);

  const [recipients, setRecipients] = useState({
    teachers: [],
    support: [],
  });

  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [users, setUsers] = useState([]);

  const [compose, setCompose] = useState({
    type: isStudent ? "STUDENT_QUERY" : "TEACHER_MESSAGE",
    subject: "",
    body: "",
    targetMode: isStudent ? "USER" : "SINGLE",
    receiverUserId: "",
    receiverRole: "teacher",
    studentId: "",
    studentIds: "",
    classId: "",
    sectionId: "",
  });

  const [replyBody, setReplyBody] = useState("");
  const [composeFiles, setComposeFiles] = useState([]);
  const [replyFiles, setReplyFiles] = useState([]);

  const [toast, setToast] = useState({
    show: false,
    bg: "success",
    title: "",
    msg: "",
  });

  const showToast = (bg, title, msg) => {
    setToast({ show: true, bg, title, msg });
  };

  const aliveRef = useRef(true);
  const selectedThreadIdRef = useRef(null);
  const inboxRequestRef = useRef(0);
  const threadRequestRef = useRef(0);

  useEffect(() => {
    selectedThreadIdRef.current = selectedThread?.id || null;
  }, [selectedThread?.id]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /* Fetchers                                                           */
  /* ------------------------------------------------------------------ */

  const fetchInbox = async (nextPage = 1, options = {}) => {
    const { autoOpen = false } = options;
    const requestId = ++inboxRequestRef.current;

    setLoading(true);
    setError("");

    try {
      const res = await api.get("/api/messages/me", {
        params: {
          page: nextPage,
          limit: 20,
          q: search.trim() || undefined,
          type: typeFilter || undefined,
          unreadOnly: unreadOnly ? "true" : "false",
        },
      });

      if (!aliveRef.current || requestId !== inboxRequestRef.current) return;

      const rows = Array.isArray(res.data?.data) ? res.data.data : [];

      setInbox(rows);
      setPagination(res.data?.pagination || null);
      setPage(nextPage);

      // ✅ IMPORTANT:
      // Do NOT auto-open on every inbox refresh.
      // Auto-open only when explicitly requested and no thread is already selected.
      if (autoOpen && !selectedThreadIdRef.current && rows[0]?.thread?.id) {
        fetchThread(rows[0].thread.id, { refreshInbox: false });
      }
    } catch (err) {
      console.error("fetchInbox error:", err);
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load messages."
      );
    } finally {
      if (aliveRef.current && requestId === inboxRequestRef.current) {
        setLoading(false);
      }
    }
  };

  const fetchThread = async (threadId, options = {}) => {
    const { refreshInbox = false } = options;
    if (!threadId) return;

    const requestId = ++threadRequestRef.current;

    setThreadLoading(true);
    setError("");

    try {
      const res = await api.get(`/api/messages/${threadId}`);
      if (!aliveRef.current || requestId !== threadRequestRef.current) return;

      setSelectedThread(res.data?.thread || null);
      setReplyBody("");

      // ✅ Do not refresh inbox from here by default.
      // This prevents infinite /me -> /thread -> /me loop.
      if (refreshInbox) {
        fetchInbox(page, { autoOpen: false });
      }
    } catch (err) {
      console.error("fetchThread error:", err);
      showToast(
        "danger",
        "Thread Error",
        err?.response?.data?.error || err?.message || "Failed to open thread."
      );
    } finally {
      if (aliveRef.current && requestId === threadRequestRef.current) {
        setThreadLoading(false);
      }
    }
  };

  const fetchRecipients = async () => {
    try {
      const res = await api.get("/api/messages/recipients");
      setRecipients({
        teachers: Array.isArray(res.data?.teachers) ? res.data.teachers : [],
        support: Array.isArray(res.data?.support) ? res.data.support : [],
      });
    } catch (err) {
      console.error("fetchRecipients error:", err);
    }
  };

  const fetchClassesSectionsStudents = async () => {
    try {
      const [clsRes, secRes, stuRes, usersRes] = await Promise.allSettled([
        api.get("/classes"),
        api.get("/sections"),
        api.get("/students"),
        api.get("/users"),
      ]);

      if (clsRes.status === "fulfilled") {
        const rows = pickRows(clsRes.value.data, [
          "classes",
          "classList",
          "rows",
          "data",
        ]);
        setClasses(rows);
        console.log("[Messages] classes loaded:", rows.length, rows[0] || null);
      } else {
        console.error(
          "[Messages] classes failed:",
          clsRes.reason?.response?.data || clsRes.reason
        );
      }

      if (secRes.status === "fulfilled") {
        const rows = pickRows(secRes.value.data, [
          "sections",
          "sectionList",
          "rows",
          "data",
        ]);
        setSections(rows);
        console.log("[Messages] sections loaded:", rows.length, rows[0] || null);
      } else {
        console.error(
          "[Messages] sections failed:",
          secRes.reason?.response?.data || secRes.reason
        );
      }

      if (stuRes.status === "fulfilled") {
        const rows = pickRows(stuRes.value.data, [
          "students",
          "studentList",
          "rows",
          "data",
        ]);
        setStudents(rows);
        console.log("[Messages] students loaded:", rows.length, rows[0] || null);
      } else {
        console.error(
          "[Messages] students failed:",
          stuRes.reason?.response?.data || stuRes.reason
        );
      }

      if (usersRes.status === "fulfilled") {
        const rows = pickRows(usersRes.value.data, [
          "users",
          "userList",
          "rows",
          "data",
        ]);
        setUsers(rows);
        console.log("[Messages] users loaded:", rows.length, rows[0] || null);
      } else {
        // Users endpoint may be restricted for student login. That is okay.
        console.warn(
          "[Messages] users not loaded:",
          usersRes.reason?.response?.data || usersRes.reason
        );
      }
    } catch (err) {
      console.error("fetchClassesSectionsStudents error:", err);
    }
  };

  useEffect(() => {
    fetchInbox(1, { autoOpen: true });
    fetchRecipients();
    fetchClassesSectionsStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInbox(1, { autoOpen: false });
    }, 350);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, typeFilter, unreadOnly]);

  /* ------------------------------------------------------------------ */
  /* Actions                                                            */
  /* ------------------------------------------------------------------ */

  const resetCompose = () => {
    setComposeFiles([]);
    setCompose({
      type: isStudent ? "STUDENT_QUERY" : "TEACHER_MESSAGE",
      subject: "",
      body: "",
      targetMode: isStudent ? "USER" : "SINGLE",
      receiverUserId: "",
      receiverRole: "teacher",
      studentId: "",
      studentIds: "",
      classId: "",
      sectionId: "",
    });
  };

  const openCompose = () => {
    resetCompose();
    setShowCompose(true);
  };

  const sendMessage = async () => {
    const subject = compose.subject.trim();
    const body = compose.body.trim();

    if (!subject || !body) {
      showToast("warning", "Missing", "Subject and message are required.");
      return;
    }

    setSending(true);

    try {
      let payload = {
        type: compose.type,
        subject,
        body,
      };

      if (isStudent) {
        if (!compose.receiverUserId) {
          showToast("warning", "Recipient missing", "Please select a recipient.");
          return;
        }

        payload = {
          ...payload,
          receiverUserId: Number(compose.receiverUserId),
          receiverRole: compose.receiverRole || "teacher",
        };
      } else {
        payload = {
          ...payload,
          targetMode: compose.targetMode,
        };

        if (compose.targetMode === "SINGLE") {
          if (!compose.studentId) {
            showToast("warning", "Student missing", "Please select a student.");
            return;
          }
          payload.studentId = Number(compose.studentId);
        }

        if (compose.targetMode === "SELECTED_STUDENTS") {
          if (!compose.studentIds.trim()) {
            showToast(
              "warning",
              "Students missing",
              "Enter student IDs separated by comma."
            );
            return;
          }
          payload.studentIds = compose.studentIds.trim();
        }

        if (compose.targetMode === "CLASS_SECTION") {
          if (!compose.classId || !compose.sectionId) {
            showToast(
              "warning",
              "Class/Section missing",
              "Please select class and section."
            );
            return;
          }
          payload.classId = Number(compose.classId);
          payload.sectionId = Number(compose.sectionId);
        }
      }

      const formData = buildMessageFormData(payload, composeFiles);

      const res = await api.post("/api/messages", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setShowCompose(false);
      setComposeFiles([]);
      resetCompose();
      showToast("success", "Sent", "Message sent successfully.");

      await fetchInbox(1, { autoOpen: false });

      const threadId = res.data?.thread?.id;
      if (threadId) fetchThread(threadId);
    } catch (err) {
      console.error("sendMessage error:", err);
      showToast(
        "danger",
        "Send Failed",
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to send message."
      );
    } finally {
      setSending(false);
    }
  };

  const sendReply = async () => {
    if (!selectedThread?.id) return;

    const body = replyBody.trim();
    if (!body) {
      showToast("warning", "Reply missing", "Please type your reply.");
      return;
    }

    setSending(true);

    try {
      const formData = buildMessageFormData({ body }, replyFiles);

      await api.post(`/api/messages/${selectedThread.id}/reply`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      showToast("success", "Reply Sent", "Your reply was sent.");
      setReplyBody("");
      setReplyFiles([]);
      await fetchThread(selectedThread.id, { refreshInbox: false });
    } catch (err) {
      console.error("sendReply error:", err);
      showToast(
        "danger",
        "Reply Failed",
        err?.response?.data?.error || err?.message || "Failed to send reply."
      );
    } finally {
      setSending(false);
    }
  };

  const archiveThread = async () => {
    if (!selectedThread?.id) return;

    try {
      await api.patch(`/api/messages/${selectedThread.id}/archive`);
      showToast("success", "Archived", "Thread archived.");
      setSelectedThread(null);
      fetchInbox(1, { autoOpen: false });
    } catch (err) {
      showToast(
        "danger",
        "Archive Failed",
        err?.response?.data?.error || err?.message || "Failed to archive."
      );
    }
  };

  const deleteThread = async () => {
    if (!selectedThread?.id) return;

    if (!window.confirm("Delete this thread from your inbox?")) return;

    try {
      await api.delete(`/api/messages/${selectedThread.id}`);
      showToast("success", "Deleted", "Thread deleted from your inbox.");
      setSelectedThread(null);
      fetchInbox(1, { autoOpen: false });
    } catch (err) {
      showToast(
        "danger",
        "Delete Failed",
        err?.response?.data?.error || err?.message || "Failed to delete."
      );
    }
  };

  /* ------------------------------------------------------------------ */
  /* Derived                                                            */
  /* ------------------------------------------------------------------ */

  const allStudentOptions = useMemo(() => {
    return (students || [])
      .map((s) => ({
        id: getStudentId(s),
        name: getStudentName(s),
        admissionNumber: getStudentAdmission(s),
        classId: getStudentClassId(s),
        sectionId: getStudentSectionId(s),
      }))
      .filter((s) => s.id);
  }, [students]);

  const studentMap = useMemo(() => {
    const map = new Map();

    (students || []).forEach((s) => {
      const id = getStudentId(s);
      const adm = getStudentAdmission(s);

      if (id) map.set(String(id), s);
      if (adm) map.set(`adm:${String(adm)}`, s);
    });

    return map;
  }, [students]);

  const userMap = useMemo(() => {
    const map = new Map();

    (users || []).forEach((u) => {
      const id = getUserId(u);
      if (id) map.set(String(id), u);
    });

    return map;
  }, [users]);

  const filteredSections = useMemo(() => {
    if (!compose.classId) return sections;

    return (sections || []).filter((s) => {
      const sidClass = getSectionClassId(s);

      // Some old section APIs return only section list without class_id.
      // In that case, show all sections instead of empty dropdown.
      if (!sidClass) return true;

      return Number(sidClass) === Number(compose.classId);
    });
  }, [sections, compose.classId]);

  const filteredStudentOptions = useMemo(() => {
    let list = allStudentOptions;

    if (compose.classId) {
      list = list.filter((s) => {
        if (!s.classId) return true;
        return Number(s.classId) === Number(compose.classId);
      });
    }

    if (compose.sectionId) {
      list = list.filter((s) => {
        if (!s.sectionId) return true;
        return Number(s.sectionId) === Number(compose.sectionId);
      });
    }

    return list;
  }, [allStudentOptions, compose.classId, compose.sectionId]);

  const staffRecipients = useMemo(() => {
    return [
      ...(recipients.teachers || []).map((r) => ({
        ...r,
        group: "Teachers",
        role: r.role || "teacher",
      })),
      ...(recipients.support || []).map((r) => ({
        ...r,
        group: "Support",
        role: r.role || "admin",
      })),
    ];
  }, [recipients]);

  const messages = selectedThread?.messages || [];
  const participants = selectedThread?.participants || [];

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <Container fluid className="messages-page py-4">
      <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
        <Toast
          bg={toast.bg}
          show={toast.show}
          delay={3500}
          autohide
          onClose={() => setToast((t) => ({ ...t, show: false }))}
        >
          <Toast.Header closeButton>
            <strong className="me-auto">{toast.title || "Info"}</strong>
          </Toast.Header>
          <Toast.Body className={toast.bg === "danger" ? "text-white" : ""}>
            {toast.msg}
          </Toast.Body>
        </Toast>
      </ToastContainer>

      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h2 className="m-0 text-primary">Messages</h2>
          <div className="text-muted small">
            Personal messages, fee reminders, teacher-student replies and inbox.
          </div>
        </div>

        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={() => fetchInbox(page, { autoOpen: false })}>
            Refresh
          </Button>
          <Button variant="primary" onClick={openCompose}>
            New Message
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="g-3">
        <Col lg={4} xl={3}>
          <Card className="messages-card">
            <Card.Header className="bg-white">
              <div className="d-flex justify-content-between align-items-center gap-2">
                <strong>Inbox</strong>
                <Badge bg="secondary" pill>
                  {pagination?.total ?? inbox.length}
                </Badge>
              </div>

              <div className="mt-3 d-flex flex-column gap-2">
                <InputGroup size="sm">
                  <InputGroup.Text>Search</InputGroup.Text>
                  <Form.Control
                    placeholder="Subject..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </InputGroup>

                <Form.Select
                  size="sm"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="">All Types</option>
                  <option value="FEE_REMINDER">Fee Reminder</option>
                  <option value="TEACHER_MESSAGE">Teacher Message</option>
                  <option value="STUDENT_QUERY">Student Query</option>
                  <option value="ADMIN_MESSAGE">Admin Message</option>
                  <option value="ACCOUNT_MESSAGE">Accounts Message</option>
                  <option value="GENERAL">General</option>
                </Form.Select>

                <Form.Check
                  type="switch"
                  label="Unread only"
                  checked={unreadOnly}
                  onChange={(e) => setUnreadOnly(e.target.checked)}
                />
              </div>
            </Card.Header>

            <Card.Body className="p-0">
              {loading ? (
                <div className="text-center py-4">
                  <Spinner animation="border" />
                </div>
              ) : inbox.length ? (
                <ListGroup variant="flush" className="messages-list">
                  {inbox.map((row) => {
                    const thread = row.thread || {};
                    const lm = latestMessage(row);
                    const active = Number(selectedThread?.id) === Number(thread.id);
                    const unread = !row.lastReadAt;

                    return (
                      <ListGroup.Item
                        key={row.id}
                        action
                        active={active}
                        className={`message-list-item ${unread ? "is-unread" : ""}`}
                        onClick={() => fetchThread(thread.id, { refreshInbox: false })}
                      >
                        <div className="d-flex justify-content-between gap-2">
                          <div className="fw-semibold text-truncate">
                            {thread.subject || "Untitled"}
                          </div>
                          {unread && <span className="unread-dot" />}
                        </div>

                        <div className="d-flex gap-2 align-items-center my-1">
                          <Badge bg={typeVariant(thread.type)}>
                            {typeLabel(thread.type)}
                          </Badge>
                          <span className="small text-muted">
                            {formatDateTime(thread.lastMessageAt || thread.createdAt)}
                          </span>
                        </div>

                        <div className="small text-muted message-snippet">
                          {lm?.body || "No message preview."}
                        </div>
                      </ListGroup.Item>
                    );
                  })}
                </ListGroup>
              ) : (
                <div className="text-center text-muted py-4">
                  No messages found.
                </div>
              )}
            </Card.Body>

            {pagination?.totalPages > 1 && (
              <Card.Footer className="bg-white d-flex justify-content-between">
                <Button
                  size="sm"
                  variant="outline-secondary"
                  disabled={page <= 1}
                  onClick={() => fetchInbox(page - 1, { autoOpen: false })}
                >
                  Previous
                </Button>
                <span className="small text-muted align-self-center">
                  Page {page} / {pagination.totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  disabled={page >= pagination.totalPages}
                  onClick={() => fetchInbox(page + 1, { autoOpen: false })}
                >
                  Next
                </Button>
              </Card.Footer>
            )}
          </Card>
        </Col>

        <Col lg={8} xl={9}>
          <Card className="messages-card thread-card">
            {!selectedThread ? (
              <div className="empty-thread">
                <div className="empty-icon">💬</div>
                <h5>Select a message</h5>
                <p className="text-muted">
                  Open a thread from the left side or create a new message.
                </p>
              </div>
            ) : threadLoading ? (
              <div className="text-center py-5">
                <Spinner animation="border" />
              </div>
            ) : (
              <>
                <Card.Header className="bg-white">
                  <div className="d-flex justify-content-between flex-wrap gap-2">
                    <div>
                      <h5 className="mb-1">{selectedThread.subject}</h5>
                      <div className="d-flex gap-2 align-items-center flex-wrap">
                        <Badge bg={typeVariant(selectedThread.type)}>
                          {typeLabel(selectedThread.type)}
                        </Badge>
                        <Badge bg="light" text="dark">
                          {selectedThread.status || "OPEN"}
                        </Badge>
                        <span className="small text-muted">
                          Last:{" "}
                          {formatDateTime(
                            selectedThread.lastMessageAt || selectedThread.createdAt
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="d-flex gap-2">
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={archiveThread}
                      >
                        Archive
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={deleteThread}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  {participants.length > 0 && (
                    <div className="participants-row mt-3">
                      {participants.map((p) => (
                        <Badge
                          key={p.id}
                          bg={p.lastReadAt ? "success" : "secondary"}
                          pill
                        >
                          {getParticipantDisplayName(p, studentMap, userMap)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Card.Header>

                <Card.Body className="thread-body">
                  {messages.length ? (
                    messages.map((m) => {
                      const sender = getMessageSenderName(
                        m,
                        participants,
                        studentMap,
                        userMap
                      );

                      return (
                        <div key={m.id} className="message-bubble-row">
                          <div className="message-avatar">{initials(sender)}</div>

                          <div className="message-bubble">
                            <div className="d-flex justify-content-between gap-3">
                              <strong className="text-capitalize">
                                {sender}
                              </strong>
                              <small className="text-muted">
                                {formatDateTime(m.createdAt)}
                              </small>
                            </div>
                            <div className="mt-1 message-body-text">{m.body}</div>

                            {Array.isArray(m.attachments) &&
                              m.attachments.length > 0 && (
                                <div className="mt-2 d-flex flex-column gap-1">
                                  {m.attachments.map((a) => (
                                    <a
                                      key={a.id}
                                      href={a.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="small"
                                    >
                                      📎 {a.name || a.filename || "Attachment"}
                                    </a>
                                  ))}
                                </div>
                              )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-muted text-center py-4">
                      No replies yet.
                    </div>
                  )}
                </Card.Body>

                <Card.Footer className="bg-white">
                  <Form.Label className="fw-semibold">Reply</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    placeholder="Type your reply..."
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                  />

                  <div className="mt-2">
                    <Form.Control
                      type="file"
                      multiple
                      size="sm"
                      onChange={(e) =>
                        setReplyFiles(Array.from(e.target.files || []))
                      }
                    />
                    {replyFiles.length > 0 && (
                      <div className="small text-muted mt-1">
                        Selected: {fileNamesText(replyFiles)}
                      </div>
                    )}
                  </div>

                  <div className="d-flex justify-content-end mt-2">
                    <Button
                      variant="primary"
                      disabled={sending || !replyBody.trim()}
                      onClick={sendReply}
                    >
                      {sending ? (
                        <>
                          <Spinner size="sm" animation="border" className="me-2" />
                          Sending
                        </>
                      ) : (
                        "Send"
                      )}
                    </Button>
                  </div>
                </Card.Footer>
              </>
            )}
          </Card>
        </Col>
      </Row>

      {/* Compose Modal */}
      <Modal
        show={showCompose}
        onHide={() => setShowCompose(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>New Message</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Row className="g-3">
            <Col md={6}>
              <Form.Label>Message Type</Form.Label>
              <Form.Select
                value={compose.type}
                onChange={(e) =>
                  setCompose((p) => ({ ...p, type: e.target.value }))
                }
              >
                <option value="GENERAL">General</option>
                {isStudent ? (
                  <option value="STUDENT_QUERY">Student Query</option>
                ) : (
                  <>
                    <option value="TEACHER_MESSAGE">Teacher Message</option>
                    <option value="ADMIN_MESSAGE">Admin Message</option>
                    <option value="ACCOUNT_MESSAGE">Accounts Message</option>
                  </>
                )}
              </Form.Select>
            </Col>

            {!isStudent && (
              <Col md={6}>
                <Form.Label>Target</Form.Label>
                <Form.Select
                  value={compose.targetMode}
                  onChange={(e) =>
                    setCompose((p) => ({ ...p, targetMode: e.target.value }))
                  }
                >
                  <option value="SINGLE">Single Student</option>
                  <option value="SELECTED_STUDENTS">Selected Students</option>
                  <option value="CLASS_SECTION">Class / Section</option>
                </Form.Select>
              </Col>
            )}

            {!isStudent && (
              <Col md={12}>
                <div className="small text-muted">
                  Loaded: {classes.length} classes, {sections.length} sections,{" "}
                  {students.length} students, {users.length} users
                </div>
              </Col>
            )}

            {isStudent && (
              <Col md={6}>
                <Form.Label>Send To</Form.Label>
                <Form.Select
                  value={compose.receiverUserId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const found = staffRecipients.find(
                      (r) => Number(r.id) === Number(id)
                    );
                    setCompose((p) => ({
                      ...p,
                      receiverUserId: id,
                      receiverRole: found?.role || "teacher",
                    }));
                  }}
                >
                  <option value="">Select teacher/admin/accounts</option>
                  {staffRecipients.map((r) => (
                    <option key={`${r.group}-${r.id}`} value={r.id}>
                      {r.group}: {r.name || r.username || `User ${r.id}`}
                    </option>
                  ))}
                </Form.Select>
              </Col>
            )}

            {!isStudent && compose.targetMode === "SINGLE" && (
              <>
                <Col md={4}>
                  <Form.Label>Class Filter</Form.Label>
                  <Form.Select
                    value={compose.classId}
                    onChange={(e) =>
                      setCompose((p) => ({
                        ...p,
                        classId: e.target.value,
                        sectionId: "",
                        studentId: "",
                      }))
                    }
                  >
                    <option value="">All Classes</option>
                    {classes.map((c) => {
                      const id = getClassId(c);
                      return (
                        <option key={id || getClassName(c)} value={id}>
                          {getClassName(c)}
                        </option>
                      );
                    })}
                  </Form.Select>
                  {!classes.length && (
                    <div className="small text-muted mt-1">
                      Classes not loaded. Check console for API response.
                    </div>
                  )}
                </Col>

                <Col md={4}>
                  <Form.Label>Section Filter</Form.Label>
                  <Form.Select
                    value={compose.sectionId}
                    onChange={(e) =>
                      setCompose((p) => ({
                        ...p,
                        sectionId: e.target.value,
                        studentId: "",
                      }))
                    }
                  >
                    <option value="">All Sections</option>
                    {filteredSections.map((s) => {
                      const id = getSectionId(s);
                      return (
                        <option key={id || getSectionName(s)} value={id}>
                          {getSectionName(s)}
                        </option>
                      );
                    })}
                  </Form.Select>
                </Col>

                <Col md={4}>
                  <Form.Label>Student</Form.Label>
                  <Form.Select
                    value={compose.studentId}
                    onChange={(e) =>
                      setCompose((p) => ({ ...p, studentId: e.target.value }))
                    }
                  >
                    <option value="">Select student</option>
                    {filteredStudentOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name || "Student"} - {s.admissionNumber || s.id}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
              </>
            )}

            {!isStudent && compose.targetMode === "SELECTED_STUDENTS" && (
              <Col md={12}>
                <Form.Label>Student IDs</Form.Label>
                <Form.Control
                  placeholder="Example: 101,102,103"
                  value={compose.studentIds}
                  onChange={(e) =>
                    setCompose((p) => ({ ...p, studentIds: e.target.value }))
                  }
                />
                <div className="small text-muted mt-1">
                  Enter database student IDs separated by comma.
                </div>
              </Col>
            )}

            {!isStudent && compose.targetMode === "CLASS_SECTION" && (
              <>
                <Col md={6}>
                  <Form.Label>Class</Form.Label>
                  <Form.Select
                    value={compose.classId}
                    onChange={(e) =>
                      setCompose((p) => ({
                        ...p,
                        classId: e.target.value,
                        sectionId: "",
                      }))
                    }
                  >
                    <option value="">Select class</option>
                    {classes.map((c) => {
                      const id = getClassId(c);
                      return (
                        <option key={id || getClassName(c)} value={id}>
                          {getClassName(c)}
                        </option>
                      );
                    })}
                  </Form.Select>
                </Col>

                <Col md={6}>
                  <Form.Label>Section</Form.Label>
                  <Form.Select
                    value={compose.sectionId}
                    onChange={(e) =>
                      setCompose((p) => ({ ...p, sectionId: e.target.value }))
                    }
                  >
                    <option value="">Select section</option>
                    {filteredSections.map((s) => {
                      const id = getSectionId(s);
                      return (
                        <option key={id || getSectionName(s)} value={id}>
                          {getSectionName(s)}
                        </option>
                      );
                    })}
                  </Form.Select>
                </Col>
              </>
            )}

            <Col md={12}>
              <Form.Label>Subject</Form.Label>
              <Form.Control
                placeholder="Message subject"
                value={compose.subject}
                onChange={(e) =>
                  setCompose((p) => ({ ...p, subject: e.target.value }))
                }
              />
            </Col>

            <Col md={12}>
              <Form.Label>Message</Form.Label>
              <Form.Control
                as="textarea"
                rows={5}
                placeholder="Type message..."
                value={compose.body}
                onChange={(e) =>
                  setCompose((p) => ({ ...p, body: e.target.value }))
                }
              />
            </Col>

            <Col md={12}>
              <Form.Label>Attachments</Form.Label>
              <Form.Control
                type="file"
                multiple
                onChange={(e) =>
                  setComposeFiles(Array.from(e.target.files || []))
                }
              />
              {composeFiles.length > 0 && (
                <div className="small text-muted mt-2">
                  Selected: {fileNamesText(composeFiles)}
                </div>
              )}
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => setShowCompose(false)}
          >
            Cancel
          </Button>
          <Button variant="primary" disabled={sending} onClick={sendMessage}>
            {sending ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Sending
              </>
            ) : (
              "Send Message"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default Messages;