import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, parseISO, parse } from "date-fns";
import {
  Plus,
  Trash2,
  Download,
  Upload,
  ClipboardPaste,
  TrendingUp,
  Save,
  Loader2,
  BarChart3,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
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
  ReferenceLine,
} from "recharts";

const genId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

const buildTemplateHeaders = (entityLabel) => ["Month-End Date", `${entityLabel} AUM`, "Assets Gained", "Assets Loss"];

function parseFlexibleDate(str) {
  if (!str) return null;
  let d = parse(str, "MM/dd/yyyy", new Date());
  if (!isNaN(d.getTime())) return d;
  try {
    d = parseISO(str);
    if (!isNaN(d.getTime())) return d;
  } catch {}
  return null;
}

function fmtDisplay(iso) {
  if (!iso) return "";
  const d = parseISO(iso);
  return isNaN(d.getTime()) ? iso : format(d, "MM/dd/yyyy");
}

function toNumber(val) {
  if (val === null || val === undefined || val === "") return 0;
  const n = Number(String(val).replace(/[$,\s]/g, ""));
  return isNaN(n) ? 0 : n;
}

function parseCsvText(text) {
  const rows = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return rows;
  // detect delimiter
  const delim = lines[0].includes("\t") ? "\t" : ",";
  const split = (l) =>
    l.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));

  const headerCells = split(lines[0]).map((c) => c.toLowerCase());
  const idx = {
    date:
      headerCells.findIndex((h) =>
        ["month-end date", "month end date", "date", "month_end_date"].includes(h)
      ),
    aum: headerCells.findIndex((h) =>
      ["firm aum", "product aum", "aum", "firm aum (mm)", "product aum (mm)", "aum ($)"].includes(h)
    ),
    gained: headerCells.findIndex((h) =>
      ["assets gained", "gained", "inflows", "asset gained"].includes(h)
    ),
    loss: headerCells.findIndex((h) =>
      ["assets loss", "loss", "outflows", "asset loss", "assets lost"].includes(h)
    ),
  };
  const startRow = idx.date >= 0 ? 1 : 0;
  for (let i = startRow; i < lines.length; i++) {
    const cells = split(lines[i]);
    const dateStr = idx.date >= 0 ? cells[idx.date] : cells[0];
    const d = parseFlexibleDate(dateStr);
    if (!d) continue;
    const aum = idx.aum >= 0 ? toNumber(cells[idx.aum]) : 0;
    const gained = idx.gained >= 0 ? toNumber(cells[idx.gained]) : 0;
    const loss = idx.loss >= 0 ? toNumber(cells[idx.loss]) : 0;
    rows.push({
      id: genId(),
      month_end_date: format(d, "yyyy-MM-dd"),
      firm_aum: aum,
      assets_gained: gained,
      assets_loss: loss,
      net_asset_flows: gained - loss,
    });
  }
  return rows;
}

