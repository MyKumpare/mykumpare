import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar, MapPin, Flag, CheckCircle2, ExternalLink, Building2, ScrollText, Loader2,
} from "lucide-react";

// Monitor / header modal: lists upcoming board meetings across all firms.
// Flagged meetings (portfolio mentions needing review) surface at the top.
export default function BoardMeetingsModal({ open, onClose, firms = [], onFirmClick }) {
  const [filter, setFilter] = useState("upcoming"); // upcoming | needs_review | all

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["board-meetings-all"],
    queryFn: () => base44.entities.BoardMeeting.list("-meeting_date", 1000),
    enabled: open,
  });

  const firmMap = useMemo(() => {
    const m = {};
    for (const f of firms) m[f.id] = f;
    return m;
  }, [firms]);

  const today = new Date().toISOString().slice(0, 10);

  const visible = useMemo(() => {
    let list = (meetings || []).filter((m) => !m.deleted_at);
    if (filter === "upcoming") list = list.filter((m) => (m.meeting_date || "9999") >= today);
    else if (filter === "needs_review") list = list.filter((m) => m.needs_review && !m.reviewed);
    // Sort: needs-review first, then by date ascending (soonest upcoming first)
    list.sort((a, b) => {
      const ar = a.needs_review && !a.reviewed ? 0 : 1;
      const br = b.needs_review && !b.reviewed ? 0 : 1;
      if (ar !== br) return ar - br;
      return (a.meeting_date || "9999").localeCompare(b.meeting_date || "9999");
    });
    return list;
  }, [meetings, filter, today]);

  const counts = useMemo(() => {
    const all = (meetings || []).filter((m) => !m.deleted_at);
    return {
      upcoming: all.filter((m) => (m.meeting_date || "9999") >= today).length,
      needs_review: all.filter((m) => m.needs_review && !m.reviewed).length,
      all: all.length,
    };
  }, [meetings, today]);

  const fmtDate = (d) => {
    if (!d) return "—";
    const dt = new Date(d + "T00:00:00");
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Board Meetings
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-1 mb-2">
          {[
            { key: "upcoming", label: `Upcoming (${counts.upcoming})` },
            { key: "needs_review", label: `Needs Review (${counts.needs_review})` },
            { key: "all", label: `All (${counts.all})` },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setFilter(opt.key)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                filter === opt.key ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 space-y-2 pr-1">
          {isLoading ? (
            <div className="text-sm text-gray-400 italic py-6 text-center flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading board meetings…
            </div>
          ) : visible.length === 0 ? (
            <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl">
              No board meetings {filter === "upcoming" ? "upcoming" : filter === "needs_review" ? "needing review" : "found"}.
            </div>
          ) : (
            visible.map((m) => {
              const firm = firmMap[m.firm_id];
              const needsReview = m.needs_review && !m.reviewed;
              return (
                <div key={m.id} className={`rounded-lg border p-3 ${needsReview ? "border-amber-300 bg-amber-50/40" : "border-gray-200 bg-white"}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800 truncate">{m.title || "Untitled board meeting"}</span>
                        {needsReview && (
                          <Badge className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200">
                            <Flag className="w-3 h-3 mr-0.5" /> Needs Review
                          </Badge>
                        )}
                        {m.reviewed && (
                          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-0.5" /> Reviewed
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                        {firm && onFirmClick && (
                          <button
                            type="button"
                            onClick={() => { onClose(); onFirmClick(firm); }}
                            className="flex items-center gap-1 text-indigo-600 hover:underline"
                          >
                            <Building2 className="w-3 h-3" /> {m.firm_name}
                          </button>
                        )}
                        {(!firm || !onFirmClick) && (
                          <span className="flex items-center gap-1 text-gray-500"><Building2 className="w-3 h-3" /> {m.firm_name}</span>
                        )}
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmtDate(m.meeting_date)}</span>
                        {m.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {m.location}</span>}
                      </div>
                      {m.mentions?.length > 0 && (
                        <div className="mt-1.5">
                          <span className="text-[10px] font-semibold text-amber-700 uppercase">Mentions: </span>
                          {m.mentions.map((mt) => (
                            <span key={mt.id} className="text-[11px] text-amber-800">{mt.entity_name}; </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {m.source_url && (
                      <a href={m.source_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-indigo-600" title="Open source">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end pt-2 border-t">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}