import React, { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Briefcase, ChevronDown, ChevronUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ExtractFromBioButton from "./ExtractFromBioButton";
import DeleteSubRecordDialog from "./DeleteSubRecordDialog";
import MasterOptionPicker from "./MasterOptionPicker";

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

function newExperience() {
  return { id: crypto.randomUUID(), company_name: "", title: "", start_year: "", end_year: "" };
}

export default function ContactProfessionalExperienceTab({ experience = [], onChange, firms = [], viewMode, biography, onExtractFromBio, extracting }) {
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [companyOptions, setCompanyOptions] = useState([]);
  const [titleOptions, setTitleOptions] = useState([]);
  const persistedCompaniesRef = useRef(new Set());
  const persistedTitlesRef = useRef(new Set());

  const sortDesc = (arr) => [...arr].sort((a, b) => (parseInt(b.start_year) || 0) - (parseInt(a.start_year) || 0));
  const addEntry = () => onChange(sortDesc([...experience, newExperience()]));
  const removeEntry = (id) => onChange(experience.filter(e => e.id !== id));
  const updateEntry = (id, field, val) => onChange(sortDesc(experience.map(e => e.id === id ? { ...e, [field]: val } : e)));
  const canExtractFromBio = !!onExtractFromBio;
  const confirmDelete = () => {
    if (pendingDeleteId) removeEntry(pendingDeleteId);
    setPendingDeleteId(null);
  };

  // Load the global company / job-title master lists once.
  useEffect(() => {
    let active = true;
    Promise.all([
      base44.entities.CompanyNameOption.list("-created_date", 5000).catch(() => []),
      base44.entities.JobTitleOption.list("-created_date", 5000).catch(() => []),
    ]).then(([c, t]) => {
      if (!active) return;
      setCompanyOptions(c.map((r) => r.name).filter(Boolean));
      setTitleOptions(t.map((r) => r.name).filter(Boolean));
    });
    return () => { active = false; };
  }, []);

  const persistCompany = (name) => {
    const key = name.toLowerCase();
    if (persistedCompaniesRef.current.has(key)) return;
    persistedCompaniesRef.current.add(key);
    base44.entities.CompanyNameOption.create({ name })
      .then(() => setCompanyOptions((prev) => (prev.some((o) => o.toLowerCase() === key) ? prev : [...prev, name])))
      .catch(() => {});
  };
  const persistTitle = (name) => {
    const key = name.toLowerCase();
    if (persistedTitlesRef.current.has(key)) return;
    persistedTitlesRef.current.add(key);
    base44.entities.JobTitleOption.create({ name })
      .then(() => setTitleOptions((prev) => (prev.some((o) => o.toLowerCase() === key) ? prev : [...prev, name])))
      .catch(() => {});
  };

  // Auto-persist any company / title on an experience entry that isn't yet in
  // the master list (covers manual entry, bio extraction, and website scrape).
  useEffect(() => {
    for (const e of experience) {
      if (e.company_name) {
        const key = e.company_name.toLowerCase();
        if (!persistedCompaniesRef.current.has(key) && !companyOptions.some((o) => o.toLowerCase() === key)) {
          persistCompany(e.company_name);
        }
      }
      if (e.title) {
        const key = e.title.toLowerCase();
        if (!persistedTitlesRef.current.has(key) && !titleOptions.some((o) => o.toLowerCase() === key)) {
          persistTitle(e.title);
        }
      }
    }
  }, [experience, companyOptions, titleOptions]);

  // Display options: master list + firm names (companies) / common titles (titles).
  const firmNames = useMemo(() => firms.map((f) => f.name), [firms]);
  const companyOpts = useMemo(
    () => [...new Set([...companyOptions, ...firmNames])].sort((a, b) => a.localeCompare(b)),
    [companyOptions, firmNames]
  );
  const titleOpts = useMemo(
    () => [...new Set([...titleOptions, ...COMMON_TITLES])].sort((a, b) => a.localeCompare(b)),
    [titleOptions]
  );



  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <Briefcase className="w-4 h-4 text-indigo-500" /> Professional Experience
        </Label>
        <div className="flex items-center gap-2">
          {canExtractFromBio && (
            <ExtractFromBioButton
              onClick={() => onExtractFromBio("experience")}
              loading={!!extracting}
              disabled={!biography || !biography.trim()}
            />
          )}
          {!viewMode && (
            <Button type="button" variant="outline" size="sm"
              className="h-7 text-xs gap-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              onClick={addEntry}>
              <Plus className="w-3 h-3" /> Add Experience
            </Button>
          )}
        </div>
      </div>

      {experience.length === 0 && (
        <div className="text-sm text-gray-400 italic text-center py-6 border rounded-lg bg-gray-50/50">
          {viewMode ? "No professional experience records." : "No records yet. Click \"Add Experience\" to begin."}
        </div>
      )}

      <div className="space-y-3">
        {experience.map((entry) => (
          <div key={entry.id} className="border rounded-xl p-3 bg-gray-50/60 space-y-3 relative">
            <button type="button" onClick={() => setPendingDeleteId(entry.id)}
              className="absolute top-2.5 right-2.5 text-gray-300 hover:text-red-500 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            {/* Company + Title */}
            <div className="grid grid-cols-2 gap-3 pr-6">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Company</Label>
                <MasterOptionPicker
                  options={companyOpts}
                  value={entry.company_name}
                  onChange={(v) => updateEntry(entry.id, "company_name", v)}
                  onPersist={persistCompany}
                  placeholder="Select or add..."
                  viewMode={viewMode}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Title</Label>
                <MasterOptionPicker
                  options={titleOpts}
                  value={entry.title}
                  onChange={(v) => updateEntry(entry.id, "title", v)}
                  onPersist={persistTitle}
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

      <DeleteSubRecordDialog
        open={!!pendingDeleteId}
        onOpenChange={(o) => !o && setPendingDeleteId(null)}
        onConfirm={confirmDelete}
        recordLabel="experience record"
      />
    </div>
  );
}