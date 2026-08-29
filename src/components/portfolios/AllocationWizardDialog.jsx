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
import { CalendarIcon, Paperclip, X, ArrowRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import AllocationValidation from "./AllocationValidation";

function fmtCurrency(n) {
  if (n == null || isNaN(n)) return "—";
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Wizard dialog for adding/editing a cash-flow record at the PORTFOLIO level.
 *
 * Every cash flow from the client MUST cascade through the Investment Manager
 * (IM amount is forced to equal the portfolio amount — no manual override) and,
 * for multi-manager products, down to the underlying sub-managers (whose split
 * must total exactly the portfolio amount). This guarantees all levels
 * reconcile as the cash flow filters down the allocation chain.
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

      // Pre-fill sub-manager amounts from linked records (editing mode)
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

  // IM amount is ALWAYS equal to the portfolio amount (forced cascade).
  // No manual override — the cash flow must flow through the IM intact.
  const advisorAmount = amount;

  const portfolioTotal = parseFloat(amount) || 0;
  const subManagersTotal = subManagers.reduce(
    (sum, sm) => sum + (parseFloat(subManagerAmounts[sm.product_id]) || 0),
    0
  );

  // Sub-manager split must total exactly the portfolio amount (no over/under)
  const subManagersMismatch =
    isMultiManager &&
    portfolioTotal > 0 &&
    subManagers.length > 0 &&
    Object.keys(subManagerAmounts).length > 0 &&
    subManagersTotal !== portfolioTotal;

  const isValid =
    activityDate &&
    amount &&
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
      // IM amount is always = portfolio amount (forced cascade)
      advisor_amount: hasAdvisor ? parseFloat(amount) : undefined,
      sub_manager_amounts: isMultiManager ? subManagerAmounts : undefined,
    });
  };

  // Auto-distribute sub-manager amounts equally as a convenience
  const handleAutoDistribute = () => {
    if (subManagers.length === 0 || portfolioTotal <= 0) return;
    const per = portfolioTotal / subManagers.length;
    const rounded = Math.floor(per * 100) / 100; // round down to cents
    const amts = {};
    subManagers.forEach((sm, i) => {
      // last sub-manager gets the remainder so total is exact
      if (i === subManagers.length - 1) {
        const allocated = rounded * (subManagers.length - 1);
        amts[sm.product_id] = String(
          Math.round((portfolioTotal - allocated) * 100) / 100
        );
      } else {
        amts[sm.product_id] = String(rounded);
      }
    });
    setSubManagerAmounts(amts);
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
                Cash Flow Cascade
              </div>
              <p className="text-xs text-gray-500">
                This cash flow cascades through the Investment Manager
                {isMultiManager ? " and down to the underlying sub-managers" : ""}.
                Amounts must total exactly{" "}
                <span className="font-medium text-gray-700">the portfolio amount</span>{" "}
                at every level — no over or under allocation.
              </p>

              {/* IM allocation — forced to equal portfolio amount (read-only) */}
              <div>
                <Label className="text-xs font-medium text-gray-700">
                  IM: {portfolio.advisor_firm_name || "Investment Manager"}
                </Label>
                <div className="h-9 mt-1 flex items-center justify-between px-3 rounded-md border bg-gray-50 text-sm">
                  <span className="font-medium text-gray-800">
                    {portfolioTotal > 0 ? fmtCurrency(portfolioTotal) : "—"}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-gray-400">
                    <Lock className="w-3 h-3" />
                    Auto-cascades from portfolio
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  The full portfolio amount flows through the Investment Manager
                  {isMultiManager ? " before splitting to sub-managers" : ""}.
                </p>
              </div>

              {/* Sub-manager allocations (multi-manager only) */}
              {isMultiManager && subManagers.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-gray-700">
                      Sub-Manager Allocations
                    </Label>
                    <button
                      type="button"
                      onClick={handleAutoDistribute}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Split equally
                    </button>
                  </div>
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
                        className={cn(
                          "h-8 text-sm mt-0.5",
                          subManagersMismatch && "border-red-400 focus-visible:ring-red-400"
                        )}
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