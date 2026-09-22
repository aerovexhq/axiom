// CSV Exporter for Axiom Protocol Telemetry

import { DecodedTransaction } from "./protocolDecoders";

/**
 * Exports transactions as a standard CSV file with tabular packet metadata and payload.
 */
export function exportTransactionsToCsv(transactions: DecodedTransaction[], filename?: string): void {
  const headers = [
    "No",
    "Protocol",
    "StartTime_ps",
    "EndTime_ps",
    "Duration_ps",
    "Status",
    "Summary",
    "Payload_Hex",
    "Fields"
  ];

  const escapeCsv = (str: string): string => {
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = transactions.map((tx) => {
    const hex = tx.data_payload.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
    const statusStr = typeof tx.status === "string" ? tx.status : JSON.stringify(tx.status);
    const durationPs = tx.end_time_ps - tx.start_time_ps;
    const fieldsJson = JSON.stringify(tx.fields);

    return [
      tx.id,
      tx.protocol.toUpperCase(),
      tx.start_time_ps,
      tx.end_time_ps,
      durationPs,
      statusStr,
      escapeCsv(tx.summary),
      escapeCsv(hex),
      escapeCsv(fieldsJson)
    ].join(",");
  });

  const csvContent = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `axiom_protocol_export_${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
