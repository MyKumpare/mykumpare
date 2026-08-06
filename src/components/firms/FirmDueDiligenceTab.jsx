import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardCheck, Pencil, Trash2 } from "lucide-react";
import AddDueDiligenceDialog from "./AddDueDiligenceDialog";
import { syncDdNotifications } from "./ddNotificationSync";

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

export default function FirmDueDiligenceTab({ firmId, firmName, contacts = [], onContactClick, onProductClick }) {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["due-diligence", firmId],
    queryFn: () => base44.entities.DueDiligence.filter({ firm_id: firmId }, "-created_date", 200),
    enabled: !!firmId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", firmId],
    queryFn: () => base44.entities.Product.filter({ firm_id: firmId }),
    enabled: !!firmId,
  });

  const firmContacts = contacts.filter((c) => !c.deleted_at && (c.firm_ids || []).includes(firmId));

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.DueDiligence.create(data),
    onSuccess: (savedRecord) => { syncDdNotifications(savedRecord); queryClient.invalidateQueries({ queryKey: ["due-diligence", firmId] }); setShowDialog(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DueDiligence.update(id, data),
    onSuccess: (savedRecord) => { syncDdNotifications(savedRecord); queryClient.invalidateQueries({ queryKey: ["due-diligence", firmId] }); setShowDialog(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DueDiligence.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["due-diligence", firmId] }),
  });

  const handleSubmit = (data) => {
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const sorted = [...records].sort((a, b) => (a.status || "").localeCompare(b.status || ""));

  const findContact = (id) => contacts.find((c) => c.id === id && !c.deleted_at);
  const findProduct = (id) => products.find((p) => p.id === id && !p.deleted_at);

  const openContact = (id) => {
    if (!id || !onContactClick) return;
    const contact = findContact(id);
    if (contact) onContactClick(contact);
  };
  const openProduct = (id) => {
    if (!id || !onProductClick) return;
    const product = findProduct(id);
    if (product) onProductClick(product);
  };

  return (
    <div className="space-y-3">
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

      {isLoading ? (
        <div className="text-xs text-gray-400 italic py-4 text-center">Loading...</div>
      ) : sorted.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-xl">
          No due diligence records yet
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((rec) => (
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
                  {rec.product_id && findProduct(rec.product_id) ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openProduct(rec.product_id); }}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline truncate text-left"
                    >
                      {rec.product_name || "—"}
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
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  <span>Primary: {
                    rec.primary_analyst_contact_id && findContact(rec.primary_analyst_contact_id) ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openContact(rec.primary_analyst_contact_id); }}
                        className="text-indigo-600 hover:text-indigo-700 hover:underline font-medium"
                      >
                        {rec.primary_analyst_name || "—"}
                      </button>
                    ) : <span className="text-gray-700 font-medium">{rec.primary_analyst_name || "—"}</span>
                  }</span>
                  {rec.secondary_analyst_name && (
                    <span className="ml-3">Secondary: {
                      rec.secondary_analyst_contact_id && findContact(rec.secondary_analyst_contact_id) ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openContact(rec.secondary_analyst_contact_id); }}
                          className="text-indigo-600 hover:text-indigo-700 hover:underline font-medium"
                        >
                          {rec.secondary_analyst_name}
                        </button>
                      ) : <span className="text-gray-700 font-medium">{rec.secondary_analyst_name}</span>
                    }</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => { setEditing(rec); setShowDialog(true); }} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => { if (window.confirm(`Delete due diligence for "${rec.product_name}"?`)) deleteMutation.mutate(rec.id); }}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddDueDiligenceDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        firmId={firmId}
        firmName={firmName}
        products={products}
        contacts={firmContacts}
        editingRecord={editing}
        onSubmit={handleSubmit}
      />
    </div>
  );
}