import React from "react";
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

// Full number-to-words function from ReceiptContent.js
const numberToWords = (num) => {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const convertHundred = (n) => {
    let word = "";
    if (n > 99) {
      word += ones[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n > 9 && n < 20) {
      word += teens[n - 10] + " ";
    } else if (n >= 20) {
      word += tens[Math.floor(n / 10)] + " ";
      if (n % 10) {
        word += ones[n % 10] + " ";
      }
    } else if (n > 0) {
      word += ones[n] + " ";
    }
    return word.trim();
  };

  if (num === 0) return "Zero";
  let word = "";
  if (num >= 1000000) {
    word += convertHundred(Math.floor(num / 1000000)) + " Million ";
    num %= 1000000;
  }
  if (num >= 1000) {
    word += convertHundred(Math.floor(num / 1000)) + " Thousand ";
    num %= 1000;
  }
  if (num > 0) {
    word += convertHundred(num);
  }
  return word.trim();
};

// Helper to format money with comma separators and 2 decimal places
const formatMoney = (value) => {
  return Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// --- DATE/TIME HELPERS ---
// "August 8, 2025"
const formatLongDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  return `${month} ${day}, ${year}`;
};

// "h:mm AM/PM"
const formatTime12 = (date) => {
  if (!date) return "";
  const d = new Date(date);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
};

// Example fallback logo URL (replace with your real URL if needed)
const DEFAULT_LOGO_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Picture_icon_BLACK.svg/240px-Picture_icon_BLACK.svg.png";

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  headerRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  logoContainer: {
    width: "25%",
    textAlign: "left",
    justifyContent: "flex-start",
  },
  logoImage: {
    width: 60,
    height: 60,
    objectFit: "contain",
  },
  schoolInfoContainer: {
    width: "75%",
    textAlign: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  schoolName: {
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  schoolDesc: {
    fontSize: 8,
    color: "#555",
    marginVertical: 2,
  },
  schoolContact: {
    fontSize: 9,
    fontWeight: "semibold",
  },
  sessionTitle: {
    textAlign: "center",
    fontSize: 10,
    marginTop: 5,
    marginBottom: 2,
    fontWeight: "bold",
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    marginVertical: 5,
  },
  // Slip + Student Info
  infoTable: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 10,
  },
  infoCell: {
    width: "50%",
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  infoCellLast: {
    width: "50%",
    padding: 5,
  },
  infoText: {
    marginBottom: 3,
  },
  infoLabel: {
    fontWeight: "bold",
  },
  // Main Table
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 10,
  },
  tableHeader: {
    backgroundColor: "#f8f8f8",
  },
  tableRow: {
    flexDirection: "row",
  },
  tableCell: {
    padding: 4,
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: "#000",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    textAlign: "center",
  },
  tableCellLast: {
    padding: 4,
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    textAlign: "center",
  },
  tableFooterCell: {
    padding: 4,
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: "#000",
    textAlign: "center",
    fontWeight: "bold",
  },
  tableFooterCellLast: {
    padding: 4,
    flex: 1,
    textAlign: "center",
    fontWeight: "bold",
  },
  // Totals
  totalsContainer: {
    alignItems: "flex-end",
    marginTop: 10,
  },
  totalTitle: {
    fontSize: 11,
    fontWeight: "bold",
  },
  totalWords: {
    fontStyle: "italic",
    fontSize: 9,
    marginBottom: 5,
  },
  // Footer note & signature
  noteText: {
    fontSize: 9,
    fontStyle: "italic",
    marginTop: 10,
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 25,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: "#000",
    width: 120,
    textAlign: "center",
    paddingTop: 3,
    fontSize: 9,
  },
  // Additional style for displaying date and time (if needed)
  dateText: {
    fontSize: 10,
    textAlign: "right",
    marginBottom: 10,
  },
});

