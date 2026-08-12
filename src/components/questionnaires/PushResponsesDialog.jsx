import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import SearchableSelect from "@/components/common/SearchableSelect";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import {
  ArrowRightToLine, Building2, Package, User, RefreshCw, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";

// Mappable text fields per target entity type
const FIELD_OPTIONS = {
  Firm: [
    { value: "name", label: "Name" },
    { value: "description", label: "Description" },
    { value: "website", label: "Website" },
    { value: "linkedin_url", label: "LinkedIn URL" },
    { value: "email", label: "Email" },
  ],
  Product: [
    { value: "name", label: "Name" },
    { value: "description", label: "Description" },
    { value: "asset_class", label: "Asset Class" },
    { value: "geography", label: "Geography" },
    { value: "market_cap", label: "Market Cap" },
    { value: "style", label: "Style" },
    { value: "investment_process", label: "Investment Process" },
    { value: "implementation_process", label: "Implementation Process" },
    { value: "diversification_classification", label: "Diversification Classification" },
    { value: "aapryl_style", label: "Aapryl Style" },
    { value: "inv_desc_edge", label: "Investment Edge" },
    { value: "inv_desc_philosophy", label: "Investment Philosophy" },
    { value: "inv_desc_universe", label: "Investment Universe" },
    { value: "inv_desc_process", label: "Investment Process Narrative" },
    { value: "inv_desc_process_buy_discipline", label: "Buy Discipline" },
    { value: "inv_desc_process_sell_discipline", label: "Sell Discipline" },
    { value: "inv_desc_portfolio_expectations", label: "Portfolio Expectations" },
  ],
  Contact: [
    { value: "title", label: "Job Title" },
    { value: "email", label: "Email" },
    { value: "linkedin_url", label: "LinkedIn URL" },
    { value: "biography", label: "Biography" },
    { value: "notes", label: "Notes" },
  ],
};

const TARGET_TYPES = [
  { value: "Firm", label: "Firm", icon: Building2, color: "text-blue-600" },
  { value: "Product", label: "Product", icon: Package, color: "text-purple-600" },
  { value: "Contact", label: "Contact", icon: User, color: "text-pink-600" },
];

// Convert HTML notes to plain text for fields that store plain text
const htmlToText = (html) => {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").trim();
};

/**
 * Dialog for mapping questionnaire sub-section responses to Firm/Product/Contact fields
 * and pushing the values to update those records. Persists mappings in ResponseMapping.
 *
 * Props:
 *   open, onOpenChange
 *   questionnaire — the Questionnaire record (with sections/sub_sections)
 *   firms, products, contacts — lists from Home page
 */
export default function PushResponsesDialog({ open, onOpenChange, questionnaire, firms = [], products = [], contacts = [] }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const [targetType, setTargetType] = useState("Firm");
  const [targetId, setTargetId] = useState("");
  const [mappings, setMappings] = useState({}); // { sub_section_id: field_name }
  const [existingMapping, setExistingMapping] = useState(null);
  const [pushing, setPushing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Collect all sub-sections that have a response (notes)
  const answeredSubSections = useMemo(() => {
    if (!questionnaire?.sections) return [];
    const list = [];
    (questionnaire.sections || []).forEach((s) => {
      (s.sub_sections || []).forEach((ss) => {
        if (ss.notes && htmlToText(ss.notes)) {
          list.push({
            section_id: s.id,
            section_name: s.name,
            sub_section_id: ss.id,
            sub_section_name: ss.name,
            notes: ss.notes,
            plainText: htmlToText(ss.notes),
          });
        }
      });
    });
    return list;
  }, [questionnaire]);

  // Target record options based on type
  const targetOptions = useMemo(() => {
    if (targetType === "Firm") return firms.filter((f) => !f.deleted_at).map((f) => ({ value: f.id, label: f.name }));
    if (targetType === "Product") return products.filter((p) => !p.deleted_at).map((p) => ({ value: p.id, label: `${p.name}${p.firm_name ? ` (${p.firm_name})` : ""}` }));
    if (targetType === "Contact") return contacts.filter((c) => !c.deleted_at).map((c) => ({ value: c.id, label: `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.email || "Unknown" }));
    return [];
  }, [targetType, firms, products, contacts]);

  // Fetch existing ResponseMapping for this questionnaire + target
  const { data: existingMappings = [] } = useQuery({
    queryKey: ["response-mappings", questionnaire?.id],
    queryFn: () => base44.entities.ResponseMapping.filter({ questionnaire_id: questionnaire.id }, "-created_date", 100),
    enabled: open && !!questionnaire?.id,
  });

  // When target changes, load the existing mapping for this target
  useEffect(() => {
    if (!open) return;
    const match = existingMappings.find(
      (m) => m.target_entity_type === targetType && m.target_record_id === targetId
    );
    setExistingMapping(match || null);
    // Pre-populate field selections from saved mappings
    const saved = {};
    (match?.mappings || []).forEach((m) => {
      saved[m.sub_section_id] = m.field_name;
    });
    setMappings(saved);
  }, [open, targetType, targetId, existingMappings]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setTargetType("Firm");
      setTargetId("");
      setMappings({});
      setExistingMapping(null);
    }
  }, [open]);

  // Auto-select the questionnaire's firm as the default target when opening
  useEffect(() => {
    if (open && questionnaire?.firm_id && targetType === "Firm" && !targetId) {
      setTargetId(questionnaire.firm_id);
    }
  }, [open, questionnaire, targetType, targetId]);

  const handleTargetTypeChange = (type) => {
    setTargetType(type);
    setTargetId("");
    setMappings({});
    setExistingMapping(null);
  };

  // Check if a response has changed since last push
  const hasChanged = (ss) => {
    if (!existingMapping) return true;
    const saved = (existingMapping.mappings || []).find((m) => m.sub_section_id === ss.sub_section_id);
    if (!saved) return true;
    return saved.last_pushed_value !== ss.plainText;
  };

  const handlePush = async () => {
    if (!targetId) {
      toast({ title: "Select a target record", variant: "destructive" });
      return;
    }
    // Build the update payload for the target record
    const updateData = {};
    const mappingEntries = [];
    answeredSubSections.forEach((ss) => {
      const field = mappings[ss.sub_section_id];
      if (field) {
        updateData[field] = ss.plainText;
        mappingEntries.push({
          sub_section_id: ss.sub_section_id,
          sub_section_name: ss.sub_section_name,
          field_name: field,
          last_pushed_value: ss.plainText,
          last_pushed_date: new Date().toISOString(),
        });
      }
    });

    if (mappingEntries.length === 0) {
      toast({ title: "Map at least one response to a field", variant: "destructive" });
      return;
    }

    setPushing(true);
    try {
      // 1. Update the target record
      const entityName = targetType;
      await base44.entities[entityName].update(targetId, updateData);

      // 2. Upsert the ResponseMapping
      const targetRecord = targetOptions.find((o) => o.value === targetId);
      const mappingPayload = {
        tenant_id: user?.linked_firm_id || questionnaire?.tenant_id,
        questionnaire_id: questionnaire.id,
        questionnaire_name: questionnaire.name,
        target_entity_type: targetType,
        target_record_id: targetId,
        target_record_name: targetRecord?.label || "",
        mappings: mappingEntries,
        last_refreshed_date: new Date().toISOString(),
      };

      if (existingMapping?.id) {
        await base44.entities.ResponseMapping.update(existingMapping.id, mappingPayload);
      } else {
        await base44.entities.ResponseMapping.create(mappingPayload);
      }

      queryClient.invalidateQueries({ queryKey: ["response-mappings", questionnaire.id] });
      queryClient.invalidateQueries({ queryKey: [targetType.toLowerCase() + "s"] });
      queryClient.invalidateQueries({ queryKey: ["firms"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });

      toast({ title: `Pushed ${mappingEntries.length} response(s) to ${targetType}`, description: targetRecord?.label });
    } catch (err) {
      console.error("Push responses error:", err);
      toast({ title: "Failed to push responses", description: err.message, variant: "destructive" });
    } finally {
      setPushing(false);
    }
  };

  // Refresh: re-push all previously mapped fields (even unchanged ones)
  const handleRefreshAll = async () => {
    if (!existingMapping) return;
    setRefreshing(true);
    try {
      const updateData = {};
      const mappingEntries = [];
      (existingMapping.mappings || []).forEach((m) => {
        const ss = answeredSubSections.find((s) => s.sub_section_id === m.sub_section_id);
        if (ss) {
          updateData[m.field_name] = ss.plainText;
          mappingEntries.push({
            ...m,
            last_pushed_value: ss.plainText,
            last_pushed_date: new Date().toISOString(),
          });
        }
      });

      if (mappingEntries.length > 0) {
        await base44.entities[targetType].update(targetId, updateData);
        await base44.entities.ResponseMapping.update(existingMapping.id, {
          mappings: mappingEntries,
          last_refreshed_date: new Date().toISOString(),
        });
        queryClient.invalidateQueries({ queryKey: ["response-mappings", questionnaire.id] });
        toast({ title: `Refreshed ${mappingEntries.length} mapped field(s)` });
      }
    } catch (err) {
      toast({ title: "Refresh failed", description: err.message, variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  const mappedCount = Object.keys(mappings).filter((k) => mappings[k]).length;
  const changedCount = answeredSubSections.filter((ss) => mappings[ss.sub_section_id] && hasChanged(ss)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightToLine className="w-5 h-5 text-indigo-500" />
            Push Responses to Records
          </DialogTitle>
        </DialogHeader>

        {answeredSubSections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <AlertCircle className="w-8 h-8 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No answered questions found in this questionnaire.</p>
            <p className="text-xs text-gray-400 mt-1">Answer at least one question before pushing responses.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Target selector */}
            <div className="space-y-2 rounded-lg border border-gray-200 p-3 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">Push to:</span>
                <div className="flex gap-1">
                  {TARGET_TYPES.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => handleTargetTypeChange(t.value)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                          targetType === t.value
                            ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                            : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${t.color}`} />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <SearchableSelect
                value={targetId}
                onChange={setTargetId}
                options={targetOptions}
                placeholder={`Select a ${targetType.toLowerCase()}…`}
                searchPlaceholder={`Search ${targetType.toLowerCase()}s…`}
              />
            </div>

            {/* Existing mapping info */}
            {existingMapping && (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs text-emerald-700">
                    Previously pushed {existingMapping.mappings?.length || 0} field(s)
                    {existingMapping.last_refreshed_date && ` · last: ${new Date(existingMapping.last_refreshed_date).toLocaleDateString()}`}
                  </span>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={handleRefreshAll} disabled={refreshing || !targetId}>
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                  {refreshing ? "Refreshing…" : "Refresh All"}
                </Button>
              </div>
            )}

            {/* Question → Field mapping list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">
                  {answeredSubSections.length} answered question(s)
                </span>
                <span className="text-xs text-gray-400">
                  {mappedCount} mapped · {changedCount} changed
                </span>
              </div>

              <div className="max-h-[40vh] overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2 bg-white">
                {answeredSubSections.map((ss) => {
                  const changed = hasChanged(ss);
                  const isMapped = !!mappings[ss.sub_section_id];
                  return (
                    <div key={ss.sub_section_id} className="rounded-md border border-gray-200 p-2">
                      <div className="flex items-start gap-2 mb-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-700 truncate">{ss.sub_section_name}</p>
                          <p className="text-[11px] text-gray-400 truncate">{ss.section_name}</p>
                        </div>
                        {isMapped && changed && (
                          <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200 flex-shrink-0">
                            Changed
                          </Badge>
                        )}
                        {isMapped && !changed && (
                          <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200 flex-shrink-0">
                            Up to date
                          </Badge>
                        )}
                      </div>
                      {/* Response preview */}
                      <div className="mb-2 px-2 py-1.5 bg-gray-50 rounded text-[11px] text-gray-600 max-h-16 overflow-y-auto">
                        {ss.plainText}
                      </div>
                      {/* Field selector */}
                      <div className="flex items-center gap-2">
                        <ArrowRightToLine className="w-3 h-3 text-gray-300 flex-shrink-0" />
                        <div className="flex-1">
                          <SearchableSelect
                            value={mappings[ss.sub_section_id] || ""}
                            onChange={(val) => setMappings((prev) => ({ ...prev, [ss.sub_section_id]: val }))}
                            options={FIELD_OPTIONS[targetType]}
                            placeholder="Select field to map…"
                            searchPlaceholder="Search fields…"
                          />
                        </div>
                      </div>
                      {/* Last pushed value */}
                      {existingMapping?.mappings?.find((m) => m.sub_section_id === ss.sub_section_id) && (
                        <div className="mt-1.5 px-2 py-1 bg-blue-50/50 rounded text-[10px] text-gray-400">
                          <span className="font-medium">Last pushed:</span>{" "}
                          {existingMapping.mappings.find((m) => m.sub_section_id === ss.sub_section_id).last_pushed_value?.slice(0, 80)}
                          {(existingMapping.mappings.find((m) => m.sub_section_id === ss.sub_section_id).last_pushed_value?.length || 0) > 80 ? "…" : ""}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handlePush} disabled={pushing || !targetId || answeredSubSections.length === 0}>
            {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightToLine className="w-4 h-4" />}
            {pushing ? "Pushing…" : `Push ${mappedCount || ""} Response${mappedCount === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}