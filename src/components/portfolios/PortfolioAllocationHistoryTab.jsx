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
  Link2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import AllocationWizardDialog from "./AllocationWizardDialog";
import { reconcilePortfolioAllocationHistory } from "./reconcileAllocations";

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
      label: `IM: ${portfolio.advisor_firm_name || ""}`,
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

/** Net total (initial + additions - redemptions) for a given level + optional reference_id. */
function calculateLevelTotal(allocationHistory, level, referenceId) {
  return (allocationHistory || [])
    .filter((e) => e.level === level && (!referenceId || e.reference_id === referenceId))
    .reduce((sum, e) => {
      if (e.activity_type === "Redemption") return sum - (e.amount || 0);
      return sum + (e.amount || 0);
    }, 0);
}

function levelHasInitial(allocationHistory, level, referenceId) {
  return (allocationHistory || []).some(
    (e) =>
      e.level === level &&
      (!referenceId || e.reference_id === referenceId) &&
      e.activity_type === "Initial Allocation"
  );
}

function levelHasAdditionOrRedemption(allocationHistory, level, referenceId) {
  return (allocationHistory || []).some(
    (e) =>
      e.level === level &&
      (!referenceId || e.reference_id === referenceId) &&
      (e.activity_type === "Capital Addition" || e.activity_type === "Redemption")
  );
}

