import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Download, Upload, Trash2, Edit2, AlertCircle, CheckCircle2 } from "lucide-react";

const RETURN_TYPES = ["Composite", "Paper Portfolio", "Back-Test"];
const GIPS_OPTIONS = ["GIPS Calculated", "GIPS Verified", "Non-GIPS Compliant"];
const RETURN_FREQUENCIES = ["Gross", "Net"];

const getReturnTypeName = (type) => {
  if (type === "Paper Portfolio") return "Paper Portfolio Name";
  if (type === "Back-Test") return "Back-Test Name";
  return "Composite Name";
};

function generateExcelTemplate(startDate, endDate, returnFrequency) {
  // Generate CSV content for Excel template
  const start = new Date(startDate);
  const end = new Date(endDate);
  let csv = "Date (YYYY-MM-DD),Return (%)\n";

  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  while (current <= end) {
    const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    csv += `${lastDay.toISOString().split("T")[0]},\n`;
    current.setMonth(current.getMonth() + 1);
  }

  // Create blob and trigger download
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `returns-template-${returnFrequency.toLowerCase()}-${startDate}-to-${endDate}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function validateAndParseCSV(csvText, startDate, endDate) {
  const lines = csvText.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return { valid: false, error: "CSV file is empty" };

  const returns = [];
  const duplicates = [];
  const missingMonths = [];

  const start = new Date(startDate);
  const end = new Date(endDate);
  const expectedDates = new Set();

  // Generate expected dates
  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  while (current <= end) {
    const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    expectedDates.add(lastDay.toISOString().split("T")[0]);
    current.setMonth(current.getMonth() + 1);
  }

  // Skip header and parse data rows
  for (let i = 1; i < lines.length; i++) {
    const [dateStr, valueStr] = lines[i].split(",").map(s => s.trim());
    if (!dateStr || valueStr === "") continue;

    const returnValue = parseFloat(valueStr);
    if (isNaN(returnValue)) {
      return { valid: false, error: `Invalid return value at row ${i + 1}: ${valueStr}` };
    }

    // Check if date is within range
    if (dateStr < startDate || dateStr > endDate) {
      return { valid: false, error: `Date ${dateStr} is outside the specified range` };
    }

    if (returns.some(r => r.date === dateStr)) {
      duplicates.push(dateStr);
    } else {
      returns.push({ date: dateStr, return_value: returnValue });
      expectedDates.delete(dateStr);
    }
  }

  // Check for missing months
  if (expectedDates.size > 0) {
    missingMonths.push(...Array.from(expectedDates));
  }

  return {
    valid: true,
    returns,
    duplicates,
    missingMonths,
  };
}

export default function ProductReturnsTab({ productId, isEditing }) {
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [returnTypes, setReturnTypes] = useState([]);
  const [compositeName, setCompositeName] = useState("");
  const [paperPortfolioName, setPaperPortfolioName] = useState("");
  const [backTestName, setBackTestName] = useState("");
  const [inceptionDate, setInceptionDate] = useState("");
  const [gipsStatus, setGipsStatus] = useState("");
  const [returnFrequency, setReturnFrequency] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [csvFile, setCsvFile] = useState(null);
  const [uploadValidation, setUploadValidation] = useState(null);
  const [editingReturnSeries, setEditingReturnSeries] = useState(null);

  const queryClient = useQueryClient();

  const { data: returnSeries = [] } = useQuery({
    queryKey: ["returnSeries", productId],
    queryFn: () => base44.entities.ReturnSeries.filter({ product_id: productId }),
    enabled: !!productId,
  });

  const createReturnSeriesMutation = useMutation({
    mutationFn: (data) => base44.entities.ReturnSeries.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returnSeries", productId] });
      resetForm();
      setShowSetupDialog(false);
      setShowUploadDialog(false);
    },
  });

  const updateReturnSeriesMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ReturnSeries.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returnSeries", productId] });
      resetForm();
      setShowUploadDialog(false);
    },
  });

  const deleteReturnSeriesMutation = useMutation({
    mutationFn: (id) => base44.entities.ReturnSeries.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["returnSeries", productId] }),
  });

  const resetForm = () => {
    setReturnTypes([]);
    setCompositeName("");
    setPaperPortfolioName("");
    setBackTestName("");
    setInceptionDate("");
    setGipsStatus("");
    setReturnFrequency("");
    setStartDate("");
    setEndDate("");
    setCsvFile(null);
    setUploadValidation(null);
    setEditingReturnSeries(null);
  };

  const handleSetupComplete = () => {
    if (returnTypes.length === 0 || !inceptionDate || !returnFrequency) return;
    if (returnTypes.includes("Composite") && !gipsStatus) return;
    if (returnTypes.includes("Composite") && !compositeName.trim()) return;
    if (returnTypes.includes("Paper Portfolio") && !paperPortfolioName.trim()) return;
    if (returnTypes.includes("Back-Test") && !backTestName.trim()) return;

    setShowSetupDialog(false);
    setShowUploadDialog(true);
  };

  const handleDownloadTemplate = () => {
    if (!startDate || !endDate) return;
    generateExcelTemplate(startDate, endDate, returnFrequency);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvText = event.target?.result;
      const validation = validateAndParseCSV(csvText, startDate, endDate);
      setUploadValidation(validation);
      setCsvFile(file);
    };
    reader.readAsText(file);
  };

  const handleUploadReturns = async () => {
    if (!uploadValidation?.valid || !uploadValidation.returns.length) return;

    const data = {
      product_id: productId,
      return_types: returnTypes,
      composite_name: compositeName || null,
      paper_portfolio_name: paperPortfolioName || null,
      back_test_name: backTestName || null,
      inception_date: inceptionDate,
      gips_status: returnTypes.includes("Composite") ? gipsStatus : null,
      return_frequency: returnFrequency,
      monthly_returns: uploadValidation.returns,
      start_date: startDate,
      end_date: endDate,
    };

    if (editingReturnSeries) {
      updateReturnSeriesMutation.mutate({ id: editingReturnSeries.id, data });
    } else {
      createReturnSeriesMutation.mutate(data);
    }
  };

  const handleEditReturnSeries = (series) => {
    setEditingReturnSeries(series);
    setReturnTypes(series.return_types || []);
    setCompositeName(series.composite_name || "");
    setPaperPortfolioName(series.paper_portfolio_name || "");
    setBackTestName(series.back_test_name || "");
    setInceptionDate(series.inception_date);
    setGipsStatus(series.gips_status || "");
    setReturnFrequency(series.return_frequency);
    setStartDate(series.start_date);
    setEndDate(series.end_date);
    setShowUploadDialog(true);
  };

  const handleAddMore = () => {
    resetForm();
    setShowSetupDialog(true);
  };

  if (!productId) {
    return <div className="text-sm text-gray-400 italic px-1 py-4">Save product first to add returns.</div>;
  }

  return (
    <div className="space-y-4">
      {returnSeries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 px-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
          <p className="text-sm text-gray-600">No return series added yet</p>
          <Button
            onClick={() => setShowSetupDialog(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            size="sm"
          >
            <Plus className="w-4 h-4" /> Add Return Series
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {returnSeries.map((series) => (
            <div key={series.id} className="border rounded-lg p-3 bg-white space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{series.return_types?.join(", ")}</p>
                  <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                    {series.composite_name && <p>Composite: {series.composite_name}</p>}
                    {series.paper_portfolio_name && <p>Portfolio: {series.paper_portfolio_name}</p>}
                    {series.back_test_name && <p>Back-Test: {series.back_test_name}</p>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {series.monthly_returns?.length || 0} returns · {series.start_date} to {series.end_date}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {series.return_frequency} · Inception: {series.inception_date}
                    {series.gips_status && ` · ${series.gips_status}`}
                  </p>
                </div>
                {isEditing && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                      onClick={() => handleEditReturnSeries(series)}
                    >
                      <Edit2 className="w-3 h-3" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => deleteReturnSeriesMutation.mutate(series.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isEditing && (
            <Button
              onClick={handleAddMore}
              variant="outline"
              className="w-full h-8 text-xs gap-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
            >
              <Plus className="w-3.5 h-3.5" /> Add More Returns
            </Button>
          )}
        </div>
      )}

      {/* Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Return Series</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Performance Type (Multi-select) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Performance Type *</Label>
              <div className="space-y-2">
                {RETURN_TYPES.map((type) => (
                  <div key={type} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={type}
                      checked={returnTypes.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setReturnTypes([...returnTypes, type]);
                        } else {
                          setReturnTypes(returnTypes.filter(t => t !== type));
                        }
                      }}
                      className="w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor={type} className="text-sm text-gray-700 cursor-pointer">{type}</label>
                  </div>
                ))}
              </div>
            </div>

            {/* Composite Name */}
            {returnTypes.includes("Composite") && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Composite Name *</Label>
                <Input
                  placeholder="Enter composite name..."
                  value={compositeName}
                  onChange={(e) => setCompositeName(e.target.value)}
                  className="h-9"
                />
              </div>
            )}

            {/* Paper Portfolio Name */}
            {returnTypes.includes("Paper Portfolio") && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Paper Portfolio Name *</Label>
                <Input
                  placeholder="Enter paper portfolio name..."
                  value={paperPortfolioName}
                  onChange={(e) => setPaperPortfolioName(e.target.value)}
                  className="h-9"
                />
              </div>
            )}

            {/* Back-Test Name */}
            {returnTypes.includes("Back-Test") && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Back-Test Name *</Label>
                <Input
                  placeholder="Enter back-test name..."
                  value={backTestName}
                  onChange={(e) => setBackTestName(e.target.value)}
                  className="h-9"
                />
              </div>
            )}

            {/* Inception Date */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Inception Date *</Label>
              <Input
                type="date"
                value={inceptionDate}
                onChange={(e) => setInceptionDate(e.target.value)}
                className="h-9"
              />
            </div>

            {/* GIPS Status (Composite only) */}
            {returnTypes.includes("Composite") && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">GIPS Compliance *</Label>
                <div className="space-y-2">
                  {GIPS_OPTIONS.map((option) => (
                    <div key={option} className="flex items-center gap-2">
                      <input
                        type="radio"
                        id={option}
                        name="gips"
                        value={option}
                        checked={gipsStatus === option}
                        onChange={(e) => setGipsStatus(e.target.value)}
                        className="w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor={option} className="text-sm text-gray-700 cursor-pointer">{option}</label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Return Frequency */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Return Type (Gross/Net) *</Label>
              <Select value={returnFrequency} onValueChange={setReturnFrequency}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select frequency..." />
                </SelectTrigger>
                <SelectContent>
                  {RETURN_FREQUENCIES.map((freq) => (
                    <SelectItem key={freq} value={freq}>{freq}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetupDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSetupComplete}
              disabled={
                returnTypes.length === 0 ||
                !inceptionDate ||
                !returnFrequency ||
                (returnTypes.includes("Composite") && !gipsStatus) ||
                (returnTypes.includes("Composite") && !compositeName.trim()) ||
                (returnTypes.includes("Paper Portfolio") && !paperPortfolioName.trim()) ||
                (returnTypes.includes("Back-Test") && !backTestName.trim())
              }
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Next
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingReturnSeries ? "Edit Return Series" : "Upload Returns"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Start Date *</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setUploadValidation(null);
                  }}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">End Date *</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setUploadValidation(null);
                  }}
                  className="h-9"
                />
              </div>
            </div>

            {/* Download Template Button */}
            {startDate && endDate && (
              <Button
                onClick={handleDownloadTemplate}
                variant="outline"
                className="w-full h-9 gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              >
                <Download className="w-4 h-4" />
                Download Template ({returnFrequency || "—"})
              </Button>
            )}

            {/* File Upload */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Upload CSV File *</Label>
              <label className="block">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="px-4 py-2 border border-dashed border-indigo-300 rounded-lg bg-indigo-50 text-center cursor-pointer hover:bg-indigo-100 transition-colors">
                  {csvFile ? (
                    <p className="text-sm text-indigo-700 font-medium">{csvFile.name}</p>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
                      <p className="text-sm text-indigo-600 font-medium">Click to upload CSV</p>
                      <p className="text-xs text-indigo-500">or drag and drop</p>
                    </>
                  )}
                </div>
              </label>
            </div>

            {/* Validation Messages */}
            {uploadValidation && (
              <div className="space-y-2">
                {!uploadValidation.valid && (
                  <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{uploadValidation.error}</p>
                  </div>
                )}

                {uploadValidation.valid && (
                  <>
                    <div className="flex gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-green-700">{uploadValidation.returns.length} returns ready to upload</p>
                    </div>

                    {uploadValidation.duplicates.length > 0 && (
                      <div className="flex gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-yellow-700">Duplicate dates found:</p>
                          <p className="text-xs text-yellow-600 mt-1">{uploadValidation.duplicates.join(", ")}</p>
                        </div>
                      </div>
                    )}

                    {uploadValidation.missingMonths.length > 0 && (
                      <div className="flex gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-blue-700">Missing months:</p>
                          <p className="text-xs text-blue-600 mt-1">{uploadValidation.missingMonths.join(", ")}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowUploadDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleUploadReturns}
              disabled={!uploadValidation?.valid || !uploadValidation.returns.length}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {editingReturnSeries ? "Update Returns" : "Upload Returns"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}