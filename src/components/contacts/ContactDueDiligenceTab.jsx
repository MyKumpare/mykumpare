import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ClipboardCheck, Pencil } from "lucide-react";
import AddDueDiligenceDialog from "../firms/AddDueDiligenceDialog";

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
export default function ContactDueDiligenceTab({ contactId, contactName }) {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);

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

  // Products of the firm on the record being edited (populates the picker).
  const { data: editProducts = [] } = useQuery({
    queryKey: ["products", editing?.firm_id],
    queryFn: () => base44.entities.Product.filter({ firm_id: editing.firm_id }),
    enabled: !!editing?.firm_id,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DueDiligence.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dd-primary-analyst", contactId] });
      queryClient.invalidateQueries({ queryKey: ["dd-secondary-analyst", contactId] });
      if (editing?.firm_id) queryClient.invalidateQueries({ queryKey: ["due-diligence", editing.firm_id] });
      setShowDialog(false);
    },
  });

  // Merge primary + secondary, dedupe by id, tag the contact's role on each record.
  const records = useMemo(() => {
    const map = new Map();
    primary.forEach((r) => map.set(r.id, { ...r, _role: "Primary" }));
    secondary.forEach((r) => {
      if (!map.has(r.id)) map.set(r.id, { ...r, _role: "Secondary" });
    });
    return [...map.values()];
  }, [primary, secondary]);

  const handleSubmit = (data) => {
    if (editing) updateMutation.mutate({ id: editing.id, data });
  };

  if (!contactId) {
    return (
      <div className="text-sm text-gray-400 italic py-4 text-center">
        Save the contact to view due diligence records.
      </div>
    );
  }

  const isLoading = lp || ls;

  return (
    <div className="space-y-2 py-1">
      {isLoading ? (
        <div className="text-xs text-gray-400 italic py-4 text-center">Loading...</div>
      ) : records.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-xl">
          No due diligence records where {contactName || "this contact"} is an analyst.
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((rec) => (
            <div
              key={rec.id}
              className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:border-indigo-200 transition-colors"
            >
              <ClipboardCheck className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-800 truncate">{rec.product_name || "—"}</span>
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
                <div className="text-xs text-gray-500 mt-0.5">{rec.firm_name || "—"}</div>
              </div>
              <button
                type="button"
                onClick={() => { setEditing(rec); setShowDialog(true); }}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600"
                title="Edit due diligence record"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
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
        onSubmit={handleSubmit}
      />
    </div>
  );
}