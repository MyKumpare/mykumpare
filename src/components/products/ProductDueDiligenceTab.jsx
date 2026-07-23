import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Pencil, Plus } from "lucide-react";
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

// Shows every DueDiligence record associated with this product and lets the
// user add a new one (firm + product pre-selected) or edit existing records.
export default function ProductDueDiligenceTab({ productId, productName, firmId, firmName, onFirmClick }) {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["due-diligence", "product", productId],
    queryFn: () => base44.entities.DueDiligence.filter({ product_id: productId }, "-created_date", 500),
    enabled: !!productId,
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
      queryClient.invalidateQueries({ queryKey: ["due-diligence", "product", productId] });
      if (editing?.firm_id) queryClient.invalidateQueries({ queryKey: ["due-diligence", editing.firm_id] });
      queryClient.invalidateQueries({ queryKey: ["due-diligence-all"] });
      setShowDialog(false);
    },
  });
  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.DueDiligence.create(data),
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ["due-diligence", "product", productId] });
      if (variables?.firm_id) queryClient.invalidateQueries({ queryKey: ["due-diligence", variables.firm_id] });
      queryClient.invalidateQueries({ queryKey: ["due-diligence-all"] });
      setShowDialog(false);
    },
  });

  const handleSubmit = (data) => {
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  if (!productId) {
    return (
      <div className="text-sm text-gray-400 italic py-4 text-center">
        Save the product to view due diligence records.
      </div>
    );
  }

  // For a brand-new record tied to this product, lock the firm + product by
  // passing a single-product list and the product's firm.
  const newRecordProducts = [{ id: productId, name: productName, firm_id: firmId, firm_name: firmName }];

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

      {isLoading ? (
        <div className="text-xs text-gray-400 italic py-4 text-center">Loading...</div>
      ) : records.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-xl">
          No due diligence records for {productName || "this product"}.
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((rec) => (
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
                  <span className="text-sm font-medium text-gray-800 truncate">{rec.product_name || "—"}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${STATUS_STYLES[rec.status] || STATUS_STYLES["Pipeline"]}`}>
                    {rec.status}
                  </span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${PROCESS_STYLES[rec.process_status] || PROCESS_STYLES["Not Started"]}`}>
                    {rec.process_status || "Not Started"}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-x-2 gap-y-0.5 flex-wrap">
                  {rec.firm_id && onFirmClick ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onFirmClick(rec.firm_id); }}
                      className="text-indigo-600 hover:text-indigo-700 hover:underline font-medium"
                    >
                      {rec.firm_name || "—"}
                    </button>
                  ) : (
                    <span className="text-gray-700">{rec.firm_name || "—"}</span>
                  )}
                  <span>Primary: <span className="text-gray-700 font-medium">{rec.primary_analyst_name || "—"}</span></span>
                  {rec.secondary_analyst_name && (
                    <span>Secondary: <span className="text-gray-700 font-medium">{rec.secondary_analyst_name}</span></span>
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
        firmId={editing ? editing.firm_id : firmId}
        firmName={editing ? editing.firm_name : firmName}
        products={editing ? editProducts : newRecordProducts}
        contacts={[]}
        editingRecord={editing}
        onSubmit={handleSubmit}
      />
    </div>
  );
}