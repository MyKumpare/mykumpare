import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, Database, Columns3, Calculator, LayoutTemplate, Printer, X, Play, Loader2, Filter } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DATA_SOURCES, COMPUTATION_TYPES, CHART_TYPES, OUTPUT_FORMATS, FILTER_OPERATORS } from "./reportConfig";
import { fetchReportData, applyFilters } from "./reportEngine";
import ReportResults from "./ReportResults";

const EMPTY_FORM = {
  name: "",
  description: "",
  data_source: "",
  selected_fields: [],
  computations: [],
  format_type: "table",
  chart_type: "bar",
  group_by: "",
  sort_by: "",
  sort_order: "asc",
  filters_description: "",
  filters: [],
  output_formats: ["pdf"],
  page_orientation: "landscape",
  include_summary: true,
  include_cover_page: false,
  include_page_numbers: true,
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

function FieldSelector({ fields, selected, onChange }) {
  const allSelected = fields.length > 0 && fields.every((f) => selected.includes(f.key));

  const toggle = (key) => {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => onChange(allSelected ? [] : fields.map((f) => f.key))}
          className="text-[11px] font-medium text-blue-600 hover:text-blue-700"
        >
          {allSelected ? "Clear all" : "Select all"}
        </button>
        <span className="text-[11px] text-gray-400">{selected.length} selected</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {fields.map((field) => (
          <label
            key={field.key}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-gray-100 hover:bg-gray-50 cursor-pointer text-sm"
          >
            <Checkbox checked={selected.includes(field.key)} onCheckedChange={() => toggle(field.key)} />
            <span className="text-gray-700">{field.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ComputationEditor({ computations, onChange, fields }) {
  const numericFields = fields.filter((f) => f.type === "number");
  const groupFields = fields;

  const add = () => {
    onChange([...computations, { type: "count", target_field: "", group_by: "", label: "" }]);
  };

  const update = (idx, field, value) => {
    onChange(computations.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  const remove = (idx) => {
    onChange(computations.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      {computations.length === 0 && (
        <p className="text-xs text-gray-400 italic">No computations added. Click "Add Computation" to include calculations.</p>
      )}
      {computations.map((comp, idx) => {
        const compType = COMPUTATION_TYPES.find((t) => t.value === comp.type);
        const needsField = compType?.needsField;
        const availableFields = compType?.numericOnly ? numericFields : fields;

        return (
          <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg border border-gray-100 bg-gray-50/50">
            <div className="flex-1 grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-gray-400 uppercase">Type</Label>
                <Select value={comp.type} onValueChange={(v) => update(idx, "type", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMPUTATION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-gray-400 uppercase">Label</Label>
                <Input
                  value={comp.label}
                  onChange={(e) => update(idx, "label", e.target.value)}
                  placeholder="e.g. Firms by Type"
                  className="h-8 text-xs"
                />
              </div>
              {needsField && (
                <div>
                  <Label className="text-[10px] text-gray-400 uppercase">Target Field</Label>
                  <Select value={comp.target_field} onValueChange={(v) => update(idx, "target_field", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select field" /></SelectTrigger>
                    <SelectContent>
                      {availableFields.map((f) => (
                        <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {availableFields.length === 0 && (
                    <p className="text-[10px] text-amber-500 mt-0.5">No numeric fields available</p>
                  )}
                </div>
              )}
              <div>
                <Label className="text-[10px] text-gray-400 uppercase">Group By (optional)</Label>
                <Select value={comp.group_by || "_none"} onValueChange={(v) => update(idx, "group_by", v === "_none" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {groupFields.map((f) => (
                      <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <button
              onClick={() => remove(idx)}
              className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 mt-4"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
      <Button variant="outline" size="sm" onClick={add} className="w-full border-dashed">
        <Plus className="w-3.5 h-3.5" /> Add Computation
      </Button>
    </div>
  );
}

function OutputOptions({ form, update }) {
  const toggleFormat = (val) => {
    update("output_formats",
      form.output_formats.includes(val)
        ? form.output_formats.filter((f) => f !== val)
        : [...form.output_formats, val]
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {OUTPUT_FORMATS.map((fmt) => (
          <label
            key={fmt.value}
            className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
              form.output_formats.includes(fmt.value)
                ? "border-blue-300 bg-blue-50"
                : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Checkbox checked={form.output_formats.includes(fmt.value)} onCheckedChange={() => toggleFormat(fmt.value)} />
            <span className="text-xs font-medium text-gray-700">{fmt.label}</span>
          </label>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-gray-500">Page Orientation</Label>
          <Select value={form.page_orientation} onValueChange={(v) => update("page_orientation", v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="landscape">Landscape</SelectItem>
              <SelectItem value="portrait">Portrait</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <Checkbox checked={form.include_summary} onCheckedChange={(v) => update("include_summary", v)} />
          Include summary section
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <Checkbox checked={form.include_cover_page} onCheckedChange={(v) => update("include_cover_page", v)} />
          Include cover page (PDF)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <Checkbox checked={form.include_page_numbers} onCheckedChange={(v) => update("include_page_numbers", v)} />
          Include page numbers (PDF)
        </label>
      </div>
    </div>
  );
}

function FilterEditor({ filters, onChange, fields }) {
  const filterFields = [{ key: "id", label: "Record ID", type: "text" }, ...fields];

  const add = () =>
    onChange([
      ...filters,
      { id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random()), field: "", operator: "equals", value: "" },
    ]);
  const update = (idx, field, value) =>
    onChange(filters.map((f, i) => (i === idx ? { ...f, [field]: value } : f)));
  const remove = (idx) => onChange(filters.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      {filters.length === 0 && (
        <p className="text-xs text-gray-400 italic">
          No filters. Add a filter to scope this report to specific records (e.g. a single product by Record ID or Name).
        </p>
      )}
      {filters.map((flt, idx) => {
        const op = FILTER_OPERATORS.find((o) => o.value === flt.operator);
        const needsValue = op ? op.needsValue : true;
        return (
          <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg border border-gray-100 bg-gray-50/50">
            <div className="flex-1 grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[10px] text-gray-400 uppercase">Field</Label>
                <Select value={flt.field} onValueChange={(v) => update(idx, "field", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select field" /></SelectTrigger>
                  <SelectContent>
                    {filterFields.map((f) => (
                      <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-gray-400 uppercase">Operator</Label>
                <Select value={flt.operator} onValueChange={(v) => update(idx, "operator", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FILTER_OPERATORS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-gray-400 uppercase">Value</Label>
                <Input
                  value={flt.value}
                  onChange={(e) => update(idx, "value", e.target.value)}
                  disabled={!needsValue}
                  placeholder={needsValue ? "Enter value" : "—"}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <button
              onClick={() => remove(idx)}
              className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 mt-4"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
      <Button variant="outline" size="sm" onClick={add} className="w-full border-dashed">
        <Plus className="w-3.5 h-3.5" /> Add Filter
      </Button>
    </div>
  );
}

export default function CustomReportBuilder({ open, onClose, editingReport, prefillConfig }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [resultsData, setResultsData] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setResultsData(null);
    setGenError(null);
    if (editingReport) {
      setForm({ ...EMPTY_FORM, ...editingReport });
    } else if (prefillConfig) {
      setForm({ ...EMPTY_FORM, ...prefillConfig });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, editingReport, prefillConfig]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (editingReport) {
        return base44.entities.CustomReport.update(editingReport.id, data);
      }
      return base44.entities.CustomReport.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom_reports"] });
      onClose();
    },
  });

  const handleSave = () => {
    if (!form.name.trim() || !form.data_source) return;
    saveMutation.mutate(form);
  };

  const handleGenerate = async () => {
    if (!form.data_source) return;
    setGenerating(true);
    setGenError(null);
    try {
      const raw = await fetchReportData(form.data_source);
      setResultsData(applyFilters(raw, form.filters));
    } catch (err) {
      setGenError(err.message || "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const fields = form.data_source ? DATA_SOURCES[form.data_source].fields : [];
  const showChartType = form.format_type === "chart" || form.format_type === "mixed";
  const canSave = form.name.trim() && form.data_source;
  const canGenerate = form.data_source && (form.selected_fields.length > 0 || form.computations.length > 0);
  const isResults = !!resultsData;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={isResults ? "max-w-5xl max-h-[90vh] overflow-y-auto" : "max-w-3xl max-h-[90vh] overflow-y-auto"}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{isResults ? (form.name || "Report Results") : editingReport ? "Edit Custom Report" : "Create Custom Report"}</span>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </DialogTitle>
        </DialogHeader>

        {isResults ? (
          <ReportResults config={form} data={resultsData} onBack={() => setResultsData(null)} />
        ) : (
          <>
            <div className="space-y-5">
              {/* Report Details */}
              <section>
                <SectionHeader icon={LayoutTemplate} title="Report Details" subtitle="Name and describe what this report should contain" />
                <div className="space-y-2.5">
                  <div>
                    <Label className="text-xs text-gray-500">Report Name *</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => update("name", e.target.value)}
                      placeholder="e.g. Quarterly Firm Overview"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Description</Label>
                    <Textarea
                      value={form.description}
                      onChange={(e) => update("description", e.target.value)}
                      placeholder="Describe what you want this report to show — what data, what insights, what time period, etc."
                      className="min-h-[70px] text-sm"
                    />
                  </div>
                </div>
              </section>

              {/* Data Source */}
              <section>
                <SectionHeader icon={Database} title="Data Source" subtitle="Select the primary entity to pull data from" />
                <Select value={form.data_source} onValueChange={(v) => update("data_source", v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select a data source..." /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DATA_SOURCES).map(([key, src]) => (
                      <SelectItem key={key} value={key}>{src.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </section>

              {/* Fields to Include */}
              {form.data_source && (
                <section>
                  <SectionHeader icon={Columns3} title="Fields to Include" subtitle="Select which data fields appear in the report" />
                  <FieldSelector fields={fields} selected={form.selected_fields} onChange={(v) => update("selected_fields", v)} />
                </section>
              )}

              {/* Filters */}
              {form.data_source && (
                <section>
                  <SectionHeader icon={Filter} title="Filters" subtitle="Scope the report to specific records (e.g. one product by ID or name)" />
                  <FilterEditor filters={form.filters} onChange={(v) => update("filters", v)} fields={fields} />
                </section>
              )}

              {/* Computations */}
              {form.data_source && (
                <section>
                  <SectionHeader icon={Calculator} title="Computations" subtitle="Define calculations to perform on the data" />
                  <ComputationEditor computations={form.computations} onChange={(v) => update("computations", v)} fields={fields} />
                </section>
              )}

              {/* Format & Layout */}
              {form.data_source && (
                <section>
                  <SectionHeader icon={LayoutTemplate} title="Format & Layout" subtitle="Choose how the report is presented" />
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: "table", label: "Table" },
                        { value: "chart", label: "Chart" },
                        { value: "mixed", label: "Mixed" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => update("format_type", opt.value)}
                          className={`p-2.5 rounded-lg border text-sm font-medium transition-colors ${
                            form.format_type === opt.value
                              ? "border-blue-300 bg-blue-50 text-blue-700"
                              : "border-gray-200 text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {showChartType && (
                      <div>
                        <Label className="text-xs text-gray-500">Chart Type</Label>
                        <Select value={form.chart_type} onValueChange={(v) => update("chart_type", v)}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CHART_TYPES.map((c) => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs text-gray-500">Group By</Label>
                        <Select value={form.group_by || "_none"} onValueChange={(v) => update("group_by", v === "_none" ? "" : v)}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">None</SelectItem>
                            {fields.map((f) => (
                              <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Sort By</Label>
                        <Select value={form.sort_by || "_none"} onValueChange={(v) => update("sort_by", v === "_none" ? "" : v)}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">None</SelectItem>
                            {fields.map((f) => (
                              <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Sort Order</Label>
                        <Select value={form.sort_order} onValueChange={(v) => update("sort_order", v)}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="asc">Ascending</SelectItem>
                            <SelectItem value="desc">Descending</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs text-gray-500">Filters (describe in words)</Label>
                      <Textarea
                        value={form.filters_description}
                        onChange={(e) => update("filters_description", e.target.value)}
                        placeholder="e.g. Only active firms founded after 2010, grouped by firm type"
                        className="min-h-[50px] text-sm"
                      />
                    </div>
                  </div>
                </section>
              )}

              {/* Output & Print Options */}
              {form.data_source && (
                <section>
                  <SectionHeader icon={Printer} title="Print & Download Options" subtitle="Configure available output formats and page settings" />
                  <OutputOptions form={form} update={update} />
                </section>
              )}
            </div>

            {genError && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm text-red-600">{genError}</p>
              </div>
            )}

            <DialogFooter className="gap-2">
              <div className="flex items-center gap-1.5 mr-auto">
                {form.data_source && <Badge variant="secondary" className="text-[10px]">{DATA_SOURCES[form.data_source].label}</Badge>}
                {form.selected_fields.length > 0 && <Badge variant="secondary" className="text-[10px]">{form.selected_fields.length} fields</Badge>}
                {form.computations.length > 0 && <Badge variant="secondary" className="text-[10px]">{form.computations.length} computations</Badge>}
              </div>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                variant="secondary"
                onClick={handleGenerate}
                disabled={!canGenerate || generating}
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {generating ? "Generating..." : "Generate Report"}
              </Button>
              <Button onClick={handleSave} disabled={!canSave || saveMutation.isPending}>
                <Save className="w-4 h-4" />
                {saveMutation.isPending ? "Saving..." : editingReport ? "Update Report" : "Save Report"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}