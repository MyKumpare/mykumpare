import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { X, ShieldCheck, Plus, Search, Pencil, ClipboardCheck } from "lucide-react";
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

// Picker modal that lists every DueDiligence record with search + add/edit,
// mirroring the row UI of the Contact Due Diligence tab.
export default function DueDiligencePickerModal({ open, onClose, onFirmClick, onContactClick, onProductClick }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["due-diligence-all"],
    queryFn: () => base44.entities.DueDiligence.list("-created_date", 5000),
    enabled: open,
  });

  // Products of the firm on the record being edited (populates the picker).
  const { data: editProducts = [] } = useQuery({
    queryKey: ["products", editing?.firm_id],
    queryFn: () => base44.entities.Product.filter({ firm_id: editing.firm_id }),
    enabled: !!editing?.firm_id,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.DueDiligence.create(data),
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ["due-diligence-all"] });
      if (variables?.firm_id) queryClient.invalidateQueries({ queryKey: ["due-diligence", variables.firm_id] });
      setShowDialog(false);
      setEditing(null);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DueDiligence.update(id, data),
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ["due-diligence-all"] });
      if (editing?.firm_id) queryClient.invalidateQueries({ queryKey: ["due-diligence", editing.firm_id] });
      setShowDialog(false);
      setEditing(null);
    },
  });

  const q = search.toLowerCase();
  const filtered = useMemo(() => {
    const active = records.filter(r => !r.deleted_at);
    if (!q) return active;
    return active.filter(r =>
      (r.product_name || "").toLowerCase().includes(q) ||
      (r.firm_name || "").toLowerCase().includes(q) ||
      (r.primary_analyst_name || "").toLowerCase().includes(q) ||
      (r.secondary_analyst_name || "").toLowerCase().includes(q) ||
      (r.status || "").toLowerCase().includes(q) ||
      (r.process_status || "").toLowerCase().includes(q)
    );
  }, [records, q]);

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
      if (contact && !contact.deleted_at) { onContactClick(contact); onClose(); }
    } catch (e) { console.error("Failed to load contact", e); }
    finally { setLinkedLoading(null); }
  };
  const openLinkedProduct = async (id) => {
    if (!id || !onProductClick || linkedLoading) return;
    setLinkedLoading("product-" + id);
    try {
      const product = await base44.entities.Product.get(id);
      if (product && !product.deleted_at) { onProductClick(product); onClose(); }
    } catch (e) { console.error("Failed to load product", e); }
    finally { setLinkedLoading(null); }
  };
  const openLinkedFirm = (firmId) => {
    if (!firmId || !onFirmClick) return;
    onFirmClick(firmId);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[78vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            Due Diligence
            <span className="text-xs text-gray-400 font-normal">({filtered.length})</span>
          </h2>
          <button type="button" onClick={onClose}>
            <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by product, firm, analyst, status..."
              className="w-full h-9 pl-9 pr-8 text-sm rounded-lg border border-gray-200 outline-none focus:border-indigo-400 bg-gray-50"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-2 px-3">
          {isLoading ? (
            <p className="text-sm text-gray-400 italic text-center py-8">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-8">
              {search ? "No due diligence records match your search." : "No due diligence records yet."}
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map(rec => (
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
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-x-2 gap-y-0.5 flex-wrap">
                      {rec.firm_id && onFirmClick ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openLinkedFirm(rec.firm_id); }}
                          className="text-indigo-600 hover:text-indigo-700 hover:underline font-medium"
                        >
                          {rec.firm_name || "—"}
                        </button>
                      ) : (
                        <span className="text-gray-700">{rec.firm_name || "—"}</span>
                      )}
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
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100">
          <button
            type="button"
            onClick={() => { setEditing(null); setShowDialog(true); }}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Due Diligence
          </button>
        </div>
      </div>

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