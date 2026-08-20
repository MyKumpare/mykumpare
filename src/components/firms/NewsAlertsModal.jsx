import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Newspaper, Pin, PinOff, ExternalLink, Trash2, Calendar, X,
  AlertTriangle, ChevronDown, ChevronUp, Building2,
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

function fmt(dateStr) {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy"); } catch { return dateStr; }
}

export default function NewsAlertsModal({ open, onClose, onFirmClick, inline }) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState(null);

  const { data: allNews = [], isLoading } = useQuery({
    queryKey: ["pinned_news_alerts"],
    queryFn: () => base44.entities.FirmNews.list("-news_date", 500),
    enabled: open,
  });

  const pinnedNews = useMemo(() => {
    return allNews
      .filter(n => !n.deleted_at && n.is_pinned)
      .sort((a, b) => (b.news_date || "").localeCompare(a.news_date || ""));
  }, [allNews]);

  const handleUnpin = async (item) => {
    await base44.entities.FirmNews.update(item.id, { is_pinned: false });
    queryClient.invalidateQueries({ queryKey: ["pinned_news_alerts"] });
    queryClient.invalidateQueries({ queryKey: ["firm_news", item.firm_id] });
  };

  const handleDelete = async (item) => {
    await base44.entities.FirmNews.delete(item.id);
    queryClient.invalidateQueries({ queryKey: ["pinned_news_alerts"] });
    queryClient.invalidateQueries({ queryKey: ["firm_news", item.firm_id] });
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
              <p className="text-xs text-gray-400">Pinned news across all firms</p>
            </div>
          </div>
          {!inline && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="text-xs text-gray-400 italic py-8 text-center">Loading...</div>
          ) : pinnedNews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
              <Pin className="w-6 h-6 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">No pinned news alerts</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Pin news items from a firm's News tab to see them here.
              </p>
            </div>
          ) : (
            pinnedNews.map((item) => {
              const alertStyle = ALERT_STYLES[item.alert_status] || ALERT_STYLES.Low;
              const statusStyle = STATUS_STYLES[item.news_status] || STATUS_STYLES.Neutral;
              const AlertIcon = alertStyle.icon;
              const expanded = expandedId === item.id;
              return (
                <div key={item.id} className="rounded-xl border border-rose-200 bg-rose-50/20 overflow-hidden">
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
                      <button type="button" onClick={() => handleUnpin(item)}
                        className="p-1 rounded text-rose-500 hover:bg-rose-100" title="Unpin">
                        <PinOff className="w-3.5 h-3.5" />
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