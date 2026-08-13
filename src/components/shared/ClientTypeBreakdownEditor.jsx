import React, { useMemo, useState } from "react";
import { Plus, Trash2, AlertTriangle, CheckCircle2, Scale, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CurrencyInput from "./CurrencyInput";
import ClientTypePicker from "./ClientTypePicker";

const OTHER_TYPE = "Other";

function genId() {
  return crypto.randomUUID();
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
}

/**
 * Lightweight per-row client type breakdown editor.
 * Used inside AUM history rows — the breakdown is stored on each aum_history
 * entry and saved together with the AUM history save.
 *
 * Props:
 *  - breakdown: array of { id, client_type, aum_amount }
 *  - targetAum: number (the row's firm_aum / product_aum to validate against)
 *  - onChange: (newBreakdown) => void
 */
export default function ClientTypeBreakdownEditor({ breakdown, targetAum, onChange, priorBreakdownMap }) {
  const rows = breakdown || [];
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

  const [newType, setNewType] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const usedNames = rows.map((r) => r.client_type).filter(Boolean);
  const canAdd = newType.trim() && !usedNames.includes(newType.trim()) && toNumber(newAmount) > 0;

  const addRow = () => {
    if (!canAdd) return;
    onChange([...rows, { id: genId(), client_type: newType.trim(), aum_amount: toNumber(newAmount) }]);
    setNewType("");
    setNewAmount("");
  };

  const updateRow = (id, field, value) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
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
      onChange([...rows, { id: genId(), client_type: OTHER_TYPE, aum_amount: underBy }]);
    }
  };

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
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[11px] font-medium text-gray-400 px-1">
            <div className="flex-1 text-center">Client Type</div>
            <div className="w-32 text-center">AUM</div>
            <div className="w-20 text-center">% Change</div>
            <div className="w-14" />
          </div>
          {rows.map((row) => {
            const usedNames = rows.filter((r) => r.id !== row.id).map((r) => r.client_type).filter(Boolean);
            const othersTotal = rows.filter((r) => r.id !== row.id).reduce((sum, r) => sum + toNumber(r.aum_amount), 0);
            const rowBalance = hasTarget ? Math.max(0, targetAum - othersTotal) : 0;
            const canUseBalance = hasTarget && rowBalance > 0 && toNumber(row.aum_amount) !== rowBalance;
            const priorAmount = priorBreakdownMap ? priorBreakdownMap[row.client_type] : undefined;
            const pctChange = (priorAmount != null && priorAmount !== 0) ? (toNumber(row.aum_amount) - priorAmount) / priorAmount : null;
            return (
              <div key={row.id} className="flex items-start gap-2">
                <div className="flex-1">
                  <ClientTypePicker
                    value={row.client_type}
                    onChange={(name) => updateRow(row.id, "client_type", name)}
                    excludeNames={usedNames}
                  />
                </div>
                <div className="w-32">
                  <CurrencyInput
                    value={row.aum_amount || ""}
                    onChange={(v) => updateRow(row.id, "aum_amount", v)}
                    className="h-8 text-sm text-center"
                  />
                </div>
                <div className="w-20 text-center text-xs font-medium self-center">
                  {pctChange != null ? (
                    <span className={pctChange >= 0 ? "text-green-600" : "text-red-600"}>
                      {(pctChange * 100).toFixed(1)}%
                    </span>
                  ) : <span className="text-gray-300">—</span>}
                </div>
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
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-start gap-2 pt-1 border-t border-gray-100">
          <div className="flex-1">
            <ClientTypePicker
              value={newType}
              onChange={setNewType}
              excludeNames={usedNames}
            />
          </div>
          <div className="w-32">
            <CurrencyInput
              value={newAmount || ""}
              onChange={setNewAmount}
              onKeyDown={(e) => { if (e.key === "Enter" && canAdd) { e.preventDefault(); addRow(); } }}
              className="h-8 text-sm text-center"
            />
          </div>
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
        <div className="flex items-center gap-2">
          {hasTarget && isUnder && (
            <Button type="button" variant="outline" size="sm" className="text-amber-700 border-amber-300 hover:bg-amber-50 gap-1 text-xs h-7" onClick={forceMatch}>
              <Scale className="w-3 h-3" /> Force Match
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}