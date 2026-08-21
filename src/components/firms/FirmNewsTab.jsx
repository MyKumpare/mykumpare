import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Newspaper, Plus, Trash2, Pin, PinOff, ExternalLink, Sparkles, Loader2,
  AlertTriangle, ChevronDown, ChevronUp, Edit2, Check, X, Calendar, History, Search,
  ArrowDownWideNarrow, ArrowUpWideNarrow, FileText, CheckSquare, Tag,
} from "lucide-react";
import { format } from "date-fns";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { toast } from "@/components/ui/use-toast";
import ContactTaggerPopover from "./ContactTaggerPopover";
import FirmTaggerPopover from "./FirmTaggerPopover";
import HistoricalScrubDialog from "../news/HistoricalScrubDialog";
import NewsBulkActionBar from "../news/NewsBulkActionBar";
import { lazyDialog } from "../common/lazyDialog";
const NewsSummaryDialog = lazyDialog(() => import("../news/NewsSummaryDialog"));

const QUILL_MODULES = {
  toolbar: [
    [{ header: [false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["blockquote", "clean"],
  ],
};

export const ALERT_STYLES = {
  High: { color: "text-red-600", bg: "bg-red-50", border: "border-red-200", icon: AlertTriangle },
  Medium: { color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", icon: AlertTriangle },
  Low: { color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", icon: ChevronDown },
};

export const STATUS_STYLES = {
  Positive: { color: "text-green-600", bg: "bg-green-50", border: "border-green-200", dot: "bg-green-500" },
  Negative: { color: "text-red-600", bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500" },
  Neutral: { color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200", dot: "bg-gray-400" },
};

export function fmt(dateStr) {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy"); } catch { return dateStr; }
}

export default function FirmNewsTab({ firmId, firmName }) {
  const queryClient = useQueryClient();
  const [scrubbing, setScrubbing] = useState(false);
  const [historicalScrubbing, setHistoricalScrubbing] = useState(false);
  const [addingManual, setAddingManual] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [alertFilter, setAlertFilter] = useState("All");
  const [dateSort, setDateSort] = useState("newest");
  const [keywords, setKeywords] = useState([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [showKeywords, setShowKeywords] = useState(false);
  const [showHistorical, setShowHistorical] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  // Owned news (firm_id = this firm) + tagged news (tagged_firm_ids includes this firm)
  const { data: ownedNews = [], isLoading: loadingOwned } = useQuery({
    queryKey: ["firm_news", firmId, "owned"],
    queryFn: () => base44.entities.FirmNews.filter({ firm_id: firmId }, "-news_date", 200),
    enabled: !!firmId,
  });
  const { data: taggedByFirm = [], isLoading: loadingTagged } = useQuery({
    queryKey: ["firm_news", firmId, "tagged_firm"],
    queryFn: () => base44.entities.FirmNews.filter({ tagged_firm_ids: firmId }, "-news_date", 200),
    enabled: !!firmId,
  });
  const isLoading = loadingOwned || loadingTagged;

  const newsItems = useMemo(() => {
    const map = new Map();
    [...ownedNews, ...taggedByFirm].forEach(n => { if (!n.deleted_at) map.set(n.id, n); });
    return Array.from(map.values());
  }, [ownedNews, taggedByFirm]);

  // Fetch all contacts for tagging
  const { data: allContacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });
  const taggableContacts = useMemo(
    () => allContacts.filter(c => !c.deleted_at),
    [allContacts]
  );

  // Fetch all firms for tagging (exclude the current firm — its news is already shown)
  const { data: allFirms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
  });
  const taggableFirms = useMemo(
    () => allFirms.filter(f => !f.deleted_at && f.id !== firmId),
    [allFirms, firmId]
  );

  const activeNews = useMemo(() => newsItems, [newsItems]);

  const sortedNews = useMemo(() => {
    const filtered = alertFilter === "All"
      ? activeNews
      : activeNews.filter(n => n.alert_status === alertFilter);
    return [...filtered].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      const cmp = (a.news_date || "").localeCompare(b.news_date || "");
      return dateSort === "newest" ? -cmp : cmp;
    });
  }, [activeNews, alertFilter, dateSort]);

  const handleScrub = async () => {
    setScrubbing(true);
    try {
      const res = await base44.functions.invoke('scrubFirmNews', { mode: 'single', firm_id: firmId, keywords: keywords.length ? keywords : undefined });
      const count = res.data?.created || 0;
      if (count > 0) {
        toast({ title: `Scrub complete`, description: `${count} news item${count > 1 ? "s" : ""} found.` });
      } else {
        toast({ title: "Scrub complete", description: "No new news found for this firm." });
      }
      queryClient.invalidateQueries({ queryKey: ["firm_news"] });
    } catch (e) {
      toast({ title: "Scrub failed", description: e.message, variant: "destructive" });
    }
    setScrubbing(false);
  };

  const handleHistoricalScrub = async ({ start_date, end_date }) => {
    setHistoricalScrubbing(true);
    try {
      await base44.functions.invoke('scrubFirmNewsHistorical', {
        mode: 'single', firm_id: firmId,
        keywords: keywords.length ? keywords : undefined,
        start_date: start_date || undefined,
        end_date: end_date || undefined,
      });
      const rangeTxt = (start_date || end_date) ? ` between ${start_date || "anytime"} and ${end_date || "today"}` : " across all available history";
      toast({ title: "Historical scrub started", description: `Searching${rangeTxt} — news will appear shortly.` });
      // Poll for results since the scrub runs in the background
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["firm_news"] }), 15000);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["firm_news"] }), 45000);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["firm_news"] }), 90000);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["firm_news"] }), 150000);
    } catch (e) {
      toast({ title: "Historical scrub failed", description: e.message, variant: "destructive" });
      throw e;
    }
    setHistoricalScrubbing(false);
  };

  const addKeyword = () => {
    const k = keywordInput.trim();
    if (k && !keywords.includes(k)) setKeywords([...keywords, k]);
    setKeywordInput("");
  };

  const removeKeyword = (k) => setKeywords(keywords.filter(x => x !== k));

  const handleTogglePin = async (item) => {
    await base44.entities.FirmNews.update(item.id, { is_pinned: !item.is_pinned });
    queryClient.invalidateQueries({ queryKey: ["firm_news"] });
    queryClient.invalidateQueries({ queryKey: ["pinned_news_alerts"] });
  };

  const handleDelete = async (item) => {
    await base44.entities.FirmNews.delete(item.id);
    queryClient.invalidateQueries({ queryKey: ["firm_news"] });
    queryClient.invalidateQueries({ queryKey: ["pinned_news_alerts"] });
  };

  const handleUpdate = async (id, data) => {
    await base44.entities.FirmNews.update(id, data);
    queryClient.invalidateQueries({ queryKey: ["firm_news"] });
    queryClient.invalidateQueries({ queryKey: ["pinned_news_alerts"] });
  };

  const handleTagContacts = async (item, taggedContactIds) => {
    await base44.entities.FirmNews.update(item.id, { tagged_contact_ids: taggedContactIds });
    queryClient.invalidateQueries({ queryKey: ["firm_news"] });
  };
  const handleTagFirms = async (item, taggedFirmIds) => {
    await base44.entities.FirmNews.update(item.id, { tagged_firm_ids: taggedFirmIds });
    queryClient.invalidateQueries({ queryKey: ["firm_news"] });
  };

  // Re-run auto-tagging on a single article (merges any newly found mentions;
  // never removes manually-managed tags)
  const handleAutoTag = async (item) => {
    try {
      const res = await base44.functions.invoke('autoTagNewsMention', { news_id: item.id });
      const r = res?.data?.result;
      const cCount = r?.tagged_contact_ids?.length || 0;
      const fCount = r?.tagged_firm_ids?.length || 0;
      if (cCount || fCount) {
        toast({ title: "Re-tagged", description: `${cCount} contact(s) and ${fCount} firm(s) now linked.` });
      } else {
        toast({ title: "Re-tag complete", description: "No new mentions found in this article." });
      }
      queryClient.invalidateQueries({ queryKey: ["firm_news"] });
    } catch (e) {
      toast({ title: "Auto-tag failed", description: e.message, variant: "destructive" });
    }
  };

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectAllNews = () => setSelectedIds(new Set(sortedNews.map(n => n.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkTagContacts = async (idsToAdd) => {
    const items = sortedNews.filter(n => selectedIds.has(n.id));
    const updates = items.map(n => ({
      id: n.id,
      tagged_contact_ids: Array.from(new Set([...(n.tagged_contact_ids || []), ...idsToAdd])),
    }));
    if (!updates.length) return;
    try {
      await base44.entities.FirmNews.bulkUpdate(updates);
      toast({ title: "Tags applied", description: `Added ${idsToAdd.length} contact${idsToAdd.length > 1 ? "s" : ""} to ${updates.length} article${updates.length > 1 ? "s" : ""}.` });
      queryClient.invalidateQueries({ queryKey: ["firm_news"] });
    } catch (e) {
      toast({ title: "Bulk tag failed", description: e.message, variant: "destructive" });
    }
  };
  const handleBulkTagFirms = async (idsToAdd) => {
    const items = sortedNews.filter(n => selectedIds.has(n.id));
    const updates = items.map(n => ({
      id: n.id,
      tagged_firm_ids: Array.from(new Set([...(n.tagged_firm_ids || []), ...idsToAdd])),
    }));
    if (!updates.length) return;
    try {
      await base44.entities.FirmNews.bulkUpdate(updates);
      toast({ title: "Tags applied", description: `Added ${idsToAdd.length} firm${idsToAdd.length > 1 ? "s" : ""} to ${updates.length} article${updates.length > 1 ? "s" : ""}.` });
      queryClient.invalidateQueries({ queryKey: ["firm_news"] });
    } catch (e) {
      toast({ title: "Bulk tag failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Newspaper className="w-4 h-4 text-rose-500" />
          <span className="text-sm font-semibold text-gray-700">News & Alerts</span>
          {activeNews.length > 0 && (
            <span className="text-xs text-gray-400">({activeNews.length})</span>
          )}
          {activeNews.length > 0 && (
            <Select value={alertFilter} onValueChange={setAlertFilter}>
              <SelectTrigger className="h-6 w-[105px] text-xs gap-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Impact Levels</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
          )}
          {activeNews.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 gap-1"
              onClick={() => setDateSort(d => d === "newest" ? "oldest" : "newest")}
              title={dateSort === "newest" ? "Newest first — click for oldest first" : "Oldest first — click for newest first"}
            >
              {dateSort === "newest" ? <ArrowDownWideNarrow className="w-3.5 h-3.5" /> : <ArrowUpWideNarrow className="w-3.5 h-3.5" />}
              {dateSort === "newest" ? "Newest" : "Oldest"}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`h-7 px-2 gap-1 text-xs ${selectMode ? "text-indigo-700 bg-indigo-50 hover:bg-indigo-100" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}`}
            onClick={() => { setSelectMode(v => !v); if (selectMode) clearSelection(); }}
            disabled={activeNews.length === 0}
            title={selectMode ? "Exit multi-select" : "Select multiple articles to bulk-tag"}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            {selectMode ? "Done" : "Select"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`h-7 px-2 gap-1 text-xs ${keywords.length ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}`}
            onClick={() => setShowKeywords(v => !v)}
            title="Set keywords to focus the news scrub"
          >
            <Search className="w-3.5 h-3.5" />
            Keywords{keywords.length > 0 && ` (${keywords.length})`}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1 text-xs"
            onClick={handleScrub}
            disabled={scrubbing}
          >
            {scrubbing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {scrubbing ? "Scrubbing..." : "Scrub Now"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 gap-1 text-xs"
            onClick={() => setShowHistorical(true)}
            disabled={historicalScrubbing || scrubbing}
            title="Search for historical news going back several years"
          >
            {historicalScrubbing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <History className="w-3.5 h-3.5" />}
            {historicalScrubbing ? "Searching..." : "Historical"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
            onClick={() => setAddingManual(true)}
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-violet-600 hover:text-violet-700 hover:bg-violet-50 gap-1 text-xs"
            onClick={() => setShowSummary(true)}
            disabled={activeNews.length === 0}
            title="Generate a date-ranged news summary report"
          >
            <FileText className="w-3.5 h-3.5" /> Summary
          </Button>
        </div>
      </div>

      {selectMode && (
        <NewsBulkActionBar
          selectedCount={selectedIds.size}
          totalCount={sortedNews.length}
          onSelectAll={selectAllNews}
          onClear={clearSelection}
          contacts={taggableContacts}
          firms={taggableFirms}
          onBulkTagContacts={handleBulkTagContacts}
          onBulkTagFirms={handleBulkTagFirms}
        />
      )}

      {/* Keywords input */}
      {showKeywords && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700">Scrub Keywords</span>
            <button type="button" onClick={() => setShowKeywords(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-gray-500">
            Add keywords to prioritize specific topics (e.g. "SEC action", "fund closure"). The AI scrub will flag matching articles with higher alert levels.
          </p>
          <div className="flex gap-1.5">
            <Input
              value={keywordInput}
              onChange={e => setKeywordInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
              placeholder="Type a keyword and press Enter..."
              className="h-8 text-sm flex-1"
            />
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={addKeyword}>Add</Button>
          </div>
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {keywords.map(k => (
                <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                  {k}
                  <button type="button" onClick={() => removeKeyword(k)} className="hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button type="button" onClick={() => setKeywords([])} className="text-xs text-gray-400 hover:text-red-500 ml-1">
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

      {/* AI scrub info banner */}
      {activeNews.length === 0 && !addingManual && (
        <div className="rounded-xl border border-dashed border-rose-200 bg-rose-50/40 p-4 text-center">
          <Sparkles className="w-5 h-5 text-rose-400 mx-auto mb-1.5" />
          <p className="text-sm text-gray-600 font-medium">No news yet</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Click "Scrub Now" to run an AI news search, or "Add" to create a manual entry.
          </p>
        </div>
      )}

      {/* Manual add form */}
      {addingManual && (
        <NewsItemForm
          firmId={firmId}
          firmName={firmName}
          onSave={async (data) => {
            const created = await base44.entities.FirmNews.create({
              ...data,
              tenant_id: firmId,
              firm_id: firmId,
              firm_name: firmName,
            });
            try { await base44.functions.invoke('autoTagNewsMention', { news_id: created.id }); } catch (e) { /* tagging is best-effort */ }
            queryClient.invalidateQueries({ queryKey: ["firm_news"] });
            setAddingManual(false);
          }}
          onCancel={() => setAddingManual(false)}
        />
      )}

      {/* News list */}
      {isLoading ? (
        <div className="text-xs text-gray-400 italic py-6 text-center">Loading...</div>
      ) : sortedNews.length === 0 && activeNews.length > 0 ? (
        <div className="text-xs text-gray-400 italic py-6 text-center">
          No {alertFilter.toLowerCase()} impact news found. Try a different filter.
        </div>
      ) : (
        <div className="space-y-2">
          {sortedNews.map((item) => (
            <NewsItemCard
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
              editing={editingId === item.id}
              onEdit={() => setEditingId(item.id)}
              onCancelEdit={() => setEditingId(null)}
              onSaveEdit={(data) => { handleUpdate(item.id, data); setEditingId(null); }}
              onTogglePin={() => handleTogglePin(item)}
              onDelete={() => handleDelete(item)}
              contacts={taggableContacts}
              onTagContacts={(ids) => handleTagContacts(item, ids)}
              firms={taggableFirms}
              onTagFirms={(ids) => handleTagFirms(item, ids)}
              selectable={selectMode}
              selected={selectedIds.has(item.id)}
              onToggleSelect={() => toggleSelect(item.id)}
              onAutoTag={() => handleAutoTag(item)}
            />
          ))}
        </div>
      )}

      <HistoricalScrubDialog
        open={showHistorical}
        onOpenChange={setShowHistorical}
        onConfirm={handleHistoricalScrub}
        keywords={keywords}
        targetLabel={firmName}
      />
      <NewsSummaryDialog
        open={showSummary}
        onOpenChange={setShowSummary}
        newsItems={activeNews}
        targetType="firm"
        targetLabel={firmName}
      />
    </div>
  );
}

// ── News item card (view / expand / edit) ───────────────────────────────────
export function NewsItemCard({ item, expanded, onToggleExpand, editing, onEdit, onCancelEdit, onSaveEdit, onTogglePin, onDelete, contacts = [], onTagContacts, firms = [], onTagFirms, selectable, selected, onToggleSelect, onAutoTag }) {
  const alertStyle = ALERT_STYLES[item.alert_status] || ALERT_STYLES.Low;
  const statusStyle = STATUS_STYLES[item.news_status] || STATUS_STYLES.Neutral;
  const AlertIcon = alertStyle.icon;

  if (editing) {
    return (
      <NewsItemForm
        item={item}
        onSave={onSaveEdit}
        onCancel={onCancelEdit}
      />
    );
  }

  return (
    <div className={`rounded-xl border ${item.is_pinned ? 'border-rose-300 bg-rose-50/30' : 'border-gray-200 bg-white'} overflow-hidden`}>
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        {selectable && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selected ? "bg-indigo-600 border-indigo-600" : "border-gray-300 bg-white hover:border-indigo-400"}`}
            title={selected ? "Deselect" : "Select"}
          >
            {selected && <Check className="w-3 h-3 text-white" />}
          </button>
        )}
        {/* Alert level indicator */}
        <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${alertStyle.bg}`}>
          <AlertIcon className={`w-3.5 h-3.5 ${alertStyle.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Headline + badges */}
          <div className="flex items-start gap-2 flex-wrap">
            <button type="button" onClick={onToggleExpand} className="text-left flex-1 min-w-0 flex items-start gap-1.5">
              <span
                className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${statusStyle.dot}`}
                title={`Sentiment: ${item.news_status || "Neutral"}`}
              />
              <p className="text-sm font-semibold text-gray-800 hover:text-indigo-600 transition-colors line-clamp-2">
                {item.headline}
              </p>
            </button>
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
              <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wide">Alert &amp; Status</span>
              <div className="flex items-center gap-1">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${alertStyle.bg} ${alertStyle.color}`}>
                  {item.alert_status}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.color}`}>
                  {item.news_status}
                </span>
                {item.is_pinned && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600 flex items-center gap-0.5">
                    <Pin className="w-2.5 h-2.5" /> Pinned
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Date + source */}
          <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-0.5">
              <Calendar className="w-3 h-3" /> {fmt(item.news_date)}
            </span>
            {item.source_type !== 'firm' && item.source_name && (
              <span className="text-indigo-500">{item.source_type}: {item.source_name}</span>
            )}
          </div>

          {/* Summary (always visible) */}
          {item.summary && (
            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.summary}</p>
          )}

          {/* Tagged contacts & firms (always visible) */}
          {(onTagContacts || onTagFirms) && (
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              {onTagContacts && (
                <ContactTaggerPopover
                  contacts={contacts}
                  taggedIds={item.tagged_contact_ids || []}
                  onTagChange={onTagContacts}
                  size="xs"
                />
              )}
              {onTagFirms && (
                <FirmTaggerPopover
                  firms={firms}
                  taggedIds={item.tagged_firm_ids || []}
                  onTagChange={onTagFirms}
                  size="xs"
                  excludeFirmId={item.firm_id}
                />
              )}
            </div>
          )}

          {/* Expanded content */}
          {expanded && (
            <div className="mt-2 space-y-2">
              {item.summary && (
                <p className="text-xs text-gray-600">{item.summary}</p>
              )}
              {item.article_url && (
                <a href={item.article_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 hover:underline">
                  <ExternalLink className="w-3 h-3" /> View article
                </a>
              )}
              {item.notes && (
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-2">
                  <p className="text-[10px] font-semibold text-gray-500 mb-1">Notes</p>
                  <div className="text-xs text-gray-700 quill-preview" dangerouslySetInnerHTML={{ __html: item.notes }} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button type="button" onClick={onTogglePin}
            className={`p-1 rounded hover:bg-gray-100 ${item.is_pinned ? 'text-rose-500' : 'text-gray-300 hover:text-rose-500'}`}
            title={item.is_pinned ? 'Unpin' : 'Pin to News Alerts'}>
            {item.is_pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          </button>
          <button type="button" onClick={onEdit}
            className="p-1 rounded text-gray-300 hover:text-indigo-500 hover:bg-gray-100" title="Edit">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          {onAutoTag && (
            <button type="button" onClick={onAutoTag}
              className="p-1 rounded text-gray-300 hover:text-emerald-500 hover:bg-gray-100"
              title="Auto-tag mentioned contacts & firms">
              <Tag className="w-3.5 h-3.5" />
            </button>
          )}
          <button type="button" onClick={onDelete}
            className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-gray-100" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onToggleExpand}
            className="p-1 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── News item form (add / edit) ─────────────────────────────────────────────
export function NewsItemForm({ item, firmName, onSave, onCancel }) {
  const [headline, setHeadline] = useState(item?.headline || "");
  const [newsDate, setNewsDate] = useState(item?.news_date || new Date().toISOString().split("T")[0]);
  const [summary, setSummary] = useState(item?.summary || "");
  const [alertStatus, setAlertStatus] = useState(item?.alert_status || "Low");
  const [newsStatus, setNewsStatus] = useState(item?.news_status || "Neutral");
  const [articleUrl, setArticleUrl] = useState(item?.article_url || "");
  const [sourceType, setSourceType] = useState(item?.source_type || "firm");
  const [sourceName, setSourceName] = useState(item?.source_name || "");
  const [notes, setNotes] = useState(item?.notes || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!headline.trim()) return;
    setSaving(true);
    await onSave({
      headline: headline.trim(),
      news_date: newsDate,
      summary: summary.trim(),
      alert_status: alertStatus,
      news_status: newsStatus,
      article_url: articleUrl.trim(),
      source_type: sourceType,
      source_name: sourceName.trim(),
      notes,
    });
    setSaving(false);
  };

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-indigo-700">{item ? "Edit News Item" : "Add News Item"}</span>
        <button type="button" onClick={onCancel}><X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" /></button>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-700">Headline *</Label>
        <Input value={headline} onChange={e => setHeadline(e.target.value)} className="h-8 text-sm" placeholder="News headline..." autoFocus />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Date</Label>
          <Input type="date" value={newsDate} onChange={e => setNewsDate(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Article URL</Label>
          <Input value={articleUrl} onChange={e => setArticleUrl(e.target.value)} className="h-8 text-sm" placeholder="https://..." />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Alert Status</Label>
          <Select value={alertStatus} onValueChange={setAlertStatus}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">News Status</Label>
          <Select value={newsStatus} onValueChange={setNewsStatus}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Positive">Positive</SelectItem>
              <SelectItem value="Negative">Negative</SelectItem>
              <SelectItem value="Neutral">Neutral</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Source Type</Label>
          <Select value={sourceType} onValueChange={setSourceType}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="firm">Firm</SelectItem>
              <SelectItem value="contact">Contact</SelectItem>
              <SelectItem value="product">Product</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Source Name</Label>
          <Input value={sourceName} onChange={e => setSourceName(e.target.value)} className="h-8 text-sm" placeholder={sourceType === 'firm' ? firmName : "Name..."} />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-700">Summary</Label>
        <Textarea value={summary} onChange={e => setSummary(e.target.value)} className="min-h-16 text-sm" placeholder="Summary of the article..." />
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-700">Notes</Label>
        <div className="quill-sm border border-gray-200 rounded-lg overflow-hidden bg-white">
          <ReactQuill theme="snow" value={notes} onChange={setNotes} modules={QUILL_MODULES} placeholder="Add your notes..." style={{ minHeight: 70 }} />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
        <Button type="button" size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" disabled={!headline.trim() || saving} onClick={handleSave}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}