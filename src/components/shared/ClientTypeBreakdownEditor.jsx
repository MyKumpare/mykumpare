import React, { useMemo, useState } from "react";
import { Trash2, AlertTriangle, CheckCircle2, Scale, Check, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import CurrencyInput from "./CurrencyInput";
import ClientTypePicker from "./ClientTypePicker";
import ProductAllocationEditor from "./ProductAllocationEditor";

const OTHER_TYPE = "Other";

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
}

function pctText(p) {
  if (p == null) return "—";
  return `${(p * 100).toFixed(1)}%`;
}

/**
 * Lightweight per-row client type breakdown editor.
 * Used inside AUM history rows — the breakdown is stored on each aum_history
 * entry and saved together with the AUM history save.
 *
 * Each breakdown row mirrors the firm/product AUM row: AUM, Assets Gained,
 * Assets Loss, Net Asset Flows (auto = gained + loss), Market Impact, and the
 * three % Change variants — all computed against the prior month's breakdown
 * for the same client type (priorBreakdownMap).
 *
 * Props:
 *  - breakdown: array of { id, client_type, aum_amount, assets_gained, assets_loss, net_asset_flows }
 *  - targetAum: number (the row's firm_aum / product_aum to validate against)
 *  - onChange: (newBreakdown) => void
 *  - priorBreakdownMap: { client_type -> aum_amount } from the prior month
 */
