import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, TrendingUp, ChevronDown, ChevronRight, Info } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import AumGrowthChart from "@/components/shared/AumGrowthChart";
import { useToast } from "@/components/ui/use-toast";

const genId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

function toNumber(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/[$,\s]/g, ""));
  return isNaN(n) ? 0 : n;
}

function formatCurrency(n) {
  if (n === null || n === undefined || isNaN(n)) return "";
  const num = Number(n);
  return (num < 0 ? "-$" : "$") + Math.abs(num).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtDisplay(iso) {
  if (!iso) return "";
  const d = parseISO(iso);
  return isNaN(d.getTime()) ? iso : format(d, "MM/dd/yyyy");
}

/**
 * Derive a product's AUM history from the parent firm's allocation matrix.
 * For each firm AUM record date, sum every client type's product_allocation
 * entries that reference this product. The per-client-type rows become the
 * product's client-type investor breakdown for that date.
 */
function deriveProductAumHistory(firmHistory, productId) {
  const derived = [];
  (firmHistory || []).forEach((fh) => {
    const ctRows = [];
    let totalAum = 0;
    let totalGained = 0;
    let totalLoss = 0;
    (fh.client_type_breakdown || []).forEach((ct) => {
      const allocs = (ct.product_allocations || []).filter((a) => a.product_id === productId);
      if (allocs.length === 0) return;
      const ctAmount = allocs.reduce((s, a) => s + toNumber(a.amount), 0);
      const ctGained = allocs.reduce((s, a) => s + toNumber(a.assets_gained), 0);
      const ctLoss = allocs.reduce((s, a) => s + toNumber(a.assets_loss), 0);
      ctRows.push({
        id: genId(),
        client_type: ct.client_type,
        aum_amount: ctAmount,
        assets_gained: ctGained,
        assets_loss: ctLoss,
        net_asset_flows: ctGained + ctLoss,
      });
      totalAum += ctAmount;
      totalGained += ctGained;
      totalLoss += ctLoss;
    });
    if (ctRows.length === 0) return;
    derived.push({
      id: genId(),
      month_end_date: fh.month_end_date,
      firm_aum: totalAum,
      assets_gained: totalGained,
      assets_loss: totalLoss,
      net_asset_flows: totalGained + totalLoss,
      client_type_breakdown: ctRows,
    });
  });
  return derived;
}

export default function ProductAumHistoryDerived({ productId, productName }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [firmName, setFirmName] = useState("");
  const [expandedRows, setExpandedRows] = useState(new Set());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const product = await base44.entities.Product.get(productId);
        if (!active) return;
        if (!product.firm_id) {
          if (active) setLoading(false);
          return;
        }
        const firm = await base44.entities.Firm.get(product.firm_id);
        if (!active) return;
        setFirmName(firm.name || "");
        const history = (firm.aum_history || []).map((fh) => ({
          ...fh,
          client_type_breakdown: (fh.client_type_breakdown || []).map((ct) => ({
            ...ct,
            product_allocations: ct.product_allocations || [],
          })),
        }));
        setRows(deriveProductAumHistory(history, productId));
      } catch (e) {
        toast({
          title: "Error loading product AUM history",
          description: e.message,
          variant: "destructive",
        });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [productId]);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) =>
        (a.month_end_date || "").localeCompare(b.month_end_date || "")
      ),
    [rows]
  );

  const chartData = useMemo(
    () =>
      sortedRows.map((r) => ({
        date: fmtDisplay(r.month_end_date),
        "Product AUM": r.firm_aum,
        "Assets Gained": r.assets_gained,
        "Assets Loss": r.assets_loss,
        "Net Flows": r.net_asset_flows,
      })),
    [sortedRows]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-xs text-gray-600 bg-indigo-50 border border-indigo-100 rounded-lg p-2.5">
        <Info className="w-3.5 h-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />
        <span>
          Product AUM is derived from the parent firm's allocation matrix{firmName ? ` (${firmName})` : ""}. Each client type's allocation to this product rolls up into this product's AUM and its client-type investor breakdown. To change these numbers, edit the allocations on the firm's AUM History tab.
        </span>
      </div>

      <AumGrowthChart rows={sortedRows} entityLabel="Product" name={productName} />

      {chartData.length > 0 ? (
        <div className="border rounded-xl p-4 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <h4 className="text-sm font-semibold text-gray-800">
              Product AUM History {productName ? `— ${productName}` : ""}
            </h4>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => {
                if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
                if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
                if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
                return `$${v}`;
              }} />
              <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Product AUM" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3 }} />
              <Bar dataKey="Assets Gained" fill="#16a34a" barSize={14} />
              <Bar dataKey="Assets Loss" fill="#dc2626" barSize={14} />
              <Line type="monotone" dataKey="Net Flows" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} strokeDasharray="4 2" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-xl">
          No product AUM data yet. This product has no allocations in the parent firm's AUM history. Add allocations on the firm's AUM History tab.
        </div>
      )}

      {sortedRows.length > 0 && (
        <div className="border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className="px-2 py-2 w-8"></th>
                  <th className="text-center font-medium px-3 py-2">Month-End Date</th>
                  <th className="text-center font-medium px-3 py-2">Product AUM</th>
                  <th className="text-center font-medium px-3 py-2">Assets Gained</th>
                  <th className="text-center font-medium px-3 py-2">Assets Loss</th>
                  <th className="text-center font-medium px-3 py-2">Net Asset Flows</th>
                  <th className="text-center font-medium px-3 py-2">Market Impact</th>
                  <th className="text-center font-medium px-3 py-2">% Change Total AUM</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r, idx) => {
                  const priorRow = idx > 0 ? sortedRows[idx - 1] : null;
                  const priorAum = priorRow ? toNumber(priorRow.firm_aum) : null;
                  const currentAum = toNumber(r.firm_aum);
                  const netFlow = toNumber(r.net_asset_flows);
                  const marketImpact = priorAum != null ? currentAum - priorAum - netFlow : null;
                  const pctChange = priorAum ? (currentAum - priorAum) / priorAum : null;
                  const hasBreakdown = (r.client_type_breakdown || []).length > 0;
                  return (
                    <React.Fragment key={r.id}>
                      <tr className="border-t hover:bg-gray-50">
                        <td className="px-2 py-1.5 text-center">
                          {hasBreakdown && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = new Set(expandedRows);
                                if (next.has(r.id)) next.delete(r.id);
                                else next.add(r.id);
                                setExpandedRows(next);
                              }}
                              className="text-gray-400 hover:text-indigo-600"
                            >
                              {expandedRows.has(r.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-center text-sm">{fmtDisplay(r.month_end_date)}</td>
                        <td className="px-3 py-1.5 text-center text-sm font-medium">{formatCurrency(currentAum)}</td>
                        <td className="px-3 py-1.5 text-center text-sm font-medium text-green-600">{formatCurrency(r.assets_gained)}</td>
                        <td className="px-3 py-1.5 text-center text-sm font-medium text-red-600">{formatCurrency(r.assets_loss)}</td>
                        <td className="px-3 py-1.5 text-center text-sm font-medium">
                          <span className={netFlow >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(netFlow)}</span>
                        </td>
                        <td className="px-3 py-1.5 text-center text-sm font-medium">
                          {marketImpact != null ? (
                            <span className={marketImpact >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(marketImpact)}</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-1.5 text-center text-sm font-medium">
                          {pctChange != null ? (
                            <span className={pctChange >= 0 ? "text-green-600" : "text-red-600"}>{(pctChange * 100).toFixed(2)}%</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                      {expandedRows.has(r.id) && hasBreakdown && (
                        <tr className="border-t">
                          <td colSpan={8} className="px-4 py-3 bg-gray-50">
                            <div className="text-xs font-medium text-gray-600 mb-2">Client Type Investors (derived from firm allocation matrix)</div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead className="text-gray-500">
                                  <tr>
                                    <th className="text-left font-medium px-2 py-1">Client Type</th>
                                    <th className="text-center font-medium px-2 py-1">AUM</th>
                                    <th className="text-center font-medium px-2 py-1">Assets Gained</th>
                                    <th className="text-center font-medium px-2 py-1">Assets Loss</th>
                                    <th className="text-center font-medium px-2 py-1">Net Flows</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.client_type_breakdown.map((ct) => {
                                    const net = toNumber(ct.net_asset_flows);
                                    return (
                                      <tr key={ct.id} className="border-t">
                                        <td className="px-2 py-1 text-gray-700">{ct.client_type}</td>
                                        <td className="px-2 py-1 text-center font-medium">{formatCurrency(ct.aum_amount)}</td>
                                        <td className="px-2 py-1 text-center text-green-600 font-medium">{formatCurrency(ct.assets_gained)}</td>
                                        <td className="px-2 py-1 text-center text-red-600 font-medium">{formatCurrency(ct.assets_loss)}</td>
                                        <td className="px-2 py-1 text-center font-medium">
                                          <span className={net >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(net)}</span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}