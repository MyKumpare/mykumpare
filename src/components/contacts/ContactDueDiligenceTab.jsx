import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Pencil, Plus } from "lucide-react";
import AddDueDiligenceDialog from "../firms/AddDueDiligenceDialog";
import { syncDdNotifications, syncProductStatusFromDd } from "../firms/ddNotificationSync";
import DdFilterTabs, { getDdCounts, filterDdRecords } from "../firms/DdFilterTabs";

const STATUS_STYLES = {
  "Pipeline": "bg-blue-50 text-blue-700 border-blue-200",
  "Buy List": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Rejected": "bg-red-50 text-red-700 border-red-200",
};

const PROCESS_STYLES = {
  "Not Started": "bg-gray-100 text-gray-600 border-gray-200",
  "In-process": "bg-amber-50 text-amber-700 border-amber-200",
  "Completed": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

// Shows every DueDiligence record where this contact is the primary or secondary
// analyst. Each row edits the ORIGINAL record (updates propagate to the source).
export default function ContactDueDiligenceTab({ contactId, contactName, onContactClick, onProductClick }) {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [activeTab, setActiveTab] = useState("active");

  const { data: primary = [], isLoading: lp } = useQuery({
    queryKey: ["dd-primary-analyst", contactId],
    queryFn: () => base44.entities.DueDiligence.filter({ primary_analyst_contact_id: contactId }, "-created_date", 500),
    enabled: !!contactId,
  });
  const { data: secondary = [], isLoading: ls } = useQuery({
    queryKey: ["dd-secondary-analyst", contactId],
    queryFn: () => base44.entities.DueDiligence.filter({ secondary_analyst_contact_id: contactId }, "-created_date", 500),
    enabled: !!contactId,
  });
  // DD records where this contact is assigned to a sub-stage task (denormalized lookup)
  const { data: assigned = [], isLoading: la } = useQuery({
    queryKey: ["dd-assigned-tasks", contactId],
    queryFn: () => base44.entities.DueDiligence.filter({ assigned_contact_ids: contactId }, "-created_date", 500),
    enabled: !!contactId,
  });

  // Products of the firm on the record being edited (populates the picker).
  const { data: editProducts = [] } = useQuery({
    queryKey: ["products", editing?.firm_id],
    queryFn: () => base44.entities.Product.filter({ firm_id: editing.firm_id }),
    enabled: !!editing?.firm_id,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const savedRecord = await base44.entities.DueDiligence.update(id, data);
      await syncDdNotifications(savedRecord);
      await syncProductStatusFromDd(savedRecord, queryClient);
      return savedRecord;
    },
    onSuccess: (savedRecord) => {
      queryClient.invalidateQueries({ queryKey: ["dd-primary-analyst", contactId] });
      queryClient.invalidateQueries({ queryKey: ["dd-secondary-analyst", contactId] });
      queryClient.invalidateQueries({ queryKey: ["dd-assigned-tasks", contactId] });
      queryClient.invalidateQueries({ queryKey: ["dd-notifications", contactId] });
      if (editing?.firm_id) queryClient.invalidateQueries({ queryKey: ["due-diligence", editing.firm_id] });
      setShowDialog(false);
    },
  });
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const savedRecord = await base44.entities.DueDiligence.create(data);
      await syncDdNotifications(savedRecord);
      await syncProductStatusFromDd(savedRecord, queryClient);
      return savedRecord;
    },
    onSuccess: (savedRecord, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dd-primary-analyst", contactId] });
      queryClient.invalidateQueries({ queryKey: ["dd-secondary-analyst", contactId] });
      queryClient.invalidateQueries({ queryKey: ["dd-assigned-tasks", contactId] });
      queryClient.invalidateQueries({ queryKey: ["dd-notifications", contactId] });
      if (variables?.firm_id) queryClient.invalidateQueries({ queryKey: ["due-diligence", variables.firm_id] });
      setShowDialog(false);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DueDiligence.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dd-primary-analyst", contactId] });
      queryClient.invalidateQueries({ queryKey: ["dd-secondary-analyst", contactId] });
      queryClient.invalidateQueries({ queryKey: ["dd-assigned-tasks", contactId] });
      queryClient.invalidateQueries({ queryKey: ["dd-notifications", contactId] });
      if (editing?.firm_id) queryClient.invalidateQueries({ queryKey: ["due-diligence", editing.firm_id] });
    },
  });

  // Merge primary + secondary + assigned, dedupe by id, tag the contact's role on each record.
  const records = useMemo(() => {
    const map = new Map();
    primary.forEach((r) => map.set(r.id, { ...r, _role: "Primary" }));
    secondary.forEach((r) => {
      if (!map.has(r.id)) map.set(r.id, { ...r, _role: "Secondary" });
    });
    assigned.forEach((r) => {
      if (!map.has(r.id)) map.set(r.id, { ...r, _role: "Task Assignee" });
    });
    return [...map.values()];
  }, [primary, secondary, assigned]);

  const sorted = [...records].sort((a, b) => (a.status || "").localeCompare(b.status || ""));
  const counts = getDdCounts(sorted);
  const filtered = filterDdRecords(sorted, activeTab);

  const handleSubmit = (data) => {
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const [linkedLoading, setLinkedLoading] = useState(null);
  const openLinkedContact = async (id) => {
    if (!id || !onContactClick || linkedLoading) return;
    setLinkedLoading("contact-" + id);
    try {
      const contact = await base44.entities.Contact.get(id);
      if (contact && !contact.deleted_at) onContactClick(contact);
    } catch (e) {
      console.error("Failed to load contact", e);
    } finally {
      setLinkedLoading(null);
    }
  };
  const openLinkedProduct = async (id) => {
    if (!id || !onProductClick || linkedLoading) return;
    setLinkedLoading("product-" + id);
    try {
      const product = await base44.entities.Product.get(id);
      if (product && !product.deleted_at) onProductClick(product);
    } catch (e) {
      console.error("Failed to load product", e);
    } finally {
      setLinkedLoading(null);
    }
  };

  if (!contactId) {
    return (
      <div className="text-sm text-gray-400 italic py-4 text-center">
        Save the contact to view due diligence records.
      </div>
    );
  }

  const isLoading = lp || ls || la;

  return (
    <div className="space-y-2 py-1">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
          onClick={() => { setEditing(null); setShowDialog(true); }}
        >
          <Plus className="w-3.5 h-3.5" /> Add Due Diligence
        </Button>
      </div>

      {sorted.length > 0 && (
        <DdFilterTabs activeTab={activeTab} onChange={setActiveTab} counts={counts} />
      )}

      {isLoading ? (
        <div className="text-xs text-gray-400 italic py-4 text-center">Loading...</div>
      ) : records.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-xl">
          No due diligence records where {contactName || "this contact"} is an analyst or task assignee.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-xl">
          No {activeTab === "pending_approval" ? "pending approval" : activeTab} records.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((rec) => (
            <div
              key={rec.id}
              role="button"
              tabIndex={0}
              onClick={() => { setEditing(rec); setShowDialog(true); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditing(rec); setShowDialog(true); } }}
              className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30 cursor-pointer transition-colors"
            >
              <ClipboardCheck className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {rec.product_id && onProductClick ? (
                    <button
                      type="button"
                      disabled={linkedLoading === "product-" + rec.product_id}
                      onClick={(e) => { e.stopPropagation(); openLinkedProduct(rec.product_id); }}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline truncate text-left disabled:opacity-60"
                    >
                      {linkedLoading === "product-" + rec.product_id ? "Loading…" : (rec.product_name || "—")}
                    </button>
                  ) : (
                    <span className="text-sm font-medium text-gray-800 truncate">{rec.product_name || "—"}</span>
                  )}
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${STATUS_STYLES[rec.status] || STATUS_STYLES["Pipeline"]}`}>
                    {rec.status}
                  </span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${PROCESS_STYLES[rec.process_status] || PROCESS_STYLES["Not Started"]}`}>
                    {rec.process_status || "Not Started"}
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-indigo-50 text-indigo-700 border-indigo-200">
                    {rec._role} Analyst
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-x-2 gap-y-0.5 flex-wrap">
                  {rec.firm_name || "—"}
                  <span>Primary: {
                    rec.primary_analyst_contact_id && onContactClick ? (
                      <button
                        type="button"
                        disabled={linkedLoading === "contact-" + rec.primary_analyst_contact_id}
                        onClick={(e) => { e.stopPropagation(); openLinkedContact(rec.primary_analyst_contact_id); }}
                        className="text-indigo-600 hover:text-indigo-700 hover:underline font-medium disabled:opacity-60"
                      >
                        {linkedLoading === "contact-" + rec.primary_analyst_contact_id ? "Loading…" : (rec.primary_analyst_name || "—")}
                      </button>
                    ) : <span className="text-gray-700 font-medium">{rec.primary_analyst_name || "—"}</span>
                  }</span>
                  {rec.secondary_analyst_name && (
                    <span>Secondary: {
                      rec.secondary_analyst_contact_id && onContactClick ? (
                        <button
                          type="button"
                          disabled={linkedLoading === "contact-" + rec.secondary_analyst_contact_id}
                          onClick={(e) => { e.stopPropagation(); openLinkedContact(rec.secondary_analyst_contact_id); }}
                          className="text-indigo-600 hover:text-indigo-700 hover:underline font-medium disabled:opacity-60"
                        >
                          {linkedLoading === "contact-" + rec.secondary_analyst_contact_id ? "Loading…" : rec.secondary_analyst_name}
                        </button>
                      ) : <span className="text-gray-700 font-medium">{rec.secondary_analyst_name}</span>
                    }</span>
                  )}
                </div>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => { setEditing(rec); setShowDialog(true); }}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600"
                  title="Edit due diligence record"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddDueDiligenceDialog
        open={showDialog}
        onOpenChange={(v) => { setShowDialog(v); if (!v) setEditing(null); }}
        firmId={editing?.firm_id}
        firmName={editing?.firm_name}
        products={editProducts}
        contacts={[]}
        editingRecord={editing}
        firmSelectionMode
        onSubmit={handleSubmit}
      />
    </div>
  );
}