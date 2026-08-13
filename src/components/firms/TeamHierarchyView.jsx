import React, { useMemo, useState, useRef } from "react";
import {
  User, ChevronDown, ChevronRight, Users, Layers,
  Crown, Briefcase, TrendingUp, BarChart3, Settings2, Building2,
  Printer, Download, Plus, Trash2, ArrowUp, ArrowDown, Pencil, RotateCcw, X, Check, Loader2, Move, Pin,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

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
// Grouping is driven by the contact's department classification (contact_firm_roles).
const DEFAULT_CATEGORIES = [
  { id: "board",  label: "Board",                       iconKey: "Crown",     colorKey: "amber",  patterns: [], departmentPatterns: ["board"] },
  { id: "exec",   label: "Executives",                  iconKey: "Building2", colorKey: "indigo", patterns: [], departmentPatterns: ["executive"] },
  { id: "mgmt",   label: "Management Team",             iconKey: "Briefcase", colorKey: "blue",   patterns: [], departmentPatterns: ["management"] },
  { id: "inv",    label: "Investments",                 iconKey: "TrendingUp", colorKey: "teal",   patterns: [], departmentPatterns: ["investments"] },
  { id: "legal",  label: "Compliance & Legal",          iconKey: "Settings2", colorKey: "purple", patterns: [], departmentPatterns: ["compliance", "legal"] },
  { id: "mkt",    label: "Marketing & Client Services",  iconKey: "BarChart3", colorKey: "pink",   patterns: [], departmentPatterns: ["marketing", "client services"] },
  { id: "ops",    label: "Operations",                  iconKey: "Settings2", colorKey: "green",  patterns: [], departmentPatterns: ["operations"] },
  { id: "admin",  label: "Administration",              iconKey: "Layers",    colorKey: "cyan",   patterns: [], departmentPatterns: ["administration"] },
  { id: "other",  label: "Other",                       iconKey: "Users",     colorKey: "gray",   patterns: [] },
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

const ASSIGN_PREFIX = "mk_teamHierarchyAssign_";

function loadAssignments(firmId) {
  if (!firmId) return {};
  try {
    const raw = localStorage.getItem(ASSIGN_PREFIX + firmId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch { /* ignore */ }
  return {};
}

function saveAssignments(firmId, map) {
  if (!firmId) return;
  try { localStorage.setItem(ASSIGN_PREFIX + firmId, JSON.stringify(map)); } catch { /* ignore */ }
}

// Per-category contact ordering (drag-rearranged). Stored as a map of
// categoryId -> [contactId, ...]. Contacts not in the list keep their
// original grouping order, appended after the ordered ones.
const ORDER_PREFIX = "mk_teamHierarchyOrder_";

function loadOrders(firmId) {
  if (!firmId) return {};
  try {
    const raw = localStorage.getItem(ORDER_PREFIX + firmId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch { /* ignore */ }
  return {};
}

function saveOrders(firmId, map) {
  if (!firmId) return;
  try { localStorage.setItem(ORDER_PREFIX + firmId, JSON.stringify(map)); } catch { /* ignore */ }
}

// ─── Classification ───
// Returns the set of category ids a person matches (by title OR department).
// A person may match multiple categories (e.g. a board member who is also an executive).
function matchCategories(person, categories) {
  const matched = [];
  const title = person.title ? person.title.toLowerCase().trim() : "";
  const roles = Array.isArray(person.contact_firm_roles)
    ? person.contact_firm_roles.map((r) => (r || "").toLowerCase().trim()).filter(Boolean)
    : [];
  for (const cat of categories) {
    const hasTitlePatterns = cat.patterns && cat.patterns.length > 0;
    const hasDeptPatterns = cat.departmentPatterns && cat.departmentPatterns.length > 0;
    if (!hasTitlePatterns && !hasDeptPatterns) continue; // skip catch-all
    let titleMatch = false;
    if (title) {
      for (const pat of cat.patterns) {
        if (title.includes(pat.toLowerCase())) { titleMatch = true; break; }
      }
    }
    let deptMatch = false;
    if (cat.departmentPatterns && cat.departmentPatterns.length) {
      for (const pat of cat.departmentPatterns) {
        const p = pat.toLowerCase().trim();
        if (roles.some((r) => r.includes(p))) { deptMatch = true; break; }
      }
    }
    if (titleMatch || deptMatch) matched.push(cat.id);
  }
  return matched;
}

function getFullName(person) {
  return [person.first_name, person.last_name].filter(Boolean).join(" ") || "Unknown";
}

// ─── Category assignment popover (move / copy a contact to categories) ───
function CategoryAssignPopover({ person, categories, assignedCategoryIds, onAssign, onResetAuto }) {
  const [open, setOpen] = useState(false);
  const manual = Array.isArray(assignedCategoryIds) ? assignedCategoryIds : null;
  const autoIds = useMemo(() => matchCategories(person, categories), [person, categories]);
  const currentIds = manual !== null ? manual : autoIds;
  // All categories except the catch-all (last) are manually assignable.
  const selectable = categories.slice(0, -1);

  const toggle = (catId) => {
    const base = new Set(manual !== null ? manual : autoIds);
    if (base.has(catId)) base.delete(catId); else base.add(catId);
    const arr = Array.from(base);
    if (arr.length === 0) { onResetAuto(person.id); }
    else { onAssign(person.id, arr); }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
          title="Move / copy to categories"
        >
          <Move className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2" onClick={(e) => e.stopPropagation()} align="start">
        <p className="text-xs font-semibold text-gray-700 mb-1.5">Assign to categories</p>
        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {selectable.map((cat) => (
            <label key={cat.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 px-1.5 py-1 rounded">
              <Checkbox
                checked={currentIds.includes(cat.id)}
                onCheckedChange={() => toggle(cat.id)}
              />
              <span className="text-gray-700">{cat.label}</span>
            </label>
          ))}
        </div>
        {manual !== null && (
          <button
            type="button"
            onClick={() => { onResetAuto(person.id); setOpen(false); }}
            className="mt-2 w-full text-[11px] text-gray-500 hover:text-red-600 border-t border-gray-100 pt-1.5 flex items-center justify-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to auto
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Person card ───
function PersonCard({ person, colorClass, onClick, canEdit, categories, assignedCategoryIds, onAssign, onResetAuto }) {
  const name = getFullName(person);
  const clickable = !!onClick;
  const hasManual = Array.isArray(assignedCategoryIds);
  return (
    <div className="flex flex-col items-center relative" style={{ minWidth: 130 }}>
      {canEdit && (
        <div className="absolute -top-1.5 -right-1.5 z-20">
          <CategoryAssignPopover
            person={person}
            categories={categories}
            assignedCategoryIds={assignedCategoryIds}
            onAssign={onAssign}
            onResetAuto={onResetAuto}
          />
        </div>
      )}
      <div
        className={`flex flex-col items-center p-2.5 rounded-xl border-2 bg-white shadow-sm relative ${colorClass} ${clickable ? "cursor-pointer hover:shadow-md hover:ring-2 hover:ring-indigo-300 hover:border-indigo-400 transition-all" : ""}`}
        style={{ width: 130, minHeight: 110 }}
        onClick={clickable ? () => onClick(person) : undefined}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
      >
        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-white mb-1.5">
          {person.photo_url ? (
            <img src={person.photo_url} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = "none"; }} />
          ) : null}
        </div>
        <p className="text-[11px] font-semibold text-gray-800 text-center leading-tight break-words whitespace-normal" style={{ wordBreak: "break-word" }}>
          {name}
        </p>
        {person.title && (
          <p className="text-[10px] text-gray-500 text-center leading-tight mt-0.5 break-words whitespace-normal" style={{ wordBreak: "break-word" }}>
            {person.title}
          </p>
        )}
        {hasManual && (
          <span className="absolute bottom-1 left-1 text-indigo-500" title="Manually assigned">
            <Pin className="w-3 h-3" />
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Level row (display) ───
function LevelRow({ cat, people, idx, total, onContactClick, canEdit, categories, manualAssignments, onAssign, onResetAuto }) {
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
        canEdit ? (
          <Droppable droppableId={cat.id} type={cat.id} direction="horizontal">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex flex-wrap gap-4 justify-center mb-2"
              >
                {people.map((person, i) => (
                  <Draggable
                    key={`${cat.id}__${person.id}`}
                    draggableId={`${cat.id}__${person.id}`}
                    index={i}
                  >
                    {(prov) => (
                      <div
                        ref={prov.innerRef}
                        {...prov.draggableProps}
                        {...prov.dragHandleProps}
                        style={prov.draggableProps.style}
                      >
                        <PersonCard
                          person={person}
                          colorClass={color.card}
                          onClick={onContactClick}
                          canEdit={canEdit}
                          categories={categories}
                          assignedCategoryIds={manualAssignments[person.id]}
                          onAssign={onAssign}
                          onResetAuto={onResetAuto}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ) : (
          <div className="flex flex-wrap gap-4 justify-center mb-2">
            {people.map((person, i) => (
              <PersonCard
                key={i}
                person={person}
                colorClass={color.card}
                onClick={onContactClick}
                canEdit={canEdit}
                categories={categories}
                assignedCategoryIds={manualAssignments[person.id]}
                onAssign={onAssign}
                onResetAuto={onResetAuto}
              />
            ))}
          </div>
        )
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
        <div>
          <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Department keywords (comma-separated)</label>
          <input
            type="text"
            value={(cat.departmentPatterns || []).join(", ")}
            onChange={(e) => {
              const departmentPatterns = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
              onChange({ ...cat, departmentPatterns });
            }}
            disabled={isCatchAll}
            className="w-full text-xs bg-white/70 rounded px-2 py-1 border border-gray-200 focus:outline-none focus:border-indigo-400 disabled:opacity-60"
            placeholder={isCatchAll ? "Catch-all — receives unmatched contacts" : "e.g. board, investments"}
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
export default function TeamHierarchyView({ people, firmName, firmId, editable, onContactClick }) {
  const canEdit = editable !== undefined ? editable : !!firmId;
  const [categories, setCategories] = useState(() => loadCategories(firmId));
  const [manualAssignments, setManualAssignments] = useState(() => loadAssignments(firmId));
  const [categoryOrders, setCategoryOrders] = useState(() => loadOrders(firmId));
  const [manageMode, setManageMode] = useState(false);
  const [printing, setPrinting] = useState(false);
  const hierarchyRef = useRef(null);

  // Persist on change
  const updateCategories = (next) => {
    setCategories(next);
    saveCategories(firmId, next);
  };

  const updateAssignments = (next) => {
    setManualAssignments(next);
    saveAssignments(firmId, next);
  };

  const updateOrders = (next) => {
    setCategoryOrders(next);
    saveOrders(firmId, next);
  };

  // Reorder a contact within its category (drag-and-drop). Cross-category
  // drags are blocked by per-category Droppable types, so this only fires for
  // same-category moves.
  const handleDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination || source.droppableId !== destination.droppableId) return;
    if (source.index === destination.index) return;
    const bucket = grouped.find((b) => b.id === destination.droppableId);
    if (!bucket) return;
    const reordered = Array.from(bucket.people);
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);
    updateOrders({ ...categoryOrders, [destination.droppableId]: reordered.map((p) => p.id) });
  };

  const handleAssign = (contactId, categoryIds) => {
    updateAssignments({ ...manualAssignments, [contactId]: categoryIds });
  };
  const handleResetAuto = (contactId) => {
    const next = { ...manualAssignments };
    delete next[contactId];
    updateAssignments(next);
  };

  const grouped = useMemo(() => {
    const buckets = categories.map(c => ({ ...c, people: [] }));
    for (const person of people) {
      const manual = manualAssignments[person.id];
      const matchedIds = Array.isArray(manual)
        ? manual.filter((id) => categories.some((c) => c.id === id))
        : matchCategories(person, categories);
      if (matchedIds.length === 0) {
        buckets[buckets.length - 1].people.push(person);
      } else {
        for (const id of matchedIds) {
          const bucket = buckets.find(b => b.id === id);
          if (bucket) bucket.people.push(person);
        }
      }
    }
    // Apply any saved per-category ordering (from drag-rearrange). Contacts in
    // the saved order list come first in that order; any not in the list
    // append in their original grouping order.
    for (const bucket of buckets) {
      const order = categoryOrders[bucket.id] || [];
      if (!order.length) continue;
      const orderIndex = new Map(order.map((id, i) => [id, i]));
      const ordered = [];
      const rest = [];
      for (const p of bucket.people) {
        if (orderIndex.has(p.id)) ordered.push({ p, i: orderIndex.get(p.id) });
        else rest.push(p);
      }
      ordered.sort((a, b) => a.i - b.i);
      bucket.people = [...ordered.map((x) => x.p), ...rest];
    }
    return buckets.filter(b => b.people.length > 0);
  }, [people, categories, manualAssignments, categoryOrders]);

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

      {canEdit && !manageMode && (
        <p className="text-[11px] text-gray-400 px-1 flex items-center gap-1">
          <Move className="w-3 h-3" />
          Use the move button on a card to assign a contact to one or more categories. Drag a card to reorder it within its category.
        </p>
      )}

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
            <DragDropContext onDragEnd={handleDragEnd}>
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
                    onContactClick={onContactClick}
                    canEdit={canEdit}
                    categories={categories}
                    manualAssignments={manualAssignments}
                    onAssign={handleAssign}
                    onResetAuto={handleResetAuto}
                  />
                ))
              )}
            </DragDropContext>
          </div>
        </div>
      )}
    </div>
  );
}