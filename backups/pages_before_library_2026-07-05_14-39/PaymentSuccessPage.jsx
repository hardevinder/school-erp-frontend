import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

const PaymentSuccessPage = () => {
  const location = useLocation();
  const [search] = useSearchParams();
  const [canClose, setCanClose] = useState(false);

  const orderId = useMemo(
    () =>
      search.get("orderId") ||
      search.get("order_id") ||
      search.get("vendorOrderId") ||
      search.get("txnid") ||
      search.get("mihpayid") ||
      search.get("transactionId") ||
      "",
    [search]
  );

  const admissionNumber = useMemo(
    () =>
      search.get("adm") ||
      search.get("admissionNumber") ||
      search.get("admission_number") ||
      "",
    [search]
  );

  useEffect(() => {
    const message = {
      type: "payment-updated",
      status: "success",
      orderId,
      admissionNumber,
      message: "Payment completed successfully.",
    };

    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(message, window.location.origin);
        window.opener.postMessage(
          { ...message, type: "hdfc.payment.updated" },
          window.location.origin
        );
        setCanClose(true);
      }
    } catch {
      setCanClose(false);
    }
  }, [admissionNumber, orderId]);

  const handleClose = () => {
    try {
      window.close();
    } catch {}
  };

  const feeLink = location.pathname.includes("/direct-pay/")
    ? `/direct-pay${admissionNumber ? `?adm=${encodeURIComponent(admissionNumber)}` : ""}`
    : "/student-fee";

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light px-3">
      <div className="card border-0 shadow-sm" style={{ maxWidth: 520, width: "100%" }}>
        <div className="card-body text-center p-4 p-md-5">
          <div
            className="mx-auto mb-3 rounded-circle d-flex align-items-center justify-content-center bg-success bg-opacity-10 text-success"
            style={{ width: 72, height: 72 }}
          >
            <i className="bi bi-check2-circle fs-1" />
          </div>

          <h1 className="h3 fw-bold mb-2">Payment Successful</h1>
          <p className="text-muted mb-4">
            Your fee payment has been completed. The fee details page will refresh
            automatically.
          </p>

          {orderId && (
            <div className="alert alert-success text-start small mb-4">
              <div className="text-muted">Order / Transaction ID</div>
              <div className="fw-semibold text-break">{orderId}</div>
            </div>
          )}

          <div className="d-flex flex-wrap justify-content-center gap-2">
            {canClose && (
              <button className="btn btn-success px-4" onClick={handleClose}>
                Close Window
              </button>
            )}
            <Link className="btn btn-outline-primary px-4" to={feeLink}>
              Go to Fees
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;
