import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Trash2, AlertCircle, Download, Upload, ClipboardPaste } from "lucide-react";
import { format, parseISO, addMonths, endOfMonth, startOfMonth, subMonths } from "date-fns";

function formatReturn(val) {
  if (val === null || val === undefined || val === "") return "";
  return Number(val).toFixed(4);
}

function parseCSVText(text) {
  const lines = text.trim().split(/\r?\n/);
  const results = [];
  const errors = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip header row if present
    if (i === 0 && /date/i.test(line)) continue;

    const parts = line.split(",");
    if (parts.length < 2) {
      errors.push(`Row ${i + 1}: invalid format`);
      continue;
    }

    const dateRaw = parts[0].trim();
    const returnRaw = parts[1].trim();

    // Parse date — accept YYYY-MM-DD or MM/DD/YYYY
    let dateStr = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
      dateStr = dateRaw;
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateRaw)) {
      const [m, d, y] = dateRaw.split("/");
      dateStr = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    } else {
      errors.push(`Row ${i + 1}: unrecognized date "${dateRaw}"`);
      continue;
    }

    const returnVal = parseFloat(returnRaw);
    if (isNaN(returnVal)) {
      errors.push(`Row ${i + 1}: invalid return value "${returnRaw}"`);
      continue;
    }

    results.push({ date: dateStr, return_value: returnVal });
  }

  return { results, errors };
}

function getMonthEnd(date) {
  return endOfMonth(date);
}

function generateTemplateRows(startDate, endDate) {
  const rows = [];
  let cur = startOfMonth(startDate);
  const end = startOfMonth(endDate);
  while (cur <= end) {
    rows.push(`${format(getMonthEnd(cur), "yyyy-MM-dd")},`);
    cur = addMonths(cur, 1);
  }
  return rows;
}

