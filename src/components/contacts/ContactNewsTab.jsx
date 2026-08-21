import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Newspaper, Plus, Trash2, Sparkles, Loader2, History, Search, X,
  ArrowDownWideNarrow, ArrowUpWideNarrow, FileText, CheckSquare, Tag, Eye, EyeOff,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { NewsItemCard, NewsItemForm } from "../firms/FirmNewsTab";
import HistoricalScrubDialog from "../news/HistoricalScrubDialog";
import NewsBulkActionBar from "../news/NewsBulkActionBar";
import { generateNewsSelectionPdf } from "../news/newsSelectionPdf";
import { lazyDialog } from "../common/lazyDialog";
const NewsSummaryDialog = lazyDialog(() => import("../news/NewsSummaryDialog"));

// ── Contact News Tab — shows news tagged to this contact, with the same
//    scrub / pin / edit / delete functionality as the firm news tab ──
export default function ContactNewsTab({ contactId, contactName, firmId, firmName }) {
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
  const [showHidden, setShowHidden] = useState(false);

  // Owned news (from contact's firm) + cross-firm tagged news
  const { data: ownedNews = [], isLoading: loadingOwned } = useQuery({
    queryKey: ["firm_news", firmId, "owned"],
    queryFn: () => base44.entities.FirmNews.filter({ firm_id: firmId }, "-news_date", 200),
    enabled: !!firmId,
  });
  const { data: taggedContactNews = [], isLoading: loadingTagged } = useQuery({
    queryKey: ["firm_news", "tagged_contact", contactId],
    queryFn: () => base44.entities.FirmNews.filter({ tagged_contact_ids: contactId }, "-news_date", 200),
    enabled: !!contactId,
  });
  const isLoading = loadingOwned || loadingTagged;

  const newsItems = useMemo(() => {
    const map = new Map();
    [...ownedNews, ...taggedContactNews].forEach(n => { if (!n.deleted_at) map.set(n.id, n); });
    return Array.from(map.values());
  }, [ownedNews, taggedContactNews]);

  const activeNews = useMemo(
    () => newsItems.filter(n => !n.deleted_at && (showHidden || !n.is_hidden) && (
      (n.source_type === "contact" && n.source_id === contactId) ||
      (n.tagged_contact_ids || []).includes(contactId)
    )),
    [newsItems, contactId, showHidden]
  );

  // Fetch all contacts and firms for tagging
  const { data: allContacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });
  const taggableContacts = useMemo(
    () => allContacts.filter(c => !c.deleted_at && c.id !== contactId),
    [allContacts, contactId]
  );
  const { data: allFirms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
  });
  const taggableFirms = useMemo(
    () => allFirms.filter(f => !f.deleted_at),
    [allFirms]
  );

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
      const res = await base44.functions.invoke('scrubFirmNews', {
        mode: 'contact', contact_id: contactId, firm_id: firmId,
        keywords: keywords.length ? keywords : undefined,
      });
      const count = res.data?.created || 0;
      if (count > 0) {
        toast({ title: `Scrub complete`, description: `${count} news item${count > 1 ? "s" : ""} found for ${contactName}.` });
      } else {
        toast({ title: "Scrub complete", description: `No new news found for ${contactName}.` });
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
        mode: 'contact', contact_id: contactId, firm_id: firmId,
        keywords: keywords.length ? keywords : undefined,
        start_date: start_date || undefined,
        end_date: end_date || undefined,
      });
      const rangeTxt = (start_date || end_date) ? ` between ${start_date || "anytime"} and ${end_date || "today"}` : " across all available history";
      toast({ title: "Historical scrub started", description: `Searching${rangeTxt} — news will appear shortly.` });
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

  const handleTogglePin = async (item) => {
    await base44.entities.FirmNews.update(item.id, { is_pinned: !item.is_pinned });
    queryClient.invalidateQueries({ queryKey: ["firm_news"] });
    queryClient.invalidateQueries({ queryKey: ["pinned_news_alerts"] });
  };

  const handleToggleHide = async (item) => {
    await base44.entities.FirmNews.update(item.id, { is_hidden: !item.is_hidden });
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

  const handleUpdateContentTags = async (item, contentTags) => {
    await base44.entities.FirmNews.update(item.id, { content_tags: contentTags });
    queryClient.invalidateQueries({ queryKey: ["firm_news"] });
    queryClient.invalidateQueries({ queryKey: ["pinned_news_alerts"] });
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

  // Export the currently-selected articles (with alert levels + tags) to PDF
  const handleExportSelectedPdf = () => {
    const selected = sortedNews.filter(n => selectedIds.has(n.id));
    if (!selected.length) return;
    generateNewsSelectionPdf({ items: selected, contacts: taggableContacts, firms: taggableFirms, sourceLabel: contactName });
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

  const addKeyword = () => {
    const k = keywordInput.trim();
    if (k && !keywords.includes(k)) setKeywords([...keywords, k]);
    setKeywordInput("");
  };
  const removeKeyword = (k) => setKeywords(keywords.filter(x => x !== k));

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
            className={`h-7 px-2 gap-1 text-xs ${showHidden ? "text-gray-700 bg-gray-100 hover:bg-gray-200" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
            onClick={() => setShowHidden(v => !v)}
            title={showHidden ? "Hide hidden items" : "Show hidden items"}
          >
            {showHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {showHidden ? "All" : "Hidden"}
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
          onExportPdf={handleExportSelectedPdf}
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
          <p className="text-sm text-gray-600 font-medium">No news yet for {contactName}</p>
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
            try {
              const res = await base44.functions.invoke('saveFirmNewsItem', {
                data: { ...data, source_type: "contact", source_id: contactId, source_name: contactName },
                firm_id: firmId, firm_name: firmName, contact_id: contactId, contact_name: contactName,
              });
              if (res.data?.merged) {
                toast({ title: "Article already exists", description: "Linked to this contact instead of creating a duplicate." });
              }
            } catch (e) {
              toast({ title: "Save failed", description: e.message, variant: "destructive" });
            }
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
              onToggleHide={() => handleToggleHide(item)}
              onDelete={() => handleDelete(item)}
              contacts={taggableContacts}
              onTagContacts={(ids) => handleTagContacts(item, ids)}
              firms={taggableFirms}
              onTagFirms={(ids) => handleTagFirms(item, ids)}
              onUpdateContentTags={(next) => handleUpdateContentTags(item, next)}
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
        targetLabel={contactName}
      />
      <NewsSummaryDialog
        open={showSummary}
        onOpenChange={setShowSummary}
        newsItems={activeNews}
        targetType="contact"
        targetLabel={contactName}
      />
    </div>
  );
}