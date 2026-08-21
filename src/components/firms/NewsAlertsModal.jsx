import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableSelect from "@/components/common/SearchableSelect";
import {
  Newspaper, Pin, PinOff, ExternalLink, Trash2, Calendar, X,
  AlertTriangle, ChevronDown, ChevronUp, Building2, Search,
} from "lucide-react";
import { format } from "date-fns";

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

  const totalCount = useMemo(() => allNews.filter(n => !n.deleted_at).length, [allNews]);

  const filteredNews = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = allNews.filter(n => !n.deleted_at);
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
  }, [allNews, search, firmFilter, contactFilter, sortBy]);

  const handleTogglePin = async (item) => {
    await base44.entities.FirmNews.update(item.id, { is_pinned: !item.is_pinned });
    queryClient.invalidateQueries({ queryKey: ["pinned_news_alerts"] });
    queryClient.invalidateQueries({ queryKey: ["firm_news", item.firm_id] });
  };

  const handleDelete = async (item) => {
    await base44.entities.FirmNews.delete(item.id);
    queryClient.invalidateQueries({ queryKey: ["pinned_news_alerts"] });
    queryClient.invalidateQueries({ queryKey: ["firm_news", item.firm_id] });
  };

  const hasFilters = search || firmFilter || contactFilter;
  const clearFilters = () => { setSearch(""); setFirmFilter(""); setContactFilter(""); };

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
          {!inline && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
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
          {hasFilters && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-400">{filteredNews.length} of {totalCount} alerts</span>
              <button type="button" onClick={clearFilters} className="text-[11px] text-rose-500 hover:text-rose-700 font-medium">
                Clear filters
              </button>
            </div>
          )}
        </div>

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
                <div key={item.id} className={`rounded-xl border ${item.is_pinned ? "border-rose-200 bg-rose-50/20" : "border-gray-200 bg-white"} overflow-hidden`}>
                  <div className="flex items-start gap-2.5 px-3 py-2.5">
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
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${alertStyle.bg} ${alertStyle.color}`}>
                            {item.alert_status}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.color}`}>
                            {item.news_status}
                          </span>
                        </div>
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
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button type="button" onClick={() => handleTogglePin(item)}
                        className={`p-1 rounded ${item.is_pinned ? "text-rose-500 hover:bg-rose-100" : "text-gray-300 hover:text-rose-500 hover:bg-gray-100"}`}
                        title={item.is_pinned ? "Unpin" : "Pin to top"}>
                        {item.is_pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
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
    </div>
  );
}