function downloadTemplate(startDate, endDate) {
  const header = "Date,Return (%)";
  const rows = generateTemplateRows(startDate, endDate);
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "benchmark_returns_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function BenchmarkReturnsTab({ returns = [], onChange, isEditing, inceptionDate = null }) {
  const [newDate, setNewDate] = useState(null);
  const [newReturn, setNewReturn] = useState("");
  const [calOpen, setCalOpen] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [parseErrors, setParseErrors] = useState([]);
  const [showTemplateOptions, setShowTemplateOptions] = useState(false);
  const [templateStartCalOpen, setTemplateStartCalOpen] = useState(false);
  const [templateEndCalOpen, setTemplateEndCalOpen] = useState(false);
  const fileInputRef = useRef(null);

  // Compute default template date range from inceptionDate
  const defaultTemplateStart = () => {
    if (inceptionDate) {
      const inc = typeof inceptionDate === "string" ? parseISO(inceptionDate) : inceptionDate;
      return endOfMonth(addMonths(inc, 1));
    }
    return endOfMonth(subMonths(new Date(), 12));
  };
  const defaultTemplateEnd = () => endOfMonth(subMonths(new Date(), 1));

  const [templateStart, setTemplateStart] = useState(null);
  const [templateEnd, setTemplateEnd] = useState(null);

  const effectiveTemplateStart = templateStart ?? defaultTemplateStart();
  const effectiveTemplateEnd = templateEnd ?? defaultTemplateEnd();

  const handleOpenTemplate = () => {
    // Reset to defaults each time
    setTemplateStart(defaultTemplateStart());
    setTemplateEnd(defaultTemplateEnd());
    setShowTemplateOptions(true);
  };

  // Returns true if a date string (YYYY-MM-DD) is on or before the inception date
  const isBeforeOrOnInception = (dateStr) => {
    if (!inceptionDate) return false;
    const inceptionStr = typeof inceptionDate === "string"
      ? inceptionDate
      : format(inceptionDate, "yyyy-MM-dd");
    return dateStr <= inceptionStr;
  };

  const sorted = [...returns].sort((a, b) => a.date < b.date ? 1 : -1);

  const handleAdd = () => {
    if (!newDate || newReturn === "") return;
    const dateStr = format(newDate, "yyyy-MM-dd");
    if (isBeforeOrOnInception(dateStr)) {
      setDuplicateWarning(`Returns on or before the inception date (${format(parseISO(typeof inceptionDate === "string" ? inceptionDate : format(inceptionDate, "yyyy-MM-dd")), "MM/dd/yyyy")}) are not allowed.`);
      return;
    }
    if (returns.some(r => r.date === dateStr)) {
      setDuplicateWarning(`A return for ${format(newDate, "MM/dd/yyyy")} already exists.`);
      return;
    }
    setDuplicateWarning(null);
    onChange([...returns, { date: dateStr, return_value: parseFloat(newReturn) }]);
    setNewDate(null);
    setNewReturn("");
  };

  const handleDelete = (date) => {
    onChange(returns.filter(r => r.date !== date));
  };

  const handleReturnEdit = (date, val) => {
    onChange(returns.map(r => r.date === date ? { ...r, return_value: parseFloat(val) } : r));
  };

  const handleImportCSV = (text) => {
    const { results, errors } = parseCSVText(text);

    // Filter out rows on or before inception date
    const blocked = [];
    const allowed = [];
    results.forEach(r => {
      if (isBeforeOrOnInception(r.date)) {
        blocked.push(`Row with date ${r.date}: on or before inception date — skipped.`);
      } else {
        allowed.push(r);
      }
    });

    setParseErrors([...errors, ...blocked]);
    if (allowed.length === 0) return;

    // Merge: new rows override existing rows with same date
    const existingMap = Object.fromEntries(returns.map(r => [r.date, r]));
    allowed.forEach(r => { existingMap[r.date] = r; });
    onChange(Object.values(existingMap));
    setPasteText("");
    setShowPaste(false);
  };

  const handlePasteSubmit = () => {
    handleImportCSV(pasteText);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => handleImportCSV(ev.target.result);
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-500">Monthly gross returns stored as a percentage (e.g. 1.5000 = 1.5%).</p>

        {isEditing && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={handleOpenTemplate}
            >
              <Download className="w-3.5 h-3.5" />
              Template
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={() => setShowPaste(!showPaste)}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              Paste CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        )}
      </div>

      {/* Template date range picker */}
      {isEditing && showTemplateOptions && (
        <div className="space-y-3 p-3 bg-gray-50 border rounded-lg">
          <p className="text-xs font-medium text-gray-600">Select date range for template</p>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-gray-500">Start (first month end)</Label>
              <Popover open={templateStartCalOpen} onOpenChange={setTemplateStartCalOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-8 w-40 justify-start text-left font-normal text-xs">
                    <CalendarIcon className="mr-1.5 h-3 w-3 text-gray-400" />
                    {effectiveTemplateStart ? format(effectiveTemplateStart, "MM/dd/yyyy") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={effectiveTemplateStart}
                    onSelect={(d) => { if (d) setTemplateStart(endOfMonth(d)); setTemplateStartCalOpen(false); }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-gray-500">End (last month end)</Label>
              <Popover open={templateEndCalOpen} onOpenChange={setTemplateEndCalOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-8 w-40 justify-start text-left font-normal text-xs">
                    <CalendarIcon className="mr-1.5 h-3 w-3 text-gray-400" />
                    {effectiveTemplateEnd ? format(effectiveTemplateEnd, "MM/dd/yyyy") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={effectiveTemplateEnd}
                    onSelect={(d) => { if (d) setTemplateEnd(endOfMonth(d)); setTemplateEndCalOpen(false); }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {effectiveTemplateStart > effectiveTemplateEnd && (
            <p className="text-xs text-red-500">Start date must be before end date.</p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs h-8"
              disabled={effectiveTemplateStart > effectiveTemplateEnd}
              onClick={() => { downloadTemplate(effectiveTemplateStart, effectiveTemplateEnd); setShowTemplateOptions(false); }}
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => setShowTemplateOptions(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Paste area */}
      {isEditing && showPaste && (
        <div className="space-y-2 p-3 bg-gray-50 border rounded-lg">
          <Label className="text-xs font-medium text-gray-600">Paste CSV data (Date, Return %)</Label>
          <textarea
            className="w-full h-32 text-sm border rounded px-3 py-2 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none"
            placeholder={"Date,Return (%)\n2024-12-31,1.2500\n2024-11-30,-0.4800"}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs h-8"
              onClick={handlePasteSubmit}
              disabled={!pasteText.trim()}
            >
              Import
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => { setShowPaste(false); setPasteText(""); setParseErrors([]); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <div className="flex gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-700">
            <p className="font-medium">Some rows could not be imported:</p>
            <ul className="list-disc ml-4 mt-1 space-y-0.5">
              {parseErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* Manual add row */}
      {isEditing && (
        <div className="flex items-end gap-2 p-3 bg-gray-50 rounded-lg border flex-wrap mt-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-gray-600">Date</Label>
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 w-44 justify-start text-left font-normal text-sm"
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5 text-gray-400" />
                  {newDate ? format(newDate, "MM/dd/yyyy") : <span className="text-gray-400">Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={newDate}
                  onSelect={(d) => { setNewDate(d); setCalOpen(false); }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-gray-600">Return (%)</Label>
            <Input
              type="number"
              step="0.0001"
              placeholder="e.g. 1.2500"
              value={newReturn}
              onChange={(e) => setNewReturn(e.target.value)}
              className="h-9 w-36 text-sm"
            />
          </div>

          <Button
            type="button"
            onClick={handleAdd}
            disabled={!newDate || newReturn === ""}
            className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </Button>
        </div>
      )}

      {/* Duplicate warning */}
      {duplicateWarning && (
        <div className="flex gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-700">{duplicateWarning}</p>
        </div>
      )}

      {/* Returns table */}
      {sorted.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400 border border-dashed rounded-lg">
          No returns data yet.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs uppercase tracking-wide">Date</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600 text-xs uppercase tracking-wide">Gross Return (%)</th>
                {isEditing && <th className="w-10" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((r) => (
                <tr key={r.date} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-800 font-medium">
                    {format(parseISO(r.date), "MM/dd/yyyy")}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.0001"
                        defaultValue={formatReturn(r.return_value)}
                        onBlur={(e) => handleReturnEdit(r.date, e.target.value)}
                        className="w-28 text-right border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    ) : (
                      <span className={`font-mono ${r.return_value >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {r.return_value >= 0 ? "+" : ""}{formatReturn(r.return_value)}%
                      </span>
                    )}
                  </td>
                  {isEditing && (
                    <td className="px-2 py-2.5 text-right">
                      <button
                        onClick={() => handleDelete(r.date)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}