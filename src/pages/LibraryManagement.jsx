import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";

const blankBook = {
  accession_no: "",
  title: "",
  author: "",
  category: "",
  isbn: "",
  publisher: "",
  shelf_no: "",
  rack_no: "",
  price: "",
  copy_count: 1,
  location: "",
};

const blankIssue = {
  barcode: "",
  borrower_type: "student",
  borrower_identifier: "",
  borrower_name: "",
  borrower_phone: "",
  issue_days: 14,
  fine_per_day: 0,
  remarks: "",
};

const fmtDate = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-IN");
};

const fmtMoney = (v) => {
  const n = Number(v || 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
};

const badgeClass = (value) => {
  const v = String(value || "").toLowerCase();
  if (v === "available" || v === "returned" || v === "active") return "bg-success";
  if (v === "issued") return "bg-primary";
  if (v === "lost" || v === "damaged") return "bg-danger";
  if (v === "reserved") return "bg-warning text-dark";
  return "bg-secondary";
};

const getRoles = () => {
  try {
    const single = localStorage.getItem("userRole");
    const roles = JSON.parse(localStorage.getItem("roles") || "[]");
    return Array.from(new Set([...roles, single].filter(Boolean).map((r) => String(r).toLowerCase())));
  } catch {
    return [localStorage.getItem("userRole")].filter(Boolean).map((r) => String(r).toLowerCase());
  }
};

export default function LibraryManagement({ mode = "dashboard", studentView = false }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [books, setBooks] = useState([]);
  const [copies, setCopies] = useState([]);
  const [issues, setIssues] = useState([]);
  const [search, setSearch] = useState("");
  const [bookForm, setBookForm] = useState(blankBook);
  const [issueForm, setIssueForm] = useState(blankIssue);
  const [bookLookup, setBookLookup] = useState("");
  const [bookMatches, setBookMatches] = useState([]);
  const [borrowerLookup, setBorrowerLookup] = useState("");
  const [borrowerMatches, setBorrowerMatches] = useState([]);

  const roles = useMemo(getRoles, []);
  const canManage = roles.some((r) => ["superadmin", "admin", "librarian", "library", "libraryadmin"].includes(r));
  const showBooks = ["dashboard", "books", "inventory", "reports"].includes(mode) && !studentView;
  const showIssueForm = ["dashboard", "issue-return"].includes(mode) && !studentView && canManage;
  const showIssues = ["dashboard", "issue-return", "members", "fines", "reports"].includes(mode) || studentView;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (studentView) {
        const res = await api.get("/api/library/me");
        const myIssues = res.data?.issues || [];
        const activeIssues = res.data?.active || myIssues.filter((x) => x.status === "issued");
        const distinctBooks = new Set(myIssues.map((x) => x.book_id || x.book?.id).filter(Boolean));
        setDashboard({
          totals: {
            books: distinctBooks.size,
            copies: myIssues.length,
            availableCopies: 0,
            issuedCopies: activeIssues.length,
            overdueIssues: activeIssues.filter((x) => x.is_overdue).length,
            lostCopies: myIssues.filter((x) => x.status === "lost").length,
          },
        });
        setIssues(myIssues);
        return;
      }

      const [dashRes, booksRes, copiesRes, issuesRes] = await Promise.all([
        api.get("/api/library/dashboard"),
        api.get("/api/library/books"),
        api.get("/api/library/copies"),
        api.get("/api/library/issues"),
      ]);
      setDashboard(dashRes.data);
      setBooks(booksRes.data || []);
      setCopies(copiesRes.data || []);
      setIssues(issuesRes.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load library data.");
    } finally {
      setLoading(false);
    }
  }, [studentView]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!showIssueForm || bookLookup.trim().length < 2) {
      setBookMatches([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get("/api/library/search/books", { params: { q: bookLookup.trim() } });
        setBookMatches(res.data || []);
      } catch {
        setBookMatches([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [bookLookup, showIssueForm]);

  useEffect(() => {
    if (!showIssueForm || issueForm.borrower_type === "external" || borrowerLookup.trim().length < 2) {
      setBorrowerMatches([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get("/api/library/search/borrowers", {
          params: { q: borrowerLookup.trim(), type: issueForm.borrower_type },
        });
        setBorrowerMatches(res.data || []);
      } catch {
        setBorrowerMatches([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [borrowerLookup, issueForm.borrower_type, showIssueForm]);

  const filteredBooks = books.filter((book) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [book.accession_no, book.title, book.author, book.category, book.isbn]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  const filteredIssues = issues.filter((issue) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [issue.borrower_name, issue.borrower_identifier, issue.book?.title, issue.copy?.barcode]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  const saveBook = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      await api.post("/api/library/books", {
        ...bookForm,
        copy_count: Number(bookForm.copy_count || 0),
        price: Number(bookForm.price || 0),
      });
      setBookForm(blankBook);
      setMessage("Book added with inventory copies.");
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to add book.");
    }
  };

  const issueBook = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      await api.post("/api/library/issues", {
        ...issueForm,
        issue_days: Number(issueForm.issue_days || 14),
        fine_per_day: Number(issueForm.fine_per_day || 0),
      });
      setIssueForm(blankIssue);
      setBookLookup("");
      setBorrowerLookup("");
      setBookMatches([]);
      setBorrowerMatches([]);
      setMessage("Book issued successfully.");
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to issue book.");
    }
  };

  const returnIssue = async (id) => {
    setMessage("");
    setError("");
    try {
      await api.patch(`/api/library/issues/${id}/return`, {});
      setMessage("Book returned successfully.");
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to return book.");
    }
  };

  const markLost = async (id) => {
    setMessage("");
    setError("");
    try {
      await api.patch(`/api/library/issues/${id}/lost`, {});
      setMessage("Book marked lost.");
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to mark lost.");
    }
  };

  const totals = dashboard?.totals || {};
  const overdue = filteredIssues.filter((x) => x.is_overdue || (x.status === "issued" && new Date(x.due_date) < new Date()));
  const visibleIssues = mode === "fines" ? overdue : mode === "reports" ? filteredIssues : filteredIssues;

  const selectBookMatch = (match) => {
    setIssueForm((x) => ({ ...x, barcode: match.barcode || "" }));
    setBookLookup(`${match.book?.title || "Book"} (${match.barcode || ""})`);
    setBookMatches([]);
  };

  const selectBorrowerMatch = (match) => {
    setIssueForm((x) => ({
      ...x,
      borrower_identifier: match.identifier || "",
      borrower_name: match.type === "external" ? match.name || "" : x.borrower_name,
      borrower_phone: match.phone || x.borrower_phone,
    }));
    setBorrowerLookup(`${match.name || "Borrower"} (${match.identifier || ""})`);
    setBorrowerMatches([]);
  };

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h3 className="mb-1">{studentView ? "My Library" : "Library Management"}</h3>
          <div className="text-muted small">
            {studentView
              ? "Books issued to you, due dates, returns and pending fines."
              : "Books, copies, issue-return, overdue fines and borrower visibility."}
          </div>
        </div>
        <button className="btn btn-outline-primary btn-sm" onClick={load} disabled={loading}>
          <i className="bi bi-arrow-clockwise me-1" /> Refresh
        </button>
      </div>

      {message ? <div className="alert alert-success py-2">{message}</div> : null}
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <div className="row g-3 mb-3">
        {[
          [studentView ? "Borrowed Books" : "Books", totals.books || 0, "bi-journal-bookmark"],
          [studentView ? "All Records" : "Total Copies", totals.copies || 0, "bi-collection"],
          [studentView ? "Returned" : "Available", studentView ? (totals.copies || 0) - (totals.issuedCopies || 0) : totals.availableCopies || 0, "bi-check2-circle"],
          [studentView ? "Currently Issued" : "Issued", totals.issuedCopies || 0, "bi-box-arrow-up-right"],
          ["Overdue", totals.overdueIssues || 0, "bi-exclamation-triangle"],
          ["Lost", totals.lostCopies || 0, "bi-x-octagon"],
        ].map(([label, value, icon]) => (
          <div className="col-6 col-md-4 col-xl-2" key={label}>
            <div className="border rounded p-3 bg-white h-100">
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-muted small">{label}</span>
                <i className={`bi ${icon} text-primary`} />
              </div>
              <div className="fs-4 fw-semibold">{value}</div>
            </div>
          </div>
        ))}
      </div>

      {!studentView ? (
        <div className="d-flex flex-wrap gap-2 mb-3">
          {[
            ["/library-dashboard", "Dashboard"],
            ["/library/books", "Books"],
            ["/library/issue-return", "Issue / Return"],
            ["/library/members", "Members"],
            ["/library/fines", "Fines"],
            ["/library/reports", "Reports"],
          ].map(([href, label]) => (
            <a className="btn btn-sm btn-outline-secondary" href={href} key={href}>{label}</a>
          ))}
        </div>
      ) : null}

      <div className="row g-3">
        {showBooks ? (
          <div className="col-12 col-xl-7">
            <div className="border rounded bg-white p-3">
              <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
                <h5 className="mb-0">Book Inventory</h5>
                <input
                  className="form-control form-control-sm"
                  style={{ maxWidth: 280 }}
                  placeholder="Search book, author, accession"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="table-responsive">
                <table className="table table-sm align-middle">
                  <thead>
                    <tr>
                      <th>Accession</th>
                      <th>Title</th>
                      <th>Author</th>
                      <th>Category</th>
                      <th>Copies</th>
                      <th>Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBooks.map((book) => (
                      <tr key={book.id}>
                        <td>{book.accession_no}</td>
                        <td className="fw-semibold">{book.title}</td>
                        <td>{book.author || "-"}</td>
                        <td>{book.category || "-"}</td>
                        <td>{book.total_copies || 0}</td>
                        <td>{book.available_copies || 0}</td>
                      </tr>
                    ))}
                    {!filteredBooks.length ? (
                      <tr><td colSpan="6" className="text-muted text-center py-4">No books found.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        {!studentView && mode === "books" && canManage ? (
          <div className="col-12 col-xl-5">
            <div className="border rounded bg-white p-3">
              <h5>Add Book</h5>
              <form onSubmit={saveBook} className="row g-2">
                {[
                  ["accession_no", "Accession No", true],
                  ["title", "Title", true],
                  ["author", "Author"],
                  ["category", "Category"],
                  ["isbn", "ISBN"],
                  ["publisher", "Publisher"],
                  ["shelf_no", "Shelf"],
                  ["rack_no", "Rack"],
                  ["location", "Location"],
                  ["price", "Price"],
                  ["copy_count", "Copies"],
                ].map(([field, label, required]) => (
                  <div className="col-md-6" key={field}>
                    <label className="form-label small">{label}</label>
                    <input
                      className="form-control form-control-sm"
                      required={!!required}
                      type={["price", "copy_count"].includes(field) ? "number" : "text"}
                      value={bookForm[field]}
                      onChange={(e) => setBookForm((x) => ({ ...x, [field]: e.target.value }))}
                    />
                  </div>
                ))}
                <div className="col-12">
                  <button className="btn btn-primary btn-sm" disabled={loading}>
                    <i className="bi bi-plus-lg me-1" /> Add Book
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {showIssueForm ? (
          <div className="col-12 col-xl-5">
            <div className="border rounded bg-white p-3">
              <h5>Issue Book</h5>
              <form onSubmit={issueBook} className="row g-2">
                <div className="col-12">
                  <label className="form-label small">Search Book</label>
                  <input
                    className="form-control form-control-sm"
                    placeholder="Title, author, accession, ISBN"
                    value={bookLookup}
                    onChange={(e) => setBookLookup(e.target.value)}
                  />
                  {bookMatches.length ? (
                    <div className="list-group mt-1 shadow-sm">
                      {bookMatches.map((match) => (
                        <button type="button" className="list-group-item list-group-item-action py-2" key={match.copy_id} onClick={() => selectBookMatch(match)}>
                          <div className="fw-semibold small">{match.book?.title || "-"}</div>
                          <div className="text-muted small">
                            {match.book?.author || "Unknown author"} · {match.barcode} · {match.book?.accession_no || "-"}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="col-md-6">
                  <label className="form-label small">Copy Barcode</label>
                  <input className="form-control form-control-sm" required value={issueForm.barcode} onChange={(e) => setIssueForm((x) => ({ ...x, barcode: e.target.value }))} />
                </div>
                <div className="col-md-6">
                  <label className="form-label small">Borrower Type</label>
                  <select className="form-select form-select-sm" value={issueForm.borrower_type} onChange={(e) => {
                    setIssueForm((x) => ({ ...x, borrower_type: e.target.value, borrower_identifier: "", borrower_name: "", borrower_phone: "" }));
                    setBorrowerLookup("");
                    setBorrowerMatches([]);
                  }}>
                    <option value="student">Student</option>
                    <option value="employee">Employee</option>
                    <option value="user">User</option>
                    <option value="external">External</option>
                  </select>
                </div>
                {issueForm.borrower_type !== "external" ? (
                  <div className="col-12">
                    <label className="form-label small">Search Borrower</label>
                    <input
                      className="form-control form-control-sm"
                      placeholder="Name, admission no, employee id, phone"
                      value={borrowerLookup}
                      onChange={(e) => setBorrowerLookup(e.target.value)}
                    />
                    {borrowerMatches.length ? (
                      <div className="list-group mt-1 shadow-sm">
                        {borrowerMatches.map((match) => (
                          <button type="button" className="list-group-item list-group-item-action py-2" key={`${match.type}-${match.id}`} onClick={() => selectBorrowerMatch(match)}>
                            <div className="fw-semibold small">{match.name || "-"}</div>
                            <div className="text-muted small">
                              {match.identifier || "-"}{match.detail ? ` · ${match.detail}` : ""}{match.phone ? ` · ${match.phone}` : ""}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="col-md-6">
                  <label className="form-label small">Admission / Employee / Username</label>
                  <input className="form-control form-control-sm" value={issueForm.borrower_identifier} onChange={(e) => setIssueForm((x) => ({ ...x, borrower_identifier: e.target.value }))} />
                </div>
                <div className="col-md-6">
                  <label className="form-label small">External Name</label>
                  <input className="form-control form-control-sm" value={issueForm.borrower_name} onChange={(e) => setIssueForm((x) => ({ ...x, borrower_name: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label small">Days</label>
                  <input type="number" className="form-control form-control-sm" value={issueForm.issue_days} onChange={(e) => setIssueForm((x) => ({ ...x, issue_days: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label small">Fine / Day</label>
                  <input type="number" className="form-control form-control-sm" value={issueForm.fine_per_day} onChange={(e) => setIssueForm((x) => ({ ...x, fine_per_day: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label small">Phone</label>
                  <input className="form-control form-control-sm" value={issueForm.borrower_phone} onChange={(e) => setIssueForm((x) => ({ ...x, borrower_phone: e.target.value }))} />
                </div>
                <div className="col-12">
                  <button className="btn btn-primary btn-sm" disabled={loading}>
                    <i className="bi bi-box-arrow-up-right me-1" /> Issue Book
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {showIssues ? (
          <div className="col-12">
            <div className="border rounded bg-white p-3">
              <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
                <h5 className="mb-0">{studentView ? "My Issued Books" : mode === "fines" ? "Overdue / Fines" : "Issue Records"}</h5>
                <input className="form-control form-control-sm" style={{ maxWidth: 280 }} placeholder="Search borrower or book" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="table-responsive">
                <table className="table table-sm align-middle">
                  <thead>
                    <tr>
                      <th>Book</th>
                      <th>Barcode</th>
                      <th>Borrower</th>
                      <th>Issued</th>
                      <th>Due</th>
                      <th>Status</th>
                      <th>Fine</th>
                      {!studentView && canManage ? <th>Action</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleIssues.map((issue) => (
                      <tr key={issue.id} className={issue.is_overdue ? "table-warning" : ""}>
                        <td>{issue.book?.title || "-"}</td>
                        <td>{issue.copy?.barcode || "-"}</td>
                        <td>
                          <div className="fw-semibold">{issue.borrower_name}</div>
                          <div className="text-muted small">{issue.borrower_identifier || issue.borrower_type}</div>
                        </td>
                        <td>{fmtDate(issue.issue_date)}</td>
                        <td>{fmtDate(issue.due_date)}</td>
                        <td><span className={`badge ${badgeClass(issue.status)}`}>{issue.is_overdue && issue.status === "issued" ? "overdue" : issue.status}</span></td>
                        <td>{fmtMoney(issue.fine_due || issue.calculated_fine || issue.fine_amount || 0)}</td>
                        {!studentView && canManage ? (
                          <td>
                            {issue.status === "issued" ? (
                              <div className="btn-group btn-group-sm">
                                <button className="btn btn-outline-success" onClick={() => returnIssue(issue.id)}>Return</button>
                                <button className="btn btn-outline-danger" onClick={() => markLost(issue.id)}>Lost</button>
                              </div>
                            ) : "-"}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                    {!visibleIssues.length ? (
                      <tr><td colSpan={studentView || !canManage ? 7 : 8} className="text-muted text-center py-4">No issue records found.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        {!studentView && mode === "reports" ? (
          <div className="col-12">
            <div className="border rounded bg-white p-3">
              <h5>Copy Status</h5>
              <div className="d-flex flex-wrap gap-2">
                {["available", "issued", "reserved", "damaged", "lost", "inactive"].map((status) => (
                  <span className={`badge ${badgeClass(status)}`} key={status}>
                    {status}: {copies.filter((copy) => copy.availability_status === status).length}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
