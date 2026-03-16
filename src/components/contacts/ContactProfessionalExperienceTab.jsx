import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Briefcase, ChevronDown, ChevronUp } from "lucide-react";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 80 }, (_, i) => CURRENT_YEAR - i);

const COMMON_TITLES = [
  "Analyst", "Associate", "Business Development", "Chairman", "Chief Executive Officer",
  "Chief Financial Officer", "Chief Investment Officer", "Chief Operating Officer",
  "Compliance Officer", "Director", "Financial Advisor", "Investment Manager",
  "Managing Director", "Managing Partner", "Partner", "Portfolio Manager", "President",
  "Principal", "Quantitative Analyst", "Relationship Manager", "Research Analyst",
  "Risk Manager", "Senior Associate", "Senior Vice President", "Vice President", "Wealth Manager",
];

function YearPicker({ value, onChange, placeholder = "Select year..." }) {
  const [open, setOpen] = useState(false);
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

function CreatableSelect({ value, onChange, options, placeholder, viewMode }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [customOptions, setCustomOptions] = useState([]);

  const allOptions = [...options, ...customOptions];
  const filtered = allOptions.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  const canCreate = search.trim() && !allOptions.some(o => o.toLowerCase() === search.trim().toLowerCase());

  const select = (val) => { onChange(val); setSearch(""); setOpen(false); };
  const create = () => { const val = search.trim(); setCustomOptions(p => [...p, val]); select(val); };

  if (viewMode) {
    return <div className="text-sm text-gray-900 px-1">{value || <span className="text-gray-400 italic">—</span>}</div>;
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full h-9 flex items-center justify-between px-3 rounded-md border border-input bg-transparent text-sm shadow-sm hover:bg-accent transition-colors">
        <span className={value ? "text-foreground" : "text-muted-foreground"}>{value || placeholder}</span>
        {open ? <ChevronUp className="w-4 h-4 opacity-50" /> : <ChevronDown className="w-4 h-4 opacity-50" />}
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-white shadow-md">
          <input autoFocus className="w-full px-3 py-2 text-sm border-b outline-none"
            placeholder="Search or type to add..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <div className="max-h-40 overflow-y-auto">
            {filtered.map(o => (
              <button key={o} type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700 ${value === o ? "bg-indigo-50 text-indigo-700 font-medium" : ""}`}
                onClick={() => select(o)}>{o}</button>
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
              <button type="button" className="text-xs text-gray-400 hover:text-gray-600"
                onClick={() => { onChange(""); setOpen(false); setSearch(""); }}>
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function newExperience() {
  return { id: crypto.randomUUID(), company_name: "", title: "", start_year: "", end_year: "" };
}

export default function ContactProfessionalExperienceTab({ experience = [], onChange, firms = [], viewMode }) {
  const addEntry = () => onChange([...experience, newExperience()]);
  const removeEntry = (id) => onChange(experience.filter(e => e.id !== id));
  const updateEntry = (id, field, val) => onChange(experience.map(e => e.id === id ? { ...e, [field]: val } : e));

  // Build company options from existing firms + existing experience companies
  const firmNames = firms.map(f => f.name);
  const experienceCompanies = experience.map(e => e.company_name).filter(Boolean);
  const companyOptions = [...new Set([...firmNames, ...experienceCompanies])].sort();

  const sorted = [...experience].sort((a, b) => {
    const aYear = parseInt(a.start_year) || 0;
    const bYear = parseInt(b.start_year) || 0;
    return bYear - aYear;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <Briefcase className="w-4 h-4 text-indigo-500" /> Professional Experience
        </Label>
        {!viewMode && (
          <Button type="button" variant="outline" size="sm"
            className="h-7 text-xs gap-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
            onClick={addEntry}>
            <Plus className="w-3 h-3" /> Add Experience
          </Button>
        )}
      </div>

      {experience.length === 0 && (
        <div className="text-sm text-gray-400 italic text-center py-6 border rounded-lg bg-gray-50/50">
          {viewMode ? "No professional experience records." : "No records yet. Click \"Add Experience\" to begin."}
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((entry) => (
          <div key={entry.id} className="border rounded-xl p-3 bg-gray-50/60 space-y-3 relative">
            {!viewMode && (
              <button type="button" onClick={() => removeEntry(entry.id)}
                className="absolute top-2.5 right-2.5 text-gray-300 hover:text-red-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Company + Title */}
            <div className="grid grid-cols-2 gap-3 pr-6">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Company</Label>
                <CreatableSelect
                  options={companyOptions}
                  value={entry.company_name}
                  onChange={v => updateEntry(entry.id, "company_name", v)}
                  placeholder="Select or add..."
                  viewMode={viewMode}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Title</Label>
                <CreatableSelect
                  options={COMMON_TITLES}
                  value={entry.title}
                  onChange={v => updateEntry(entry.id, "title", v)}
                  placeholder="Select or add..."
                  viewMode={viewMode}
                />
              </div>
            </div>

            {/* Start Year + End Year */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Start Year</Label>
                {viewMode ? (
                  <div className="text-sm text-gray-900 px-1">{entry.start_year || <span className="text-gray-400 italic">—</span>}</div>
                ) : (
                  <YearPicker value={entry.start_year} onChange={v => updateEntry(entry.id, "start_year", v)} placeholder="Start year..." />
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">End Year</Label>
                {viewMode ? (
                  <div className="text-sm text-gray-900 px-1">{entry.end_year || "Present"}</div>
                ) : (
                  <div className="space-y-1">
                    <YearPicker value={entry.end_year} onChange={v => updateEntry(entry.id, "end_year", v)} placeholder="Present" />
                    {entry.end_year && (
                      <button type="button" className="text-xs text-gray-400 hover:text-gray-600 ml-1"
                        onClick={() => updateEntry(entry.id, "end_year", "")}>
                        Set to Present
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Summary line in view mode */}
            {viewMode && (entry.company_name || entry.title) && (
              <div className="flex items-center gap-2 flex-wrap">
                {entry.company_name && <Badge variant="secondary" className="text-xs">{entry.company_name}</Badge>}
                {entry.title && <span className="text-xs text-gray-500">{entry.title}</span>}
                <span className="text-xs text-gray-400">
                  {entry.start_year || "?"} – {entry.end_year || "Present"}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}