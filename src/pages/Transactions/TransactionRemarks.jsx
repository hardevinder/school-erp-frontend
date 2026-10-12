import React from "react";

export default function TransactionRemarks({ remarks }) {
  const text = String(remarks || "").trim();
  const previewLength = 65;
  const style = { width: 240, maxWidth: 240, whiteSpace: "pre-wrap", overflowWrap: "anywhere" };
  if (!text) return <>—</>;
  if (text.length <= previewLength) return <div style={style}>{text}</div>;

  return (
    <details className="transaction-remarks" style={style}>
      <summary>
        <span className="transaction-remarks-preview">{text.slice(0, previewLength)}… </span>
        <span className="text-primary transaction-remarks-more">View more</span>
        <span className="text-primary transaction-remarks-less">View less</span>
      </summary>
      <div className="mt-1">{text}</div>
    </details>
  );
}