export default function ClientTypeBreakdownEditor({ breakdown, targetAum, onChange, priorBreakdownMap, targetGained = 0, targetLoss = 0, products = [] }) {
  // Ensure every breakdown row has a stable unique id so per-row updates
  // always target the correct row.
  const rows = useMemo(
    () => (breakdown || []).map((r) => ({ ...r, id: r.id || genId() })),
    [breakdown]
  );
  const hasRows = rows.length > 0;

  const breakdownTotal = useMemo(
    () => rows.reduce((sum, r) => sum + toNumber(r.aum_amount), 0),
    [rows]
  );

  const hasTarget = targetAum != null && targetAum > 0;
  const overBy = hasTarget ? Math.max(0, breakdownTotal - targetAum) : 0;
  const underBy = hasTarget ? Math.max(0, targetAum - breakdownTotal) : 0;
  const isOver = overBy > 0;
  const isUnder = underBy > 0;
  const isMatched = hasTarget && breakdownTotal === targetAum;

  // Remaining (unallocated) Assets Gained / Loss from the parent AUM record.
  // "Use remaining" passes these down to the new breakdown row so the
  // breakdown's gained/loss totals match the parent firm/product AUM record.
  const sumGained = useMemo(
    () => rows.reduce((sum, r) => sum + toNumber(r.assets_gained), 0),
    [rows]
  );
  const sumLoss = useMemo(
    () => rows.reduce((sum, r) => sum + toNumber(r.assets_loss), 0),
    [rows]
  );
  const remainingGained = Math.max(0, toNumber(targetGained) - sumGained);
  const remainingLoss = Math.min(0, toNumber(targetLoss) - sumLoss);

  const [newType, setNewType] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newGained, setNewGained] = useState("");
  const [newLoss, setNewLoss] = useState("");
  const [expandedRows, setExpandedRows] = useState(new Set());

  const usedNames = rows.map((r) => r.client_type).filter(Boolean);
  const canAdd = newType.trim() && !usedNames.includes(newType.trim()) && toNumber(newAmount) > 0;
  const newNetFlow = toNumber(newGained) + toNumber(newLoss);

  const addRow = () => {
    if (!canAdd) return;
    const gained = toNumber(newGained);
    const loss = -Math.abs(toNumber(newLoss));
    onChange([...rows, {
      id: genId(),
      client_type: newType.trim(),
      aum_amount: toNumber(newAmount),
      assets_gained: gained,
      assets_loss: loss,
      net_asset_flows: gained + loss,
    }]);
    setNewType("");
    setNewAmount("");
    setNewGained("");
    setNewLoss("");
  };

  const updateRow = (id, field, value) => {
    onChange(rows.map((r) => {
      if (r.id !== id) return r;
      let nextValue = value;
      if (field === "assets_loss") nextValue = -Math.abs(toNumber(value));
      const updated = { ...r, [field]: nextValue };
      if (field === "assets_gained" || field === "assets_loss") {
        updated.net_asset_flows = toNumber(updated.assets_gained) + toNumber(updated.assets_loss);
      }
      return updated;
    }));
  };

  const deleteRow = (id) => {
    onChange(rows.filter((r) => r.id !== id));
  };

  const forceMatch = () => {
    if (!hasTarget || isOver || underBy === 0) return;
    const existing = rows.find((r) => r.client_type === OTHER_TYPE);
    if (existing) {
      onChange(rows.map((r) =>
        r.id === existing.id ? { ...r, aum_amount: toNumber(r.aum_amount) + underBy } : r
      ));
    } else {
      onChange([...rows, { id: genId(), client_type: OTHER_TYPE, aum_amount: underBy, assets_gained: 0, assets_loss: 0, net_asset_flows: 0 }]);
    }
  };

  // Column widths — kept aligned between header, data rows, and the add form.
  const COL = {
    expand: "w-8",
    aum: "w-28",
    gained: "w-28",
    loss: "w-28",
    net: "w-28",
    market: "w-28",
    pctTotal: "w-24",
    pctExcl: "w-24",
    pctMarket: "w-24",
    actions: "w-14",
  };

  const onEnterAdd = (e) => { if (e.key === "Enter" && canAdd) { e.preventDefault(); addRow(); } };

  return (
    <div className="space-y-2">
      {hasTarget && (
        <div className={`rounded-lg border p-2 text-xs ${
          isMatched ? "border-emerald-200 bg-emerald-50" :
          isOver ? "border-red-200 bg-red-50" :
          hasRows ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-gray-50"
        }`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {isMatched ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> :
               hasRows ? <AlertTriangle className={`w-3.5 h-3.5 ${isOver ? "text-red-600" : "text-amber-600"}`} /> :
               <AlertTriangle className="w-3.5 h-3.5 text-gray-400" />}
              <span className="text-gray-700">
                AUM: <span className="font-semibold">{formatCurrency(targetAum)}</span>
              </span>
            </div>
            {hasRows && (
              <div className="font-medium">
                <span className={isMatched ? "text-emerald-700" : isOver ? "text-red-700" : "text-amber-700"}>
                  {formatCurrency(breakdownTotal)}
                </span>
                {isOver && <span className="text-red-600 ml-1">(over {formatCurrency(overBy)})</span>}
                {isUnder && <span className="text-amber-600 ml-1">(under {formatCurrency(underBy)})</span>}
                {isMatched && <span className="text-emerald-600 ml-1">✓</span>}
              </div>
            )}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="min-w-[980px] space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] font-medium text-gray-400 px-1">
              <div className={COL.expand} />
              <div className="flex-1 text-center">Client Type</div>
              <div className={`${COL.aum} text-center`}>AUM</div>
              <div className={`${COL.gained} text-center`}>Assets Gained</div>
              <div className={`${COL.loss} text-center`}>Assets Loss</div>
              <div className={`${COL.net} text-center`}>Net Flows</div>
              <div className={`${COL.market} text-center`}>Market Impact</div>
              <div className={`${COL.pctTotal} text-center`}>% Change Total</div>
              <div className={`${COL.pctExcl} text-center`}>% Excl. Market</div>
              <div className={`${COL.pctMarket} text-center`}>% Market</div>
              <div className={COL.actions} />
            </div>
            {rows.map((row) => {
              const rowUsedNames = rows.filter((r) => r.id !== row.id).map((r) => r.client_type).filter(Boolean);
              const othersTotal = rows.filter((r) => r.id !== row.id).reduce((sum, r) => sum + toNumber(r.aum_amount), 0);
              const rowBalance = hasTarget ? Math.max(0, targetAum - othersTotal) : 0;
              const canUseBalance = hasTarget && rowBalance > 0 && toNumber(row.aum_amount) !== rowBalance;
              const currentAum = toNumber(row.aum_amount);
              const gained = toNumber(row.assets_gained);
              const loss = toNumber(row.assets_loss);
              const netFlow = gained + loss;
              const priorAum = priorBreakdownMap ? priorBreakdownMap[row.client_type] : undefined;
              const hasPrior = priorAum != null && priorAum !== 0;
              const marketImpact = hasPrior ? currentAum - priorAum - netFlow : null;
              const pctTotal = hasPrior ? (currentAum - priorAum) / priorAum : null;
              const pctExcl = hasPrior ? netFlow / priorAum : null;
              const pctMarket = (pctTotal != null && pctExcl != null) ? pctTotal - pctExcl : null;
              return (
                <div key={row.id} className="space-y-1">
                <div className="flex items-start gap-2">
                  <div className={COL.expand}>
                    <button
                      type="button"
                      onClick={() => {
                        const next = new Set(expandedRows);
                        if (next.has(row.id)) next.delete(row.id);
                        else next.add(row.id);
                        setExpandedRows(next);
                      }}
                      className="text-gray-400 hover:text-indigo-600 flex items-center justify-center h-8"
                      title="Product allocations for this client type"
                    >
                      {expandedRows.has(row.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="flex-1">
                    <ClientTypePicker
                      value={row.client_type}
                      onChange={(name) => updateRow(row.id, "client_type", name)}
                      excludeNames={rowUsedNames}
                    />
                  </div>
                  <div className={COL.aum}>
                    <CurrencyInput
                      value={row.aum_amount || ""}
                      onChange={(v) => updateRow(row.id, "aum_amount", v)}
                      className="h-8 text-sm text-center"
                    />
                  </div>
                  <div className={COL.gained}>
                    <CurrencyInput
                      value={row.assets_gained || ""}
                      onChange={(v) => updateRow(row.id, "assets_gained", v)}
                      className="h-8 text-sm text-center text-green-600 font-medium"
                    />
                  </div>
                  <div className={COL.loss}>
                    <CurrencyInput
                      value={row.assets_loss || ""}
                      onChange={(v) => updateRow(row.id, "assets_loss", v)}
                      className="h-8 text-sm text-center text-red-600 font-medium"
                    />
                  </div>
                  <div className={`${COL.net} text-center text-xs font-medium self-center`}>
                    <span className={netFlow >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(netFlow)}</span>
                  </div>
                  <div className={`${COL.market} text-center text-xs font-medium self-center`}>
                    {marketImpact != null ? (
                      <span className={marketImpact >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(marketImpact)}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </div>
                  <div className={`${COL.pctTotal} text-center text-xs font-medium self-center`}>
                    {pctTotal != null ? (
                      <span className={pctTotal >= 0 ? "text-green-600" : "text-red-600"}>{pctText(pctTotal)}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </div>
                  <div className={`${COL.pctExcl} text-center text-xs font-medium self-center`}>
                    {pctExcl != null ? (
                      <span className={pctExcl >= 0 ? "text-green-600" : "text-red-600"}>{pctText(pctExcl)}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </div>
                  <div className={`${COL.pctMarket} text-center text-xs font-medium self-center`}>
                    {pctMarket != null ? (
                      <span className={pctMarket >= 0 ? "text-green-600" : "text-red-600"}>{pctText(pctMarket)}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </div>
                  <div className={`${COL.actions} flex items-center justify-center self-center`}>
                    <button
                      type="button"
                      onClick={() => updateRow(row.id, "aum_amount", rowBalance)}
                      disabled={!canUseBalance}
                      className="p-1.5 text-indigo-500 hover:text-indigo-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                      title={canUseBalance ? `Use remaining balance (${formatCurrency(rowBalance)})` : "No balance available"}
                    >
                      <Scale className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => deleteRow(row.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {expandedRows.has(row.id) && (
                  <div className="ml-10 border-l-2 border-indigo-100 pl-3 py-1">
                    <div className="text-[11px] font-medium text-gray-500 mb-1">Product Allocations — this client type's investments in the firm's products</div>
                    <ProductAllocationEditor
                      allocations={row.product_allocations || []}
                      targetAmount={toNumber(row.aum_amount)}
                      targetGained={toNumber(row.assets_gained)}
                      targetLoss={toNumber(row.assets_loss)}
                      products={products}
                      onChange={(newAllocations) => updateRow(row.id, "product_allocations", newAllocations)}
                    />
                  </div>
                )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-start gap-2 pt-1 border-t border-gray-100">
          <div className={COL.expand} />
          <div className="flex-1">
            <ClientTypePicker
              value={newType}
              onChange={setNewType}
              excludeNames={usedNames}
            />
          </div>
          <div className={COL.aum}>
            <CurrencyInput
              value={newAmount || ""}
              onChange={setNewAmount}
              onKeyDown={onEnterAdd}
              className="h-8 text-sm text-center"
            />
          </div>
          <div className={COL.gained}>
            <CurrencyInput
              value={newGained || ""}
              onChange={setNewGained}
              onKeyDown={onEnterAdd}
              className="h-8 text-sm text-center text-green-600 font-medium"
            />
          </div>
          <div className={COL.loss}>
            <CurrencyInput
              value={newLoss || ""}
              onChange={(v) => setNewLoss(-Math.abs(toNumber(v)))}
              onKeyDown={onEnterAdd}
              className="h-8 text-sm text-center text-red-600 font-medium"
            />
          </div>
          <div className={`${COL.net} text-center text-xs font-medium self-center`}>
            <span className={newNetFlow >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(newNetFlow)}</span>
          </div>
          <div className="flex-1 flex justify-end">
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1 text-xs"
              disabled={!canAdd}
              onClick={addRow}
            >
              <Check className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
        </div>
        {hasTarget && (
          <div className="flex items-center justify-between gap-2 text-xs px-1">
            <span className="text-gray-500">Remaining balance to allocate:</span>
            <span className={`font-semibold ${
              isOver ? "text-red-600" : isMatched ? "text-emerald-600" : "text-amber-600"
            }`}>
              {isOver
                ? `Over by ${formatCurrency(overBy)}`
                : isMatched
                  ? "Fully allocated ✓"
                  : formatCurrency(underBy)}
            </span>
            {isUnder && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1"
                onClick={() => {
                  setNewAmount(String(underBy));
                  setNewGained(String(remainingGained));
                  setNewLoss(String(remainingLoss));
                }}
                disabled={underBy <= 0}
                title="Fill AUM, Assets Gained, and Assets Loss with the remaining balance from the parent record"
              >
                <Scale className="w-3 h-3" /> Use remaining
              </Button>
            )}
            {hasTarget && isUnder && (
              <Button type="button" variant="outline" size="sm" className="text-amber-700 border-amber-300 hover:bg-amber-50 gap-1 text-xs h-7 ml-auto" onClick={forceMatch}>
                <Scale className="w-3 h-3" /> Force Match
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}