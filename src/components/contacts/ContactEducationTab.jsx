import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GraduationCap, ChevronDown, ChevronUp } from "lucide-react";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 80 }, (_, i) => CURRENT_YEAR - i);

const DEFAULT_DEGREES = ["AA", "BA", "BS", "MS", "MA", "MBA", "DBA", "PhD"];
const DEFAULT_SPECIALIZATIONS = ["Accounting", "Economics", "Finance", "Mathematics"];

function CreatableSelect({ label, options, value, onChange, placeholder, viewMode }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [customOptions, setCustomOptions] = useState([]);

  const allOptions = [...options, ...customOptions];
  const filtered = allOptions.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  const canCreate = search.trim() && !allOptions.some(o => o.toLowerCase() === search.trim().toLowerCase());

  const select = (val) => { onChange(val); setSearch(""); setOpen(false); };
  const create = () => {
    const val = search.trim();
    setCustomOptions(prev => [...prev, val]);
    select(val);
  };

  if (viewMode) {
    return <div className="text-sm text-gray-900 px-1">{value || <span className="text-gray-400 italic">—</span>}</div>;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full h-9 flex items-center justify-between px-3 rounded-md border border-input bg-transparent text-sm shadow-sm hover:bg-accent transition-colors"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>{value || placeholder}</span>
        {open ? <ChevronUp className="w-4 h-4 opacity-50" /> : <ChevronDown className="w-4 h-4 opacity-50" />}
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-white shadow-md">
          <input
            autoFocus
            className="w-full px-3 py-2 text-sm border-b outline-none"
            placeholder="Search or type to add..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="max-h-40 overflow-y-auto">
            {filtered.map(o => (
              <button key={o} type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700 ${value === o ? "bg-indigo-50 text-indigo-700 font-medium" : ""}`}
                onClick={() => select(o)}>
                {o}
              </button>
            ))}
            {canCreate && (
              <button type="button"
                className="w-full text-left px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 font-medium flex items-center gap-1"
                onClick={create}>
                <Plus className="w-3 h-3" /> Add "{search.trim()}"
              </button>
            )}
            {filtered.length === 0 && !canCreate && (
              <div className="px-3 py-2 text-xs text-gray-400 italic">No options found</div>
            )}
          </div>
          {value && (
            <div className="border-t px-3 py-1.5">
              <button type="button" className="text-xs text-gray-400 hover:text-gray-600" onClick={() => { onChange(""); setOpen(false); setSearch(""); }}>
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MultiCreatableSelect({ label, options, value = [], onChange, placeholder, viewMode }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [customOptions, setCustomOptions] = useState([]);

  const allOptions = [...options, ...customOptions];
  const filtered = allOptions.filter(o => o.toLowerCase().includes(search.toLowerCase()) && !value.includes(o));
  const canCreate = search.trim() && !allOptions.some(o => o.toLowerCase() === search.trim().toLowerCase()) && !value.includes(search.trim());

  const add = (val) => { onChange([...value, val]); setSearch(""); };
  const remove = (val) => onChange(value.filter(v => v !== val));
  const create = () => {
    const val = search.trim();
    setCustomOptions(prev => [...prev, val]);
    add(val);
  };

  if (viewMode) {
    return (
      <div className="text-sm text-gray-900 px-1">
        {value.length > 0 ? value.join(", ") : <span className="text-gray-400 italic">—</span>}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {value.map(v => (
          <Badge key={v} variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-xs">
            {v}
            <button type="button" onClick={() => remove(v)} className="hover:text-red-500 transition-colors">
              <span className="text-xs">×</span>
            </button>
          </Badge>
        ))}
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full h-9 flex items-center justify-between px-3 rounded-md border border-input bg-transparent text-sm shadow-sm hover:bg-accent transition-colors"
        >
          <span className="text-muted-foreground">{placeholder}</span>
          {open ? <ChevronUp className="w-4 h-4 opacity-50" /> : <ChevronDown className="w-4 h-4 opacity-50" />}
        </button>
        {open && (
          <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-white shadow-md">
            <input
              autoFocus
              className="w-full px-3 py-2 text-sm border-b outline-none"
              placeholder="Search or type to add..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="max-h-40 overflow-y-auto">
              {filtered.map(o => (
                <button key={o} type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700"
                  onClick={() => { add(o); setOpen(false); }}>
                  {o}
                </button>
              ))}
              {canCreate && (
                <button type="button"
                  className="w-full text-left px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 font-medium flex items-center gap-1"
                  onClick={() => { create(); setOpen(false); }}>
                  <Plus className="w-3 h-3" /> Add "{search.trim()}"
                </button>
              )}
              {filtered.length === 0 && !canCreate && (
                <div className="px-3 py-2 text-xs text-gray-400 italic">No more options</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function newEducation() {
  return {
    id: crypto.randomUUID(),
    graduation_year: "",
    degree: "",
    area_of_specialization: "",
    majors: [],
    minors: [],
  };
}

const MAJOR_OPTIONS = ["Accounting", "Business Administration", "Economics", "Finance", "Information Technology", "Management", "Marketing", "Mathematics", "Statistics"];
const MINOR_OPTIONS = ["Accounting", "Business Administration", "Economics", "Finance", "Information Technology", "Management", "Marketing", "Mathematics", "Statistics"];

export default function ContactEducationTab({ education = [], onChange, designations = [], onDesignationsChange, viewMode }) {
  const addEntry = () => onChange([...education, newEducation()]);
  const removeEntry = (id) => onChange(education.filter(e => e.id !== id));
  const updateEntry = (id, field, val) => onChange(education.map(e => e.id === id ? { ...e, [field]: val } : e));

  return (
    <div className="space-y-4">
      {/* Professional Designations */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">Professional Designations</Label>
        {viewMode ? (
          <div className="text-sm text-gray-900 px-1">
            {designations.length > 0
              ? <div className="flex flex-wrap gap-1.5">{designations.map(d => <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>)}</div>
              : <span className="text-gray-400 italic">—</span>}
          </div>
        ) : (
          <DesignationsPickerInline value={designations} onChange={onDesignationsChange} />
        )}
      </div>

      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-indigo-500" /> Education History
          </Label>
          {!viewMode && (
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50" onClick={addEntry}>
              <Plus className="w-3 h-3" /> Add Education
            </Button>
          )}
        </div>

        {education.length === 0 && (
          <div className="text-sm text-gray-400 italic text-center py-6 border rounded-lg bg-gray-50/50">
            {viewMode ? "No education records." : "No education records yet. Click \"Add Education\" to begin."}
          </div>
        )}

        <div className="space-y-3">
          {[...education].sort((a, b) => (parseInt(b.graduation_year) || 0) - (parseInt(a.graduation_year) || 0)).map((entry, idx) => (
            <div key={entry.id} className="border rounded-xl p-3 bg-gray-50/60 space-y-3 relative">
              {!viewMode && (
                <button type="button" onClick={() => removeEntry(entry.id)}
                  className="absolute top-2.5 right-2.5 text-gray-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              <div className="text-xs font-semibold text-indigo-600 mb-1">Education #{idx + 1}</div>

              {/* Graduation Year */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Graduation Year</Label>
                  {viewMode ? (
                    <div className="text-sm text-gray-900 px-1">{entry.graduation_year || <span className="text-gray-400 italic">—</span>}</div>
                  ) : (
                    <YearPicker value={entry.graduation_year} onChange={v => updateEntry(entry.id, "graduation_year", v)} />
                  )}
                </div>

                {/* Degree */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Degree</Label>
                  <CreatableSelect
                    options={DEFAULT_DEGREES}
                    value={entry.degree}
                    onChange={v => updateEntry(entry.id, "degree", v)}
                    placeholder="Select degree..."
                    viewMode={viewMode}
                  />
                </div>
              </div>

              {/* Area of Specialization */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Area of Specialization</Label>
                <CreatableSelect
                  options={DEFAULT_SPECIALIZATIONS}
                  value={entry.area_of_specialization}
                  onChange={v => updateEntry(entry.id, "area_of_specialization", v)}
                  placeholder="Select specialization..."
                  viewMode={viewMode}
                />
              </div>

              {/* Majors */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Major(s)</Label>
                <MultiCreatableSelect
                  options={MAJOR_OPTIONS}
                  value={entry.majors || []}
                  onChange={v => updateEntry(entry.id, "majors", v)}
                  placeholder="Add major..."
                  viewMode={viewMode}
                />
              </div>

              {/* Minors */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Minor(s)</Label>
                <MultiCreatableSelect
                  options={MINOR_OPTIONS}
                  value={entry.minors || []}
                  onChange={v => updateEntry(entry.id, "minors", v)}
                  placeholder="Add minor..."
                  viewMode={viewMode}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Inline year picker using a scrollable dropdown
function YearPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full h-9 flex items-center justify-between px-3 rounded-md border border-input bg-transparent text-sm shadow-sm hover:bg-accent transition-colors"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>{value || "Select year..."}</span>
        {open ? <ChevronUp className="w-4 h-4 opacity-50" /> : <ChevronDown className="w-4 h-4 opacity-50" />}
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-white shadow-md max-h-48 overflow-y-auto">
          {YEARS.map(y => (
            <button key={y} type="button"
              className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700 ${value === String(y) ? "bg-indigo-50 text-indigo-700 font-medium" : ""}`}
              onClick={() => { onChange(String(y)); setOpen(false); }}>
              {y}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Inline designations picker (reused from DesignationsPicker but self-contained for this tab)
const COMMON_DESIGNATIONS = ["CFA", "CPA", "MBA", "CFP", "CAIA", "FRM", "CIPM", "CMA", "CMT", "CIMA", "PMP", "JD", "PhD", "MD"];

function DesignationsPickerInline({ value = [], onChange }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState([]);

  const allOpts = [...COMMON_DESIGNATIONS, ...custom];
  const filtered = allOpts.filter(d => d.toLowerCase().includes(search.toLowerCase()) && !value.includes(d));
  const canCreate = search.trim() && !allOpts.some(d => d.toLowerCase() === search.trim().toLowerCase()) && !value.includes(search.trim());

  const add = (d) => { onChange([...value, d]); setSearch(""); };
  const remove = (d) => onChange(value.filter(v => v !== d));
  const create = () => { const d = search.trim(); setCustom(p => [...p, d]); add(d); setOpen(false); };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {value.map(d => (
          <Badge key={d} variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-xs">
            {d}
            <button type="button" onClick={() => remove(d)} className="hover:text-red-500 transition-colors">
              <span className="text-xs">×</span>
            </button>
          </Badge>
        ))}
      </div>
      <div className="relative">
        <button type="button" onClick={() => setOpen(!open)}
          className="h-7 flex items-center gap-1 text-xs text-indigo-600 border border-indigo-200 hover:bg-indigo-50 rounded-md px-2.5 py-1 font-medium transition-colors">
          <Plus className="w-3 h-3" /> Add Designation
        </button>
        {open && (
          <div className="absolute z-50 top-full mt-1 w-56 rounded-md border bg-white shadow-md">
            <input autoFocus className="w-full px-3 py-2 text-sm border-b outline-none"
              placeholder="Search or type..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="max-h-40 overflow-y-auto">
              {filtered.map(d => (
                <button key={d} type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700"
                  onClick={() => { add(d); setOpen(false); }}>{d}</button>
              ))}
              {canCreate && (
                <button type="button"
                  className="w-full text-left px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 font-medium flex items-center gap-1"
                  onClick={create}>
                  <Plus className="w-3 h-3" /> Add "{search.trim()}"
                </button>
              )}
              {filtered.length === 0 && !canCreate && (
                <div className="px-3 py-2 text-xs text-gray-400 italic">No options</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}