import React, { useMemo, useState, useRef } from "react";
import {
  User, ChevronDown, ChevronRight, Users, Layers,
  Crown, Briefcase, TrendingUp, BarChart3, Settings2, Building2,
  Printer, Download, Plus, Trash2, ArrowUp, ArrowDown, Pencil, RotateCcw, X, Check, Loader2,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// ─── Color palette (literal strings so Tailwind purger sees them) ───
const COLORS = {
  amber:  { card: "border-amber-300 bg-amber-50",  header: "bg-amber-100 text-amber-800" },
  indigo: { card: "border-indigo-300 bg-indigo-50", header: "bg-indigo-100 text-indigo-800" },
  blue:   { card: "border-blue-300 bg-blue-50",    header: "bg-blue-100 text-blue-800" },
  purple: { card: "border-purple-300 bg-purple-50", header: "bg-purple-100 text-purple-800" },
  teal:   { card: "border-teal-300 bg-teal-50",    header: "bg-teal-100 text-teal-800" },
  green:  { card: "border-green-300 bg-green-50",  header: "bg-green-100 text-green-800" },
  gray:   { card: "border-gray-300 bg-gray-50",    header: "bg-gray-100 text-gray-700" },
  red:    { card: "border-red-300 bg-red-50",      header: "bg-red-100 text-red-800" },
  pink:   { card: "border-pink-300 bg-pink-50",    header: "bg-pink-100 text-pink-800" },
  cyan:   { card: "border-cyan-300 bg-cyan-50",    header: "bg-cyan-100 text-cyan-800" },
};
const COLOR_KEYS = Object.keys(COLORS);

const ICONS = { Crown, Building2, Briefcase, Layers, TrendingUp, BarChart3, Settings2, Users };
const ICON_KEYS = Object.keys(ICONS);

// ─── Default categories ───
const DEFAULT_CATEGORIES = [
  { id: "board",  label: "Board & Trustees",      iconKey: "Crown",     colorKey: "amber",  patterns: ["board chair", "chair of the board", "vice chair", "board member", "trustee", "chairman", "chairperson"] },
  { id: "exec",   label: "Executive Leadership",  iconKey: "Building2", colorKey: "indigo", patterns: ["chief ", "ceo", "cio", "cfo", "coo", "cto", "ccio", "president", "executive director", "general counsel", "executive officer"] },
  { id: "smgmt",  label: "Senior Management",      iconKey: "Briefcase",  colorKey: "blue",   patterns: ["managing director", "senior managing director", "partner", "head of", "deputy ", "co-head", "svp", "senior vice president", "executive vice president", "evp"] },
  { id: "dir",    label: "Directors & VPs",        iconKey: "Layers",     colorKey: "purple", patterns: ["director", "vice president", " vp", "vp ", "vp,", "vp.", "vp/", "deputy director"] },
  { id: "pm",     label: "Portfolio Managers",     iconKey: "TrendingUp", colorKey: "teal",   patterns: ["portfolio manager", " pm ", " pm,", " pm.", "pm/", "lead pm", "co-pm", "investment manager", "fund manager"] },
  { id: "analyst",label: "Analysts & Associates",  iconKey: "BarChart3",  colorKey: "green",  patterns: ["analyst", "associate", "research", "trader", "quant", "strategist"] },
  { id: "other",  label: "Operations & Other",     iconKey: "Settings2",  colorKey: "gray",   patterns: [] },
];

const STORAGE_PREFIX = "mk_teamHierarchy_";

function loadCategories(firmId) {
  if (!firmId) return DEFAULT_CATEGORIES;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + firmId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_CATEGORIES;
}

function saveCategories(firmId, cats) {
  if (!firmId) return;
  try { localStorage.setItem(STORAGE_PREFIX + firmId, JSON.stringify(cats)); } catch { /* ignore */ }
}

// ─── Classification ───
function classifyPerson(title, categories) {
  if (title) {
    const lower = title.toLowerCase().trim();
    for (const cat of categories) {
      if (!cat.patterns || cat.patterns.length === 0) continue;
      for (const pat of cat.patterns) {
        if (lower.includes(pat.toLowerCase())) return cat;
      }
    }
  }
  // Fallback: last category (catch-all)
  return categories[categories.length - 1];
}

function getFullName(person) {
  return [person.first_name, person.last_name].filter(Boolean).join(" ") || "Unknown";
}

// ─── Person card ───
function PersonCard({ person, colorClass }) {
  const name = getFullName(person);
  return (
    <div className="flex flex-col items-center" style={{ minWidth: 130 }}>
      <div className={`flex flex-col items-center p-2.5 rounded-xl border-2 bg-white shadow-sm ${colorClass}`} style={{ width: 130, minHeight: 110 }}>
        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-white mb-1.5">
          {person.photo_url ? (
            <img src={person.photo_url} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = "none"; }} />
          ) : (
            <User className="w-4 h-4 text-indigo-400" />
          )}
        </div>
        <p className="text-[11px] font-semibold text-gray-800 text-center leading-tight break-words whitespace-normal" style={{ wordBreak: "break-word" }}>
          {name}
        </p>
        {person.title && (
          <p className="text-[10px] text-gray-500 text-center leading-tight mt-0.5 break-words whitespace-normal" style={{ wordBreak: "break-word" }}>
            {person.title}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Level row (display) ───
function LevelRow({ cat, people, idx, total }) {
  const [collapsed, setCollapsed] = useState(false);
  const Icon = ICONS[cat.iconKey] || Users;
  const color = COLORS[cat.colorKey] || COLORS.gray;
  const showConnector = idx < total - 1;

  return (
    <div className="flex flex-col items-center w-full">
      <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${color.header} mb-2`}>
        <Icon className="w-3.5 h-3.5" />
        {cat.label}
        <span className="font-normal opacity-70">({people.length})</span>
        <button type="button" onClick={() => setCollapsed(c => !c)} className="ml-1 hover:opacity-70 transition-opacity">
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>
      {!collapsed && (
        <div className="flex flex-wrap gap-4 justify-center mb-2">
          {people.map((person, i) => (
            <PersonCard key={i} person={person} colorClass={color.card} />
          ))}
        </div>
      )}
      {showConnector && <div className="w-px h-6 bg-gray-300 mb-2" />}
    </div>
  );
}

// ─── Category editor row (manage mode) ───
function CategoryEditor({ cat, idx, total, onChange, onDelete, onMoveUp, onMoveDown }) {
  const color = COLORS[cat.colorKey] || COLORS.gray;
  const Icon = ICONS[cat.iconKey] || Users;
  const isCatchAll = idx === total - 1;

  return (
    <div className={`rounded-lg border-2 p-3 ${color.card}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex gap-0.5">
          <button type="button" onClick={onMoveUp} disabled={idx === 0} className="p-1 rounded hover:bg-white/60 disabled:opacity-30 disabled:cursor-not-allowed" title="Move up">
            <ArrowUp className="w-3.5 h-3.5 text-gray-600" />
          </button>
          <button type="button" onClick={onMoveDown} disabled={idx === total - 1} className="p-1 rounded hover:bg-white/60 disabled:opacity-30 disabled:cursor-not-allowed" title="Move down">
            <ArrowDown className="w-3.5 h-3.5 text-gray-600" />
          </button>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${color.header}`}>
          <Icon className="w-3.5 h-3.5" />
          #{idx + 1}
        </div>
        <input
          type="text"
          value={cat.label}
          onChange={(e) => onChange({ ...cat, label: e.target.value })}
          className="flex-1 text-sm font-medium bg-white/70 rounded px-2 py-1 border border-gray-200 focus:outline-none focus:border-indigo-400"
          placeholder="Category name"
        />
        <button
          type="button"
          onClick={onDelete}
          disabled={total <= 1}
          className="p-1 rounded text-red-500 hover:bg-red-100 disabled:opacity-30 disabled:cursor-not-allowed"
          title={isCatchAll ? "Catch-all category (can't delete)" : "Delete category"}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <div>
          <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Keywords (comma-separated)</label>
          <input
            type="text"
            value={(cat.patterns || []).join(", ")}
            onChange={(e) => {
              const patterns = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
              onChange({ ...cat, patterns });
            }}
            disabled={isCatchAll}
            className="w-full text-xs bg-white/70 rounded px-2 py-1 border border-gray-200 focus:outline-none focus:border-indigo-400 disabled:opacity-60"
            placeholder={isCatchAll ? "Catch-all — receives unmatched contacts" : "e.g. director, vp, manager"}
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Color</label>
            <div className="flex flex-wrap gap-1">
              {COLOR_KEYS.map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChange({ ...cat, colorKey: key })}
                  className={`w-5 h-5 rounded-full border border-gray-300 hover:scale-110 transition-transform ${cat.colorKey === key ? "ring-2 ring-offset-1 ring-gray-600" : ""} ${COLORS[key].header.split(" ")[0]}`}
                  title={key}
                />
              ))}
            </div>
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Icon</label>
            <select
              value={cat.iconKey}
              onChange={(e) => onChange({ ...cat, iconKey: e.target.value })}
              className="text-xs bg-white/70 rounded px-2 py-1 border border-gray-200 focus:outline-none focus:border-indigo-400"
            >
              {ICON_KEYS.map(key => <option key={key} value={key}>{key}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───
export default function TeamHierarchyView({ people, firmName, firmId, editable }) {
  const canEdit = editable !== undefined ? editable : !!firmId;
  const [categories, setCategories] = useState(() => loadCategories(firmId));
  const [manageMode, setManageMode] = useState(false);
  const [printing, setPrinting] = useState(false);
  const hierarchyRef = useRef(null);

  // Persist on change
  const updateCategories = (next) => {
    setCategories(next);
    saveCategories(firmId, next);
  };

  const grouped = useMemo(() => {
    const buckets = categories.map(c => ({ ...c, people: [] }));
    for (const person of people) {
      const cat = classifyPerson(person.title, categories);
      const bucket = buckets.find(b => b.id === cat.id);
      if (bucket) bucket.people.push(person);
      else buckets[buckets.length - 1].people.push(person);
    }
    return buckets.filter(b => b.people.length > 0);
  }, [people, categories]);

  const totalPeople = people.length;

  // ── Category management handlers ──
  const handleCatChange = (idx, updated) => {
    const next = [...categories];
    next[idx] = updated;
    updateCategories(next);
  };
  const handleCatDelete = (idx) => {
    if (categories.length <= 1) return;
    const next = categories.filter((_, i) => i !== idx);
    updateCategories(next);
  };
  const handleMoveUp = (idx) => {
    if (idx === 0) return;
    const next = [...categories];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    updateCategories(next);
  };
  const handleMoveDown = (idx) => {
    if (idx === categories.length - 1) return;
    const next = [...categories];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    updateCategories(next);
  };
  const handleAddCat = () => {
    const next = [...categories];
    // Insert before the catch-all (last)
    const insertIdx = next.length - 1;
    const newCat = {
      id: `cat_${Date.now()}`,
      label: "New Category",
      iconKey: "Users",
      colorKey: COLOR_KEYS[next.length % COLOR_KEYS.length],
      patterns: [],
    };
    next.splice(insertIdx, 0, newCat);
    updateCategories(next);
  };
  const handleReset = () => {
    updateCategories(DEFAULT_CATEGORIES.map(c => ({ ...c })));
    toast({ title: "Categories reset", description: "Restored to default structure." });
  };

  // ── Print / Download ──
  const captureCanvas = async () => {
    const html2canvas = (await import("html2canvas")).default;
    return html2canvas(hierarchyRef.current, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
    });
  };

  const handleDownload = async () => {
    if (!hierarchyRef.current) return;
    setPrinting(true);
    try {
      // Temporarily exit manage mode for a clean capture
      const wasManage = manageMode;
      if (wasManage) setManageMode(false);
      await new Promise(r => setTimeout(r, 300));
      const canvas = await captureCanvas();
      const link = document.createElement("a");
      link.download = `${(firmName || "team").replace(/[^a-z0-9]/gi, "_")}_structure.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      if (wasManage) setManageMode(true);
      toast({ title: "Downloaded", description: "Team structure saved as PNG." });
    } catch (err) {
      toast({ title: "Download failed", description: err?.message || "Could not generate image.", variant: "destructive" });
    } finally {
      setPrinting(false);
    }
  };

  const handlePrint = async () => {
    if (!hierarchyRef.current) return;
    setPrinting(true);
    try {
      const wasManage = manageMode;
      if (wasManage) setManageMode(false);
      await new Promise(r => setTimeout(r, 300));
      const canvas = await captureCanvas();
      const img = canvas.toDataURL("image/png");
      const win = window.open("", "_blank");
      if (!win) {
        toast({ title: "Print blocked", description: "Please allow popups for this site.", variant: "destructive" });
        if (wasManage) setManageMode(true);
        return;
      }
      win.document.write(
        `<html><head><title>${firmName || "Team"} Structure</title></head>` +
        `<body style="margin:0;padding:20px;display:flex;justify-content:center;background:#fff;">` +
        `<img src="${img}" style="max-width:100%;"/></body></html>`
      );
      win.document.close();
      setTimeout(() => { win.focus(); win.print(); }, 400);
      if (wasManage) setManageMode(true);
    } catch (err) {
      toast({ title: "Print failed", description: err?.message || "Could not print.", variant: "destructive" });
    } finally {
      setPrinting(false);
    }
  };

  if (totalPeople === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <Users className="w-10 h-10 mb-2 opacity-40" />
        <p className="text-sm">No contacts to organize</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 flex-1 min-w-0">
          <Users className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <p className="text-xs text-indigo-700 truncate">
            <strong>{firmName}</strong> — {totalPeople} {totalPeople === 1 ? "person" : "people"} across {grouped.length} {grouped.length === 1 ? "level" : "levels"}.
          </p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          disabled={printing}
          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors disabled:opacity-50"
        >
          {printing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
          Print
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={printing}
          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors disabled:opacity-50"
        >
          {printing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Download
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={() => setManageMode(m => !m)}
            className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors ${
              manageMode ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700" : "text-gray-600 hover:bg-gray-100 border-gray-200"
            }`}
          >
            {manageMode ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
            {manageMode ? "Done" : "Edit Categories"}
          </button>
        )}
      </div>

      {/* Manage mode: category editors */}
      {manageMode ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Drag-free reorder with arrows. The last category is the catch-all for unmatched contacts.
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to defaults
            </button>
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto p-1">
            {categories.map((cat, idx) => (
              <CategoryEditor
                key={cat.id}
                cat={cat}
                idx={idx}
                total={categories.length}
                onChange={(updated) => handleCatChange(idx, updated)}
                onDelete={() => handleCatDelete(idx)}
                onMoveUp={() => handleMoveUp(idx)}
                onMoveDown={() => handleMoveDown(idx)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddCat}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors w-full justify-center"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        </div>
      ) : (
        /* Display mode: hierarchy tree */
        <div ref={hierarchyRef} className="rounded-xl border border-gray-100 bg-white p-4 overflow-x-auto">
          <div className="flex flex-col items-center min-w-fit">
            {firmName && (
              <h3 className="text-sm font-bold text-gray-800 mb-3 text-center">{firmName} — Team Structure</h3>
            )}
            {grouped.length === 0 ? (
              <p className="text-sm text-gray-400 py-8">No contacts match your categories.</p>
            ) : (
              grouped.map((level, idx) => (
                <LevelRow
                  key={level.id}
                  cat={level}
                  people={level.people}
                  idx={idx}
                  total={grouped.length}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}