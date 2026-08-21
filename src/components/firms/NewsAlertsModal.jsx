import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableSelect from "@/components/common/SearchableSelect";
import {
  Newspaper, Pin, PinOff, ExternalLink, Trash2, Calendar, X,
  AlertTriangle, ChevronDown, ChevronUp, Building2, Search, Download, Eye, EyeOff,
  CheckSquare, FileText,
} from "lucide-react";
import { format } from "date-fns";
import { generateNewsAlertsPdf } from "@/components/news/newsAlertsPdf";
import { generateNewsSelectionPdf } from "@/components/news/newsSelectionPdf";
import NewsSelectionSummaryDialog from "@/components/news/NewsSelectionSummaryDialog";
import NewsContentTags from "@/components/news/NewsContentTags";
import NewsStatusBadges from "@/components/news/NewsStatusBadges";

const ALERT_STYLES = {
  High: { color: "text-red-600", bg: "bg-red-50", border: "border-red-200", icon: AlertTriangle },
  Medium: { color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", icon: AlertTriangle },
  Low: { color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", icon: ChevronDown },
};

const STATUS_STYLES = {
  Positive: { color: "text-green-600", bg: "bg-green-50", border: "border-green-200", dot: "bg-green-500" },
  Negative: { color: "text-red-600", bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500" },
  Neutral: { color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200", dot: "bg-gray-400" },
};

const ALERT_RANK = { High: 3, Medium: 2, Low: 1 };
const STATUS_RANK = { Positive: 3, Neutral: 2, Negative: 1 };

function fmt(dateStr) {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy"); } catch { return dateStr; }
}

export default function NewsAlertsModal({ open, onClose, onFirmClick, inline }) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState("");
  const [firmFilter, setFirmFilter] = useState("");
  const [contactFilter, setContactFilter] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [summaryOpen, setSummaryOpen] = useState(false);

  // All news alerts (pinned ones always sort to the top)
  const { data: allNews = [], isLoading } = useQuery({
    queryKey: ["pinned_news_alerts"],
    queryFn: () => base44.entities.FirmNews.list("-news_date", 500),
    enabled: open,
  });

  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
  });
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });

  const firmOptions = useMemo(() => {
    const opts = firms
      .filter(f => !f.deleted_at)
      .map(f => ({ value: f.id, label: f.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: "", label: "All firms" }, ...opts];
  }, [firms]);

  const contactOptions = useMemo(() => {
    const opts = contacts
      .filter(c => !c.deleted_at)
      .map(c => ({ value: c.id, label: [c.first_name, c.last_name].filter(Boolean).join(" ") || "—" }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: "", label: "All contacts" }, ...opts];
  }, [contacts]);

  const totalCount = useMemo(() => allNews.filter(n => !n.deleted_at && !n.is_hidden).length, [allNews]);

  const filteredNews = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = allNews.filter(n => !n.deleted_at && (showHidden || !n.is_hidden));
    if (q) {
      list = list.filter(n =>
        (n.headline || "").toLowerCase().includes(q) ||
        (n.summary || "").toLowerCase().includes(q) ||
        (n.notes || "").toLowerCase().includes(q)
      );
    }
    if (firmFilter) {
      list = list.filter(n => n.firm_id === firmFilter || (n.tagged_firm_ids || []).includes(firmFilter));
    }
    if (contactFilter) {
      list = list.filter(n =>
        (n.tagged_contact_ids || []).includes(contactFilter) ||
        (n.source_type === "contact" && n.source_id === contactFilter)
      );
    }
    if (dateFrom) {
      list = list.filter(n => (n.news_date || "") >= dateFrom);
    }
    if (dateTo) {
      list = list.filter(n => (n.news_date || "") <= dateTo);
    }
    return [...list].sort((a, b) => {
      // Pinned items always on top, regardless of sort
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      switch (sortBy) {
        case "date_asc": return (a.news_date || "").localeCompare(b.news_date || "");
        case "alert_desc": return (ALERT_RANK[b.alert_status] || 0) - (ALERT_RANK[a.alert_status] || 0);
        case "alert_asc": return (ALERT_RANK[a.alert_status] || 0) - (ALERT_RANK[b.alert_status] || 0);
        case "status_pos": return (STATUS_RANK[b.news_status] || 0) - (STATUS_RANK[a.news_status] || 0);
        case "status_neg": return (STATUS_RANK[a.news_status] || 0) - (STATUS_RANK[b.news_status] || 0);
        case "date_desc":
        default: return (b.news_date || "").localeCompare(a.news_date || "");
      }
    });
  }, [allNews, search, firmFilter, contactFilter, sortBy, showHidden, dateFrom, dateTo]);

  const handleTogglePin = async (item) => {
    await base44.entities.FirmNews.update(item.id, { is_pinned: !item.is_pinned });
    queryClient.invalidateQueries({ queryKey: ["pinned_news_alerts"] });
    queryClient.invalidateQueries({ queryKey: ["firm_news", item.firm_id] });
  };

  const handleToggleHide = async (item) => {
    await base44.entities.FirmNews.update(item.id, { is_hidden: !item.is_hidden });
    queryClient.invalidateQueries({ queryKey: ["pinned_news_alerts"] });
    queryClient.invalidateQueries({ queryKey: ["firm_news", item.firm_id] });
  };

  const handleDelete = async (item) => {
    await base44.entities.FirmNews.delete(item.id);
    queryClient.invalidateQueries({ queryKey: ["pinned_news_alerts"] });
    queryClient.invalidateQueries({ queryKey: ["firm_news", item.firm_id] });
  };

  const handleUpdateTags = async (item, nextTags) => {
    await base44.entities.FirmNews.update(item.id, { content_tags: nextTags });
    queryClient.invalidateQueries({ queryKey: ["pinned_news_alerts"] });
    queryClient.invalidateQueries({ queryKey: ["firm_news", item.firm_id] });
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filteredNews.map(n => n.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const selectedItems = useMemo(
    () => filteredNews.filter(n => selectedIds.has(n.id)),
    [filteredNews, selectedIds]
  );

  const handleBulkHide = async () => {
    const ids = Array.from(selectedIds);
    await base44.entities.FirmNews.bulkUpdate(ids.map(id => ({ id, is_hidden: true })));
    queryClient.invalidateQueries({ queryKey: ["pinned_news_alerts"] });
    queryClient.invalidateQueries({ queryKey: ["firm_news"] });
    clearSelection();
  };

  const handleBulkUnhide = async () => {
    const ids = Array.from(selectedIds);
    await base44.entities.FirmNews.bulkUpdate(ids.map(id => ({ id, is_hidden: false })));
    queryClient.invalidateQueries({ queryKey: ["pinned_news_alerts"] });
    queryClient.invalidateQueries({ queryKey: ["firm_news"] });
    clearSelection();
  };

  const handleBulkExportPdf = () => {
    if (!selectedItems.length) return;
    generateNewsSelectionPdf({ items: selectedItems, contacts, firms, sourceLabel: "Monitor News Alerts" });
  };

  const handleBulkSummarize = () => {
    if (!selectedItems.length) return;
    setSummaryOpen(true);
  };

  const hasFilters = search || firmFilter || contactFilter || dateFrom || dateTo;
  const clearFilters = () => { setSearch(""); setFirmFilter(""); setContactFilter(""); setDateFrom(""); setDateTo(""); };

  const handleExportPdf = () => {
    if (!filteredNews.length) return;
    generateNewsAlertsPdf({
      items: filteredNews,
      filters: { search, firmFilter, contactFilter, sortBy },
      totalCount,
      firmLabel: firmOptions.find(o => o.value === firmFilter)?.label,
      contactLabel: contactOptions.find(o => o.value === contactFilter)?.label,
    });
  };

  if (!inline && !open) return null;

  return (
    <div className={inline ? "" : "fixed inset-0 z-50 flex items-center justify-center"}>
      {!inline && <div className="absolute inset-0 bg-black/40" onClick={onClose} />}
      <div className={inline ? "bg-white rounded-2xl w-full flex flex-col border border-gray-100" : "relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col"}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
              <Newspaper className="w-4 h-4 text-rose-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">News Alerts</h3>
              <p className="text-xs text-gray-400">
                All news alerts across firms {totalCount > 0 && <span className="text-gray-500">· {filteredNews.length} shown</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={!filteredNews.length}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-1 rounded-md hover:bg-indigo-50"
              title="Export current view as PDF"
            >
              <Download className="w-3.5 h-3.5" /> Export PDF
            </button>
            {!inline && (
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filter / sort toolbar */}
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search headlines, summaries, keywords..."
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <SearchableSelect
              value={firmFilter}
              onChange={setFirmFilter}
              options={firmOptions}
              placeholder="All firms"
              searchPlaceholder="Search firms..."
              emptyText="No firms found."
            />
            <SearchableSelect
              value={contactFilter}
              onChange={setContactFilter}
              options={contactOptions}
              placeholder="All contacts"
              searchPlaceholder="Search contacts..."
              emptyText="No contacts found."
            />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Date (newest)</SelectItem>
                <SelectItem value="date_asc">Date (oldest)</SelectItem>
                <SelectItem value="alert_desc">Alert: High → Low</SelectItem>
                <SelectItem value="alert_asc">Alert: Low → High</SelectItem>
                <SelectItem value="status_pos">Status: Positive → Negative</SelectItem>
                <SelectItem value="status_neg">Status: Negative → Positive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <Input type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)} className="h-8 text-sm" />
              <span className="text-[11px] text-gray-400">to</span>
              <Input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} className="h-8 text-sm" />
              {(dateFrom || dateTo) && (
                <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-gray-400 hover:text-rose-500" title="Clear date filter">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filteredNews.length > 0 && selectedIds.size === filteredNews.length}
                  ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredNews.length; }}
                  onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
                  disabled={filteredNews.length === 0}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Select all
              </label>
              <span className="text-[11px] text-gray-400">{filteredNews.length} of {totalCount} alerts</span>
            </div>
            <div className="flex items-center gap-3">
              {hasFilters && (
                <button type="button" onClick={clearFilters} className="text-[11px] text-rose-500 hover:text-rose-700 font-medium">
                  Clear filters
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowHidden(v => !v)}
                className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md ${showHidden ? "text-gray-700 bg-gray-100 hover:bg-gray-200" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
                title={showHidden ? "Hide hidden items" : "Show hidden items"}
              >
                {showHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {showHidden ? "Showing hidden" : "Show hidden"}
              </button>
            </div>
          </div>
        </div>

        {/* Bulk action bar — shown when items are selected */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap px-4 py-2 border-b border-indigo-100 bg-indigo-50/80">
            <span className="text-xs font-semibold text-indigo-700">
              {selectedIds.size} of {filteredNews.length} selected
            </span>
            <button type="button" onClick={selectAll} className="text-xs text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 disabled:opacity-40" disabled={filteredNews.length === 0}>
              <CheckSquare className="w-3.5 h-3.5" /> Select all
            </button>
            <button type="button" onClick={clearSelection} className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
            <div className="h-4 w-px bg-indigo-200" />
            <button type="button" onClick={handleBulkHide} className="text-xs text-gray-600 hover:text-gray-800 inline-flex items-center gap-1">
              <EyeOff className="w-3.5 h-3.5" /> Hide
            </button>
            <button type="button" onClick={handleBulkUnhide} className="text-xs text-gray-600 hover:text-gray-800 inline-flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> Unhide
            </button>
            <div className="h-4 w-px bg-indigo-200" />
            <button type="button" onClick={handleBulkExportPdf} className="text-xs text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1">
              <Download className="w-3.5 h-3.5" /> Export PDF
            </button>
            <button type="button" onClick={handleBulkSummarize} className="text-xs text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> Summarize
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="text-xs text-gray-400 italic py-8 text-center">Loading...</div>
          ) : totalCount === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
              <Newspaper className="w-6 h-6 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">No news alerts yet</p>
              <p className="text-xs text-gray-400 mt-0.5">
                News articles from firm scrubs will appear here automatically.
              </p>
            </div>
          ) : filteredNews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
              <Search className="w-6 h-6 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">No alerts match your filters</p>
              <button type="button" onClick={clearFilters} className="text-xs text-rose-500 hover:text-rose-700 mt-1 font-medium">
                Clear filters
              </button>
            </div>
          ) : (
            filteredNews.map((item) => {
              const alertStyle = ALERT_STYLES[item.alert_status] || ALERT_STYLES.Low;
              const statusStyle = STATUS_STYLES[item.news_status] || STATUS_STYLES.Neutral;
              const AlertIcon = alertStyle.icon;
              const expanded = expandedId === item.id;
              return (
                <div key={item.id} className={`rounded-xl border ${item.is_pinned ? "border-rose-200 bg-rose-50/20" : "border-gray-200 bg-white"} overflow-hidden ${item.is_hidden ? "opacity-50" : ""}`}>
                  <div className="flex items-start gap-2.5 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0 cursor-pointer"
                      title="Select article"
                    />
                    <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${alertStyle.bg}`}>
                      <AlertIcon className={`w-3.5 h-3.5 ${alertStyle.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        <button type="button" onClick={() => setExpandedId(expanded ? null : item.id)} className="text-left flex-1 min-w-0 flex items-start gap-1.5">
                          <span
                            className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${statusStyle.dot}`}
                            title={`Sentiment: ${item.news_status || "Neutral"}`}
                          />
                          <p className="text-sm font-semibold text-gray-800 hover:text-indigo-600 transition-colors line-clamp-2">
                            {item.headline}
                          </p>
                        </button>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {item.is_pinned && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600 flex items-center gap-0.5">
                              <Pin className="w-2.5 h-2.5" /> Pinned
                            </span>
                          )}
                          {item.is_hidden && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-500 flex items-center gap-0.5">
                              <EyeOff className="w-2.5 h-2.5" /> Hidden
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${alertStyle.bg} ${alertStyle.color}`}>
                            {item.alert_status}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.color}`}>
                            {item.news_status}
                          </span>
                          {(item.content_tags || []).map(tag => (
                            <span key={tag} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-violet-200 bg-violet-50 text-violet-700">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="mt-1">
                        <NewsStatusBadges item={item} />
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-0.5">
                          <Calendar className="w-3 h-3" /> {fmt(item.news_date)}
                        </span>
                        {item.firm_name && (
                          <button
                            type="button"
                            onClick={() => { onClose(); onFirmClick?.(item.firm_id); }}
                            className="flex items-center gap-0.5 text-indigo-500 hover:text-indigo-700 hover:underline"
                          >
                            <Building2 className="w-3 h-3" /> {item.firm_name}
                          </button>
                        )}
                      </div>
                      {item.summary && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.summary}</p>
                      )}
                      {expanded && (
                        <div className="mt-2 space-y-2">
                          {item.summary && <p className="text-xs text-gray-600">{item.summary}</p>}
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
                          <div className="pt-1">
                            <p className="text-[10px] font-semibold text-gray-400 mb-1">Content tags</p>
                            <NewsContentTags
                              tags={item.content_tags}
                              onChange={(next) => handleUpdateTags(item, next)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button type="button" onClick={() => handleTogglePin(item)}
                        className={`p-1 rounded ${item.is_pinned ? "text-rose-500 hover:bg-rose-100" : "text-gray-300 hover:text-rose-500 hover:bg-gray-100"}`}
                        title={item.is_pinned ? "Unpin" : "Pin to top"}>
                        {item.is_pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                      </button>
                      <button type="button" onClick={() => handleToggleHide(item)}
                        className={`p-1 rounded hover:bg-gray-100 ${item.is_hidden ? "text-gray-500 hover:text-gray-700" : "text-gray-300 hover:text-gray-500"}`}
                        title={item.is_hidden ? "Unhide" : "Hide from lists"}>
                        {item.is_hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button type="button" onClick={() => handleDelete(item)}
                        className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-gray-100" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => setExpandedId(expanded ? null : item.id)}
                        className="p-1 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100">
                        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <NewsSelectionSummaryDialog
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        items={selectedItems}
      />
    </div>
  );
}