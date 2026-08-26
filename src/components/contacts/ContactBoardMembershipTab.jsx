import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Users, ChevronDown, ChevronUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ExtractFromBioButton from "./ExtractFromBioButton";
import DeleteSubRecordDialog from "./DeleteSubRecordDialog";
import MasterOptionPicker from "./MasterOptionPicker";
import { titleCase } from "./titleCase";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 80 }, (_, i) => CURRENT_YEAR - i);

const COMMON_ROLES = [
  "Board Member", "Chairman", "Chair", "Vice Chair", "Lead Director",
  "Director", "Trustee", "Advisor", "Advisory Board Member", "Independent Director",
  "Audit Committee Chair", "Compensation Committee Chair", "Nominating Committee Chair",
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

function newMembership() {
  return { id: crypto.randomUUID(), organization_name: "", role: "", start_year: "", end_year: "" };
}

export default function ContactBoardMembershipTab({ memberships = [], onChange, viewMode, biography, onExtractFromBio, extracting }) {
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [orgOptions, setOrgOptions] = useState([]);
  const [roleOptions, setRoleOptions] = useState([]);
  const persistedOrgsRef = React.useRef(new Set());
  const persistedRolesRef = React.useRef(new Set());

  const sortDesc = (arr) => [...arr].sort((a, b) => (parseInt(b.start_year) || 0) - (parseInt(a.start_year) || 0));
  const addEntry = () => onChange(sortDesc([...memberships, newMembership()]));
  const removeEntry = (id) => onChange(memberships.filter(e => e.id !== id));
  const updateEntry = (id, field, val) => onChange(sortDesc(memberships.map(e => e.id === id ? { ...e, [field]: val } : e)));
  const canExtractFromBio = !!onExtractFromBio;
  const confirmDelete = () => {
    if (pendingDeleteId) removeEntry(pendingDeleteId);
    setPendingDeleteId(null);
  };

  // Load the global organization / role master lists once.
  useEffect(() => {
    let active = true;
    Promise.all([
      base44.entities.CompanyNameOption.list("-created_date", 5000).catch(() => []),
      base44.entities.JobTitleOption.list("-created_date", 5000).catch(() => []),
    ]).then(([c, t]) => {
      if (!active) return;
      setOrgOptions(c.map((r) => r.name).filter(Boolean));
      setRoleOptions(t.map((r) => r.name).filter(Boolean));
    });
    return () => { active = false; };
  }, []);

  const persistOrg = (name) => {
    const normalized = titleCase(name);
    const key = normalized.toLowerCase();
    if (persistedOrgsRef.current.has(key)) return;
    persistedOrgsRef.current.add(key);
    base44.entities.CompanyNameOption.create({ name: normalized })
      .then(() => setOrgOptions((prev) => (prev.some((o) => o.toLowerCase() === key) ? prev : [...prev, normalized])))
      .catch(() => {});
  };
  const persistRole = (name) => {
    const normalized = titleCase(name);
    const key = normalized.toLowerCase();
    if (persistedRolesRef.current.has(key)) return;
    persistedRolesRef.current.add(key);
    base44.entities.JobTitleOption.create({ name: normalized })
      .then(() => setRoleOptions((prev) => (prev.some((o) => o.toLowerCase() === key) ? prev : [...prev, normalized])))
      .catch(() => {});
  };

  // Auto-persist any org / role on a membership entry that isn't yet in the
  // master list (covers manual entry, bio extraction, and website scrape).
  useEffect(() => {
    for (const e of memberships) {
      if (e.organization_name) {
        const key = e.organization_name.toLowerCase();
        if (!persistedOrgsRef.current.has(key) && !orgOptions.some((o) => o.toLowerCase() === key)) {
          persistOrg(e.organization_name);
        }
      }
      if (e.role) {
        const key = e.role.toLowerCase();
        if (!persistedRolesRef.current.has(key) && !roleOptions.some((o) => o.toLowerCase() === key)) {
          persistRole(e.role);
        }
      }
    }
  }, [memberships, orgOptions, roleOptions]);

  const orgOpts = [...new Set([...orgOptions])].sort((a, b) => a.localeCompare(b));
  const roleOpts = [...new Set([...roleOptions, ...COMMON_ROLES])].sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <Users className="w-4 h-4 text-indigo-500" /> Board Memberships
        </Label>
        <div className="flex items-center gap-2">
          {canExtractFromBio && (
            <ExtractFromBioButton
              onClick={() => onExtractFromBio("board_memberships")}
              loading={!!extracting}
              disabled={!biography || !biography.trim()}
            />
          )}
          {!viewMode && (
            <Button type="button" variant="outline" size="sm"
              className="h-7 text-xs gap-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              onClick={addEntry}>
              <Plus className="w-3 h-3" /> Add Board
            </Button>
          )}
        </div>
      </div>

      {memberships.length === 0 && (
        <div className="text-sm text-gray-400 italic text-center py-6 border rounded-lg bg-gray-50/50">
          {viewMode ? "No board membership records." : "No records yet. Click \"Add Board\" to begin."}
        </div>
      )}

      <div className="space-y-3">
        {memberships.map((entry) => (
          <div key={entry.id} className="border rounded-xl p-3 bg-gray-50/60 space-y-3 relative">
            <button type="button" onClick={() => setPendingDeleteId(entry.id)}
              className="absolute top-2.5 right-2.5 text-gray-300 hover:text-red-500 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            {/* Organization + Role */}
            <div className="grid grid-cols-2 gap-3 pr-6">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Organization</Label>
                <MasterOptionPicker
                  options={orgOpts}
                  value={entry.organization_name}
                  onChange={(v) => updateEntry(entry.id, "organization_name", v)}
                  onPersist={persistOrg}
                  placeholder="Select or add..."
                  viewMode={viewMode}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Role</Label>
                <MasterOptionPicker
                  options={roleOpts}
                  value={entry.role}
                  onChange={(v) => updateEntry(entry.id, "role", v)}
                  onPersist={persistRole}
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
            {viewMode && (entry.organization_name || entry.role) && (
              <div className="flex items-center gap-2 flex-wrap">
                {entry.organization_name && <Badge variant="secondary" className="text-xs">{entry.organization_name}</Badge>}
                {entry.role && <span className="text-xs text-gray-500">{entry.role}</span>}
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
        recordLabel="board membership record"
      />
    </div>
  );
}