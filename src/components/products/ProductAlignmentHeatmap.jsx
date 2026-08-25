import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Grid3x3, GitCompare } from "lucide-react";
import RfpRfiAlignmentDialog from "@/components/firms/RfpRfiAlignmentDialog";

// Cell colors for the alignment heatmap.
const ALIGN_COLORS = {
  Strong: "bg-emerald-500",
  Partial: "bg-amber-500",
  Gap: "bg-red-500",
};
const ALIGN_LABEL = { Strong: "Strong", Partial: "Partial", Gap: "Gap" };

const MAX_RFPS = 30;

/**
 * Alignment heatmap showing how the user's own products match against the
 * specific requirements of RFP/RFI opportunities. Reads the structured
 * `product_alignment` breakdown stored on each FirmRfpRfi record by the
 * product-match check. Rows = our products, columns = RFP/RFI requirements
 * (grouped by opportunity), cells color-coded Strong (green) / Partial (amber)
 * / Gap (red). Clicking a cell opens the full alignment comparison dialog.
 */
export default function ProductAlignmentHeatmap() {
  const [rfps, setRfps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRfp, setSelectedRfp] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const all = await base44.entities.FirmRfpRfi.list("-created_date", 500);
        if (!active) return;
        const withAlign = (all || []).filter(
          (r) => Array.isArray(r.product_alignment) && r.product_alignment.length > 0
        );
        setRfps(withAlign.slice(0, MAX_RFPS));
      } catch (e) {
        if (active) setRfps([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Build the row set (our products) and column structure (RFPs → requirements).
  const { products, columns, counts } = useMemo(() => {
    const productMap = new Map();
    const colList = [];
    const totals = { strong: 0, partial: 0, gap: 0, empty: 0 };

    for (const rfp of rfps || []) {
      const reqs = [];
      const seenReq = new Set();
      for (const prod of rfp.product_alignment || []) {
        if (prod.product_id && !productMap.has(prod.product_id)) {
          productMap.set(prod.product_id, {
            id: prod.product_id,
            name: prod.product_name || "—",
          });
        }
        for (const c of prod.criteria || []) {
          if (c.requirement && !seenReq.has(c.requirement)) {
            seenReq.add(c.requirement);
            reqs.push(c.requirement);
          }
        }
      }
      if (reqs.length === 0) reqs.push("Overall");
      colList.push({ rfp, requirements: reqs });
    }

    // Count cell outcomes
    const productList = Array.from(productMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    for (const col of colList) {
      for (const p of productList) {
        for (const req of col.requirements) {
          const a = getCell(col.rfp, p.id, req);
          if (a === "Strong") totals.strong++;
          else if (a === "Partial") totals.partial++;
          else if (a === "Gap") totals.gap++;
          else totals.empty++;
        }
      }
    }

    return { products: productList, columns: colList, counts: totals };
  }, [rfps]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading alignment heatmap…
      </div>
    );
  }

  if (!rfps || rfps.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-4 flex items-center gap-2 text-xs text-gray-500">
        <Grid3x3 className="w-4 h-4 text-gray-300" />
        No product alignment data yet. Run a product match on an RFP/RFI to populate this heatmap.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/60">
        <div className="flex items-center gap-1.5 min-w-0">
          <Grid3x3 className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-semibold text-gray-800">Product Alignment Heatmap</span>
          <span className="text-[11px] text-gray-400 hidden sm:inline">
            how our products match RFP/RFI requirements
          </span>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <Legend swatch="bg-emerald-500" label={`Strong (${counts.strong})`} />
          <Legend swatch="bg-amber-500" label={`Partial (${counts.partial})`} />
          <Legend swatch="bg-red-500" label={`Gap (${counts.gap})`} />
          <Legend swatch="bg-gray-100 border border-gray-200" label="N/A" />
        </div>
      </div>

      {/* Matrix */}
      <div className="overflow-auto max-h-[60vh]">
        <table className="border-collapse text-xs">
          <thead className="sticky top-0 z-20">
            {/* RFP group header row */}
            <tr>
              <th className="sticky left-0 z-30 bg-gray-50 border-b border-r border-gray-200 px-3 py-2 text-left font-semibold text-gray-600 min-w-[160px] max-w-[200px]">
                Product
              </th>
              {columns.map((col, ci) => (
                <th
                  key={col.rfp.id + "-" + ci}
                  colSpan={col.requirements.length}
                  className="bg-gray-50 border-b border-r border-gray-200 px-1 py-1 text-center"
                >
                  <button
                    onClick={() => setSelectedRfp(col.rfp)}
                    title={col.rfp.title}
                    className="block w-full text-[10px] font-semibold text-gray-700 hover:text-primary truncate"
                    style={{ maxWidth: col.requirements.length * 84 }}
                  >
                    {col.rfp.firm_name ? col.rfp.firm_name + " · " : ""}
                    {col.rfp.title || "—"}
                  </button>
                </th>
              ))}
            </tr>
            {/* Requirement sub-header row */}
            <tr>
              <th className="sticky left-0 z-30 bg-gray-50 border-b border-r border-gray-200 px-3 py-1 text-left font-medium text-gray-400 text-[10px]">
                Requirement →
              </th>
              {columns.flatMap((col, ci) =>
                col.requirements.map((req, ri) => (
                  <th
                    key={ci + "-" + ri}
                    title={req}
                    className="bg-white border-b border-r border-gray-200 px-1 py-1 text-center font-medium text-gray-500 text-[10px] min-w-[84px] max-w-[84px]"
                  >
                    <span className="block truncate">{req}</span>
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {products.map((p, pi) => (
              <tr key={p.id} className={pi % 2 ? "bg-gray-50/40" : "bg-white"}>
                <td className="sticky left-0 z-10 bg-inherit border-b border-r border-gray-200 px-3 py-1.5 text-gray-800 font-medium truncate min-w-[160px] max-w-[200px]">
                  {p.name}
                </td>
                {columns.flatMap((col, ci) =>
                  col.requirements.map((req, ri) => {
                    const a = getCell(col.rfp, p.id, req);
                    const color = a ? ALIGN_COLORS[a] : "bg-gray-100 border border-gray-200";
                    return (
                      <td
                        key={ci + "-" + ri}
                        className="border-b border-r border-gray-100 p-0"
                      >
                        <button
                          onClick={() => setSelectedRfp(col.rfp)}
                          title={
                            a
                              ? `${col.rfp.title} · ${req} · ${ALIGN_LABEL[a]}`
                              : `${col.rfp.title} · ${req} · not evaluated`
                          }
                          className={`block w-full h-7 ${color} hover:opacity-80 transition-opacity`}
                        />
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rfps.length === MAX_RFPS && (
        <p className="text-[10px] text-gray-400 px-3 py-1.5 border-t border-gray-100">
          Showing the {MAX_RFPS} most recent RFP/RFI opportunities with alignment data.
        </p>
      )}

      <RfpRfiAlignmentDialog
        open={!!selectedRfp}
        onClose={() => setSelectedRfp(null)}
        record={selectedRfp}
      />
    </div>
  );
}

function Legend({ swatch, label }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-3 h-3 rounded-sm ${swatch}`} />
      {label}
    </span>
  );
}

// Resolve the alignment value for a product × RFP × requirement cell.
function getCell(rfp, productId, requirement) {
  const prod = (rfp.product_alignment || []).find((p) => p.product_id === productId);
  if (!prod) return null;
  if (requirement === "Overall") return prod.overall_fit || null;
  const c = (prod.criteria || []).find((x) => x.requirement === requirement);
  return c ? c.alignment : null;
}