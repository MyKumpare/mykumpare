import React, { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import {
  CalendarIcon,
  Plus,
  Trash2,
  Pencil,
  Paperclip,
  DollarSign,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

const genId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

const ACTIVITY_TYPES = ["Initial Allocation", "Capital Addition", "Redemption"];

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

function stripHtml(html) {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").trim();
}

// Allocation record edit dialog
function AllocationRecordDialog({
  open,
  onOpenChange,
  onSave,
  editingRecord,
  levelLabel,
}) {
  const [activityDate, setActivityDate] = useState(null);
  const [activityType, setActivityType] = useState("Initial Allocation");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [docFile, setDocFile] = useState(null);
  const [existingDoc, setExistingDoc] = useState(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (open) {
      setActivityDate(
        editingRecord?.activity_date ? parseISO(editingRecord.activity_date) : null
      );
      setActivityType(editingRecord?.activity_type || "Initial Allocation");
      setAmount(
        editingRecord?.amount != null ? String(editingRecord.amount) : ""
      );
      setNotes(editingRecord?.notes || "");
      setExistingDoc(editingRecord?.document || null);
      setDocFile(null);
    }
  }, [open, editingRecord]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setDocFile(file);
      setExistingDoc(null);
    }
  };

  const handleSave = async () => {
    if (!activityDate || !amount) {
      toast({
        title: "Please enter date and amount",
        variant: "destructive",
      });
      return;
    }

    let documentData = existingDoc || undefined;

    if (docFile) {
      setUploading(true);
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({
          file: docFile,
        });
        documentData = {
          name: docFile.name,
          file_url,
          file_type: docFile.type || docFile.name.split(".").pop(),
        };
      } catch (err) {
        toast({
          title: "Failed to upload document",
          variant: "destructive",
        });
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    onSave({
      activity_date: format(activityDate, "yyyy-MM-dd"),
      activity_type: activityType,
      amount: parseFloat(amount),
      notes: notes.trim() || undefined,
      document: documentData,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingRecord ? "Edit Allocation Record" : "Add Allocation Record"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-medium text-gray-700">
              Activity Date <span className="text-red-400">*</span>
            </Label>
            <div className="mt-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-9 text-sm justify-start font-normal"
                    type="button"
                  >
                    <CalendarIcon className="w-3.5 h-3.5 mr-2 text-gray-400" />
                    {activityDate ? (
                      format(activityDate, "MM/dd/yyyy")
                    ) : (
                      <span className="text-gray-400">Select date...</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={activityDate}
                    onSelect={setActivityDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium text-gray-700">
              Activity Type <span className="text-red-400">*</span>
            </Label>
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              className="w-full h-9 text-sm rounded-md border border-input bg-transparent px-3 mt-1 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-xs font-medium text-gray-700">
              Amount <span className="text-red-400">*</span>
            </Label>
            <Input
              type="number"
              step="0.01"
              placeholder="Enter amount..."
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-9 text-sm mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-medium text-gray-700">Notes</Label>
            <textarea
              placeholder="Enter notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-sm rounded-md border border-input bg-transparent px-3 py-2 mt-1 min-h-[80px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <Label className="text-xs font-medium text-gray-700">
              Supporting Document
            </Label>
            <div className="mt-1 space-y-1.5">
              {existingDoc && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-gray-50 text-sm">
                  <Paperclip className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <a
                    href={existingDoc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline truncate flex-1"
                  >
                    {existingDoc.name}
                  </a>
                  <button
                    type="button"
                    onClick={() => setExistingDoc(null)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {!existingDoc && (
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="w-full text-sm file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              )}
              {docFile && (
                <p className="text-xs text-gray-500">
                  New file: {docFile.name}
                </p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={uploading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {uploading ? "Uploading..." : "Save Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PortfolioAllocationHistoryTab({ portfolio }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [allocData, setAllocData] = useState(portfolio.allocation_history || []);
  const [selectedLevel, setSelectedLevel] = useState("portfolio");
  const [selectedRefId, setSelectedRefId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [saving, setSaving] = useState(false);

  // Query products to resolve sub-manager firm_ids for document creation
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date"),
  });

  const levelOptions = useMemo(() => buildLevelOptions(portfolio), [portfolio]);

  const currentLevelLabel = useMemo(
    () =>
      levelOptions.find(
        (o) => o.value === selectedLevel && o.refId === (selectedRefId || "")
      )?.label || "Portfolio Total",
    [levelOptions, selectedLevel, selectedRefId]
  );

  const filteredAlloc = useMemo(() => {
    return allocData
      .filter(
        (a) =>
          a.level === selectedLevel &&
          (a.reference_id || "") === (selectedRefId || "")
      )
      .sort((a, b) => new Date(b.activity_date) - new Date(a.activity_date));
  }, [allocData, selectedLevel, selectedRefId]);

  // Determine the firm to link the document to
  const getFirmForDocument = () => {
    if (selectedLevel === "portfolio") {
      return { firm_id: portfolio.firm_id, firm_name: portfolio.allocator_name };
    }
    if (selectedLevel === "advisor") {
      return {
        firm_id: portfolio.advisor_firm_id,
        firm_name: portfolio.advisor_firm_name,
      };
    }
    // sub_manager — look up product's firm
    const product = products.find((p) => p.id === selectedRefId);
    return {
      firm_id: product?.firm_id || portfolio.firm_id,
      firm_name: product?.firm_name || portfolio.allocator_name,
      product_id: selectedRefId,
    };
  };

  const saveAlloc = async (newData) => {
    setSaving(true);
    try {
      const updated = await base44.entities.Portfolio.update(portfolio.id, {
        allocation_history: newData,
      });
      setAllocData(updated.allocation_history || []);
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["firmDocuments"] });
      toast({ title: "Allocation record saved" });
    } catch (err) {
      toast({
        title: "Failed to save allocation record",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddRecord = () => {
    setEditingRecord(null);
    setDialogOpen(true);
  };

  const handleEditRecord = (record) => {
    setEditingRecord(record);
    setDialogOpen(true);
  };

  const handleDeleteRecord = (id) => {
    saveAlloc(allocData.filter((a) => a.id !== id));
  };

  const handleSaveRecord = async (recordData) => {
    const firmInfo = getFirmForDocument();
    let firmDocumentId = editingRecord?.document?.firm_document_id || undefined;

    // If a new document was uploaded, create a FirmDocument record
    if (recordData.document && recordData.document.file_url && !recordData.document.firm_document_id) {
      try {
        const firmDoc = await base44.entities.FirmDocument.create({
          firm_id: firmInfo.firm_id,
          firm_name: firmInfo.firm_name,
          file_url: recordData.document.file_url,
          file_name: recordData.document.name,
          file_type: recordData.document.file_type,
          entry_date: format(new Date(), "yyyy-MM-dd"),
          categories: ["Allocation History"],
          product_ids: firmInfo.product_id ? [firmInfo.product_id] : undefined,
          description: `Allocation history document for ${portfolio.portfolio_name} (${currentLevelLabel})`,
        });
        firmDocumentId = firmDoc.id;
      } catch (err) {
        toast({
          title: "Document saved to portfolio, but failed to save to firm documents tab",
          variant: "destructive",
        });
      }
    }

    const newRecord = {
      id: editingRecord?.id || genId(),
      activity_date: recordData.activity_date,
      activity_type: recordData.activity_type,
      amount: recordData.amount,
      notes: recordData.notes,
      level: selectedLevel,
      reference_id: selectedRefId || undefined,
      reference_name: currentLevelLabel,
      document: recordData.document
        ? { ...recordData.document, firm_document_id: firmDocumentId }
        : undefined,
    };

    let newData;
    if (editingRecord) {
      newData = allocData.map((a) =>
        a.id === editingRecord.id ? newRecord : a
      );
    } else {
      newData = [...allocData, newRecord];
    }

    await saveAlloc(newData);
    setDialogOpen(false);
    setEditingRecord(null);
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

  return (
    <div className="space-y-3 py-2">
      {/* Level selector + Add button */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs font-medium text-gray-600 mb-1 block">
            Show Records for
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
          size="sm"
          className="h-9 gap-1.5 text-xs whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white"
          onClick={handleAddRecord}
          disabled={saving}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Record
        </Button>
      </div>

      {/* Records table */}
      {filteredAlloc.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl flex items-center justify-center gap-2">
          <DollarSign className="w-4 h-4 text-gray-300" />
          No allocation records for {currentLevelLabel}
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="max-h-[350px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">
                    Date
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">
                    Type
                  </th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600 text-xs">
                    Amount
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">
                    Notes
                  </th>
                  <th className="text-center px-2 py-2 font-medium text-gray-600 text-xs">
                    Doc
                  </th>
                  <th className="w-16 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredAlloc.map((rec) => (
                  <tr
                    key={rec.id}
                    className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleEditRecord(rec)}
                  >
                    <td className="px-3 py-2 text-gray-800 whitespace-nowrap">
                      {rec.activity_date
                        ? format(parseISO(rec.activity_date), "MM/dd/yyyy")
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-block px-2 py-0.5 rounded text-xs font-medium",
                          rec.activity_type === "Initial Allocation" &&
                            "bg-blue-50 text-blue-700",
                          rec.activity_type === "Capital Addition" &&
                            "bg-green-50 text-green-700",
                          rec.activity_type === "Redemption" &&
                            "bg-red-50 text-red-700"
                        )}
                      >
                        {rec.activity_type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-800 font-medium whitespace-nowrap">
                      {rec.amount != null
                        ? rec.amount.toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">
                      {rec.notes ? stripHtml(rec.notes) : "—"}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {rec.document?.file_url ? (
                        <a
                          href={rec.document.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-indigo-500 hover:text-indigo-700"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditRecord(rec);
                          }}
                          className="text-gray-300 hover:text-indigo-500 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRecord(rec.id);
                          }}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          disabled={saving}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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

      <AllocationRecordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSaveRecord}
        editingRecord={editingRecord}
        levelLabel={currentLevelLabel}
      />
    </div>
  );
}