// src/utils/normalizeReceipt.js

export const normalizeReceiptForPdf = ({
  receipt = [],
  school = {},
  slipId,
  student,
  session,
}) => {
  const items = receipt.map((trx, idx) => {
    const rec = Number(trx.Fee_Recieved || trx.received || 0);
    const fine = Number(trx.Fine_Amount || trx.fine || 0);
    const van = Number(trx.VanFee || trx.vanFee || 0);
    const conc = Number(trx.Concession || trx.concession || 0);
    const bal = trx.feeBalance !== undefined ? Number(trx.feeBalance) : 0;

    return {
      srNo: idx + 1,
      particular:
        trx.FeeHeading?.fee_heading ||
        trx.Particular ||
        trx.particular ||
        "N/A",
      concession: conc,
      fine,
      received: rec,
      balance: bal,
      vanFee: van,
      paymentMode: trx.PaymentMode || trx.paymentMode || undefined,
      transactionId: trx.Transaction_ID || trx.transactionId || undefined,
      dateOfTransaction: trx.DateOfTransaction
        ? new Date(trx.DateOfTransaction).toISOString()
        : undefined,
      className: trx.Class?.class_name || trx.className || undefined,
      student: {
        name: trx.Student?.name || student?.name || undefined,
        admissionNumber:
          trx.Student?.admission_number ||
          student?.admission_number ||
          student?.admissionNumber ||
          undefined,
        fatherName: trx.Student?.father_name || student?.father_name || undefined,
        motherName: trx.Student?.mother_name || student?.mother_name || undefined,
      },
    };
  });

  const totals = items.reduce(
    (acc, it) => {
      acc.totalReceived += it.received;
      acc.totalConcession += it.concession;
      acc.totalFine += it.fine;
      acc.totalVan += it.vanFee;
      acc.totalBalance += it.balance;
      return acc;
    },
    {
      totalReceived: 0,
      totalConcession: 0,
      totalFine: 0,
      totalVan: 0,
      totalBalance: 0,
    }
  );

  totals.grandTotal = totals.totalReceived + totals.totalFine + totals.totalVan;

  return {
    items,
    school: {
      name: school.name || school.schoolName || "School Name",
      logo: school.logo || school.logoUrl || "",
      address: school.address || school.schoolAddress || "",
      phone: school.phone || "",
      email: school.email || "",
    },
    totals,
    slipId:
      slipId ||
      (receipt[0] && (receipt[0].Slip_ID || receipt[0].slipId)) ||
      undefined,
    paymentMode: receipt[0]?.PaymentMode || undefined,
    transactionId: receipt[0]?.Transaction_ID || undefined,
    collectedAt: receipt[0]?.DateOfTransaction
      ? new Date(receipt[0].DateOfTransaction).toISOString()
      : undefined,
    session: session || "2025-26",
    student: {
      name: student?.name,
      admissionNumber: student?.admission_number,
      fatherName: student?.father_name,
      motherName: student?.mother_name,
    },
  };
};
