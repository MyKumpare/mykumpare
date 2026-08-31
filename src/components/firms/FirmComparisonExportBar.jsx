import React, { useState } from "react";
import { Printer, FileDown, FileText, Loader2 } from "lucide-react";
import { readPersistentState } from "@/hooks/usePersistentState";
import { DEFAULT_ORDER, resolveMetricRows } from "@/components/firms/FirmMetricsTable";
import {
  exportFirmComparisonPdf,
  exportFirmComparisonCsv,
} from "@/components/firms/firmComparisonExport";

/**
 * Print / Download PDF / Download CSV toolbar for the Firm Comparison report.
 * Reads the live metric customization (order + enabled) so exports match the
 * on-screen table exactly.
 */
export default function FirmComparisonExportBar({
  firms = [],
  products = [],
  benchmarks = [],
  dueDiligences = [],
  dateRange,
}) {
  const [busy, setBusy] = useState(null); // 'pdf' | 'csv' | null

  const getRows = () => {
    const order = readPersistentState("firmMetrics_order") || DEFAULT_ORDER;
    const enabled = readPersistentState("firmMetrics_enabled") || DEFAULT_ORDER;
    return resolveMetricRows(order, enabled);
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePdf = async () => {
    setBusy("pdf");
    try {
      await exportFirmComparisonPdf({
        firms,
        products,
        benchmarks,
        dueDiligences,
        dateRange,
        rows: getRows(),
      });
    } finally {
      setBusy(null);
    }
  };

  const handleCsv = () => {
    setBusy("csv");
    try {
      exportFirmComparisonCsv({
        firms,
        products,
        dueDiligences,
        rows: getRows(),
      });
    } finally {
      setBusy(null);
    }
  };

  const btn =
    "flex items-center gap-1.5 text-xs font-medium rounded-md px-2.5 py-1.5 transition-colors border";

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={handlePrint}
        className={`${btn} border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800`}
        title="Print report"
      >
        <Printer className="w-3.5 h-3.5" />
        Print
      </button>
      <button
        type="button"
        onClick={handlePdf}
        disabled={busy !== null}
        className={`${btn} border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800 disabled:opacity-50`}
        title="Download PDF"
      >
        {busy === "pdf" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <FileDown className="w-3.5 h-3.5" />
        )}
        PDF
      </button>
      <button
        type="button"
        onClick={handleCsv}
        disabled={busy !== null}
        className={`${btn} border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800 disabled:opacity-50`}
        title="Download CSV"
      >
        {busy === "csv" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <FileText className="w-3.5 h-3.5" />
        )}
        CSV
      </button>
    </div>
  );
}