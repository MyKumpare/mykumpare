import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, AlertTriangle, CheckCircle2, Loader2, Scale } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ClientTypePicker, { CLIENT_TYPE_PRESETS } from "./ClientTypePicker";

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
 * Reusable client-type AUM breakdown editor for Firm and Product entities.
 *
 * Props:
 *  - entityId: string
 *  - entityName: "Firm" | "Product"
 *  - entityLabel: "Firm" | "Product" (display)
 */
export default function ClientTypeBreakdownSection({ entityId, entityName = "Firm", entityLabel = "Firm" }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const entity = base44.entities[entityName];

  const [rows, setRows] = useState([]);
  const [totalAum, setTotalAum] = useState(null); // latest firm/product AUM from aum_history
  const [totalAumDate, setTotalAumDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rec = await entity.get(entityId);
        if (!active) return;
        setRows(rec.client_type_breakdown || []);
        // Derive the latest AUM from aum_history (most recent month-end).
        const history = rec.aum_history || [];
        if (history.length > 0) {
          const latest = [...history].sort((a, b) =>
            (b.month_end_date || "").localeCompare(a.month_end_date || "")
          )[0];
          setTotalAum(toNumber(latest.firm_aum));
          setTotalAumDate(latest.month_end_date || "");
        } else {
          setTotalAum(null);
          setTotalAumDate("");
        }
      } catch (e) {
        toast({ title: "Error loading client type breakdown", description: e.message, variant: "destructive" });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [entityId]);

  const breakdownTotal = useMemo(
    () => rows.reduce((sum, r) => sum + toNumber(r.aum_amount), 0),
    [rows]
  );

  const hasTotalAum = totalAum != null;
  const overBy = hasTotalAum ? Math.max(0, breakdownTotal - totalAum) : 0;
  const underBy = hasTotalAum ? Math.max(0, totalAum - breakdownTotal) : 0;
  const isOver = overBy > 0;
  const isUnder = underBy > 0;
  const isMatched = hasTotalAum && breakdownTotal === totalAum;
  const hasRows = rows.length > 0;

  const addRow = () => {
    setRows((prev) => [...prev, { id: genId(), client_type: "", aum_amount: 0 }]);
  };

  const updateRow = (id, field, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const deleteRow = (id) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Force the breakdown total to equal the entity AUM by adding (or adjusting)
  // the balance into the "Other" client type row.
  const forceMatch = () => {
    if (!hasTotalAum) return;
    if (isOver) {
      toast({
        title: "Cannot force match",
        description: `Total exceeds ${entityLabel} AUM by ${formatCurrency(overBy)}. Reduce individual rows first.`,
        variant: "destructive",
      });
      return;
    }
    if (underBy === 0) {
      toast({ title: "Already matched", description: "The breakdown total already equals the AUM." });
      return;
    }
    setRows((prev) => {
      const existing = prev.find((r) => r.client_type === OTHER_TYPE);
      if (existing) {
        return prev.map((r) =>
          r.id === existing.id ? { ...r, aum_amount: toNumber(r.aum_amount) + underBy } : r
        );
      }
      return [...prev, { id: genId(), client_type: OTHER_TYPE, aum_amount: underBy }];
    });
    toast({
      title: "Balance added to Other",
      description: `${formatCurrency(underBy)} added to the "${OTHER_TYPE}" client type.`,
    });
  };

  const handleSave = async () => {
    // Validate: no duplicate client types, no empty client types, total <= firm AUM.
    const seen = new Set();
    for (const r of rows) {
      if (!r.client_type) {
        toast({ title: "Missing client type", description: "Every row needs a client type selected.", variant: "destructive" });
        return;
      }
      if (seen.has(r.client_type)) {
        toast({ title: "Duplicate client type", description: `"${r.client_type}" appears more than once. Remove the duplicate.`, variant: "destructive" });
        return;
      }
      seen.add(r.client_type);
    }
    if (hasTotalAum && breakdownTotal > totalAum) {
      toast({
        title: "Total exceeds AUM",
        description: `The breakdown total (${formatCurrency(breakdownTotal)}) exceeds the ${entityLabel} AUM (${formatCurrency(totalAum)}).`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const cleaned = rows.map((r) => ({
        id: r.id,
        client_type: r.client_type,
        aum_amount: toNumber(r.aum_amount),
      }));
      await entity.update(entityId, { client_type_breakdown: cleaned });
      setRows(cleaned);
      queryClient.invalidateQueries({ queryKey: [entityName.toLowerCase() + "s"] });
      queryClient.invalidateQueries({ queryKey: [entityName.toLowerCase(), entityId] });
      toast({ title: "✅ Client type breakdown saved" });
    } catch (e) {
      toast({ title: "Error saving", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <div
        className={`rounded-lg border p-3 ${
          !hasTotalAum
            ? "border-gray-200 bg-gray-50"
            : isMatched
            ? "border-emerald-200 bg-emerald-50"
            : isOver
            ? "border-red-200 bg-red-50"
            : "border-amber-200 bg-amber-50"
        }`}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {!hasTotalAum ? (
              <AlertTriangle className="w-4 h-4 text-gray-400" />
            ) : isMatched ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className={`w-4 h-4 ${isOver ? "text-red-600" : "text-amber-600"}`} />
            )}
            <div className="text-sm">
              {!hasTotalAum ? (
                <span className="text-gray-600">
                  No AUM history yet — add AUM history entries first to enable total validation.
                </span>
              ) : (
                <span className="text-gray-800">
                  {entityLabel} AUM: <span className="font-semibold">{formatCurrency(totalAum)}</span>
                  {totalAumDate && <span className="text-gray-500 text-xs ml-2">({totalAumDate})</span>}
                </span>
              )}
            </div>
          </div>
          {hasTotalAum && (
            <div className="text-sm font-medium">
              <span className={isMatched ? "text-emerald-700" : isOver ? "text-red-700" : "text-amber-700"}>
                Breakdown: {formatCurrency(breakdownTotal)}
              </span>
              {isOver && (
                <span className="text-red-700 text-xs ml-2">(over by {formatCurrency(overBy)})</span>
              )}
              {isUnder && (
                <span className="text-amber-700 text-xs ml-2">(under by {formatCurrency(underBy)})</span>
              )}
              {isMatched && (
                <span className="text-emerald-700 text-xs ml-2">✓ matched</span>
              )}
            </div>
          )}
        </div>

        {/* Discrepancy visual bar */}
        {hasTotalAum && hasRows && !isMatched && (
          <div className="mt-3">
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden flex">
              <div
                className={`h-full ${isOver ? "bg-red-500" : "bg-amber-500"}`}
                style={{ width: `${Math.min(100, (breakdownTotal / totalAum) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>$0</span>
              <span>{formatCurrency(totalAum)} (target)</span>
            </div>
          </div>
        )}
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {rows.length === 0 && (
          <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
            No client types added yet. Click "Add Client Type" to break down the AUM.
          </div>
        )}
        {rows.map((row) => {
          const usedNames = rows.filter((r) => r.id !== row.id).map((r) => r.client_type).filter(Boolean);
          return (
            <div key={row.id} className="flex items-start gap-2">
              <div className="flex-1">
                <ClientTypePicker
                  value={row.client_type}
                  onChange={(name) => updateRow(row.id, "client_type", name)}
                  excludeNames={usedNames}
                />
              </div>
              <div className="w-40">
                <Input
                  type="number"
                  min="0"
                  placeholder="AUM amount"
                  value={row.aum_amount || ""}
                  onChange={(e) => updateRow(row.id, "aum_amount", e.target.value === "" ? 0 : Number(e.target.value))}
                  className="h-9"
                />
              </div>
              <button
                type="button"
                onClick={() => deleteRow(row.id)}
                className="p-2 text-gray-400 hover:text-red-500"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button type="button" variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs" onClick={addRow}>
          <Plus className="w-3.5 h-3.5" /> Add Client Type
        </Button>
        {hasTotalAum && isUnder && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-amber-700 border-amber-300 hover:bg-amber-50 gap-1 text-xs"
            onClick={forceMatch}
            title={`Add ${formatCurrency(underBy)} to "${OTHER_TYPE}" to match the ${entityLabel} AUM`}
          >
            <Scale className="w-3.5 h-3.5" /> Force Match to AUM
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white gap-1 text-xs"
          onClick={handleSave}
          disabled={saving || (hasTotalAum && isOver)}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Save Breakdown
        </Button>
      </div>
    </div>
  );
}