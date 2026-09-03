import React, { useMemo } from "react";
import { MapPin, Flame } from "lucide-react";

const REGIONS = ["North America", "Europe", "Asia-Pacific", "Latin America", "Middle East & Africa", "Global"];
const getContactName = (c) =>
  [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");

/**
 * Heatmap of active product coverage assignments by Xponance analyst (rows) × firm region (columns).
 * A product counts toward an analyst's region cell when that analyst is the primary or secondary
 * Xponance contact on the product and the product's firm is in that geographic region.
 * Cell color intensity scales with count — darker = more active coverage in that region.
 */
export default function AnalystRegionCoverageHeatmap({ products, firmMap, xponanceContacts }) {
  const { analysts, regions, maxCell, totalAssignments, regionTotals } = useMemo(() => {
    const contactMap = Object.fromEntries(xponanceContacts.map((c) => [c.id, c]));
    const m = {}; // analystId -> region -> count
    for (const p of products) {
      const region = firmMap[p.firm_id]?.geographic_region || "Undefined";
      const assignees = [p.primary_xponance_contact_id, p.secondary_xponance_contact_id].filter(Boolean);
      if (assignees.length === 0) continue; // only active coverage
      for (const aid of assignees) {
        if (!contactMap[aid]) continue; // only Xponance analysts
        m[aid] = m[aid] || {};
        m[aid][region] = (m[aid][region] || 0) + 1;
      }
    }
    const regionSet = new Set();
    Object.values(m).forEach((r) => Object.keys(r).forEach((k) => regionSet.add(k)));
    const usedRegions = [...REGIONS.filter((r) => regionSet.has(r))];
    if (regionSet.has("Undefined")) usedRegions.push("Undefined");

    const analystList = xponanceContacts
      .filter((c) => m[c.id])
      .map((c) => ({ contact: c, row: m[c.id], total: Object.values(m[c.id]).reduce((s, n) => s + n, 0) }))
      .sort((a, b) => b.total - a.total || getContactName(a.contact).localeCompare(getContactName(b.contact)));

    let max = 0;
    analystList.forEach((a) => usedRegions.forEach((r) => { if ((a.row[r] || 0) > max) max = a.row[r]; }));
    const totals = usedRegions.map((r) => analystList.reduce((s, a) => s + (a.row[r] || 0), 0));
    const total = analystList.reduce((s, a) => s + a.total, 0);
    return { analysts: analystList, regions: usedRegions, maxCell: max, totalAssignments: total, regionTotals: totals };
  }, [products, firmMap, xponanceContacts]);

  const cellColor = (count) => {
    if (!count) return "transparent";
    const intensity = maxCell > 0 ? 0.15 + 0.75 * (count / maxCell) : 0.15;
    return `rgba(139, 92, 246, ${intensity})`;
  };

  return (
    <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <Flame className="w-4 h-4 text-violet-600" />
          Analyst Coverage Heatmap by Region
        </h3>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span><b className="text-gray-700">{totalAssignments}</b> active assignments</span>
          <span><b className="text-gray-700">{analysts.length}</b> analysts</span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-3 rounded" style={{ background: "rgba(139,92,246,0.15)" }} />
            low
            <span className="inline-block w-4 h-3 rounded" style={{ background: "rgba(139,92,246,0.9)" }} />
            high
          </span>
        </div>
      </div>

      {analysts.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-6 text-center">No active product coverage assignments to map.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="text-left font-semibold text-gray-500 uppercase tracking-wider px-3 py-2 sticky left-0 bg-white whitespace-nowrap">Analyst</th>
                {regions.map((r) => (
                  <th key={r} className="text-center font-semibold text-gray-500 uppercase tracking-wider px-2 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-1 justify-center">
                      <MapPin className="w-3 h-3 text-gray-400" />
                      {r}
                    </div>
                  </th>
                ))}
                <th className="text-center font-semibold text-gray-500 uppercase tracking-wider px-2 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {analysts.map((a) => (
                <tr key={a.contact.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 sticky left-0 bg-white whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {a.contact.photo_url ? (
                        <img src={a.contact.photo_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 text-violet-500 font-bold text-[10px]">
                          {(a.contact.first_name?.[0] || "") + (a.contact.last_name?.[0] || "")}
                        </div>
                      )}
                      <span className="font-medium text-gray-800">{getContactName(a.contact)}</span>
                    </div>
                  </td>
                  {regions.map((r) => {
                    const count = a.row[r] || 0;
                    return (
                      <td key={r} className="px-2 py-2 text-center" style={{ backgroundColor: cellColor(count) }}>
                        <span className={`font-semibold ${count > 0 ? "text-gray-800" : "text-gray-300"}`}>{count > 0 ? count : "·"}</span>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center font-bold text-violet-700 bg-violet-50">{a.total}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200">
                <td className="px-3 py-2 sticky left-0 bg-white font-semibold text-gray-600 text-right whitespace-nowrap">Region total</td>
                {regionTotals.map((t, i) => (
                  <td key={i} className="px-2 py-2 text-center font-semibold text-gray-600">{t}</td>
                ))}
                <td className="px-2 py-2 text-center font-bold text-violet-700 bg-violet-50">{totalAssignments}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}