export default function FirmAumHistoryTab({ firmId, firmName, entityName = "Firm", entityLabel = "Firm" }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newAum, setNewAum] = useState("");
  const [newGained, setNewGained] = useState("");
  const [newLoss, setNewLoss] = useState("");
  const [showGainedLoss, setShowGainedLoss] = useState(true);
  const fileInputRef = useRef(null);
  const pasteRef = useRef(null);
  const entity = base44.entities[entityName];

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rec = await entity.get(firmId);
        if (!active) return;
        setRows(rec.aum_history || []);
      } catch (e) {
        toast({
          title: "Error loading AUM history",
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
  }, [firmId]);

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
        [`${entityLabel} AUM`]: r.firm_aum,
        "Assets Gained": r.assets_gained,
        "Assets Loss": r.assets_loss,
        "Net Flows": r.net_asset_flows,
      })),
    [sortedRows]
  );

  const handleAddRow = () => {
    if (!newDate) {
      toast({ title: "Month-end date is required", variant: "destructive" });
      return;
    }
    const d = parseFlexibleDate(newDate);
    if (!d) {
      toast({ title: "Invalid date format", description: "Use MM/DD/YYYY", variant: "destructive" });
      return;
    }
    const gained = toNumber(newGained);
    const loss = toNumber(newLoss);
    const aum = toNumber(newAum);
    setRows([
      ...rows,
      {
        id: genId(),
        month_end_date: format(d, "yyyy-MM-dd"),
        firm_aum: aum,
        assets_gained: gained,
        assets_loss: loss,
        net_asset_flows: gained - loss,
      },
    ]);
    setNewDate("");
    setNewAum("");
    setNewGained("");
    setNewLoss("");
  };

  const updateRow = (id, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === "assets_gained" || field === "assets_loss") {
          updated.net_asset_flows =
            toNumber(updated.assets_gained) - toNumber(updated.assets_loss);
        }
        return updated;
      })
    );
  };

  const deleteRow = (id) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const cleaned = sortedRows.map((r) => ({
        id: r.id,
        month_end_date: r.month_end_date,
        firm_aum: toNumber(r.firm_aum),
        assets_gained: toNumber(r.assets_gained),
        assets_loss: toNumber(r.assets_loss),
        net_asset_flows: toNumber(r.assets_gained) - toNumber(r.assets_loss),
      }));
      await entity.update(firmId, { aum_history: cleaned });
      setRows(cleaned);
      queryClient.invalidateQueries({ queryKey: [entityName.toLowerCase() + "s"] });
      queryClient.invalidateQueries({ queryKey: [entityName.toLowerCase(), firmId] });
      toast({ title: "AUM history saved" });
    } catch (e) {
      toast({
        title: "Error saving AUM history",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = () => {
    const csv = [buildTemplateHeaders(entityLabel).join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(firmName || entityLabel.toLowerCase()).replace(/\s+/g, "_")}_AUM_Template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadData = () => {
    const csv = [
      buildTemplateHeaders(entityLabel).join(","),
      ...sortedRows.map((r) =>
        [fmtDisplay(r.month_end_date), r.firm_aum, r.assets_gained, r.assets_loss].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(firmName || entityLabel.toLowerCase()).replace(/\s+/g, "_")}_AUM_History.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCsvText(ev.target.result);
      if (parsed.length === 0) {
        toast({ title: "No valid rows found in file", variant: "destructive" });
        return;
      }
      setRows((prev) => {
        // merge by month_end_date, replacing duplicates
        const map = new Map(prev.map((r) => [r.month_end_date, r]));
        parsed.forEach((r) => map.set(r.month_end_date, r));
        return Array.from(map.values());
      });
      toast({ title: `Imported ${parsed.length} rows` });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        toast({ title: "Clipboard is empty", variant: "destructive" });
        return;
      }
      const parsed = parseCsvText(text);
      if (parsed.length === 0) {
        toast({ title: "No valid rows found in clipboard", variant: "destructive" });
        return;
      }
      setRows((prev) => {
        const map = new Map(prev.map((r) => [r.month_end_date, r]));
        parsed.forEach((r) => map.set(r.month_end_date, r));
        return Array.from(map.values());
      });
      toast({ title: `Pasted ${parsed.length} rows` });
    } catch (e) {
      toast({
        title: "Could not read clipboard",
        description: "Try uploading a CSV file instead.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={downloadTemplate}
        >
          <Download className="w-3.5 h-3.5" />
          Download Template
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-3.5 h-3.5" />
          Upload CSV
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={handleUploadFile}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handlePaste}
        >
          <ClipboardPaste className="w-3.5 h-3.5" />
          Paste from Clipboard
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={downloadData}
          disabled={sortedRows.length === 0}
        >
          <Download className="w-3.5 h-3.5" />
          Export Data
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showGainedLoss}
              onChange={(e) => setShowGainedLoss(e.target.checked)}
              className="rounded"
            />
            Show Assets Gained / Loss
          </label>
          <Button
            type="button"
            size="sm"
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save
          </Button>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Upload, paste, or manually enter monthly AUM. Month-end date format: MM/DD/YYYY. Net Asset Flows auto-calculates as Assets Gained − Assets Loss.
      </p>

      {/* Chart */}
      {chartData.length > 0 ? (
        <div className="border rounded-xl p-4 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <h4 className="text-sm font-semibold text-gray-800">
              {entityLabel} AUM History {firmName ? `— ${firmName}` : ""}
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
              <Tooltip
                formatter={(v) => `$${Number(v).toLocaleString()}`}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey={`${entityLabel} AUM`}
                stroke="#4f46e5"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
              {showGainedLoss && (
                <>
                  <Bar dataKey="Assets Gained" fill="#16a34a" barSize={14} />
                  <Bar dataKey="Assets Loss" fill="#dc2626" barSize={14} />
                  <Line
                    type="monotone"
                    dataKey="Net Flows"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    strokeDasharray="4 2"
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-xl">
          No AUM data yet. Add a row below or upload/paste data to see the chart.
        </div>
      )}

      {/* Add row form */}
      <div className="border rounded-xl p-4 bg-gray-50 w-full">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-medium text-gray-700">Add Monthly Entry</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <Label className="text-xs text-gray-500 mb-1">Month-End Date</Label>
            <Input
              type="text"
              placeholder="MM/DD/YYYY"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1">{entityLabel} AUM ($)</Label>
            <Input
              type="number"
              placeholder="0"
              value={newAum}
              onChange={(e) => setNewAum(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1">Assets Gained ($)</Label>
            <Input
              type="number"
              placeholder="0"
              value={newGained}
              onChange={(e) => setNewGained(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1">Assets Loss ($)</Label>
            <Input
              type="number"
              placeholder="0"
              value={newLoss}
              onChange={(e) => setNewLoss(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1">Net Flow ($)</Label>
            <div className="h-9 px-3 flex items-center text-sm font-medium rounded-md border border-gray-200 bg-white">
              <span
                className={
                  (toNumber(newGained) - toNumber(newLoss)) >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                {(toNumber(newGained) - toNumber(newLoss)).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              size="sm"
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white w-full h-9"
              onClick={handleAddRow}
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* Data table */}
      {sortedRows.length > 0 && (
        <div className="border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Month-End Date</th>
                  <th className="text-right font-medium px-3 py-2">{entityLabel} AUM</th>
                  <th className="text-right font-medium px-3 py-2">Assets Gained</th>
                  <th className="text-right font-medium px-3 py-2">Assets Loss</th>
                  <th className="text-right font-medium px-3 py-2">Net Asset Flows</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-1.5">
                       <Input
                         type="text"
                         value={fmtDisplay(r.month_end_date)}
                         onChange={(e) => {
                           const d = parseFlexibleDate(e.target.value);
                           updateRow(r.id, "month_end_date", d ? format(d, "yyyy-MM-dd") : e.target.value);
                         }}
                         className="h-8 text-sm w-full min-w-[120px]"
                       />
                     </td>
                     <td className="px-3 py-1.5">
                       <Input
                         type="number"
                         value={r.firm_aum ?? ""}
                         onChange={(e) => updateRow(r.id, "firm_aum", toNumber(e.target.value))}
                         className="h-8 text-sm text-right w-full min-w-[120px]"
                       />
                     </td>
                     <td className="px-3 py-1.5">
                       <Input
                         type="number"
                         value={r.assets_gained ?? ""}
                         onChange={(e) => updateRow(r.id, "assets_gained", toNumber(e.target.value))}
                         className="h-8 text-sm text-right w-full min-w-[120px]"
                       />
                     </td>
                     <td className="px-3 py-1.5">
                       <Input
                         type="number"
                         value={r.assets_loss ?? ""}
                         onChange={(e) => updateRow(r.id, "assets_loss", toNumber(e.target.value))}
                         className="h-8 text-sm text-right w-full min-w-[120px]"
                       />
                     </td>
                    <td className="px-3 py-1.5 text-right text-sm font-medium">
                      <span
                        className={
                          (r.net_asset_flows ?? 0) >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }
                      >
                        {(r.net_asset_flows ?? 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => deleteRow(r.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}