import React, { useMemo, useState } from "react";
import { Trash2, AlertTriangle, CheckCircle2, Scale, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import CurrencyInput from "./CurrencyInput";

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

/**
 * Editor for a single client type's allocations across the firm's products
 * for one AUM record date. The firm allocation matrix is the single source of
 * truth — each product's AUM and client-type investors are derived from these
 * allocations.
 *
 * Props:
 *  - allocations: [{ id, product_id, product_name, amount, assets_gained, assets_loss, net_asset_flows }]
 *  - targetAmount: the client type's aum_amount (sum of allocations must not exceed it)
 *  - targetGained / targetLoss: the client type's gained/loss (for "Use remaining")
 *  - products: the firm's products [{ id, name }]
 *  - onChange: (newAllocations) => void
 */
export default function ProductAllocationEditor({ allocations, targetAmount, targetGained = 0, targetLoss = 0, products = [], onChange }) {
  const rows = useMemo(
    () => (allocations || []).map((r) => ({ ...r, id: r.id || genId() })),
    [allocations]
  );

  const total = useMemo(() => rows.reduce((s, r) => s + toNumber(r.amount), 0), [rows]);
  const hasTarget = targetAmount != null && targetAmount > 0;
  const overBy = hasTarget ? Math.max(0, total - targetAmount) : 0;
  const underBy = hasTarget ? Math.max(0, targetAmount - total) : 0;
  const isOver = overBy > 0;
  const isUnder = underBy > 0;
  const isMatched = hasTarget && total === targetAmount;

  const sumGained = rows.reduce((s, r) => s + toNumber(r.assets_gained), 0);
  const sumLoss = rows.reduce((s, r) => s + toNumber(r.assets_loss), 0);
  const remainingGained = Math.max(0, toNumber(targetGained) - sumGained);
  const remainingLoss = Math.min(0, toNumber(targetLoss) - sumLoss);

  const [newProductId, setNewProductId] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newGained, setNewGained] = useState("");
  const [newLoss, setNewLoss] = useState("");

  const usedProductIds = rows.map((r) => r.product_id).filter(Boolean);
  const availableProducts = products.filter((p) => !usedProductIds.includes(p.id));
  const canAdd = newProductId && toNumber(newAmount) > 0;
  const newNetFlow = toNumber(newGained) + toNumber(newLoss);

  const addRow = () => {
    if (!canAdd) return;
    const prod = products.find((p) => p.id === newProductId);
    const gained = toNumber(newGained);
    const loss = -Math.abs(toNumber(newLoss));
    onChange([...rows, {
      id: genId(),
      product_id: newProductId,
      product_name: prod?.name || "",
      amount: toNumber(newAmount),
      assets_gained: gained,
      assets_loss: loss,
      net_asset_flows: gained + loss,
    }]);
    setNewProductId("");
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

  const deleteRow = (id) => onChange(rows.filter((r) => r.id !== id));

  const COL = { product: "flex-1 min-w-[160px]", amount: "w-28", gained: "w-28", loss: "w-28", net: "w-28", actions: "w-14" };

  const onEnterAdd = (e) => { if (e.key === "Enter" && canAdd) { e.preventDefault(); addRow(); } };

  if (products.length === 0 && rows.length === 0) {
    return <div className="text-xs text-gray-400 italic">No products available for this firm. Add products to the firm first to allocate this client type's AUM.</div>;
  }

  return (
    <div className="space-y-2">
      {hasTarget && (
        <div className={`rounded-lg border p-2 text-xs ${
          isMatched ? "border-emerald-200 bg-emerald-50" :
          isOver ? "border-red-200 bg-red-50" :
          rows.length ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-gray-50"
        }`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {isMatched ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> :
               rows.length ? <AlertTriangle className={`w-3.5 h-3.5 ${isOver ? "text-red-600" : "text-amber-600"}`} /> :
               <AlertTriangle className="w-3.5 h-3.5 text-gray-400" />}
              <span className="text-gray-700">Client Type AUM: <span className="font-semibold">{formatCurrency(targetAmount)}</span></span>
            </div>
            {rows.length > 0 && (
              <div className="font-medium">
                <span className={isMatched ? "text-emerald-700" : isOver ? "text-red-700" : "text-amber-700"}>{formatCurrency(total)}</span>
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
          <div className="min-w-[760px] space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] font-medium text-gray-400 px-1">
              <div className={`${COL.product} text-center`}>Product</div>
              <div className={`${COL.amount} text-center`}>Amount</div>
              <div className={`${COL.gained} text-center`}>Assets Gained</div>
              <div className={`${COL.loss} text-center`}>Assets Loss</div>
              <div className={`${COL.net} text-center`}>Net Flows</div>
              <div className={COL.actions} />
            </div>
            {rows.map((row) => {
              const netFlow = toNumber(row.assets_gained) + toNumber(row.assets_loss);
              return (
                <div key={row.id} className="flex items-center gap-2">
                  <div className={COL.product}>
                    <div className="h-8 px-2 flex items-center text-sm text-gray-700 bg-gray-50 border rounded-md truncate" title={row.product_name}>
                      {row.product_name || "(unknown product)"}
                    </div>
                  </div>
                  <div className={COL.amount}>
                    <CurrencyInput
                      value={row.amount || ""}
                      onChange={(v) => updateRow(row.id, "amount", v)}
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
                  <div className={`${COL.actions} flex items-center justify-center`}>
                    <button type="button" onClick={() => deleteRow(row.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {availableProducts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 pt-1 border-t border-gray-100">
            <div className={COL.product}>
              <select
                value={newProductId}
                onChange={(e) => setNewProductId(e.target.value)}
                className="h-8 w-full text-sm border border-gray-200 rounded-md px-2 bg-white"
              >
                <option value="">Select product…</option>
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className={COL.amount}>
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
            <div className={`${COL.actions} flex items-center justify-center`}>
              <Button type="button" size="sm" className="h-8 gap-1 text-xs" disabled={!canAdd} onClick={addRow}>
                <Check className="w-3.5 h-3.5" /> Add
              </Button>
            </div>
          </div>
          {hasTarget && isUnder && (
            <div className="flex items-center justify-end gap-2 text-xs px-1">
              <span className="text-gray-500">Remaining: <span className="text-amber-600 font-semibold">{formatCurrency(underBy)}</span></span>
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
                title="Fill Amount, Assets Gained, and Assets Loss with the remaining balance from the client type row"
              >
                <Scale className="w-3 h-3" /> Use remaining
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}