const PdfReceiptDocument = ({ school, receipt, slipId, student }) => {
  // Calculations (mirroring your ReceiptContent.js)
  const totalAcademicReceived = receipt.reduce(
    (sum, trx) => sum + trx.Fee_Recieved,
    0
  );
  const totalAcademicConcession = receipt.reduce(
    (sum, trx) => sum + (trx.Concession || 0),
    0
  );
  const totalAcademicBalance = receipt.reduce(
    (sum, trx) => sum + (trx.feeBalance || 0),
    0
  );
  const totalTransportFee = receipt.reduce(
    (sum, trx) => sum + (trx.VanFee || 0),
    0
  );
  const totalFine = receipt.reduce((sum, trx) => sum + (trx.Fine_Amount || 0), 0);
  const showFineColumn = totalFine > 0;
  const grandTotalReceived = totalAcademicReceived + totalTransportFee + totalFine;
  const grandTotalInWords = numberToWords(Math.round(grandTotalReceived));

  // School data fallback
  const schoolLogo = school?.logo
    ? `https://scontent.fluh1-1.fna.fbcdn.net/v/t39.30808-6/483099462_9538226956238598_7063924851221293696_n.jpg?_nc_cat=107&ccb=1-7&_nc_sid=127cfc&_nc_ohc=7Sfonn3hEP4Q7kNvgGpepBO&_nc_oc=AdjOp42e_dEKfFyFn_ypjeF2QBJBw1SeQXYwGTDi7eWnVvs-TYDrz7dfH3hitZ4YS40&_nc_zt=23&_nc_ht=scontent.fluh1-1.fna&_nc_gid=ATE2idWg4YDfCPdTVrk8iON&oh=00_AYEake05uCvnLZuKgFX-B3WC3BcR6Gi8qzibUzMr5LzNLQ&oe=67D72FE9`
    : DEFAULT_LOGO_URL;
  const schoolName = school?.name || "School Name";
  const schoolDesc = school?.description || "School Description";
  const schoolPhoneEmail = `${school?.phone || ""} | ${school?.email || ""}`;

  // If Class data is missing, use fallback
  const className = receipt[0]?.Class?.class_name || "N/A";

  // Condition to show Van Fee column only if any transaction has VanFee > 0
  const showVanFeeColumn = receipt.some((trx) => trx.VanFee > 0);

  // Payment Mode & Transaction ID from first transaction
  const paymentMode = receipt[0]?.PaymentMode || "N/A";
  const transactionId = receipt[0]?.Transaction_ID || "N/A";

  // Extract fee collection date/time from the first transaction
  const feeCollectionDateTime = receipt[0]?.DateOfTransaction
    ? new Date(receipt[0].DateOfTransaction)
    : new Date();

  return (
    <Document>
      <Page style={styles.page} size="A4">
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.logoContainer}>
            <Image style={styles.logoImage} src={schoolLogo} />
          </View>
          <View style={styles.schoolInfoContainer}>
            <Text style={styles.schoolName}>{schoolName}</Text>
            <Text style={styles.schoolDesc}>{schoolDesc}</Text>
            <Text style={styles.schoolContact}>{schoolPhoneEmail}</Text>
          </View>
        </View>

        {/* Session + Fee Receipt Title */}
        <Text style={styles.sessionTitle}>
          Session: 2025-26{"\n"}Fee Receipt
        </Text>
        <View style={styles.hr} />

        {/* Slip & Student Info Table */}
        <View style={styles.infoTable}>
          <View style={styles.infoCell}>
            <Text style={styles.infoText}>
              <Text style={styles.infoLabel}>Slip ID:</Text>{" "}
              {slipId || receipt[0]?.Slip_ID || "N/A"}
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoLabel}>Student Name:</Text> {student.name || "N/A"}
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoLabel}>Father's Name:</Text> {student.father_name || "N/A"}
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoLabel}>Mother's Name:</Text> {student.mother_name || "N/A"}
            </Text>
          </View>
          <View style={styles.infoCellLast}>
            <Text style={styles.infoText}>
              <Text style={styles.infoLabel}>Admission No:</Text> {student.admission_number || "N/A"}
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoLabel}>Class:</Text> {className}
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoLabel}>Date and Time:</Text>{" "}
              {formatLongDate(feeCollectionDateTime)} {formatTime12(feeCollectionDateTime)}
            </Text>
          </View>
        </View>

        {/* Main Fee Table */}
        <View style={styles.table}>
          {/* Header Row */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.tableCell}>Sr. No.</Text>
            <Text style={styles.tableCell}>Particular</Text>
            <Text style={styles.tableCell}>Concession</Text>
            {showFineColumn && <Text style={styles.tableCell}>Fine</Text>}
            <Text style={styles.tableCell}>Received</Text>
            <Text style={styles.tableCell}>Balance</Text>
            {showVanFeeColumn && <Text style={styles.tableCell}>Van Fee</Text>}
          </View>

          {/* Body Rows */}
          {receipt.map((trx, idx) => (
            <View style={styles.tableRow} key={idx}>
              <Text style={styles.tableCell}>{idx + 1}</Text>
              <Text style={styles.tableCell}>
                {trx.FeeHeading?.fee_heading || "N/A"}
              </Text>
              <Text style={styles.tableCell}>
                {formatMoney(trx.Concession || 0)}
              </Text>
              {showFineColumn && (
                <Text style={styles.tableCell}>{formatMoney(trx.Fine_Amount || 0)}</Text>
              )}
              <Text style={styles.tableCell}>
                {formatMoney(trx.Fee_Recieved || 0)}
              </Text>
              <Text style={styles.tableCell}>
                {trx.feeBalance !== undefined
                  ? formatMoney(trx.feeBalance)
                  : "N/A"}
              </Text>
              {showVanFeeColumn && (
                <Text style={styles.tableCell}>
                  {trx.VanFee > 0 ? formatMoney(trx.VanFee) : ""}
                </Text>
              )}
            </View>
          ))}

          {/* Totals Row */}
          <View style={styles.tableRow}>
            <Text style={styles.tableFooterCell}></Text>
            <Text style={styles.tableFooterCell}>G. Total</Text>
            <Text style={styles.tableFooterCell}>Rs. {formatMoney(totalAcademicConcession)}</Text>

            {showFineColumn && (
              <Text style={styles.tableFooterCell}>Rs. {formatMoney(totalFine)}</Text>
            )}

            <Text style={styles.tableFooterCell}>Rs. {formatMoney(totalAcademicReceived)}</Text>
            <Text style={styles.tableFooterCell}>Rs. {formatMoney(totalAcademicBalance)}</Text>

            {showVanFeeColumn && (
              <Text style={styles.tableFooterCellLast}>
                Rs. {totalTransportFee > 0 ? formatMoney(totalTransportFee) : ""}
              </Text>
            )}
          </View>
        </View>

        {/* Overall Total */}
        <View style={styles.totalsContainer}>
          <Text style={styles.totalTitle}>
            Total Received (Rs.): {formatMoney(totalAcademicReceived)}
            {totalFine > 0 && ` + ${formatMoney(totalFine)} Fine`}
            {totalTransportFee > 0 && ` + ${formatMoney(totalTransportFee)} Van Fee`} =
            {formatMoney(grandTotalReceived)}
          </Text>
          <Text style={styles.totalWords}>
            (In words: {grandTotalInWords} Rupees Only)
          </Text>
        </View>

        {/* Transaction Mode & Transaction ID */}
        <View style={{ marginTop: 10 }}>
          <Text style={styles.infoText}>
            <Text style={styles.infoLabel}>Mode of Transaction:</Text> {paymentMode}
          </Text>
          <Text style={styles.infoText}>
            <Text style={styles.infoLabel}>Transaction ID:</Text> {transactionId}
          </Text>
        </View>

        {/* Note */}
        <Text style={styles.noteText}>
          Note: Please keep this receipt for any future reference. Fees once paid are non-refundable.
        </Text>

        {/* Signature */}
        <View style={styles.signatureRow}>
          <Text style={styles.signatureLine}>Cashier Signature</Text>
        </View>
      </Page>
    </Document>
  );
};

export default PdfReceiptDocument;
