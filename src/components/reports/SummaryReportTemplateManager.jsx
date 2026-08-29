import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Trash2, FileDown, Search, X, Loader2, LayoutTemplate } from "lucide-react";
import { SUMMARY_ENTITY_TYPES, recordDisplayName } from "./summaryReportTemplateConfig";
import { exportRecordSummary } from "./summaryReportExport";
import SummaryReportTemplateDesigner from "./SummaryReportTemplateDesigner";

const ENTITY_LABELS = { Firm: "Firm", Product: "Product", Portfolio: "Portfolio", Contact: "Contact" };

function RecordPickerDialog({ open, onClose, entityType, onPick }) {
  const [search, setSearch] = useState("");
  const [generatingId, setGeneratingId] = useState(null);

  const { data: records, isLoading } = useQuery({
    queryKey: ["summary_picker", entityType],
    queryFn: async () => {
      const list = await base44.entities[entityType].list("-updated_date", 200);
      return Array.isArray(list) ? list : [];
    },
    enabled: open && !!entityType,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return records || [];
    return (records || []).filter((r) => {
      const name = recordDisplayName(entityType, r) || "";
      return name.toLowerCase().includes(q);
    });
  }, [records, search, entityType]);

  const handlePick = async (record) => {
    setGeneratingId(record.id);
    await onPick(record);
    setGeneratingId(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Select a {ENTITY_LABELS[entityType]} to summarize</span>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </DialogTitle>
        </DialogHeader>
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${ENTITY_LABELS[entityType].toLowerCase()}…`}
            className="pl-9 h-9"
          />
        </div>
        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No records found</p>
          )}
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => handlePick(r)}
              disabled={generatingId === r.id}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50 text-left"
            >
              <span className="text-sm text-gray-700 truncate">{recordDisplayName(entityType, r)}</span>
              {generatingId === r.id ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              ) : (
                <FileDown className="w-4 h-4 text-gray-400" />
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({ template, onEdit, onDelete, onGenerate }) {
  const cfg = SUMMARY_ENTITY_TYPES[template.entity_type];
  const fieldCount = template.selected_fields?.length || 0;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-800 truncate">{template.name}</h3>
          {template.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{template.description}</p>
          )}
        </div>
        <Badge variant="secondary" className="text-[10px] shrink-0">{template.entity_type}</Badge>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-gray-400">
        <span>{fieldCount} fields</span>
        <span>•</span>
        <span className="capitalize">{template.page_orientation}</span>
        {template.include_cover_page && <><span>•</span><span>cover</span></>}
      </div>
      <div className="flex items-center gap-1.5 mt-auto">
        <Button size="sm" variant="default" className="h-8 text-xs" onClick={() => onGenerate(template)}>
          <FileDown className="w-3.5 h-3.5" /> Generate PDF
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onEdit(template)}>
          <Pencil className="w-3.5 h-3.5" /> Edit
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs text-red-500 hover:text-red-600" onClick={() => onDelete(template)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function SummaryReportTemplateManager() {
  const [designerOpen, setDesignerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [picker, setPicker] = useState(null); // { template }
  const [filterType, setFilterType] = useState("");
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["summary_report_templates"],
    queryFn: async () => {
      const list = await base44.entities.SummaryReportTemplate.list("-updated_date", 200);
      return Array.isArray(list) ? list : [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SummaryReportTemplate.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["summary_report_templates"] }),
  });

  const filtered = filterType ? templates.filter((t) => t.entity_type === filterType) : templates;

  const handleEdit = (tpl) => {
    setEditing(tpl);
    setDesignerOpen(true);
  };
  const handleNew = () => {
    setEditing(null);
    setDesignerOpen(true);
  };
  const handleDelete = (tpl) => {
    if (window.confirm(`Delete template "${tpl.name}"?`)) deleteMutation.mutate(tpl.id);
  };
  const handleGenerate = (template) => setPicker({ template });

  const runGenerate = async (record) => {
    const template = picker?.template;
    if (!template || !record) return;
    await exportRecordSummary(template, record);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
            <LayoutTemplate className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-800">Summary Report Templates</h2>
            <p className="text-xs text-gray-500">Design custom PDF summaries — choose exactly which fields appear for each firm, product, portfolio, or contact.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-9 rounded-md border border-gray-200 text-sm px-2 bg-white"
          >
            <option value="">All types</option>
            {Object.keys(ENTITY_LABELS).map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <Button onClick={handleNew} className="h-9">
            <Plus className="w-4 h-4" /> New Template
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-gray-200">
          <LayoutTemplate className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-1">No summary report templates yet</p>
          <p className="text-xs text-gray-400 mb-4">Create a template to choose which fields go into your PDF summaries.</p>
          <Button onClick={handleNew} variant="outline"><Plus className="w-4 h-4" /> Create your first template</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onGenerate={handleGenerate}
            />
          ))}
        </div>
      )}

      {designerOpen && (
        <SummaryReportTemplateDesigner
          open={designerOpen}
          onClose={() => setDesignerOpen(false)}
          editingTemplate={editing}
        />
      )}
      {picker && (
        <RecordPickerDialog
          open={!!picker}
          onClose={() => setPicker(null)}
          entityType={picker.template.entity_type}
          onPick={runGenerate}
        />
      )}
    </div>
  );
}