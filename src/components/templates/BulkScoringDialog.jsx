import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Loader2, ClipboardCheck, Search, X, CheckCircle2, AlertCircle, Package } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { initiateScoringForProduct } from "./scoringInitLogic";

export default function BulkScoringDialog({ open, onClose, selectedProducts, currentUser, onCompleted }) {
  const [templateId, setTemplateId] = useState("");
  const [primaryAnalystId, setPrimaryAnalystId] = useState(currentUser?.linked_contact_id || "");
  const [enableSecondary, setEnableSecondary] = useState(false);
  const [secondaryAnalystId, setSecondaryAnalystId] = useState("");
  const [search, setSearch] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null); // { success: [], failed: [] }

  // Fetch scoring matrix templates
  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ["templates", "scoring-matrix"],
    queryFn: () => base44.entities.Template.list("-created_date", 500),
    enabled: open
  });
  const scoringTemplates = useMemo(
    () => (templates || []).filter((t) => !t.deleted_at && t.template_category === "Scoring Matrix" && (t.scoring_blocks || []).length > 0),
    [templates]
  );

  // Fetch contacts from the user's own firm for analyst pickers
  const userFirmId = currentUser?.linked_firm_id;
  const { data: firmContacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ["contacts", "firm", userFirmId],
    queryFn: () => base44.entities.Contact.list("-first_name", 500),
    enabled: open && !!userFirmId
  });
  const analystContacts = useMemo(
    () => (firmContacts || []).filter(
      (c) => !c.deleted_at && (c.firm_ids || []).includes(userFirmId) && c.contact_status !== "Inactive"
    ),
    [firmContacts, userFirmId]
  );

  const selectedTemplate = scoringTemplates.find((t) => t.id === templateId);
  const primaryAnalyst = analystContacts.find((c) => c.id === primaryAnalystId);
  const secondaryAnalyst = analystContacts.find((c) => c.id === secondaryAnalystId);

  const searchLower = search.toLowerCase().trim();
  const visibleProducts = useMemo(() => {
    if (!searchLower) return selectedProducts;
    return selectedProducts.filter((p) =>
      (p.name || "").toLowerCase().includes(searchLower) ||
      (p.firm_name || "").toLowerCase().includes(searchLower)
    );
  }, [selectedProducts, searchLower]);

  const canStart = !!templateId && !!primaryAnalystId && selectedProducts.length > 0 && !isProcessing;

  const handleStart = async () => {
    if (!selectedTemplate) {
      toast({ title: "Select a template", description: "Please choose a scoring matrix template.", variant: "destructive" });
      return;
    }
    if (!primaryAnalyst) {
      toast({ title: "Select a primary analyst", variant: "destructive" });
      return;
    }
    if (enableSecondary && !secondaryAnalyst) {
      toast({ title: "Select a secondary analyst", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    const success = [];
    const failed = [];

    for (const product of selectedProducts) {
      try {
        await initiateScoringForProduct(product, selectedTemplate, primaryAnalyst, {
          secondaryScoringEnabled: enableSecondary,
          secondaryAnalyst: enableSecondary ? secondaryAnalyst : null
        });
        success.push(product);
      } catch (err) {
        failed.push({ product, error: err?.message || "Unknown error" });
      }
    }

    setIsProcessing(false);
    setResults({ success, failed, total: selectedProducts.length });

    if (failed.length === 0) {
      toast({ title: "Scoring initiated", description: `Started scoring for ${success.length} product${success.length === 1 ? "" : "s"}.` });
    } else if (success.length > 0) {
      toast({ title: "Partially completed", description: `${success.length} succeeded, ${failed.length} failed.`, variant: "destructive" });
    } else {
      toast({ title: "Scoring failed", description: `All ${failed.length} product${failed.length === 1 ? "" : "s"} failed.`, variant: "destructive" });
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    setResults(null);
    setTemplateId("");
    setEnableSecondary(false);
    setSecondaryAnalystId("");
    setSearch("");
    onClose();
    if (results && onCompleted) onCompleted();
  };

  const fullName = (c) => [c?.salutation, c?.first_name, c?.middle_name, c?.last_name, c?.suffix].filter(Boolean).join(" ").trim();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-indigo-500" />
            Bulk Initiate Scoring
          </DialogTitle>
          <DialogDescription>
            Start a scoring matrix evaluation for {selectedProducts.length} selected manager product{selectedProducts.length === 1 ? "" : "s"} at once.
          </DialogDescription>
        </DialogHeader>

        {results ? (
          /* Results summary */
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-800">
                  {results.success.length} of {results.total} product{results.total === 1 ? "" : "s"} scoring initiated
                </p>
                <p className="text-xs text-emerald-600">
                  {results.failed.length > 0 ? `${results.failed.length} failed — see below.` : "All evaluations started successfully."}
                </p>
              </div>
            </div>

            {results.failed.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-red-700 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Failed products
                </p>
                {results.failed.map(({ product, error }) => (
                  <div key={product.id} className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-200">
                    <Package className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-red-800 truncate">{product.name}</p>
                      <p className="text-[10px] text-red-500 truncate">{error}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {results.success.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-emerald-700">Successfully started:</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {results.success.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 p-1.5 rounded bg-gray-50">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span className="text-xs text-gray-700 truncate">{p.name}</span>
                      <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">{p.firm_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {/* Template picker */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Scoring Matrix Template *</Label>
              {loadingTemplates ? (
                <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading templates...</div>
              ) : scoringTemplates.length === 0 ? (
                <p className="text-xs text-amber-600 italic">No scoring matrix templates found. Create one in Templates first.</p>
              ) : (
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select a scoring matrix template..." /></SelectTrigger>
                  <SelectContent>
                    {scoringTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedTemplate && (
                <p className="text-[11px] text-gray-500">
                  {(selectedTemplate.scoring_blocks || []).length} blocks · {((selectedTemplate.scoring_blocks || []).reduce((s, b) => s + (b.criteria || []).length, 0))} criteria
                </p>
              )}
            </div>

            {/* Primary analyst */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Primary Analyst *</Label>
              {loadingContacts ? (
                <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading contacts...</div>
              ) : analystContacts.length === 0 ? (
                <p className="text-xs text-amber-600 italic">No active contacts found in your firm. Link a contact in your profile first.</p>
              ) : (
                <Select value={primaryAnalystId} onValueChange={setPrimaryAnalystId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select primary analyst..." /></SelectTrigger>
                  <SelectContent>
                    {analystContacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{fullName(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Secondary analyst (optional) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="enable-secondary" checked={enableSecondary} onCheckedChange={(v) => { setEnableSecondary(v); if (!v) setSecondaryAnalystId(""); }} />
                <Label htmlFor="enable-secondary" className="text-xs font-medium cursor-pointer">Enable secondary analyst scoring</Label>
              </div>
              {enableSecondary && (
                <Select value={secondaryAnalystId} onValueChange={setSecondaryAnalystId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select secondary analyst..." /></SelectTrigger>
                  <SelectContent>
                    {analystContacts.filter((c) => c.id !== primaryAnalystId).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{fullName(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Selected products list */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Selected Products ({selectedProducts.length})
              </Label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter selected products..."
                  className="pl-8 h-8 text-xs pr-8"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="max-h-44 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2 bg-gray-50/50">
                {visibleProducts.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-2">No products match your filter.</p>
                ) : (
                  visibleProducts.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 p-1.5 rounded bg-white border border-gray-100">
                      <Package className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                      <span className="text-xs text-gray-700 font-medium truncate flex-1">{p.name}</span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{p.firm_name}</span>
                    </div>
                  ))
                )}
                {visibleProducts.length < selectedProducts.length && (
                  <p className="text-[10px] text-gray-400 text-center pt-1">
                    Showing {visibleProducts.length} of {selectedProducts.length}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {results ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isProcessing}>Cancel</Button>
              <Button onClick={handleStart} disabled={!canStart}>
                {isProcessing ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Initiating...</>
                ) : (
                  <><ClipboardCheck className="w-3.5 h-3.5" /> Start Scoring ({selectedProducts.length})</>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}