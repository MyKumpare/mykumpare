import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { CalendarIcon, Paperclip, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import AllocationValidation from "./AllocationValidation";

/**
 * Wizard dialog for adding/editing an allocation record at the PORTFOLIO level.
 * Automatically prompts the user to split the amount between the Investment
 * Manager (default = full amount) and the underlying sub-managers (if the
 * product is multi-manager). Applies the same exact-match validation as the
 * initial allocation in AddPortfolioDialog (no over/under allocation).
 *
 * On save, returns a payload describing records at all three levels so the
 * parent can create/update them in a single allocation_history array.
 */
export default function AllocationWizardDialog({
  open,
  onOpenChange,
  onSave,
  editingRecord,
  portfolio,
  linkedRecords,
  availableActivityTypes,
}) {
  const { toast } = useToast();
  const [activityDate, setActivityDate] = useState(null);
  const [activityType, setActivityType] = useState("Capital Addition");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [docFile, setDocFile] = useState(null);
  const [existingDoc, setExistingDoc] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [advisorAmount, setAdvisorAmount] = useState("");
  const [subManagerAmounts, setSubManagerAmounts] = useState({});

  const hasAdvisor = !!(portfolio.advisor_type && portfolio.advisor_firm_id);
  const isMultiManager = portfolio.advisor_product_type === "Multi-Manager Product";
  const subManagers = portfolio.sub_managers || [];

  useEffect(() => {
    if (open) {
      setActivityDate(
        editingRecord?.activity_date ? parseISO(editingRecord.activity_date) : new Date()
      );
      setActivityType(
        editingRecord?.activity_type ||
          availableActivityTypes[0] ||
          "Capital Addition"
      );
      setAmount(editingRecord?.amount != null ? String(editingRecord.amount) : "");
      setNotes(editingRecord?.notes || "");
      setExistingDoc(editingRecord?.document || null);
      setDocFile(null);

      // Pre-fill downstream amounts from linked records (editing mode)
      if (linkedRecords?.advisor) {
        setAdvisorAmount(
          linkedRecords.advisor.amount != null ? String(linkedRecords.advisor.amount) : ""
        );
      } else {
        setAdvisorAmount("");
      }
      const smAmts = {};
      if (linkedRecords?.subManagers) {
        linkedRecords.subManagers.forEach((r) => {
          if (r.reference_id) smAmts[r.reference_id] = String(r.amount || "");
        });
      }
      setSubManagerAmounts(smAmts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingRecord, linkedRecords]);

  // Auto-sync advisor amount to portfolio amount for NEW records (same
  // behaviour as AddPortfolioDialog's initial-allocation sync).
  useEffect(() => {
    if (editingRecord) return; // don't override when editing
    setAdvisorAmount(amount);
  }, [amount, editingRecord]);

  const portfolioTotal = parseFloat(amount) || 0;
  const advisorTotal = parseFloat(advisorAmount) || 0;
  const subManagersTotal = subManagers.reduce(
    (sum, sm) => sum + (parseFloat(subManagerAmounts[sm.product_id]) || 0),
    0
  );

  // Exact-match validation (no over, no under) — same as initial allocation
  const advisorMismatch =
    hasAdvisor && portfolioTotal > 0 && advisorAmount !== "" && advisorTotal !== portfolioTotal;
  const subManagersMismatch =
    isMultiManager &&
    portfolioTotal > 0 &&
    subManagers.length > 0 &&
    Object.keys(subManagerAmounts).length > 0 &&
    subManagersTotal !== portfolioTotal;

  const isValid =
    activityDate &&
    amount &&
    (!hasAdvisor || !advisorMismatch) &&
    (!isMultiManager || !subManagersMismatch || subManagers.length === 0);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setDocFile(file);
      setExistingDoc(null);
    }
  };

  const handleSave = async () => {
    if (!activityDate || !amount) {
      toast({ title: "Please enter date and amount", variant: "destructive" });
      return;
    }
    if (hasAdvisor && advisorMismatch) {
      toast({
        title: "Investment Manager allocation must match the portfolio amount exactly",
        variant: "destructive",
      });
      return;
    }
    if (isMultiManager && subManagers.length > 0 && subManagersMismatch) {
      toast({
        title: "Sub-manager allocations must total the portfolio amount exactly",
        variant: "destructive",
      });
      return;
    }

    let documentData = existingDoc || undefined;
    if (docFile) {
      setUploading(true);
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: docFile });
        documentData = {
          name: docFile.name,
          file_url,
          file_type: docFile.type || docFile.name.split(".").pop(),
        };
      } catch {
        toast({ title: "Failed to upload document", variant: "destructive" });
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
      advisor_amount: hasAdvisor ? parseFloat(advisorAmount) || 0 : undefined,
      sub_manager_amounts: isMultiManager ? subManagerAmounts : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingRecord ? "Edit Allocation Record" : "Add Allocation Record"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* ── Step 1: Basic record info ── */}
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
                    {activityDate ? format(activityDate, "MM/dd/yyyy") : <span className="text-gray-400">Select date...</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={activityDate} onSelect={setActivityDate} initialFocus />
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
                <option key={t} value={t}>{t}</option>
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
              min="0"
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
              className="w-full text-sm rounded-md border border-input bg-transparent px-3 py-2 mt-1 min-h-[60px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <Label className="text-xs font-medium text-gray-700">Supporting Document</Label>
            <div className="mt-1 space-y-1.5">
              {existingDoc && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-gray-50 text-sm">
                  <Paperclip className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <a href={existingDoc.file_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate flex-1">
                    {existingDoc.name}
                  </a>
                  <button type="button" onClick={() => setExistingDoc(null)} className="text-gray-400 hover:text-red-500">
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
              {docFile && <p className="text-xs text-gray-500">New file: {docFile.name}</p>}
            </div>
          </div>

          {/* ── Step 2: Cascading allocation split ── */}
          {hasAdvisor && (
            <div className="border-t border-gray-200 pt-3 space-y-3">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                Allocate to Investment Manager
              </div>
              <p className="text-xs text-gray-500">
                Split this record across the Investment Manager
                {isMultiManager ? " and underlying sub-managers" : ""}. Amounts must
                total exactly <span className="font-medium text-gray-700">the portfolio amount</span> — no over or under allocation.
              </p>

              {/* IM allocation */}
              <div>
                <Label className="text-xs font-medium text-gray-700">
                  IM: {portfolio.advisor_firm_name || "Investment Manager"}
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Enter IM amount..."
                  value={advisorAmount}
                  onChange={(e) => setAdvisorAmount(e.target.value)}
                  className={cn(
                    "h-9 text-sm mt-1",
                    advisorMismatch && "border-red-400 focus-visible:ring-red-400"
                  )}
                />
                {portfolioTotal > 0 && advisorAmount !== "" && (
                  <AllocationValidation allocated={advisorAmount} total={amount} label="portfolio amount" />
                )}
              </div>

              {/* Sub-manager allocations (multi-manager only) */}
              {isMultiManager && subManagers.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-700">Sub-Manager Allocations</Label>
                  {subManagers.map((sm) => (
                    <div key={sm.product_id}>
                      <Label className="text-[11px] text-gray-500">{sm.product_name}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Enter amount..."
                        value={subManagerAmounts[sm.product_id] || ""}
                        onChange={(e) =>
                          setSubManagerAmounts((prev) => ({ ...prev, [sm.product_id]: e.target.value }))
                        }
                        className="h-8 text-sm mt-0.5"
                      />
                    </div>
                  ))}
                  {portfolioTotal > 0 && Object.keys(subManagerAmounts).length > 0 && (
                    <AllocationValidation allocated={subManagersTotal} total={amount} label="portfolio amount" />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={uploading || !isValid}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {uploading ? "Uploading..." : "Save Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}