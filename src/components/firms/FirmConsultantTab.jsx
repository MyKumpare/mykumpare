import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Building2, User, Calendar } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import AddConsultantDialog from "./AddConsultantDialog";
import { buildContactFullName } from "./consultantFullName";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function FirmConsultantTab({ firmId, firmName }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingConsultant, setEditingConsultant] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const { data: consultants = [], isLoading } = useQuery({
    queryKey: ["firm-consultants", firmId],
    queryFn: () => base44.entities.FirmConsultant.filter({ firm_id: firmId }, "-created_date", 200),
    enabled: !!firmId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FirmConsultant.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["firm-consultants", firmId] });
      setPendingDelete(null);
      toast({ title: "Consultant removed", description: "The consultant has been removed." });
    },
    onError: (err) => {
      toast({ title: "Failed to remove", description: err.message, variant: "destructive" });
    },
  });

  const handleAdd = () => {
    setEditingConsultant(null);
    setShowDialog(true);
  };

  const handleEdit = (consultant) => {
    setEditingConsultant(consultant);
    setShowDialog(true);
  };

  const handleDelete = (consultant) => {
    setPendingDelete(consultant);
  };

  const confirmDelete = () => {
    if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
          onClick={handleAdd}
        >
          <Plus className="w-3.5 h-3.5" /> Add Consultant
        </Button>
      </div>

      {isLoading ? (
        <div className="text-xs text-gray-400 italic py-4 text-center">Loading...</div>
      ) : consultants.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-xl">
          No investment consultants added yet
        </div>
      ) : (
        <div className="space-y-3">
          {consultants.map((consultant) => (
            <div key={consultant.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
              {/* Header row */}
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate">{consultant.consultant_firm_name}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(consultant.roles || []).map((role) => (
                      <span key={role} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">{role}</span>
                    ))}
                    {(!consultant.roles || consultant.roles.length === 0) && (
                      <span className="text-xs text-gray-400 italic">No roles assigned</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-gray-500 hover:text-indigo-600 gap-1 text-xs" onClick={() => handleEdit(consultant)}>
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-gray-500 hover:text-red-500 gap-1 text-xs" onClick={() => handleDelete(consultant)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Dates row */}
              <div className="flex items-center gap-4 text-xs text-gray-500 pl-10">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Inception: <span className="font-medium text-gray-700">{formatDate(consultant.inception_date)}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Termination: <span className="font-medium text-gray-700">{formatDate(consultant.termination_date)}</span>
                </span>
              </div>

              {/* Contacts */}
              {(consultant.contacts || []).length > 0 && (
                <div className="pl-10 space-y-1.5">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Related Contacts</div>
                  {(consultant.contacts || []).map((c) => (
                    <div key={c.id} className="flex items-start gap-2 text-xs py-1">
                      <User className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-800">{c.contact_name || "—"}</span>
                        {c.contact_role && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">{c.contact_role}</span>
                        )}
                        <span className="ml-2 text-gray-400">
                          {formatDate(c.inception_date)} → {formatDate(c.termination_date)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AddConsultantDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        firmId={firmId}
        firmName={firmName}
        editingConsultant={editingConsultant}
        existingConsultants={consultants}
      />

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPendingDelete(null)}>
          <div className="bg-white rounded-lg p-6 max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              <h3 className="text-sm font-semibold text-gray-800">Remove Consultant</h3>
            </div>
            <p className="text-sm text-gray-600">
              Remove <span className="font-medium">{pendingDelete.consultant_firm_name}</span> as a consultant? This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" size="sm" onClick={() => setPendingDelete(null)}>Cancel</Button>
              <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white" onClick={confirmDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? "Removing..." : "Remove"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}