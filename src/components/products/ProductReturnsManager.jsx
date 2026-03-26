import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Trash2, AlertCircle, Download, Upload, ClipboardPaste, Trash } from "lucide-react";
import { format, parseISO, addMonths, endOfMonth, startOfMonth, subMonths } from "date-fns";
import ImportConflictReview from "@/components/utility/ImportConflictReview";

function formatReturn(val) {
  if (val === null || val === undefined || val === "") return "";
  return Number(val).toFixed(4);
}

function parseCSVText(text, expectNetReturn = false) {
  const lines = text.trim().split(/\r?\n/);
  const results = [];
  const errors = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (i === 0 && /date/i.test(line)) continue;

    const parts = line.split(",");
    if (parts.length < 2) {
      errors.push(`Row ${i + 1}: invalid format`);
      continue;
    }

    const dateRaw = parts[0].trim();
    const returnRaw = parts[1].trim();
    const netReturnRaw = parts[2]?.trim();

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

    const entry = { date: dateStr, return_value: returnVal };
    if (expectNetReturn && netReturnRaw) {
      const netVal = parseFloat(netReturnRaw);
      if (!isNaN(netVal)) {
        entry.net_return = netVal;
      }
    }

    results.push(entry);
  }

  return { results, errors };
}

function generateTemplateMonths(startDate, endDate) {
  const months = [];
  let cur = startOfMonth(startDate);
  const end = startOfMonth(endDate);
  while (cur <= end) {
    months.push(format(endOfMonth(cur), "yyyy-MM-dd"));
    cur = addMonths(cur, 1);
  }
  return months;
}

