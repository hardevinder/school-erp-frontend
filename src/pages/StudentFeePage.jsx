// src/pages/StudentFeePage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { Tabs, Tab } from "react-bootstrap";

const StudentFeePage = () => {
  // ------------- Role helpers -------------
  const parseJwt = (token) => {
    try {
      const p = token.split(".")[1];
      return JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      return null;
    }
  };
  const normalizeRole = (r) => String(r || "").toLowerCase();
  const normalizeAdmission = (s) => String(s || "").replace(/\//g, "-").trim();

  const roles = useMemo(() => {
    try {
      const stored = localStorage.getItem("roles");
      if (stored) return JSON.parse(stored).map(normalizeRole);
    } catch {}
    const single = localStorage.getItem("userRole");
    if (single) return [normalizeRole(single)];
    const token = localStorage.getItem("token");
    if (token) {
      const payload = parseJwt(token);
      if (payload) {
        if (Array.isArray(payload.roles)) return payload.roles.map(normalizeRole);
        if (payload.role) return [normalizeRole(payload.role)];
      }
    }
    return [];
  }, []);

  const normalizedRoles = roles.map(normalizeRole);
  const isStudent = normalizedRoles.includes("student");
  const isParent = normalizedRoles.includes("parent");
  const isAdminish = normalizedRoles.includes("admin") || normalizedRoles.includes("superadmin");
  const canView = isStudent || isParent || isAdminish;

  // ------------- NEW: family + active student (sibling switcher parity) -------------
  const [family, setFamily] = useState(null);
  const [activeStudentAdmission, setActiveStudentAdmission] = useState(
    () => localStorage.getItem("activeStudentAdmission") || localStorage.getItem("username") || ""
  );

  const studentsList = useMemo(() => {
    if (!family) return [];
    const list = [];
    if (family.student) list.push({ ...family.student, isSelf: true });
    (family.siblings || []).forEach((s) => list.push({ ...s, isSelf: false }));
    return list;
  }, [family]);

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem("family");
        setFamily(raw ? JSON.parse(raw) : null);
        const stored =
          localStorage.getItem("activeStudentAdmission") || localStorage.getItem("username") || "";
        setActiveStudentAdmission(stored);
      } catch {
        setFamily(null);
      }
    };
    load();

    const onFamilyUpdated = () => load();
    const onStudentSwitched = () => {
      load();
      const adm =
        localStorage.getItem("activeStudentAdmission") || localStorage.getItem("username");
      if (adm) {
        const n = normalizeAdmission(adm);
        // refresh data for newly active student
        fetchStudentDetails(n);
        fetchTransactionHistory(n);
        fetchVanFeeByHead();
        fetchOpeningBalanceOutstandingForMe(); // refresh OB on switch
      }
    };

    window.addEventListener("family-updated", onFamilyUpdated);
    window.addEventListener("student-switched", onStudentSwitched);
    return () => {
      window.removeEventListener("family-updated", onFamilyUpdated);
      window.removeEventListener("student-switched", onStudentSwitched);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSeeStudentSwitcher = isStudent || isParent;

  // ------------- Admission source: prefer activeStudentAdmission -------------
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const username = useMemo(() => {
    const storedActive = localStorage.getItem("activeStudentAdmission");
    if (storedActive) return normalizeAdmission(storedActive);
    const stored = localStorage.getItem("username");
    if (stored) return normalizeAdmission(stored);
    const token = localStorage.getItem("token");
    if (token) {
      const payload = parseJwt(token);
      const adm = (payload && (payload.admission_number || payload.username)) || null;
      if (adm) return normalizeAdmission(adm);
    }
    return null;
  }, [activeStudentAdmission]);

  // ------------- Page state -------------
  const [studentDetails, setStudentDetails] = useState(null);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [vanByHead, setVanByHead] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("details");

  // Payment gateway + popup state
  const [paymentGateway, setPaymentGateway] = useState("razorpay");
  const popupRef = useRef(null);
  const popupPollRef = useRef(null);
  const messageListenerRef = useRef(null);
  const popupTimeoutRef = useRef(null);

  // ---------- NEW: Opening Balance (Previous Balance) state ----------
  const [prevBalanceHeadId, setPrevBalanceHeadId] = useState(null);
  const [prevBalanceDue, setPrevBalanceDue] = useState(0);
  const [activeSessionId, setActiveSessionId] = useState(null);

  // ------------- Helpers -------------
  const formatINR = (v) =>
    isNaN(v)
      ? v
      : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(
          Number(v || 0)
        );
  const formatDateTime = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Fine totals from server (any shape)
  const getFineTotal = (fee) =>
    Number(
      fee?.fineAmount ?? fee?.fine_due ?? fee?.lateFee ?? fee?.LateFee ?? fee?.Fine ?? fee?.FineAmount ?? 0
    );
  const getFinePaid = (fee) =>
    Number(
      fee?.fineReceived ?? fee?.totalFineReceived ?? fee?.Fine_Amount ?? fee?.FineReceived ?? 0
    );
  const getFineDue = (fee) => Math.max(0, getFineTotal(fee) - getFinePaid(fee));

  // --------- NEW: Session + OB helpers (parity with Transactions.js) ----------
  const fetchActiveSessionId = async () => {
    try {
      const res = await api.get("/sessions");
      const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      let active = list.find((s) => s.is_active === true) || list[0] || null;
      if (active) setActiveSessionId(Number(active.id));
      else setActiveSessionId(null);
    } catch (e) {
      console.warn("fetchActiveSessionId failed:", e?.message || e);
      setActiveSessionId(null);
    }
  };

  const ensurePrevBalanceHeadId = async () => {
    if (prevBalanceHeadId) return prevBalanceHeadId;
    try {
      const res = await api.get("/fee-headings");
      const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      const hit = list.find((h) => String(h.fee_heading).toLowerCase() === "previous balance");
      if (hit) {
        setPrevBalanceHeadId(hit.id);
        return hit.id;
      }
    } catch (e) {
      console.warn("fee-headings fetch failed:", e?.message || e);
    }
    return null;
  };

  const fetchOpeningBalanceOutstandingForMe = async () => {
    try {
      const sid =
        Number(studentDetails?.student_id) ||
        Number(studentDetails?.id) ||
        Number(studentDetails?.Student_ID) ||
        null;

      if (!sid || !activeSessionId) {
        setPrevBalanceDue(0);
        return 0;
      }

      // Preferred server endpoint
      try {
        const try1 = await api.get(`/opening-balances/outstanding`, {
          params: { student_id: sid, session_id: activeSessionId },
        });
        const val1 = Number(
          try1?.data?.outstanding ??
          try1?.data?.data?.outstanding ??
          try1?.data?.totalOutstanding
        );
        if (!Number.isNaN(val1) && val1 > 0) {
          setPrevBalanceDue(val1);
          return val1;
        }
      } catch (_) {}

      // Fallback: list and sum
      try {
        const res = await api.get(`/opening-balances`, {
          params: { student_id: sid, session_id: activeSessionId },
        });
        const rows = Array.isArray(res.data?.rows) ? res.data.rows : (Array.isArray(res.data) ? res.data : []);
        if (!rows.length) {
          setPrevBalanceDue(0);
          return 0;
        }
        const providedTotal = Number(
          res.data?.outstanding ||
          res.data?.totalOutstanding ||
          res.data?.totals?.outstanding
        );
        const total = !Number.isNaN(providedTotal)
          ? providedTotal
          : rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);

        const final = Math.max(0, total);
        setPrevBalanceDue(final);
        return final;
      } catch (e) {
        console.warn("opening balance fallback failed:", e?.message || e);
        setPrevBalanceDue(0);
        return 0;
      }
    } catch (e) {
      console.warn("OB fetch failed:", e?.message || e);
      setPrevBalanceDue(0);
      return 0;
    }
  };

  // ------------- Data fetch -------------
  useEffect(() => {
    if (!canView || !username) {
      setError("Access Denied");
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchStudentDetails(username), fetchTransactionHistory(username)]);
      await fetchVanFeeByHead();
      setLoading(false);
    };
    load();
  }, [canView, username]);

  // NEW: on mount, resolve session & OB head id
  useEffect(() => {
    fetchActiveSessionId();
    ensurePrevBalanceHeadId();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When basic data loads or keys change, refresh Opening Balance
  useEffect(() => {
    if (canView && username) {
      (async () => {
        await fetchOpeningBalanceOutstandingForMe();
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, username, studentDetails, activeSessionId]);

  // Optional polling (keeps current selection in sync)
  useEffect(() => {
    if (username && canView) {
      const id = setInterval(() => {
        fetchStudentDetails(username);
        fetchTransactionHistory(username);
        fetchVanFeeByHead();
        fetchOpeningBalanceOutstandingForMe(); // keep OB fresh
      }, 15000);
      return () => clearInterval(id);
    }
  }, [username, canView]);

  const fetchStudentDetails = async (admissionNumber) => {
    try {
      const res = await api.get(`/StudentsApp/admission/${admissionNumber}/fees`);
      setStudentDetails(res.data || null);
      setError(null);
    } catch (err) {
      console.error("Error fetching student details:", err);
      setError("Failed to load student details.");
    }
  };

  const fetchTransactionHistory = async (admissionNumber) => {
    try {
      const res = await api.get(`/StudentsApp/feehistory/${admissionNumber}`);
    if (res.data && res.data.success) {
        setTransactionHistory(res.data.data || []);
      } else {
        setTransactionHistory([]);
      }
    } catch (err) {
      console.error("Error fetching transaction history:", err);
    }
  };

  const fetchVanFeeByHead = async () => {
    try {
      const res = await api.get(`/transactions/vanfee/me`);
      const rows =
        res.data && res.data.data
          ? res.data.data
          : Array.isArray(res.data)
          ? res.data
          : [];
      const map = {};
      rows.forEach((r) => {
        const id = Number(r.Fee_Head);
        map[id] = {
          transportCost: Number(r.TransportCost || 0),
          totalVanFeeReceived: Number(r.TotalVanFeeReceived || 0),
          totalVanFeeConcession: Number(r.TotalVanFeeConcession || 0),
        };
      });
      setVanByHead(map);
    } catch (e) {
      console.warn("Failed to fetch per-head van fee:", e?.message || e);
      setVanByHead({});
    }
  };

  // ------------- Payment utilities (popup + gateway) -------------
  const openBlankWindowForPayment = () => {
    try {
      const width = 980,
        height = 720;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;
      const features = `width=${width},height=${height},left=${left},top=${top},noopener`;
      const w = window.open("", "_blank", features);
      if (w) {
        try {
          w.document.write("<p style='font-family:system-ui;padding:20px'>Preparing payment page…</p>");
        } catch {}
      }
      return w;
    } catch {
      return null;
    }
  };

  const pollPopupClosed = (w) => {
    if (popupPollRef.current) clearInterval(popupPollRef.current);
    popupPollRef.current = setInterval(() => {
      try {
        if (!w || w.closed) {
          clearInterval(popupPollRef.current);
          popupPollRef.current = null;
          refreshAfterPayment();
        }
      } catch {
        clearInterval(popupPollRef.current);
        popupPollRef.current = null;
        refreshAfterPayment();
      }
    }, 800);
  };

  const installMessageListener = () => {
    if (messageListenerRef.current) return;
    const handler = (ev) => {
      try {
        const data = ev?.data;
        if (!data) return;
        if (data.type === "payment-updated" || data.type === "hdfc.payment.updated") {
          refreshAfterPayment();
          Swal.fire({
            icon: data.status === "success" ? "success" : "info",
            title: data.status === "success" ? "Payment Completed" : "Payment Update",
            text: data.message || "Payment status updated. Fetching latest data...",
            background: "#052e16",
            color: "#dcfce7",
          });
          try {
            if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
          } catch {}
        }
      } catch (err) {
        console.warn("message handler error:", err);
      }
    };
    messageListenerRef.current = handler;
    window.addEventListener("message", handler, false);
  };

  const cleanupPopupListeners = () => {
    if (messageListenerRef.current) {
      window.removeEventListener("message", messageListenerRef.current);
      messageListenerRef.current = null;
    }
    if (popupPollRef.current) {
      clearInterval(popupPollRef.current);
      popupPollRef.current = null;
    }
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
      popupTimeoutRef.current = null;
    }
    popupRef.current = null;
  };

  const openPaymentPopup = (url) => {
    try {
      const width = 980,
        height = 720;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;
      const features = `width=${width},height=${height},left=${left},top=${top},noopener`;

      // eslint-disable-next-line no-restricted-globals
      const w = window.open(url, "_blank", features);
      if (!w) {
        Swal.fire({
          icon: "error",
          title: "Popup blocked",
          text: "Please allow popups for this site to complete payment.",
        });
        return;
      }
      popupRef.current = w;
      installMessageListener();
      pollPopupClosed(w);

      if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
      popupTimeoutRef.current = setTimeout(() => {
        try {
          if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
        } catch {}
        cleanupPopupListeners();
      }, 1000 * 60 * 15);
    } catch (e) {
      console.error("Failed to open payment popup:", e);
    }
  };

  const handleGatewayResponse = (data, sessionHint = null) => {
    const url =
      data?.paymentPageUrl ||
      data?.payment_page_url ||
      data?.paymentUrl ||
      data?.redirectUrl ||
      data?.paymentUrlForClient ||
      (data && data.session && data.session.paymentPageUrl) ||
      (data &&
        data.vendorOrderId &&
        (process.env.REACT_APP_HDFC_PAYMENT_PAGE_BASE
          ? `${process.env.REACT_APP_HDFC_PAYMENT_PAGE_BASE.replace(/\/$/, "")}/${data.vendorOrderId}`
          : null)) ||
      (sessionHint &&
        sessionHint.vendorOrderId &&
        (process.env.REACT_APP_HDFC_PAYMENT_PAGE_BASE
          ? `${process.env.REACT_APP_HDFC_PAYMENT_PAGE_BASE.replace(/\/$/, "")}/${sessionHint.vendorOrderId}`
          : null));

    if (url) {
      openPaymentPopup(url);
      Swal.fire({
        icon: "info",
        title: "Payment page opened",
        text: "Complete the payment in the opened window.",
      });
      return true;
    }

    if (data && data.action && data.params) {
      const w = window.open("", "_blank", "noopener");
      if (!w) {
        Swal.fire({ icon: "error", title: "Popup blocked", text: "Allow popups to complete payment." });
        return false;
      }
      const formHtml = `
        <form id="payForm" method="POST" action="${data.action}">
          ${Object.entries(data.params)
            .map(([k, v]) => `<input type="hidden" name="${k}" value="${String(v == null ? "" : v)}" />`)
            .join("\n")}
        </form>
        <script>document.getElementById('payForm').submit();</script>
      `;
      w.document.write(formHtml);
      installMessageListener();
      pollPopupClosed(w);
      Swal.fire({ icon: "info", title: "Payment page opened", text: "A new tab was opened to complete your payment." });
      return true;
    }

    if (data && data._createOrderError) {
      Swal.fire({
        icon: "error",
        title: "Payment link creation failed",
        text: "Could not create payment link. Try again.",
      });
      return false;
    }

    Swal.fire({
      icon: "error",
      title: "Payment initialization failed",
      text: "Please contact support or try again.",
    });
    return false;
  };

  const refreshAfterPayment = () => {
    window.dispatchEvent(new Event("student-fee:refresh"));
    setTimeout(() => {
      try {
        if (username) {
          fetchStudentDetails(username);
          fetchTransactionHistory(username);
          fetchVanFeeByHead();
          fetchOpeningBalanceOutstandingForMe();
        } else {
          window.location.reload();
        }
      } catch {}
      cleanupPopupListeners();
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (popupPollRef.current) clearInterval(popupPollRef.current);
      if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
      if (messageListenerRef.current) window.removeEventListener("message", messageListenerRef.current);
      try {
        if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
      } catch {}
    };
  }, []);

  // ------------- UI helpers (Transport) -------------
  const getVanForHeadFromMap = (feeHeadId) => {
    const v = vanByHead[Number(feeHeadId)];
    if (!v) return null;
    const received = Number(v.totalVanFeeReceived || 0);
    const concession = Number(v.totalVanFeeConcession || 0);
    const cost = Number(v.transportCost || 0);
    const pending = Math.max(cost - (received + concession), 0);
    return { cost, received, concession, pending, due: cost };
  };

  const getTransportBreakdown = (fee) => {
    if (fee?.transportApplicable && fee?.transport) {
      const t = fee.transport;
      return {
        cost: Number(t.transportDue || 0) + Number(t.transportReceived || 0) + Number(t.transportConcession || 0),
        due: Number(t.transportDue || 0),
        received: Number(t.transportReceived || 0),
        concession: Number(t.transportConcession || 0),
        pending: Number(t.transportPending || 0),
        source: "api",
      };
    }
    const fallback = getVanForHeadFromMap(fee?.fee_heading_id);
    return fallback ? { ...fallback, source: "map" } : null;
  };

  // ======== NEW: Previous slabs auto-inclusion ========
  const computePreviousSlabsTotals = (untilIndex) => {
    // Sum all dues from heads strictly before 'untilIndex'
    const feesList = studentDetails?.feeDetails || [];
    let prevAcademic = 0, prevFine = 0, prevVan = 0;
    const items = [];

    for (let i = 0; i < untilIndex; i++) {
      const f = feesList[i];
      if (!f) continue;
      const acadDue = Number(f?.finalAmountDue || 0);
      const fineDue = getFineDue(f);
      const t = getTransportBreakdown(f);
      const vanDue = Number(t?.pending || 0);
      const headDue = acadDue + fineDue + vanDue;
      if (headDue > 0) {
        prevAcademic += acadDue;
        prevFine += fineDue;
        prevVan += vanDue;
        items.push({
          feeHeading: f.fee_heading,
          feeHeadId: f.fee_heading_id,
          academicDue: acadDue,
          fineDue,
          vanDue,
          total: headDue,
        });
      }
    }

    return {
      items,
      totalAcademic: prevAcademic,
      totalFine: prevFine,
      totalVan: prevVan,
      total: prevAcademic + prevFine + prevVan,
      count: items.length,
    };
  };

  // ------------- Totals for Summary -------------
  let totalOriginal = 0,
    totalEffective = 0,
    totalDue = 0,
    totalReceived = 0,
    totalConcession = 0,
    totalFineRemaining = 0;

  const fees = studentDetails?.feeDetails || [];
  fees.forEach((f) => {
    totalOriginal += Number(f.originalFeeDue || 0);
    totalEffective += Number(f.effectiveFeeDue || 0);
    totalDue += Number(f.finalAmountDue || 0);
    totalReceived += Number(f.totalFeeReceived || 0);
    totalConcession += Number(f.totalConcessionReceived || 0);
    totalFineRemaining += getFineDue(f); // show remaining fine, not original
  });

  // Van (overall)
  const van = studentDetails?.vanFee || {
    transportCost: 0,
    totalVanFeeReceived: 0,
    totalVanFeeConcession: 0,
    vanFeeBalance: 0,
    perHeadTotalDue: 0,
  };
  const vanCost = Number(van.perHeadTotalDue || van.transportCost || 0);
  const vanReceived = Number(van.totalVanFeeReceived || 0);
  const vanConcession = Number(van.totalVanFeeConcession || 0);
  const vanDue = Math.max(vanCost - (vanReceived + vanConcession), 0);

  // ------------- Payment handlers (UPDATED: include Fine Due + Van Pending + Previous Balance + Previous Slabs) -------------
  const handlePayFee = async (fee, feeIndex) => {
    const academicDue = Number(fee?.finalAmountDue || 0);
    const fineDue = getFineDue(fee);
    const vanBreak = getTransportBreakdown(fee);
    const vanDueHead = Number(vanBreak?.pending || 0);

    // previous slabs (heads before this one)
    const prev = computePreviousSlabsTotals(feeIndex);

    // Opening Balance
    const openingBalanceDue = Number(prevBalanceDue || 0);

    // GRAND total for this payment
    const dueAmount = academicDue + fineDue + vanDueHead + openingBalanceDue + prev.total;

    if (isNaN(dueAmount) || dueAmount <= 0) {
      return Swal.fire({ icon: "error", title: "Invalid Amount", text: "Nothing due to pay." });
    }

    const breakupHtml = `
      <div style="text-align:left;font-size:.95rem">
        <div><strong>Breakup</strong></div>
        <div>Academic (this head): <strong>${formatINR(academicDue)}</strong></div>
        <div>Fine (remaining, this head): <strong>${formatINR(fineDue)}</strong></div>
        <div>Transport (this head): <strong>${formatINR(vanDueHead)}</strong></div>
        ${prev.count > 0 ? `
          <hr/>
          <div><strong>Previous Heads (${prev.count})</strong></div>
          <div>Academic (prev): <strong>${formatINR(prev.totalAcademic)}</strong></div>
          <div>Fine (prev): <strong>${formatINR(prev.totalFine)}</strong></div>
          <div>Transport (prev): <strong>${formatINR(prev.totalVan)}</strong></div>
        ` : ""}
        ${openingBalanceDue > 0 ? `<hr/><div>Previous Balance: <strong>${formatINR(openingBalanceDue)}</strong></div>` : ""}
      </div>
    `;

    const { isConfirmed } = await Swal.fire({
      title: `Proceed to pay ${formatINR(dueAmount)}?`,
      html: breakupHtml,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#4f46e5",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "Yes, pay now!",
      cancelButtonText: "Cancel",
      width: 560,
    });
    if (!isConfirmed) return;

    const admissionNumberRaw =
      studentDetails?.admissionNumber ||
      studentDetails?.AdmissionNumber ||
      localStorage.getItem("activeStudentAdmission") ||
      localStorage.getItem("username");
    const admissionNumber = normalizeAdmission(admissionNumberRaw);
    const feeHeadId = Number(fee?.fee_heading_id) || fee?.fee_heading_id || null;
    console.log("💳 Sending create-order with:", { admissionNumber, feeHeadId, dueAmount });


    if (!admissionNumber || !feeHeadId) {
      return Swal.fire({
        icon: "error",
        title: "Missing information",
        text: "Required fee information not available.",
      });
    }

    // Open blank window first to avoid popup blockers
    let paymentWindow = null;
    try {
      paymentWindow = openBlankWindowForPayment();
    } catch {}

    try {
      if (paymentGateway === "razorpay" && !window.Razorpay) {
        if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
        return Swal.fire({
          icon: "error",
          title: "Payment SDK not loaded",
          text: "Please refresh the page and try again.",
        });
      }

      const orderRes = await api.post("/student-fee/create-order", {
        admissionNumber,
        amount: dueAmount,
        feeHeadId,
        gateway: paymentGateway,

        // per-head breakdown (this head)
        fineAmount: fineDue,
        vanFeeAmount: vanDueHead,

        // Opening balance
        openingBalanceAmount: openingBalanceDue,
        openingBalanceHeadId: prevBalanceHeadId || undefined,

        // Previous slabs breakdown
        previousSlabs: prev.items,                    // array of { feeHeadId, academicDue, fineDue, vanDue, total }
        previousSlabsTotal: prev.total,

        breakdown: {
          academicDue,
          fineDue,
          vanDueHead,
          openingBalanceDue,
          previous: {
            total: prev.total,
            academic: prev.totalAcademic,
            fine: prev.totalFine,
            van: prev.totalVan,
            count: prev.count,
            items: prev.items,
          },
        },
      });

      const orderData = orderRes.data || {};
      const reportedGateway = (orderData && orderData.gateway) || paymentGateway;

      // HDFC flow
      if (reportedGateway && String(reportedGateway).toLowerCase().includes("hdfc")) {
        const paymentPageUrl =
          orderData.paymentPageUrl ||
          orderData.payment_page_url ||
          orderData.redirectUrl ||
          orderData.paymentUrl ||
          (orderData.vendorOrderId &&
            (process.env.REACT_APP_HDFC_PAYMENT_PAGE_BASE
              ? `${process.env.REACT_APP_HDFC_PAYMENT_PAGE_BASE.replace(/\/$/, "")}/${orderData.vendorOrderId}`
              : null)) ||
          (orderData.session?.vendorOrderId &&
            (process.env.REACT_APP_HDFC_PAYMENT_PAGE_BASE
              ? `${process.env.REACT_APP_HDFC_PAYMENT_PAGE_BASE.replace(/\/$/, "")}/${orderData.session.vendorOrderId}`
              : null)) ||
          null;

        if (!paymentPageUrl) {
          if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
          const handled = handleGatewayResponse(orderData, orderData.session || null);
          if (!handled) {
            Swal.fire({ icon: "error", title: "Payment initialization failed", text: "No payment URL returned. Try again." });
          }
          return;
        }

        try {
          if (paymentWindow && !paymentWindow.closed) {
            paymentWindow.location.href = paymentPageUrl;
            popupRef.current = paymentWindow;
            installMessageListener();
            pollPopupClosed(paymentWindow);
          } else {
            openPaymentPopup(paymentPageUrl);
          }
        } catch {
          openPaymentPopup(paymentPageUrl);
        }

        Swal.fire({ icon: "info", title: "Payment page opened", text: "Complete the payment in the opened window." });
        return;
      }

      // Razorpay flow
      const order = orderData.order || orderData;
      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY,
        amount: order.amount,
        currency: order.currency || "INR",
        name: "Pathseekers International School",
        description: `Fee Payment - ${fee.fee_heading}`,
        order_id: order.id,
        handler: async (resp) => {
          try {
            await api.post("/student-fee/verify-payment", {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              admissionNumber,
              amount: dueAmount,
              feeHeadId,

              // same breakdown on verify
              fineAmount: fineDue,
              vanFeeAmount: vanDueHead,
              openingBalanceAmount: openingBalanceDue,
              openingBalanceHeadId: prevBalanceHeadId || undefined,
              previousSlabs: prev.items,
              previousSlabsTotal: prev.total,
            });
            Swal.fire({ icon: "success", title: "Payment Successful!" });
            refreshAfterPayment();
          } catch (e) {
            console.error("Verification failed:", e);
            Swal.fire({ icon: "error", title: "Payment Verification Failed", text: "Please try again." });
          }
        },
        notes: {
          admissionNumber,
          feeHeadId,
          fineAmount: fineDue,
          vanFeeAmount: vanDueHead,
          openingBalanceAmount: openingBalanceDue,
          previousSlabsTotal: prev.total,
        },
        theme: { color: "#22c55e" },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      console.error("Error initiating payment:", e);
      if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
      Swal.fire({ icon: "error", title: "Payment Error", text: "Please try again later." });
    }
  };

  const handlePayVanFee = async () => {
    const van = studentDetails?.vanFee;
    if (!van) return;
    const vanCost = Number(van.perHeadTotalDue || van.transportCost || 0);
    const vanReceived = Number(van.totalVanFeeReceived || 0);
    const vanConcession = Number(van.totalVanFeeConcession || 0);
    const vanDueOnly = Math.max(vanCost - (vanReceived + vanConcession), 0);

    const openingBalanceDue = Number(prevBalanceDue || 0); // include OB with van-only pay
    const totalToPay = vanDueOnly + openingBalanceDue;

    if (totalToPay <= 0) {
      return Swal.fire({ icon: "info", title: "No Dues", text: "You're all clear on Van Fee and Previous Balance." });
    }

    const { isConfirmed } = await Swal.fire({
      title: `Pay ${formatINR(totalToPay)}?`,
      html: `
        <div style="text-align:left;font-size:.95rem">
          <div><strong>Breakup</strong></div>
          <div>Van Fee: <strong>${formatINR(vanDueOnly)}</strong></div>
          ${openingBalanceDue > 0 ? `<div>Previous Balance: <strong>${formatINR(openingBalanceDue)}</strong></div>` : ""}
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Pay Now",
      confirmButtonColor: "#16a34a",
    });
    if (!isConfirmed) return;

    const admissionNumberRaw =
      studentDetails?.admissionNumber ||
      studentDetails?.AdmissionNumber ||
      localStorage.getItem("activeStudentAdmission") ||
      localStorage.getItem("username");
    const admissionNumber = normalizeAdmission(admissionNumberRaw);

    let paymentWindow = null;
    try {
      paymentWindow = openBlankWindowForPayment();
    } catch {}

    try {
      if (paymentGateway === "razorpay" && !window.Razorpay) {
        if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
        return Swal.fire({
          icon: "error",
          title: "Payment SDK not loaded",
          text: "Refresh the page and try again.",
        });
      }

      const orderRes = await api.post("/student-fee/create-order", {
        admissionNumber,
        amount: totalToPay,
        feeHeadId: "VAN_FEE",
        gateway: paymentGateway,
        openingBalanceAmount: openingBalanceDue,
        openingBalanceHeadId: prevBalanceHeadId || undefined,
        breakdown: { vanDue: vanDueOnly, openingBalanceDue },
      });

      const orderData = orderRes.data || {};
      const reportedGateway = (orderData && orderData.gateway) || paymentGateway;

      if (reportedGateway && String(reportedGateway).toLowerCase().includes("hdfc")) {
        const paymentPageUrl =
          orderData.paymentPageUrl ||
          orderData.payment_page_url ||
          orderData.redirectUrl ||
          orderData.paymentUrl ||
          (orderData.vendorOrderId &&
            (process.env.REACT_APP_HDFC_PAYMENT_PAGE_BASE
              ? `${process.env.REACT_APP_HDFC_PAYMENT_PAGE_BASE.replace(/\/$/, "")}/${orderData.vendorOrderId}`
              : null)) ||
          null;

        if (!paymentPageUrl) {
          if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
          const handled = handleGatewayResponse(orderData, orderData.session || null);
          if (!handled) {
            Swal.fire({
              icon: "error",
              title: "Payment init failed",
              text: "No payment URL returned. Try again.",
            });
          }
          return;
        }

        try {
          if (paymentWindow && !paymentWindow.closed) {
            paymentWindow.location.href = paymentPageUrl;
            popupRef.current = paymentWindow;
            installMessageListener();
            pollPopupClosed(paymentWindow);
          } else {
            openPaymentPopup(paymentPageUrl);
          }
        } catch {
          openPaymentPopup(paymentPageUrl);
        }

        Swal.fire({
          icon: "info",
          title: "Payment page opened",
          text: "Complete the payment in the opened window.",
        });
        return;
      }

      // Razorpay fallback
      const order = orderData.order || orderData;
      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY,
        amount: order.amount,
        currency: order.currency || "INR",
        name: "Pathseekers International School",
        description: "Van Fee Payment",
        order_id: order.id,
        handler: async (resp) => {
          try {
            await api.post("/student-fee/verify-payment", {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              admissionNumber,
              amount: totalToPay,
              feeHeadId: "VAN_FEE",
              openingBalanceAmount: openingBalanceDue,
              openingBalanceHeadId: prevBalanceHeadId || undefined,
            });
            Swal.fire({ icon: "success", title: "Payment Successful!" });
            refreshAfterPayment();
          } catch (e) {
            console.error("Verification failed:", e);
            Swal.fire({ icon: "error", title: "Verification Failed", text: "Please try again." });
          }
        },
        notes: { admissionNumber, feeHeadId: "VAN_FEE", openingBalanceAmount: openingBalanceDue },
        theme: { color: "#16a34a" },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      console.error("Error initiating van fee payment:", e);
      if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
      Swal.fire({ icon: "error", title: "Payment Error", text: "Please try again later." });
    }
  };

  // ------------- Student switch handler (re-added to fix no-undef) -------------
  const handleStudentSwitch = (admissionNumber) => {
    const norm = normalizeAdmission(admissionNumber);
    if (!norm || norm === activeStudentAdmission) return;
    try {
      localStorage.setItem("activeStudentAdmission", norm);
      setActiveStudentAdmission(norm);
      window.dispatchEvent(new CustomEvent("student-switched", { detail: { admissionNumber: norm } }));
      // refresh this page immediately
      fetchStudentDetails(norm);
      fetchTransactionHistory(norm);
      fetchVanFeeByHead();
      fetchOpeningBalanceOutstandingForMe();
    } catch (e) {
      console.warn("Failed to switch student", e);
    }
  };

  return (
    <div className="container-fluid px-2 px-md-3" style={{ marginTop: 72 }}>
      {/* Header */}
      {studentDetails && (
        <div className="rounded-4 p-3 p-md-4 mb-3 shadow-sm hero">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <div className="h4 mb-0 me-2 text-white">
              Fees for <span className="fw-semibold">{studentDetails?.name || "Student"}</span>
            </div>
            <span className="badge badge-soft badge-soft-primary">
              Adm No: <strong className="ms-1">{studentDetails?.admissionNumber || username}</strong>
            </span>
            {studentDetails?.class_name && (
              <span className="badge badge-soft badge-soft-info">
                Class: <strong className="ms-1">{studentDetails.class_name}</strong>
              </span>
            )}
            {studentDetails?.section_name && (
              <span className="badge badge-soft badge-soft-secondary">
                Section: <strong className="ms-1">{studentDetails.section_name}</strong>
              </span>
            )}

            <div className="ms-auto d-flex gap-2 align-items-center">
              <div className="d-flex align-items-center">
                <label className="me-2 small text-white-75 mb-0">Gateway</label>
                <select
                  value={paymentGateway}
                  onChange={(e) => setPaymentGateway(e.target.value)}
                  className="form-select form-select-sm"
                  style={{ width: 160 }}
                >
                  <option value="razorpay">Razorpay (Default)</option>
                  <option value="hdfc">SmartHDFC</option>
                </select>
              </div>
              <button
                className="btn btn-light btn-sm rounded-pill px-3 action-chip"
                onClick={() => setActiveTab("details")}
              >
                <i className="bi bi-grid me-1" /> Fee Details
              </button>
              <button
                className="btn btn-outline-light btn-sm rounded-pill px-3 action-chip"
                onClick={() => setActiveTab("summary")}
              >
                <i className="bi bi-list-check me-1" /> Summary
              </button>
              <button
                className="btn btn-outline-light btn-sm rounded-pill px-3 action-chip"
                onClick={() => setActiveTab("history")}
              >
                <i className="bi bi-clock-history me-1" /> History
              </button>
            </div>
          </div>

          {/* Student switcher UI (Desktop pills + Mobile select) */}
          {canSeeStudentSwitcher && studentsList.length > 0 && (
            <>
              <div className="d-none d-lg-flex align-items-center gap-1 mt-3" role="tablist" aria-label="Switch student">
                {studentsList.map((s) => {
                  const isActive = s.admission_number === activeStudentAdmission;
                  return (
                    <button
                      key={s.admission_number}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`btn btn-sm ${isActive ? "btn-warning" : "btn-outline-light"} rounded-pill px-3`}
                      onClick={() => handleStudentSwitch(s.admission_number)}
                      title={`${s.name} (${s.class?.name || "—"}-${s.section?.name || "—"})`}
                      style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {s.isSelf ? "Me" : s.name}
                      <span className="ms-1" style={{ opacity: 0.8 }}>
                        {s.class?.name ? ` · ${s.class.name}-${s.section?.name || "—"}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="d-lg-none mt-3">
                <label htmlFor="studentSwitcherMobileFee" className="visually-hidden">
                  Switch student
                </label>
                <select
                  id="studentSwitcherMobileFee"
                  className="form-select form-select-sm bg-light border-0"
                  value={activeStudentAdmission}
                  onChange={(e) => handleStudentSwitch(e.target.value)}
                >
                  {studentsList.map((s) => (
                    <option key={s.admission_number} value={s.admission_number}>
                      {(s.isSelf ? "Me: " : "") + s.name}{" "}
                      {s.class?.name ? `(${s.class.name}-${s.section?.name || "—"})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Transport + OB chips */}
          <div className="d-flex gap-2 mt-3 overflow-auto pb-1 fancy-chip-row">
            <div className="chip chip-amber">
              <i className="bi bi-truck me-1" />
              Transport Due: <strong className="ms-1">{formatINR(vanCost)}</strong>
            </div>
            <div className="chip chip-blue">
              <i className="bi bi-wallet2 me-1" />
              Van Received: <strong className="ms-1">{formatINR(vanReceived)}</strong>
            </div>
            <div className="chip chip-orange">
              <i className="bi bi-ticket-perforated me-1" />
              Van Concession: <strong className="ms-1">{formatINR(vanConcession)}</strong>
            </div>
            <div className={`chip ${vanDue > 0 ? "chip-red" : "chip-green"}`}>
              <i className="bi bi-cash-coin me-1" />
              Van Due:
              <strong className="ms-1">{formatINR(vanDue)}</strong>
            </div>
            <div className={`chip ${prevBalanceDue > 0 ? "chip-red" : "chip-green"}`}>
              <i className="bi bi-exclamation-octagon me-1" />
              Previous Balance: <strong className="ms-1">{formatINR(prevBalanceDue)}</strong>
            </div>
            <button className="btn btn-success btn-sm ms-auto shrink-0" disabled={vanDue + prevBalanceDue <= 0} onClick={handlePayVanFee}>
              <i className="bi bi-credit-card-2-front me-1" /> Pay Van Fee
            </button>
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="card shadow-sm rounded-4 glass">
        <div className="card-body p-3 p-md-4">
          {loading ? (
            <div className="loader shimmer mt-3">
              <div className="line w-75" />
              <div className="line w-50" />
              <div className="line w-100" />
            </div>
          ) : error ? (
            <p className="text-danger text-center">{error}</p>
          ) : studentDetails ? (
            <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-3 colorful-tabs">
              {/* Details */}
              <Tab eventKey="details" title="Fee Details">
                <div className="row g-3">
                  {(studentDetails?.feeDetails || []).length ? (
                    studentDetails.feeDetails.map((fee, idx) => {
                      const t = getTransportBreakdown(fee);
                      const academicDue = Number(fee.finalAmountDue || 0);
                      const fineDue = getFineDue(fee); // remaining fine (not original)
                      const totalInclVan = academicDue + Number(t?.pending || 0) + fineDue;

                      const paidPct =
                        ((Number(fee.totalFeeReceived || 0) + Number(fee.totalConcessionReceived || 0)) /
                          (Number(fee.effectiveFeeDue || 0) || 1)) *
                        100;

                      const vanPaidPct =
                        t && t.cost > 0
                          ? ((Number(t.received || 0) + Number(t.concession || 0)) / (Number(t.cost || 0) || 1)) * 100
                          : 0;

                      const prev = computePreviousSlabsTotals(idx);

                      return (
                        <div key={idx} className="col-12 col-sm-6 col-lg-4">
                          <div className="card h-100 border-2 fancy-card">
                            <div className="card-header gradient-soft fw-semibold d-flex justify-content-between align-items-center">
                              <span className="text-center w-100">
                                <i className="bi bi-receipt-cutoff me-1" /> {fee.fee_heading}
                              </span>
                              {t ? (
                                t.pending > 0 ? (
                                  <span className="badge rounded-pill text-bg-warning ms-2">
                                    TR Pending: {formatINR(t.pending)}
                                  </span>
                                ) : (
                                  <span className="badge rounded-pill text-bg-success ms-2">TR Clear</span>
                                )
                              ) : (
                                <span className="badge rounded-pill text-bg-secondary ms-2">No Transport</span>
                              )}
                            </div>

                            <div className="card-body">
                              <div className="d-flex justify-content-between small mb-1">
                                <span>Original</span>
                                <span className="fw-semibold">{formatINR(fee.originalFeeDue)}</span>
                              </div>
                              <div className="d-flex justify-content-between small mb-1">
                                <span>Effective</span>
                                <span className="fw-semibold">{formatINR(fee.effectiveFeeDue)}</span>
                              </div>
                              <div className="d-flex justify-content-between small mb-1">
                                <span>Received</span>
                                <span className="fw-semibold">{formatINR(fee.totalFeeReceived)}</span>
                              </div>
                              <div className="d-flex justify-content-between small mb-1">
                                <span>Concession</span>
                                <span className="fw-semibold">{formatINR(fee.totalConcessionReceived)}</span>
                              </div>
                              <div className="d-flex justify-content-between small mb-2">
                                <span>Fine (remaining)</span>
                                <span className="fw-semibold">{formatINR(fineDue)}</span>
                              </div>

                              {prev.count > 0 && (
                                <div className="alert alert-warning py-2 px-3 small mb-2">
                                  <div className="fw-semibold mb-1">Previous heads pending</div>
                                  <div className="d-flex justify-content-between tiny-row">
                                    <span>Prev Academic</span>
                                    <span className="fw-semibold">{formatINR(prev.totalAcademic)}</span>
                                  </div>
                                  <div className="d-flex justify-content-between tiny-row">
                                    <span>Prev Fine</span>
                                    <span className="fw-semibold">{formatINR(prev.totalFine)}</span>
                                  </div>
                                  <div className="d-flex justify-content-between tiny-row">
                                    <span>Prev Transport</span>
                                    <span className="fw-semibold">{formatINR(prev.totalVan)}</span>
                                  </div>
                                </div>
                              )}

                              <div className="mb-2">
                                <div className="progress progress-thin">
                                  <div
                                    className="progress-bar bg-success progress-bar-striped progress-bar-animated"
                                    role="progressbar"
                                    style={{ width: `${Math.min(100, Math.max(0, paidPct)).toFixed(1)}%` }}
                                    aria-valuenow={paidPct}
                                    aria-valuemin="0"
                                    aria-valuemax="100"
                                  />
                                </div>
                                <div className="small text-muted mt-1">Academic Paid {paidPct.toFixed(1)}%</div>
                              </div>

                              {t && (
                                <div className="transport-panel mt-2">
                                  <div className="d-flex align-items-center justify-content-between mb-1">
                                    <div className="badge rounded-pill transport-badge">
                                      <i className="bi bi-truck me-1" />
                                      Transport ({fee.fee_heading})
                                    </div>
                                    <div className="small text-muted">
                                      {t.source === "api" ? "from API" : "from Summary"}
                                    </div>
                                  </div>

                                  <div className="d-flex justify-content-between tiny-row">
                                    <span className="label">Due (Head)</span>
                                    <span className="value">{formatINR(t.due)}</span>
                                  </div>
                                  <div className="d-flex justify-content-between tiny-row">
                                    <span className="label">Received (Head)</span>
                                    <span className="value">{formatINR(t.received)}</span>
                                  </div>
                                  <div className="d-flex justify-content-between tiny-row">
                                    <span className="label">Concession (Head)</span>
                                    <span className="value">{formatINR(t.concession)}</span>
                                  </div>
                                  <div className="d-flex justify-content-between tiny-row">
                                    <span className="label">Pending (Head)</span>
                                    <span className={`value fw-bold ${t.pending > 0 ? "text-danger" : "text-success"}`}>
                                      {formatINR(t.pending)}
                                    </span>
                                  </div>

                                  {t.cost > 0 && (
                                    <>
                                      <div className="progress progress-thin mt-1">
                                        <div
                                          className="progress-bar bg-info progress-bar-striped progress-bar-animated"
                                          role="progressbar"
                                          style={{ width: `${Math.min(100, Math.max(0, vanPaidPct)).toFixed(1)}%` }}
                                          aria-valuenow={vanPaidPct}
                                          aria-valuemin="0"
                                          aria-valuemax="100"
                                        />
                                      </div>
                                      <div className="small text-muted mt-1">Transport Paid {vanPaidPct.toFixed(1)}%</div>
                                    </>
                                  )}
                                </div>
                              )}

                              <hr className="my-2" />
                              <div className="d-flex justify-content-between">
                                <span className="fw-semibold">Academic Due</span>
                                <span className={`fw-bold ${academicDue > 0 ? "text-danger" : "text-success"}`}>
                                  {formatINR(academicDue)}
                                </span>
                              </div>

                              {t ? (
                                <>
                                  <div className="d-flex justify-content-between mt-1">
                                    <span className="fw-semibold">Transport Pending (Head)</span>
                                    <span className={`fw-bold ${t.pending > 0 ? "text-danger" : "text-success"}`}>
                                      {formatINR(t.pending)}
                                    </span>
                                  </div>
                                  <div className="d-flex justify-content-between mt-1">
                                    <span className="fw-semibold">Total Due (incl. Fine + TR)</span>
                                    <span className={`fw-bold ${totalInclVan > 0 ? "text-danger" : "text-success"}`}>
                                      {formatINR(totalInclVan)}
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <div className="d-flex justify-content-between mt-1">
                                  <span className="fw-semibold">Total Due (incl. Fine)</span>
                                  <span className={`fw-bold ${totalInclVan > 0 ? "text-danger" : "text-success"}`}>
                                    {formatINR(totalInclVan)}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="card-footer bg-transparent">
                              {Number(fee.finalAmountDue) > 0 || getFineDue(fee) > 0 || (t && t.pending > 0) || prev.count > 0 || prevBalanceDue > 0 ? (
                                <button className="btn btn-primary w-100 soft-shadow" onClick={() => handlePayFee(fee, idx)}>
                                  <i className="bi bi-currency-rupee me-1" /> Pay
                                  {t && t.pending > 0 ? " (Acad + Fine + TR" : " (Acad + Fine"}
                                  {prev.count > 0 ? " + Prev Heads" : ""}
                                  {prevBalanceDue > 0 ? " + OB" : ""}
                                  )
                                </button>
                              ) : (
                                <div className="text-success text-center fw-semibold">Paid</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-12">
                      <div className="alert alert-info">No fee details available.</div>
                    </div>
                  )}
                </div>
              </Tab>

              {/* Summary */}
              <Tab eventKey="summary" title="Summary">
                <div className="row g-3">
                  <div className="col-12 col-lg-6">
                    <div className="card h-100 shadow-sm rounded-4">
                      <div className="card-header bg-secondary text-white text-center fw-semibold">Breakdown</div>
                      <div className="card-body">
                        <div className="table-responsive">
                          <table className="table table-sm align-middle">
                            <tbody>
                              <tr className="table-light">
                                <th>Original Fee</th>
                                <td className="text-end">{formatINR(totalOriginal)}</td>
                              </tr>
                              <tr className="table-light">
                                <th>Effective Fee</th>
                                <td className="text-end">{formatINR(totalEffective)}</td>
                              </tr>
                              <tr className="table-light">
                                <th>Total Received</th>
                                <td className="text-end">{formatINR(totalReceived)}</td>
                              </tr>
                              <tr className="table-light">
                                <th>Total Concession</th>
                                <td className="text-end">{formatINR(totalConcession)}</td>
                              </tr>
                              <tr className="table-light">
                                <th>Total Fine (remaining)</th>
                                <td className="text-end">{formatINR(totalFineRemaining)}</td>
                              </tr>
                              <tr className={prevBalanceDue > 0 ? "table-danger" : "table-success"}>
                                <th>Previous Balance</th>
                                <td className="text-end fw-semibold">{formatINR(prevBalanceDue)}</td>
                              </tr>
                              <tr className="table-warning">
                                <th>Total Due (Academic)</th>
                                <td className="text-end fw-semibold">{formatINR(totalDue)}</td>
                              </tr>
                              <tr className="table-success">
                                <th>Van Received</th>
                                <td className="text-end">{formatINR(vanReceived)}</td>
                              </tr>
                              <tr className="table-warning">
                                <th>Van Due</th>
                                <td className="text-end fw-semibold">{formatINR(vanDue)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <hr />

                        <div className="alert alert-success d-flex flex-wrap justify-content-between align-items-center mb-0">
                          <div className="me-3">
                            <div className="small text-muted">Transport Due</div>
                            <div className="fs-6 fw-semibold">{formatINR(vanCost)}</div>
                          </div>
                          <div className="me-3">
                            <div className="small text-muted">Van Received</div>
                            <div className="fs-6 fw-semibold">{formatINR(vanReceived)}</div>
                          </div>
                          <div className="me-3">
                            <div className="small text-muted">Van Concession</div>
                            <div className="fs-6 fw-semibold">{formatINR(vanConcession)}</div>
                          </div>
                          <div className="me-3">
                            <div className={`small text-muted`}>Van Due</div>
                            <div className={`fs-6 fw-bold ${vanDue > 0 ? "text-danger" : "text-success"}`}>
                              {formatINR(vanDue)}
                            </div>
                          </div>
                          <div className="ms-auto">
                            <button className="btn btn-success btn-sm" onClick={handlePayVanFee} disabled={vanDue + prevBalanceDue <= 0}>
                              Pay Van Fee {prevBalanceDue > 0 ? "(incl. OB)" : ""}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* At-a-glance user info */}
                  <div className="col-12 col-lg-6">
                    <div className="card h-100 shadow-sm rounded-4">
                      <div className="card-header bg-primary text-white text-center fw-semibold">Student</div>
                      <div className="card-body">
                        <div className="row g-2">
                          <div className="col-6">
                            <div className="kpi kpi-blue">
                              <div className="kpi-label">Name</div>
                              <div className="kpi-value">{studentDetails?.name || "—"}</div>
                            </div>
                          </div>
                          <div className="col-6">
                            <div className="kpi kpi-amber">
                              <div className="kpi-label">Admission</div>
                              <div className="kpi-value">{studentDetails?.admissionNumber || username}</div>
                            </div>
                          </div>
                          <div className="col-6">
                            <div className="kpi kpi-green">
                              <div className="kpi-label">Class</div>
                              <div className="kpi-value">{studentDetails?.class_name || "—"}</div>
                            </div>
                          </div>
                          <div className="col-6">
                            <div className="kpi kpi-red">
                              <div className="kpi-label">Section</div>
                              <div className="kpi-value">{studentDetails?.section_name || "—"}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Tab>

              {/* History */}
              <Tab eventKey="history" title="History">
                <div className="card shadow-sm rounded-4">
                  <div className="card-header bg-dark text-white text-center fw-semibold">Transaction History</div>
                  <div className="card-body">
                    {transactionHistory?.length ? (
                      <div className="table-responsive">
                        <table className="table table-striped table-bordered align-middle">
                          <thead className="table-light">
                            <tr>
                              <th>Fee Heading</th>
                              <th>Serial</th>
                              <th>Slip ID</th>
                              <th>Date & Time</th>
                              <th>Payment Mode</th>
                              <th>Fee Received</th>
                              <th>Concession</th>
                              <th>Fine</th>
                              <th>Van Fee</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transactionHistory.map((txn) => (
                              <tr key={txn.Serial}>
                                <td>{txn.FeeHeading ? txn.FeeHeading.fee_heading : "N/A"}</td>
                                <td>{txn.Serial}</td>
                                <td>{txn.Slip_ID}</td>
                                <td>{formatDateTime(txn.createdAt)}</td>
                                <td>
                                  <span
                                    className={`badge ${
                                      txn.PaymentMode === "ONLINE" ? "text-bg-primary" : "text-bg-secondary"
                                    }`}
                                  >
                                    {txn.PaymentMode}
                                  </span>
                                </td>
                                <td>{formatINR(txn.Fee_Recieved)}</td>
                                <td>{formatINR(txn.Concession)}</td>
                                <td>{formatINR(txn.Fine ?? txn.LateFee ?? txn.FineAmount ?? 0)}</td>
                                <td>{formatINR(txn.VanFee || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="alert alert-info mb-0">No transaction history available.</div>
                    )}
                  </div>
                </div>
              </Tab>
            </Tabs>
          ) : (
            <p className="text-center">No student details available.</p>
          )}
        </div>
      </div>

      {/* Local styles */}
      <style>{`
        :root{
          --hero-bg: linear-gradient(135deg,#4f46e5 0%, #06b6d4 45%, #10b981 100%);
          --glass-bg: rgba(255,255,255,0.6);
          --glass-brd: rgba(148,163,184,0.25);
        }
        .hero{ background: var(--hero-bg); color:#e2e8f0; border:1px solid rgba(255,255,255,.25); }
        .badge-soft{ border:1px solid rgba(255,255,255,.45); color:#fff; backdrop-filter: blur(4px); }
        .badge-soft-primary{ background: rgba(59,130,246,.25); }
        .badge-soft-info{ background: rgba(6,182,212,.25); }
        .badge-soft-secondary{ background: rgba(148,163,184,.25); }
        .action-chip{ backdrop-filter: blur(6px); }
        .glass{ background: var(--glass-bg); border:1px solid var(--glass-brd); }
        .gradient-soft{ background: linear-gradient(90deg, rgba(99,102,241,.15), rgba(6,182,212,.15)); }
        .fancy-card{ border-radius: 1rem; overflow: hidden; }
        .soft-shadow{ box-shadow: 0 8px 20px rgba(2,8,23,.12); }

        .fancy-chip-row { scrollbar-width: thin; }
        .fancy-chip-row::-webkit-scrollbar { height: 8px; }
        .fancy-chip-row::-webkit-scrollbar-thumb { background: rgba(0,0,0,.15); border-radius: 8px; }

        .chip { border-radius: 999px; padding: 8px 12px; font-size: .9rem; white-space: nowrap; color:#0b1220; border:1px solid rgba(0,0,0,.06); }
        .chip-amber{ background: linear-gradient(135deg,#fef3c7,#fde68a); }
        .chip-blue{ background: linear-gradient(135deg,#dbeafe,#bfdbfe); }
        .chip-green{ background: linear-gradient(135deg,#dcfce7,#bbf7d0); }
        .chip-red{ background: linear-gradient(135deg,#fee2e2,#fecaca); }
        .chip-orange{ background: linear-gradient(135deg,#ffedd5,#fed7aa); }
        .shrink-0 { flex-shrink: 0; }

        .kpi{ border-radius: 1rem; padding: .85rem 1rem; color:#0b1220; background: #fff; border:1px solid #e5e7eb; }
        .kpi .kpi-label{ font-size: .8rem; opacity:.8; }
        .kpi .kpi-value{ font-size: 1.05rem; font-weight: 700; }
        .kpi-blue{ background: linear-gradient(135deg,#dbeafe,#bfdbfe); }
        .kpi-amber{ background: linear-gradient(135deg,#fef3c7,#fde68a); }
        .kpi-green{ background: linear-gradient(135deg,#dcfce7,#bbf7d0); }
        .kpi-red{ background: linear-gradient(135deg,#fee2e2,#fecaca); }

        .progress-thin{ height: .45rem; border-radius: 999px; }
        .transport-panel{
          background: linear-gradient(135deg, rgba(59,130,246,.10), rgba(16,185,129,.10));
          border: 1 dashed rgba(15,23,42,.15);
          border-radius: 12px;
          padding: .6rem .7rem;
        }
        .transport-badge{
          background: rgba(99,102,241,.15);
          color: #111827;
        }
        .tiny-row .label{ font-size: .86rem; opacity: .85; }
        .tiny-row .value{ font-size: .95rem; }

        .colorful-tabs .nav-link.active{ background: linear-gradient(90deg,#3b82f6,#10b981); color:#fff; border:0; }
        .colorful-tabs .nav-link{ border-radius: 999px !important; }

        .shimmer .line{ height: 14px; background: linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 37%,#e5e7eb 63%); background-size: 400% 100%; animation: shimmer 1.4s infinite; border-radius: 8px; margin-bottom: 10px; }
        @keyframes shimmer{ 0%{background-position: 100% 0;} 100%{background-position: -100% 0;} }
      `}</style>
    </div>
  );
};

export default StudentFeePage;