function fmtCurrency(n) {
  if (n == null || isNaN(n)) return "—";
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// Allocation record edit dialog
function AllocationRecordDialog({
  open,
  onOpenChange,
  onSave,
  editingRecord,
  levelLabel,
  levelType,
  parentTotal,
  levelTotal,
  canAllocate,
  availableActivityTypes,
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
        editingRecord?.activity_date ? parseISO(editingRecord.activity_date) : new Date()
      );
      setActivityType(
        editingRecord?.activity_type ||
          availableActivityTypes[0] ||
          "Capital Addition"
      );
      setAmount(
        editingRecord?.amount != null ? String(editingRecord.amount) : ""
      );
      setNotes(editingRecord?.notes || "");
      setExistingDoc(editingRecord?.document || null);
      setDocFile(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Validation: parent level must be populated before allocating downstream
    if (levelType !== "portfolio" && !canAllocate) {
      toast({
        title:
          levelType === "advisor"
            ? "Portfolio must have an initial allocation first"
            : "Advisor must have an initial allocation first",
        variant: "destructive",
      });
      return;
    }

    // Validation: amount cannot exceed remaining available (advisor / sub_manager levels)
    if (parentTotal != null) {
      const editingAmt = editingRecord?.amount || 0;
      const remaining =
        parentTotal - levelTotal + editingAmt;
      if (parseFloat(amount) > remaining) {
        toast({
          title: `Amount exceeds available to allocate (${fmtCurrency(remaining)})`,
          variant: "destructive",
        });
        return;
      }
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
          {/* Allocation availability info (advisor / sub_manager levels only) */}
          {parentTotal != null && (
            <div className="rounded-lg border bg-gray-50 p-3 space-y-1.5">
              {levelType === "advisor" && (
                <div className="text-xs font-medium text-gray-700 mb-1">
                  Allocation from Portfolio
                </div>
              )}
              {levelType === "sub_manager" && (
                <div className="text-xs font-medium text-gray-700 mb-1">
                  Allocation from Advisor
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Total Available</span>
                <span className="font-medium text-gray-800">
                  {fmtCurrency(parentTotal)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Already Allocated</span>
                <span className="font-medium text-gray-800">
                  {fmtCurrency(levelTotal - (editingRecord?.amount || 0))}
                </span>
              </div>
              <div className="flex justify-between text-xs pt-1 border-t border-gray-200">
                <span className="text-gray-600 font-medium">Remaining</span>
                <span
                  className={cn(
                    "font-bold",
                    parentTotal - levelTotal + (editingRecord?.amount || 0) <= 0
                      ? "text-red-600"
                      : "text-emerald-600"
                  )}
                >
                  {fmtCurrency(
                    parentTotal - levelTotal + (editingRecord?.amount || 0)
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Warning: parent level not populated */}
          {levelType !== "portfolio" && !canAllocate && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 flex items-start gap-2">
              <span className="text-xs text-amber-700">
                {levelType === "advisor"
                  ? "Portfolio must have an initial allocation before allocating to the advisor."
                  : "Advisor must have an initial allocation before allocating to sub-managers."}
              </span>
            </div>
          )}

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
              {availableActivityTypes.map((t) => (
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
            disabled={uploading || (levelType !== "portfolio" && !canAllocate)}
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
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [wizardOpen, setWizardOpen] = useState(false);
  const [highlightedRecordId, setHighlightedRecordId] = useState(null);

  // Query products to resolve sub-manager firm_ids for document creation
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date"),
  });

  const levelOptions = useMemo(() => buildLevelOptions(portfolio), [portfolio]);

  // Calculate totals at each level
  const portfolioTotal = useMemo(
    () => calculateLevelTotal(allocData, "portfolio"),
    [allocData]
  );
  const advisorTotal = useMemo(
    () => calculateLevelTotal(allocData, "advisor"),
    [allocData]
  );
  const subManagerTotal = useMemo(
    () => calculateLevelTotal(allocData, "sub_manager"),
    [allocData]
  );

  const isPortfolioPopulated = useMemo(
    () => levelHasInitial(allocData, "portfolio"),
    [allocData]
  );
  const isAdvisorPopulated = useMemo(
    () => levelHasInitial(allocData, "advisor"),
    [allocData]
  );

  // Available amount + canAllocate for the currently selected level
  const allocationInfo = useMemo(() => {
    if (selectedLevel === "portfolio") {
      return { parentTotal: null, levelTotal: portfolioTotal, canAllocate: true };
    }
    if (selectedLevel === "advisor") {
      return {
        parentTotal: portfolioTotal,
        levelTotal: advisorTotal,
        canAllocate: isPortfolioPopulated,
      };
    }
    // sub_manager
    return {
      parentTotal: advisorTotal,
      levelTotal: subManagerTotal,
      canAllocate: isAdvisorPopulated,
    };
  }, [
    selectedLevel,
    portfolioTotal,
    advisorTotal,
    subManagerTotal,
    isPortfolioPopulated,
    isAdvisorPopulated,
  ]);

  // Filter activity types: hide "Initial Allocation" if one already exists
  // or if any Capital Addition / Redemption exists at this level
  const availableActivityTypes = useMemo(() => {
    const hasInitial = levelHasInitial(allocData, selectedLevel, selectedRefId);
    const hasAddOrRed = levelHasAdditionOrRedemption(
      allocData,
      selectedLevel,
      selectedRefId
    );
    return ACTIVITY_TYPES.filter((t) => {
      if (t === "Initial Allocation" && (hasInitial || hasAddOrRed)) return false;
      return true;
    });
  }, [allocData, selectedLevel, selectedRefId]);

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

  // Linked downstream records (advisor + sub-managers) for the portfolio-level
  // record currently being edited — pre-fills the wizard's allocation split.
  const linkedRecords = useMemo(() => {
    if (!editingRecord) return null;
    const linked = allocData.filter((a) => a.source_record_id === editingRecord.id);
    return {
      advisor: linked.find((a) => a.level === "advisor"),
      subManagers: linked.filter((a) => a.level === "sub_manager"),
    };
  }, [editingRecord, allocData]);

  const handleAddRecord = () => {
    setEditingRecord(null);
    if (selectedLevel === "portfolio") {
      setWizardOpen(true);
    } else {
      setDialogOpen(true);
    }
  };

  const handleEditRecord = (record) => {
    setEditingRecord(record);
    if (record.level === "portfolio") {
      setWizardOpen(true);
    } else {
      setDialogOpen(true);
    }
  };

  // Navigate to the portfolio-level source record from a downstream record
  const handleNavigateToSource = (sourceRecordId) => {
    setSelectedLevel("portfolio");
    setSelectedRefId("");
    setSelectedIds(new Set());
    setHighlightedRecordId(sourceRecordId);
    // Clear highlight after a few seconds
    setTimeout(() => setHighlightedRecordId(null), 4000);
  };

  const handleDeleteRecord = (id) => {
    // Cascade delete: removing a portfolio-level record also removes its
    // linked downstream advisor/sub-manager records.
    saveAlloc(allocData.filter((a) => a.id !== id && a.source_record_id !== id));
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    // Cascade delete: also remove downstream records linked to selected portfolio records
    saveAlloc(allocData.filter((a) => !selectedIds.has(a.id) && !selectedIds.has(a.source_record_id)));
    setSelectedIds(new Set());
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAlloc.length && filteredAlloc.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAlloc.map((a) => a.id)));
    }
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

  // Save handler for the cascading allocation wizard (portfolio-level records).
  // EVERY cash flow cascades through the IM (amount forced = portfolio amount)
  // and, for multi-manager products, down to sub-managers. All levels are
  // created/updated in a single allocation_history write, linked via
  // source_record_id. When editing, old linked records are replaced so legacy
  // records that were added without cascading get reconciled on save.
  const handleWizardSave = async (data) => {
    const portfolioRecordId = editingRecord?.id || genId();
    const baseFields = {
      activity_date: data.activity_date,
      activity_type: data.activity_type,
      notes: data.notes,
      document: data.document,
    };

    // Create FirmDocument for uploaded doc (same as single-record flow)
    let documentData = data.document;
    if (documentData?.file_url && !documentData.firm_document_id) {
      try {
        const firmDoc = await base44.entities.FirmDocument.create({
          firm_id: portfolio.firm_id,
          firm_name: portfolio.allocator_name,
          file_url: documentData.file_url,
          file_name: documentData.name,
          file_type: documentData.file_type,
          entry_date: format(new Date(), "yyyy-MM-dd"),
          categories: ["Allocation History"],
          description: `Allocation history document for ${portfolio.portfolio_name} (Portfolio Total)`,
        });
        documentData = { ...documentData, firm_document_id: firmDoc.id };
      } catch {
        toast({ title: "Document saved to portfolio, but failed to save to firm documents tab", variant: "destructive" });
      }
    }

    const portfolioRecord = {
      id: portfolioRecordId,
      ...baseFields,
      document: documentData,
      amount: data.amount,
      level: "portfolio",
      reference_id: undefined,
      reference_name: "Portfolio Total",
    };

    // Build the set of downstream records that SHOULD exist for this cascade
    const downstreamRecords = [];
    // IM record — always created (amount forced = portfolio amount)
    if (data.advisor_amount != null && data.advisor_amount > 0) {
      downstreamRecords.push({
        id: genId(),
        ...baseFields,
        document: documentData,
        amount: data.advisor_amount,
        level: "advisor",
        reference_id: portfolio.advisor_firm_id,
        reference_name: `IM: ${portfolio.advisor_firm_name || ""}`,
        source_record_id: portfolioRecordId,
      });
    }
    // Sub-manager records (multi-manager only)
    if (data.sub_manager_amounts) {
      Object.entries(data.sub_manager_amounts).forEach(([productId, amtStr]) => {
        const amt = parseFloat(amtStr);
        if (amt > 0) {
          const sm = (portfolio.sub_managers || []).find((s) => s.product_id === productId);
          downstreamRecords.push({
            id: genId(),
            ...baseFields,
            document: documentData,
            amount: amt,
            level: "sub_manager",
            reference_id: productId,
            reference_name: `Sub-Manager: ${sm?.product_name || ""}`,
            source_record_id: portfolioRecordId,
          });
        }
      });
    }

    let newData;
    if (editingRecord) {
      // Remove the old portfolio record + all its old linked downstream records,
      // then add the updated portfolio record + fresh downstream records.
      // This reconciles legacy records that were added without cascading.
      newData = allocData.filter(
        (a) => a.id !== editingRecord.id && a.source_record_id !== editingRecord.id
      );
      newData = [...newData, portfolioRecord, ...downstreamRecords];
    } else {
      newData = [...allocData, portfolioRecord, ...downstreamRecords];
    }

    await saveAlloc(newData);
    setWizardOpen(false);
    setEditingRecord(null);
  };

  // Reconcile all portfolio-level records that don't have cascaded downstream
  // records. Uses the shared reconciliation helper so the same logic powers
  // the bulk "Reconcile All" action on the portfolio list page.
  const handleReconcileAll = async () => {
    const result = reconcilePortfolioAllocationHistory(portfolio);
    if (!result) return; // no advisor to cascade to

    if (result.reconciledCount === 0) {
      toast({ title: "All records are already cascaded" });
      return;
    }

    await saveAlloc(result.newData);
    toast({
      title: `Reconciled ${result.reconciledCount} record${result.reconciledCount !== 1 ? "s" : ""} — cash flows cascaded to IM${result.isMultiManager && result.subManagerCount > 0 ? " and sub-managers" : ""}`,
    });
  };

  const handleLevelChange = (e) => {
    const idx = parseInt(e.target.value);
    const opt = levelOptions[idx];
    setSelectedLevel(opt.value);
    setSelectedRefId(opt.refId || "");
    setSelectedIds(new Set());
  };

  // Export the full allocation history (all levels) to CSV for external analysis
  const handleExportCsv = () => {
    const rows = [...allocData].sort((a, b) =>
      (a.activity_date || "").localeCompare(b.activity_date || "")
    );
    if (rows.length === 0) return;

    const header = [
      "Activity Date",
      "Activity Type",
      "Amount",
      "Level",
      "Reference Name",
      "Notes",
      "Document Name",
      "Document URL",
    ];

    const escapeCsv = (val) => {
      const s = val == null ? "" : String(val);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csvLines = [header.join(",")];
    rows.forEach((r) => {
      csvLines.push(
        [
          r.activity_date || "",
          r.activity_type || "",
          r.amount != null ? Number(r.amount).toFixed(2) : "",
          r.level || "",
          r.reference_name || "",
          stripHtml(r.notes || ""),
          r.document?.name || "",
          r.document?.file_url || "",
        ]
          .map(escapeCsv)
          .join(",")
      );
    });

    const csv = csvLines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeName = (portfolio.portfolio_name || "portfolio").replace(/[^a-zA-Z0-9_-]/g, "_");
    link.download = `${safeName}_allocation_history.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const selectedLevelIdx = levelOptions.findIndex(
    (o) => o.value === selectedLevel && o.refId === (selectedRefId || "")
  );

  // Reconciliation check: do all levels match?
  const reconciliation = useMemo(() => {
    const hasAdvisor = !!(portfolio.advisor_type && portfolio.advisor_firm_id);
    const isMultiManager = portfolio.advisor_product_type === "Multi-Manager Product";
    const subManagers = portfolio.sub_managers || [];
    const hasSubManagers = isMultiManager && subManagers.length > 0;

    if (!hasAdvisor) return null;

    const portfolioNet = calculateLevelTotal(allocData, "portfolio");
    const advisorNet = calculateLevelTotal(allocData, "advisor");
    const subManagerNet = calculateLevelTotal(allocData, "sub_manager");

    const advisorMatches = portfolioNet === advisorNet;
    const subManagerMatches = !hasSubManagers || advisorNet === subManagerNet;
    const allMatch = advisorMatches && subManagerMatches;

    return {
      hasAdvisor,
      hasSubManagers,
      portfolioNet,
      advisorNet,
      subManagerNet,
      advisorMatches,
      subManagerMatches,
      allMatch,
    };
  }, [allocData, portfolio]);

  return (
    <div className="space-y-3 py-2">
      {/* Reconciliation indicator — shows whether cash flows cascade correctly */}
      {reconciliation && (
        <div
          className={cn(
            "rounded-lg border p-2.5 text-xs",
            reconciliation.allMatch
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-200 bg-amber-50"
          )}
        >
          <div className="flex items-center gap-2 mb-1.5">
            {reconciliation.allMatch ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            )}
            <span className="font-semibold text-gray-800">
              {reconciliation.allMatch
                ? "All levels reconciled"
                : "Levels out of balance — cash flows must cascade through the IM" +
                  (reconciliation.hasSubManagers ? " and sub-managers" : "")}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-600">
            <span>
              Portfolio:{" "}
              <strong className={cn(!reconciliation.advisorMatches && "text-amber-700")}>
                {fmtCurrency(reconciliation.portfolioNet)}
              </strong>
            </span>
            <span>→</span>
            <span>
              IM:{" "}
              <strong className={cn(!reconciliation.advisorMatches && "text-amber-700")}>
                {fmtCurrency(reconciliation.advisorNet)}
              </strong>
            </span>
            {reconciliation.hasSubManagers && (
              <>
                <span>→</span>
                <span>
                  Sub-Managers:{" "}
                  <strong className={cn(!reconciliation.subManagerMatches && "text-amber-700")}>
                    {fmtCurrency(reconciliation.subManagerNet)}
                  </strong>
                </span>
              </>
            )}
          </div>
          {!reconciliation.allMatch && (
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[11px] text-amber-700 flex-1">
                Some portfolio cash flows haven't cascaded to the IM
                {reconciliation.hasSubManagers ? " and sub-managers" : ""}.
                Reconcile now to auto-cascade all records.
              </p>
              <Button
                type="button"
                size="sm"
                className="h-7 ml-2 text-[11px] gap-1 bg-amber-600 hover:bg-amber-700 text-white whitespace-nowrap"
                onClick={handleReconcileAll}
                disabled={saving}
              >
                <ArrowRight className="w-3 h-3" />
                Reconcile Now
              </Button>
            </div>
          )}
        </div>
      )}

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
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs whitespace-nowrap"
          onClick={handleExportCsv}
          disabled={allocData.length === 0}
        >
          <Download className="w-3.5 h-3.5" />
          Export to CSV
        </Button>
      </div>

      {/* Allocation availability banner for advisor / sub_manager levels */}
      {selectedLevel !== "portfolio" && (
        <div
          className={cn(
            "rounded-lg border p-2.5 flex items-center justify-between text-xs",
            allocationInfo.canAllocate
              ? "border-indigo-100 bg-indigo-50"
              : "border-amber-200 bg-amber-50"
          )}
        >
          <span className="text-gray-600">
            {selectedLevel === "advisor"
              ? "Available to allocate from portfolio:"
              : "Available to allocate from advisor:"}
          </span>
          <span className="flex items-center gap-3">
            {!allocationInfo.canAllocate && (
              <span className="text-amber-700 font-medium">
                {selectedLevel === "advisor"
                  ? "Portfolio needs an initial allocation first"
                  : "Advisor needs an initial allocation first"}
              </span>
            )}
            {allocationInfo.canAllocate && (
              <>
                <span className="text-gray-500">
                  Allocated: {fmtCurrency(allocationInfo.levelTotal)}
                </span>
                <span className="font-bold text-indigo-700">
                  Remaining:{" "}
                  {fmtCurrency(
                    allocationInfo.parentTotal - allocationInfo.levelTotal
                  )}
                </span>
              </>
            )}
          </span>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
          <span className="text-xs font-medium text-indigo-700">
            {selectedIds.size} record{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-7 text-xs gap-1.5"
              onClick={handleBulkDelete}
              disabled={saving}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected
            </Button>
          </div>
        </div>
      )}

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
                  <th className="text-center px-2 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredAlloc.length && filteredAlloc.length > 0}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
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
                    className={cn(
                      "border-t border-gray-100 hover:bg-gray-50 cursor-pointer",
                      selectedIds.has(rec.id) && "bg-indigo-50/50",
                      highlightedRecordId === rec.id && "bg-amber-100 ring-2 ring-amber-400"
                    )}
                    onClick={() => handleEditRecord(rec)}
                  >
                    <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(rec.id)}
                        onChange={() => toggleSelect(rec.id)}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-800 whitespace-nowrap">
                      {rec.activity_date
                        ? format(parseISO(rec.activity_date), "MM/dd/yyyy")
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
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
                        {rec.source_record_id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNavigateToSource(rec.source_record_id);
                            }}
                            title="Go to source portfolio record"
                            className="text-indigo-500 hover:text-indigo-700 transition-colors"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
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
        levelType={selectedLevel}
        parentTotal={allocationInfo.parentTotal}
        levelTotal={allocationInfo.levelTotal}
        canAllocate={allocationInfo.canAllocate}
        availableActivityTypes={availableActivityTypes}
      />

      <AllocationWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onSave={handleWizardSave}
        editingRecord={editingRecord}
        portfolio={portfolio}
        linkedRecords={linkedRecords}
        availableActivityTypes={availableActivityTypes}
      />
    </div>
  );
}