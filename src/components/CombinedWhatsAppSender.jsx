// src/components/CombinedWhatsAppSender.jsx
import React from "react";
import Swal from "sweetalert2";
import api from "../api";

const currencyPlain = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;

export default async function sendCombinedWhatsApp({
  school,
  academicData = [],
  transportData = [],
}) {
  if (!school) {
    await Swal.fire({
      icon: "info",
      title: "School Info Missing",
      text: "School details not loaded.",
    });
    return;
  }

  // Merge by admission number
  const mergedMap = new Map();

  // Academic entries
  academicData.forEach((stu) => {
    const key = stu.admissionNumber;
    if (!key) return;
    if (!mergedMap.has(key)) mergedMap.set(key, { ...stu, academicHeads: [], transportHeads: [] });
    const entry = mergedMap.get(key);
    if (stu.breakdown && Array.isArray(stu.breakdown)) {
      entry.academicHeads.push(...stu.breakdown);
    }
  });

  // Transport entries
  transportData.forEach((stu) => {
    const key = stu.admissionNumber;
    if (!key) return;
    if (!mergedMap.has(key)) mergedMap.set(key, { ...stu, academicHeads: [], transportHeads: [] });
    const entry = mergedMap.get(key);
    if (stu.breakdown && Array.isArray(stu.breakdown)) {
      entry.transportHeads.push(...stu.breakdown);
    }
  });

  const mergedStudents = Array.from(mergedMap.values());

  if (mergedStudents.length === 0) {
    await Swal.fire({
      icon: "info",
      title: "No Students Found",
      text: "No combined pending data found.",
    });
    return;
  }

  const confirm = await Swal.fire({
    title: "Send Combined WhatsApp?",
    html: `This will send combined messages for <b>${mergedStudents.length}</b> students.`,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Send Now",
    cancelButtonText: "Cancel",
  });
  if (!confirm.isConfirmed) return;

  try {
    Swal.showLoading();

    const payload = {
      students: mergedStudents.map((s) => {
        const academicLines = (s.academicHeads || []).map(
          (h) => `• ${h.head} — Amount: ${currencyPlain(h.amount)} | Fine: ${currencyPlain(h.fine || 0)}`
        );

        const transportLines = (s.transportHeads || []).map(
          (h) => `• ${h.head} — Amount: ${currencyPlain(h.amount)}`
        );

        const totalAcademic = (s.academicHeads || []).reduce((sum, h) => sum + (h.amount + (h.fine || 0)), 0);
        const totalTransport = (s.transportHeads || []).reduce((sum, h) => sum + h.amount, 0);
        const grandTotal = totalAcademic + totalTransport;

        const messageLines = [
          `*Dear Parent/Guardian of ${s.name},*`,
          ``,
          `This is a kind reminder from *${school.name}* regarding the pending dues:`,
          ``,
          `📘 *Academic Fees:*`,
          ...(academicLines.length ? academicLines : ["No academic dues"]),
          ``,
          `🚌 *Transport Fees:*`,
          ...(transportLines.length ? transportLines : ["No transport dues"]),
          ``,
          `*Total Academic:* ${currencyPlain(totalAcademic)}`,
          `*Total Transport:* ${currencyPlain(totalTransport)}`,
          `*Grand Total Pending:* *${currencyPlain(grandTotal)}*`,
          ``,
          `Student: ${s.name}`,
          s.className ? `Class: ${s.className}` : null,
          s.admissionNumber ? `Admission No: ${s.admissionNumber}` : null,
          ``,
          `We kindly request you to clear the dues at the earliest.`,
          `If already paid, please ignore this message.`,
          ``,
          `*Thank you for your prompt attention.*`,
        ].filter(Boolean);

        return {
          id: s.id ?? s.admissionNumber,
          name: s.name,
          phone: s.phone || "919417873297", // test number
          admissionNumber: s.admissionNumber,
          message: messageLines.join("\n"),
          breakdown: {
            academic: s.academicHeads,
            transport: s.transportHeads,
          },
          overallTotal: grandTotal,
        };
      }),
    };

    const resp = await api.post("/integrations/whatsapp/send-batch", payload);
    const data = resp?.data;

    Swal.hideLoading();

    if (data?.ok) {
      const sent = Array.isArray(data.sent) ? data.sent : [];
      const failedCount = sent.filter((x) => !x.ok).length;
      const successCount = sent.length - failedCount;

      await Swal.fire({
        title: failedCount ? "Partial Success" : "Success",
        html: failedCount
          ? `Sent: <b>${successCount}</b> | Failed: <b>${failedCount}</b>.<br/>Tested to <b>9417873297</b>.`
          : `All <b>${sent.length}</b> messages sent successfully.`,
        icon: failedCount ? "warning" : "success",
      });
    } else {
      await Swal.fire({
        title: "Error",
        text: "Server failed to send messages.",
        icon: "error",
      });
    }
  } catch (err) {
    console.error("Combined WhatsApp error:", err);
    Swal.hideLoading();
    await Swal.fire({
      title: "Error",
      html: `Unable to send combined messages.<br/><small>${err.message}</small>`,
      icon: "error",
    });
  }
}