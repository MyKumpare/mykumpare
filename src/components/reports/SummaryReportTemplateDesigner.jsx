import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X, Columns3, FileText, Palette, Eye, Loader2, Check, CheckCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SUMMARY_ENTITY_TYPES } from "./summaryReportTemplateConfig";
import { generateSummaryPdf } from "./summaryReportPdf";

const ENTITY_OPTIONS = [
  { value: "Firm", label: "Firm" },
  { value: "Product", label: "Product" },
  { value: "Portfolio", label: "Portfolio" },
  { value: "Contact", label: "Contact" },
];

const ACCENT_PRESETS = ["#0d9488", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#0891b2"];

const EMPTY_FORM = {
  name: "",
  description: "",
  entity_type: "Firm",
  selected_fields: [],
  page_orientation: "portrait",
  include_cover_page: false,
  include_logo: true,
  include_branding: true,
  include_summary_metrics: true,
  accent_color: "#0d9488",
};

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
        <Icon className="w-4 h-4 text-blue-600" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-400">{subtitle}</p>}
      </div>
    </div>
  );
}

function SectionBlock({ section, selected, onToggleField, onToggleSection }) {
  const fields = section.fields;
  const allOn = fields.length > 0 && fields.every((f) => selected.includes(f.key));
  const someOn = fields.some((f) => selected.includes(f.key));

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allOn}
            onCheckedChange={() => onToggleSection(section, !allOn)}
          />
          <span className="text-sm font-semibold text-gray-700">{section.label}</span>
        </div>
        <button
          onClick={() => onToggleSection(section, !allOn)}
          className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          {allOn ? <><CheckCheck className="w-3 h-3" /> All selected</> : someOn ? <><Check className="w-3 h-3" /> Select all</> : "Select all"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 p-2.5">
        {fields.map((field) => (
          <label
            key={field.key}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-gray-100 hover:bg-gray-50 cursor-pointer text-sm"
          >
            <Checkbox
              checked={selected.includes(field.key)}
              onCheckedChange={() => onToggleField(field.key)}
            />
            <span className="text-gray-700">{field.label}</span>
            {(field.type === "metric_number" || field.type === "metric_currency") && (
              <Badge variant="secondary" className="text-[9px] ml-auto">KPI</Badge>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function SummaryReportTemplateDesigner({ open, onClose, editingTemplate }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [previewing, setPreviewing] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    if (editingTemplate) {
      setForm({ ...EMPTY_FORM, ...editingTemplate });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, editingTemplate]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const entityCfg = SUMMARY_ENTITY_TYPES[form.entity_type];

  const toggleField = (key) => {
    setForm((prev) => ({
      ...prev,
      selected_fields: prev.selected_fields.includes(key)
        ? prev.selected_fields.filter((k) => k !== key)
        : [...prev.selected_fields, key],
    }));
  };

  const toggleSection = (section, on) => {
    const keys = section.fields.map((f) => f.key);
    setForm((prev) => {
      let next = on
        ? [...new Set([...prev.selected_fields, ...keys])]
        : prev.selected_fields.filter((k) => !keys.includes(k));
      // Preserve config order
      const ordered = entityCfg.sections.flatMap((s) => s.fields.map((f) => f.key)).filter((k) => next.includes(k));
      return { ...prev, selected_fields: ordered };
    });
  };

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (editingTemplate) return base44.entities.SummaryReportTemplate.update(editingTemplate.id, data);
      return base44.entities.SummaryReportTemplate.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["summary_report_templates"] });
      onClose();
    },
  });

  const handleSave = () => {
    if (!form.name.trim() || !form.entity_type) return;
    saveMutation.mutate(form);
  };

  const handlePreview = async () => {
    if (!form.entity_type) return;
    setPreviewing(true);
    try {
      const list = await base44.entities[form.entity_type].list("-updated_date", 1);
      const sample = Array.isArray(list) ? list[0] : null;
      if (sample) {
        await generateSummaryPdf(form, sample, {});
      }
    } catch (e) {
      // ignore preview errors
    } finally {
      setPreviewing(false);
    }
  };

  const canSave = form.name.trim() && form.entity_type && form.selected_fields.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{editingTemplate ? "Edit Summary Report Template" : "Design Summary Report Template"}</span>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Details */}
          <section>
            <SectionHeader icon={FileText} title="Template Details" subtitle="Name and describe this template" />
            <div className="space-y-2.5">
              <div>
                <Label className="text-xs text-gray-500">Template Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="e.g. Executive Firm Brief"
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="What this template is for…"
                  className="min-h-[60px] text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Entity Type *</Label>
                <Select value={form.entity_type} onValueChange={(v) => update("entity_type", v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Fields */}
          <section>
            <SectionHeader
              icon={Columns3}
              title="Fields to Include"
              subtitle="Toggle exactly which data fields appear in the PDF"
            />
            <div className="space-y-2.5">
              {entityCfg?.sections.map((section) => (
                <SectionBlock
                  key={section.key}
                  section={section}
                  selected={form.selected_fields}
                  onToggleField={toggleField}
                  onToggleSection={toggleSection}
                />
              ))}
            </div>
          </section>

          {/* Page options */}
          <section>
            <SectionHeader icon={Palette} title="Page & Layout Options" subtitle="Control the PDF appearance" />
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">Page Orientation</Label>
                  <Select value={form.page_orientation} onValueChange={(v) => update("page_orientation", v)}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Accent Color</Label>
                  <div className="flex items-center gap-1.5 h-9">
                    {ACCENT_PRESETS.map((c) => (
                      <button
                        key={c}
                        onClick={() => update("accent_color", c)}
                        className={`w-7 h-7 rounded-full border-2 ${form.accent_color === c ? "border-gray-800" : "border-white"}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <Checkbox checked={form.include_summary_metrics} onCheckedChange={(v) => update("include_summary_metrics", v)} />
                  Show KPI metric strip at top (for metric fields)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <Checkbox checked={form.include_logo} onCheckedChange={(v) => update("include_logo", v)} />
                  Include record logo / photo
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <Checkbox checked={form.include_cover_page} onCheckedChange={(v) => update("include_cover_page", v)} />
                  Include cover page
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <Checkbox checked={form.include_branding} onCheckedChange={(v) => update("include_branding", v)} />
                  Include "Powered by MyKumpare" branding footer
                </label>
              </div>
            </div>
          </section>
        </div>

        <DialogFooter className="gap-2">
          <div className="flex items-center gap-1.5 mr-auto">
            <Badge variant="secondary" className="text-[10px]">{form.entity_type}</Badge>
            <Badge variant="secondary" className="text-[10px]">{form.selected_fields.length} fields</Badge>
          </div>
          <Button variant="outline" onClick={handlePreview} disabled={previewing || form.selected_fields.length === 0}>
            {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            {previewing ? "Previewing…" : "Preview PDF"}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave || saveMutation.isPending}>
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? "Saving…" : editingTemplate ? "Update Template" : "Save Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}