function downloadTemplate(startDate, endDate, existingReturns = []) {
  const existingMap = Object.fromEntries(existingReturns.map(r => [r.date, r.return_value]));
  const months = generateTemplateMonths(startDate, endDate);
  const header = "Date,Return (%)";
  const rows = months.map(dateStr => {
    const val = existingMap[dateStr];
    return val !== undefined ? `${dateStr},${val}` : `${dateStr},`;
  });
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "product_returns_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ProductReturnsManager({ returns = [], onChange, isEditing, inceptionDate = null, seriesName = "", showNetReturn = false }) {
  const [newDate, setNewDate] = useState(null);
  const [newReturn, setNewReturn] = useState("");
  const [calOpen, setCalOpen] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [parseErrors, setParseErrors] = useState([]);
  const [conflictState, setConflictState] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [showTemplateOptions, setShowTemplateOptions] = useState(false);
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [downloadStartCalOpen, setDownloadStartCalOpen] = useState(false);
  const [downloadEndCalOpen, setDownloadEndCalOpen] = useState(false);
  const [downloadStart, setDownloadStart] = useState(null);
  const [downloadEnd, setDownloadEnd] = useState(null);
  const [downloadFormat, setDownloadFormat] = useState("percentage");
  const [templateStartCalOpen, setTemplateStartCalOpen] = useState(false);
  const [templateEndCalOpen, setTemplateEndCalOpen] = useState(false);
  const fileInputRef = useRef(null);

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

  const dataDatesSorted = [...returns].map(r => r.date).sort();
  const firstDataDate = dataDatesSorted.length > 0 ? parseISO(dataDatesSorted[0]) : null;
  const lastDataDate = dataDatesSorted.length > 0 ? parseISO(dataDatesSorted[dataDatesSorted.length - 1]) : null;

  const effectiveDownloadStart = downloadStart ?? firstDataDate;
  const effectiveDownloadEnd = downloadEnd ?? lastDataDate;

  const handleOpenDownload = () => {
    setDownloadStart(null);
    setDownloadEnd(null);
    setDownloadFormat("percentage");
    setShowDownloadOptions(true);
    setShowTemplateOptions(false);
  };

  const handleDownloadData = () => {
    if (!effectiveDownloadStart || !effectiveDownloadEnd) return;
    const startStr = format(effectiveDownloadStart, "yyyy-MM-dd");
    const endStr = format(effectiveDownloadEnd, "yyyy-MM-dd");
    const filtered = [...returns]
      .filter(r => r.date >= startStr && r.date <= endStr)
      .sort((a, b) => a.date < b.date ? -1 : 1);

    let headerParts = ["Date", downloadFormat === "percentage" ? "Gross Return (%)" : "Gross Return (decimal)"];
    if (showNetReturn) {
      headerParts.push(downloadFormat === "percentage" ? "Net Return (%)" : "Net Return (decimal)");
    }
    const header = headerParts.join(",");

    const rows = filtered.map(r => {
      const grossVal = downloadFormat === "percentage" ? r.return_value : (r.return_value / 100);
      let row = `${r.date},${grossVal.toFixed(6)}`;
      if (showNetReturn) {
        const netVal = r.net_return !== undefined ? (downloadFormat === "percentage" ? r.net_return : (r.net_return / 100)) : "";
        row += `,${netVal ? netVal.toFixed(6) : ""}`;
      }
      return row;
    });

    const nameComment = seriesName ? `# ${seriesName}\n` : "";
    const csv = nameComment + [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = seriesName ? seriesName.replace(/[^a-z0-9]/gi, "_").toLowerCase() : "returns";
    a.download = `${safeName}_returns.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowDownloadOptions(false);
  };

  const handleOpenTemplate = () => {
    setTemplateStart(defaultTemplateStart());
    setTemplateEnd(defaultTemplateEnd());
    setShowTemplateOptions(true);
    setShowDownloadOptions(false);
  };

  const isBeforeOrOnInception = (dateStr) => {
    if (!inceptionDate) return false;
    const inceptionStr = typeof inceptionDate === "string"
      ? inceptionDate
      : format(inceptionDate, "yyyy-MM-dd");
    return dateStr <= inceptionStr;
  };

  const sorted = [...returns].sort((a, b) => a.date < b.date ? 1 : -1);

  const [newNetReturn, setNewNetReturn] = useState("");

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
    const newEntry = { date: dateStr, return_value: parseFloat(newReturn) };
    if (showNetReturn && newNetReturn !== "") {
      newEntry.net_return = parseFloat(newNetReturn);
    }
    onChange([...returns, newEntry]);
    setNewDate(null);
    setNewReturn("");
    setNewNetReturn("");
  };

  const handleDelete = (date) => {
    onChange(returns.filter(r => r.date !== date));
  };

  const handleReturnEdit = (date, val, isNetReturn = false) => {
    onChange(returns.map(r => {
      if (r.date === date) {
        if (isNetReturn) {
          return { ...r, net_return: val ? parseFloat(val) : undefined };
        } else {
          return { ...r, return_value: parseFloat(val) };
        }
      }
      return r;
    }));
  };

  const applyImport = (allowed, acceptedDates) => {
    const existingMap = Object.fromEntries(returns.map(r => [r.date, r]));
    allowed.forEach(r => {
      const isConflict = existingMap[r.date] !== undefined;
      if (!isConflict || acceptedDates.has(r.date)) {
        existingMap[r.date] = r;
      }
    });
    onChange(Object.values(existingMap));
    setPasteText("");
    setShowPaste(false);
    setConflictState(null);
  };

  const handleImportCSV = (text) => {
    const { results, errors } = parseCSVText(text, showNetReturn);

    const blocked = [];
    const allowed = [];
    results.forEach(r => {
      if (isBeforeOrOnInception(r.date)) {
        blocked.push(`Row with date ${r.date}: on or before inception date — skipped.`);
      } else {
        allowed.push(r);
      }
    });

    const allErrors = [...errors, ...blocked];
    if (allowed.length === 0) {
      setParseErrors(allErrors);
      return;
    }

    const existingMap = Object.fromEntries(returns.map(r => [r.date, r.return_value]));
    const conflicts = [];
    const newRows = [];
    allowed.forEach(r => {
      if (existingMap[r.date] !== undefined) {
        conflicts.push({ date: r.date, existing_value: existingMap[r.date], incoming_value: r.return_value });
      } else {
        newRows.push(r);
      }
    });

    if (conflicts.length > 0) {
      setConflictState({ conflicts, newRows, allowed, errors: allErrors });
      setParseErrors([]);
    } else {
      setParseErrors(allErrors);
      applyImport(allowed, new Set());
    }
  };

  const handleConflictConfirm = (acceptedDates) => {
    applyImport(conflictState.allowed, acceptedDates);
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
      {/* Toolbar */}
      <div className="rounded-lg border bg-gray-50 p-3 space-y-2.5">
        <p className="text-xs text-gray-500">Monthly gross returns stored as a percentage (e.g. 1.5000 = 1.5%).</p>
        <div className="flex items-center gap-2 flex-wrap">
          {returns.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8 bg-white"
              onClick={handleOpenDownload}
            >
              <Download className="w-3.5 h-3.5" />
              Download Data
            </Button>
          )}
          {isEditing && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8 bg-white"
                onClick={handleOpenTemplate}
              >
                <Download className="w-3.5 h-3.5" />
                Template
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8 bg-white"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8 bg-white"
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
              {returns.length > 0 && !confirmDeleteAll && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-8 bg-white text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 ml-auto"
                  onClick={() => setConfirmDeleteAll(true)}
                >
                  <Trash className="w-3.5 h-3.5" />
                  Delete All
                </Button>
              )}
              {confirmDeleteAll && (
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-red-600 font-medium">Delete all {returns.length} records?</span>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white px-3"
                    onClick={() => { onChange([]); setConfirmDeleteAll(false); }}
                  >
                    Confirm
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-3"
                    onClick={() => setConfirmDeleteAll(false)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Download data panel */}
      {showDownloadOptions && (() => {
        const isInvalid = !effectiveDownloadStart || !effectiveDownloadEnd || effectiveDownloadStart > effectiveDownloadEnd;
        const startStr = effectiveDownloadStart ? format(effectiveDownloadStart, "yyyy-MM-dd") : null;
        const endStr = effectiveDownloadEnd ? format(effectiveDownloadEnd, "yyyy-MM-dd") : null;
        const count = (!isInvalid && startStr && endStr)
          ? returns.filter(r => r.date >= startStr && r.date <= endStr).length
          : 0;
        return (
          <div className="space-y-3 p-3 bg-gray-50 border rounded-lg">
            <p className="text-xs font-medium text-gray-600">Download returns data</p>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-gray-500">Start</Label>
                <Popover open={downloadStartCalOpen} onOpenChange={setDownloadStartCalOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-8 w-40 justify-start text-left font-normal text-xs">
                      <CalendarIcon className="mr-1.5 h-3 w-3 text-gray-400" />
                      {effectiveDownloadStart ? format(effectiveDownloadStart, "MM/dd/yyyy") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={effectiveDownloadStart}
                      onSelect={(d) => { if (d) setDownloadStart(endOfMonth(d)); setDownloadStartCalOpen(false); }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-gray-500">End</Label>
                <Popover open={downloadEndCalOpen} onOpenChange={setDownloadEndCalOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-8 w-40 justify-start text-left font-normal text-xs">
                      <CalendarIcon className="mr-1.5 h-3 w-3 text-gray-400" />
                      {effectiveDownloadEnd ? format(effectiveDownloadEnd, "MM/dd/yyyy") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={effectiveDownloadEnd}
                      onSelect={(d) => { if (d) setDownloadEnd(endOfMonth(d)); setDownloadEndCalOpen(false); }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs text-gray-500">Format</Label>
              <div className="flex gap-1">
                <button
                  onClick={() => setDownloadFormat("percentage")}
                  className={`px-3 py-1 text-xs rounded border transition-colors ${downloadFormat === "percentage" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                >
                  Percentage (e.g. 1.5000)
                </button>
                <button
                  onClick={() => setDownloadFormat("decimal")}
                  className={`px-3 py-1 text-xs rounded border transition-colors ${downloadFormat === "decimal" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                >
                  Decimal (e.g. 0.015000)
                </button>
              </div>
            </div>

            {isInvalid && effectiveDownloadStart && effectiveDownloadEnd && (
              <p className="text-xs text-red-500">Start date must be before end date.</p>
            )}
            {!isInvalid && (
              <p className="text-xs text-gray-500">{count} month{count !== 1 ? "s" : ""} will be exported.</p>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs h-8"
                disabled={isInvalid || count === 0}
                onClick={handleDownloadData}
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => setShowDownloadOptions(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        );
      })()}

      {/* Template date range picker */}
      {isEditing && showTemplateOptions && (() => {
        const isInvalid = effectiveTemplateStart > effectiveTemplateEnd;
        const existingMap = Object.fromEntries(returns.map(r => [r.date, r.return_value]));
        const months = isInvalid ? [] : generateTemplateMonths(effectiveTemplateStart, effectiveTemplateEnd);
        const missingCount = months.filter(d => existingMap[d] === undefined).length;
        const filledCount = months.length - missingCount;
        return (
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

            {isInvalid && <p className="text-xs text-red-500">Start date must be before end date.</p>}

            {!isInvalid && months.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{months.length} month{months.length !== 1 ? "s" : ""} total</span>
                  {filledCount > 0 && <span className="text-green-700 font-medium">· {filledCount} already in system</span>}
                  {missingCount > 0 && <span className="text-amber-600 font-medium">· {missingCount} missing</span>}
                </div>
                <div className="max-h-40 overflow-y-auto border rounded bg-white divide-y divide-gray-100">
                  {months.map(dateStr => {
                    const val = existingMap[dateStr];
                    const hasData = val !== undefined;
                    return (
                      <div key={dateStr} className={`flex items-center justify-between px-3 py-1.5 text-xs ${hasData ? "text-gray-700" : "text-amber-700 bg-amber-50"}`}>
                        <span className="font-mono">{format(parseISO(dateStr), "MMM yyyy")}</span>
                        {hasData
                          ? <span className={`font-mono ${val >= 0 ? "text-green-700" : "text-red-600"}`}>{val >= 0 ? "+" : ""}{Number(val).toFixed(4)}%</span>
                          : <span className="text-amber-500 italic">missing</span>
                        }
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs h-8"
                disabled={isInvalid || months.length === 0}
                onClick={() => { downloadTemplate(effectiveTemplateStart, effectiveTemplateEnd, returns); setShowTemplateOptions(false); }}
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
        );
      })()}

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

      {/* Conflict review */}
      {conflictState && (
        <ImportConflictReview
          conflicts={conflictState.conflicts}
          newRows={conflictState.newRows}
          errors={conflictState.errors}
          onConfirm={handleConflictConfirm}
          onCancel={() => setConflictState(null)}
        />
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
        <div className="flex items-end gap-2 p-3 bg-gray-50 rounded-lg border flex-wrap">
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
            <Label className="text-xs font-medium text-gray-600">Gross Return (%)</Label>
            <Input
              type="number"
              step="0.0001"
              placeholder="e.g. 1.2500"
              value={newReturn}
              onChange={(e) => setNewReturn(e.target.value)}
              className="h-9 w-36 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-gray-600">Net Return (%)</Label>
            <Input
              type="number"
              step="0.0001"
              placeholder="e.g. 1.0500"
              value={newNetReturn}
              onChange={(e) => setNewNetReturn(e.target.value)}
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
                <th className="text-right px-4 py-2.5 font-medium text-gray-600 text-xs uppercase tracking-wide">Net Return (%)</th>
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
                        onBlur={(e) => handleReturnEdit(r.date, e.target.value, false)}
                        className="w-28 text-right border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    ) : (
                      <span className={`font-mono ${r.return_value >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {r.return_value >= 0 ? "+" : ""}{formatReturn(r.return_value)}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.0001"
                        defaultValue={r.net_return !== undefined ? formatReturn(r.net_return) : ""}
                        onBlur={(e) => handleReturnEdit(r.date, e.target.value, true)}
                        className="w-28 text-right border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    ) : (
                      <span className={`font-mono ${r.net_return >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {r.net_return !== undefined ? `${r.net_return >= 0 ? "+" : ""}${formatReturn(r.net_return)}%` : "—"}
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