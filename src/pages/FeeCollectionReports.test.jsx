/* React DOM tests do not use Testing Library. */
/* eslint-disable testing-library/no-unnecessary-act */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import * as XLSX from "xlsx";
import { pdf } from "@react-pdf/renderer";
import api from "../api";
import DayWiseReport from "./DayWiseReport";
import CategoryReport from "./DayWiseCategoryReports";
import { downloadReport, receiptKey } from "../utils/feeReport";

jest.mock("sweetalert2", () => ({ fire: jest.fn() }));
jest.mock("../api", () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock("@react-pdf/renderer", () => ({ pdf: jest.fn() }));
jest.mock("./PdfReport", () => () => null);
jest.mock("./PdfCategoryReport", () => () => null);
jest.mock("./Transactions/PdfReceiptDocument", () => () => null);
jest.mock("./Transactions/ReceiptModal", () => () => null);
jest.mock("file-saver", () => ({ saveAs: jest.fn() }));
jest.mock("../utils/feeReport", () => ({ ...jest.requireActual("../utils/feeReport"), downloadReport: jest.fn() }));

const rows = [
  { Serial: 1, Slip_ID: "55", Student_ID: 7, session_id: 1, Session: { id: 1, name: "2025-26" }, Student: { name: "Asha", admission_number: "A1", Class: { class_name: "V" } }, feeCategoryName: "Activity", feeHeadingName: "Activity fee", totalFeeReceived: 100, totalFine: 10, totalVanFee: 0, PaymentMode: "UPI", DateOfTransaction: "2026-09-25", status: "paid" },
  { Serial: 2, Slip_ID: "55", Student_ID: 7, session_id: 2, Session: { id: 2, name: "2026-27" }, Student: { name: "Asha", admission_number: "A1", Class: { class_name: "V" } }, feeCategoryName: "Activity", feeHeadingName: "Activity fee", totalFeeReceived: 200, totalFine: 20, totalVanFee: 0, PaymentMode: "Cheque", DateOfTransaction: "2026-09-25", status: "paid" },
];
let container, root;
const click = async (label) => {
  const button = [...container.querySelectorAll("button")].find((b) => b.textContent.trim() === label);
  expect(button).toBeTruthy();
  await act(async () => Simulate.click(button));
};
const changeSession = async (value) => { await act(async () => Simulate.change(container.querySelector("select"), { target: { value } })); };
const render = async (Component) => { await act(async () => root.render(<Component />)); };
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  api.get.mockImplementation(async (url, options) => {
    if (url === "/sessions") return { data: [{ id: 1, name: "2025-26" }, { id: 2, name: "2026-27", is_active: true }] };
    if (url === "/schools") return { data: [{ name: "Test School" }] };
    if (url === "/reports/day-wise") return { data: options.params.session_id === "all" ? rows : rows.filter((r) => String(r.session_id) === options.params.session_id) };
    return { data: [] };
  });
  pdf.mockReturnValue({ toBlob: async () => new Blob(["PDF"]) });
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); jest.clearAllMocks(); jest.restoreAllMocks(); });

test.each([["day", DayWiseReport], ["category", CategoryReport]])("%s report defaults to active session and blocks exports after filter changes", async (_, Component) => {
  await render(Component);
  expect(container.querySelector("select").value).toBe("2");
  await changeSession("1"); await click("Generate report");
  const request = api.get.mock.calls.find(([url]) => url === "/reports/day-wise");
  expect(request[1].params.session_id).toBe("1");
  expect(container.querySelector("tbody").textContent).toContain("2025-26");
  await changeSession("all");
  expect([...container.querySelectorAll("button")].find((b) => b.textContent.trim() === "Download PDF").disabled).toBe(true);
  expect([...container.querySelectorAll("button")].find((b) => b.textContent.trim() === "Download Excel").disabled).toBe(true);
  expect(container.textContent).toContain("Filters changed");
});

test("category all-session receipts stay separate and Excel/PDF use matching scope and fines", async () => {
  await render(CategoryReport); await changeSession("all"); await click("Generate report");
  expect(container.querySelectorAll("table")[0].querySelectorAll("tbody tr")).toHaveLength(2);
  expect(container.querySelectorAll("table")[0].querySelector("tfoot").textContent).toContain("330");
  const write = jest.spyOn(XLSX, "write");
  await click("Download Excel");
  const workbook = write.mock.calls[0][0];
  const exported = XLSX.utils.sheet_to_json(workbook.Sheets.Collection);
  expect(exported.map((r) => r.Session)).toEqual(["2025-26", "2026-27"]);
  expect(exported.map((r) => r["Overall Total"])).toEqual([110, 220]);
  expect(XLSX.utils.sheet_to_json(workbook.Sheets["Category Summary"])[0]["Overall - TotalReceived"]).toBe(330);
  await click("Download PDF");
  expect(pdf.mock.calls[0][0].props.sessionLabel).toBe("All sessions");
  expect(pdf.mock.calls[0][0].props.aggregatedData).toHaveLength(2);
  expect(downloadReport.mock.calls[0][1]).toContain("All_sessions");
});

test("day report PDF follows the visible search and applied session", async () => {
  await render(DayWiseReport); await changeSession("all"); await click("Generate report");
  await act(async () => Simulate.change(container.querySelector('[aria-label="Search collection report"]'), { target: { value: "Cheque" } }));
  await click("Download PDF");
  expect(pdf.mock.calls[0][0].props.aggregatedData).toHaveLength(1);
  expect(pdf.mock.calls[0][0].props.aggregatedData[0].session_id).toBe(2);
  expect(pdf.mock.calls[0][0].props.sessionLabel).toBe("All sessions");
});

test("receipt identity distinguishes both sessions and students", () => {
  expect(receiptKey(rows[0])).not.toBe(receiptKey(rows[1]));
  expect(receiptKey(rows[0])).not.toBe(receiptKey({ ...rows[0], Student_ID: 8 }));
});
