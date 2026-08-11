import React, { useState, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, parseISO, parse } from "date-fns";
import { Plus, Trash2, Download, Upload, TrendingUp } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const genId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

function buildLevelOptions(portfolio) {
  const opts = [{ value: "portfolio", label: "Portfolio Total", refId: "" }];
  if (portfolio.advisor_type && portfolio.advisor_firm_id) {
    opts.push({
      value: "advisor",
      label: `${portfolio.advisor_type === "Manager of Managers" ? "MoM" : "IM"}: ${portfolio.advisor_firm_name || ""}`,
      refId: portfolio.advisor_firm_id,
    });
  }
  (portfolio.sub_managers || []).forEach((sm) => {
    opts.push({
      value: "sub_manager",
      label: `Sub-Manager: ${sm.product_name}`,
      refId: sm.product_id,
    });
  });
  return opts;
}

function parseFlexibleDate(str) {
  if (!str) return null;
  // Try MM/DD/YYYY
  let d = parse(str, "MM/dd/yyyy", new Date());
  if (!isNaN(d.getTime())) return d;
  // Try YYYY-MM-DD
  try {
    d = parseISO(str);
    if (!isNaN(d.getTime())) return d;
  } catch {}
  return null;
}

export default function PortfolioHistoricalAumTab({ portfolio }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [aumData, setAumData] = useState(portfolio.historical_aum || []);
  const [selectedLevel, setSelectedLevel] = useState("portfolio");
  const [selectedRefId, setSelectedRefId] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const levelOptions = useMemo(() => buildLevelOptions(portfolio), [portfolio]);

  const currentLevelLabel = useMemo(
    () =>
      levelOptions.find(
        (o) => o.value === selectedLevel && o.refId === (selectedRefId || "")
      )?.label || "Portfolio Total",
    [levelOptions, selectedLevel, selectedRefId]
  );

  const filteredAum = useMemo(() => {
    return aumData
      .filter(
        (a) =>
          a.level === selectedLevel &&
          (a.reference_id || "") === (selectedRefId || "")
      )
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [aumData, selectedLevel, selectedRefId]);

  const saveAum = async (newData) => {
    setSaving(true);
    try {
      const updated = await base44.entities.Portfolio.update(portfolio.id, {
        historical_aum: newData,
      });
      setAumData(updated.historical_aum || []);
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      toast({ title: "AUM data saved" });
    } catch (err) {
      toast({ title: "Failed to save AUM data", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddRow = () => {
    if (!newDate || !newValue) {
      toast({ title: "Please enter both date and value", variant: "destructive" });
      return;
    }
    const parsed = parseFlexibleDate(newDate);
    if (!parsed) {
      toast({ title: "Invalid date format", variant: "destructive" });
      return;
    }
    const row = {
      id: genId(),
      date: format(parsed, "yyyy-MM-dd"),
      value: parseFloat(newValue),
      level: selectedLevel,
      reference_id: selectedRefId || undefined,
      reference_name: currentLevelLabel,
    };
    saveAum([...aumData, row]);
    setNewDate("");
    setNewValue("");
  };

  const handleDeleteRow = (id) => {
    saveAum(aumData.filter((a) => a.id !== id));
  };

  const handleLevelChange = (e) => {
    const idx = parseInt(e.target.value);
    const opt = levelOptions[idx];
    setSelectedLevel(opt.value);
    setSelectedRefId(opt.refId || "");
  };

  const selectedLevelIdx = levelOptions.findIndex(
    (o) => o.value === selectedLevel && o.refId === (selectedRefId || "")
  );

  const downloadTemplate = () => {
    const csv = "Date,Value\nMM/DD/YYYY,1000000\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historical_aum_template_${selectedLevel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uploadTemplate = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      // Skip header row
      const newRows = lines
        .slice(1)
        .map((line) => {
          const parts = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
          const dateStr = parts[0];
          const valStr = parts[1];
          const parsed = parseFlexibleDate(dateStr);
          if (!parsed || !valStr) return null;
          return {
            id: genId(),
            date: format(parsed, "yyyy-MM-dd"),
            value: parseFloat(valStr) || 0,
            level: selectedLevel,
            reference_id: selectedRefId || undefined,
            reference_name: currentLevelLabel,
          };
        })
        .filter(Boolean);

      if (newRows.length === 0) {
        toast({ title: "No valid rows found in file", variant: "destructive" });
        return;
      }
      saveAum([...aumData, ...newRows]);
      toast({ title: `${newRows.length} rows imported` });
    } catch (err) {
      toast({ title: "Failed to parse file", variant: "destructive" });
    }
    e.target.value = "";
  };

  return (
    <div className="space-y-3 py-2">
      {/* Level selector */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs font-medium text-gray-600 mb-1 block">
            Show AUM for
          </Label>
          <select
            value={selectedLevelIdx >= 0 ? selectedLevelIdx : 0}
            onChange={handleLevelChange}
            className="w-full h-9 text-sm rounded-md border border-input bg-transparent px-2 focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {levelOptions.map((o, i) => (
              <option key={i} value={i}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs whitespace-nowrap"
          onClick={downloadTemplate}
        >
          <Download className="w-3.5 h-3.5" />
          Download Template
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs whitespace-nowrap"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-3.5 h-3.5" />
          Upload Template
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={uploadTemplate}
        />
      </div>

      {/* Add row */}
      <div className="flex items-end gap-2 p-2.5 rounded-lg border border-gray-200 bg-gray-50">
        <div className="flex-1">
          <Label className="text-xs font-medium text-gray-600 mb-1 block">
            Date (MM/DD/YYYY)
          </Label>
          <Input
            placeholder="MM/DD/YYYY"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="flex-1">
          <Label className="text-xs font-medium text-gray-600 mb-1 block">
            Value
          </Label>
          <Input
            type="number"
            step="0.01"
            placeholder="Enter value..."
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5 text-xs whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white"
          onClick={handleAddRow}
          disabled={saving}
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </Button>
      </div>

      {/* Table */}
      {filteredAum.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl flex items-center justify-center gap-2">
          <TrendingUp className="w-4 h-4 text-gray-300" />
          No AUM data recorded for {currentLevelLabel}
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="max-h-[300px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">
                    Date
                  </th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600 text-xs">
                    Value
                  </th>
                  <th className="w-10 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredAum.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-3 py-2 text-gray-800">
                      {row.date
                        ? format(parseISO(row.date), "MM/dd/yyyy")
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-800 font-medium">
                      {row.value != null
                        ? row.value.toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(row.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                        disabled={saving}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {saving && (
        <p className="text-xs text-gray-400 text-center">Saving...</p>
      )}
    </div>
  );
}