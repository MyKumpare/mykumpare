import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Search, Plus, FileText, Filter, Pencil, Trash2, Copy } from "lucide-react";
import { format } from "date-fns";
import AddTemplateDialog from "./AddTemplateDialog";

const fmtDate = (iso) => {
  if (!iso) return "";
  try {
    const [y, m, d] = iso.split("-");
    return `${m}/${d}/${y}`;
  } catch {
    return iso;
  }
};

/**
 * Modal for browsing, searching, and filtering templates.
 * - Search by name
 * - Filter by template type
 * - Add new template via AddTemplateDialog
 */
export default function TemplatePickerModal({ open, onClose }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Template.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: "Template deleted" });
    },
    onError: (err) => {
      toast({ title: "Failed to delete template", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const copyMutation = useMutation({
    mutationFn: async (template) => {
      const payload = {
        name: `${template.name} (Copy)`,
        template_type: template.template_type || undefined,
        create_date: format(new Date(), "yyyy-MM-dd"),
        stages: template.stages || [],
      };
      return base44.entities.Template.create(payload);
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: "Template copied" });
      setEditTemplate(created);
      setAddOpen(true);
    },
    onError: (err) => {
      toast({ title: "Failed to copy template", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: () => base44.entities.Template.list("-created_date", 5000),
    enabled: open,
  });

  const { data: types = [] } = useQuery({
    queryKey: ["template_types"],
    queryFn: () => base44.entities.TemplateType.list("-created_date"),
    enabled: open,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return templates
      .filter((t) => typeFilter === "all" || t.template_type === typeFilter)
      .filter((t) => !q || (t.name || "").toLowerCase().includes(q) || (t.template_type || "").toLowerCase().includes(q))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [templates, search, typeFilter]);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-600" />
              Templates
              <span className="text-xs text-gray-400 font-normal">({templates.length})</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                placeholder="Search templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Filter className="w-3.5 h-3.5" />
                Type:
              </div>
              <button
                onClick={() => setTypeFilter("all")}
                className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors ${typeFilter === "all" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                All
              </button>
              {types.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTypeFilter(t.name)}
                  className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors ${typeFilter === t.name ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-[200px]">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">
                  {search || typeFilter !== "all" ? "No templates match your filters." : "No templates yet."}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filtered.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <button
                        onClick={() => { setEditTemplate(t); setAddOpen(true); }}
                        className="text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:underline truncate text-left"
                      >
                        {t.name}
                      </button>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {t.template_type && (
                        <Badge variant="secondary" className="text-xs">
                          {t.template_type}
                        </Badge>
                      )}
                      {t.create_date && (
                        <span className="text-[11px] text-gray-400">{fmtDate(t.create_date)}</span>
                      )}
                      <button
                        onClick={() => copyMutation.mutate(t)}
                        className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Copy as new version"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setEditTemplate(t); setAddOpen(true); }}
                        className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(t)}
                        className="p-1 rounded hover:bg-red-100 text-gray-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-2 border-t">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button size="sm" className="gap-1" onClick={() => setAddOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              Add Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddTemplateDialog
        open={addOpen}
        onOpenChange={(o) => { setAddOpen(o); if (!o) setEditTemplate(null); }}
        editTemplate={editTemplate}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <p className="text-sm text-gray-500">
              Are you sure you want to delete <span className="font-medium text-gray-700">"{deleteTarget?.name}"</span>? This action cannot be undone.
            </p>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}