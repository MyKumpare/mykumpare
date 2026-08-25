import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Globe, Calendar, MapPin, Video, Users, FileText, ScrollText,
  AlertTriangle, CheckCircle2, Filter, ArrowUpDown, Plus, RefreshCw, Library, CalendarClock, Building, LayoutGrid,
} from "lucide-react";
import BoardMeetingCard from "./BoardMeetingCard";
import BoardMeetingTimeline from "./BoardMeetingTimeline";
import AddBoardMeetingDialog from "./AddBoardMeetingDialog";
import BoardMeetingTemplateLibrary from "./BoardMeetingTemplateLibrary";
import { toast } from "@/components/ui/use-toast";

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// "Board Meeting" tab inside the firm form. Scrapes the firm's website for
// board meetings, lists them with filter/sort, and lets the user fetch
// minutes per meeting. Meetings mentioning the user's own firm or any
// investment manager / sub-manager in its portfolios are flagged for review.
export default function FirmBoardMeetingTab({ firmId, firmName, firmWebsite, onFirmClick }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [scraping, setScraping] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all"); // all | upcoming | completed | needs_review
  const [sortBy, setSortBy] = useState("date_desc"); // date_desc | date_asc | topic
  const [topicSearch, setTopicSearch] = useState("");
  const [showAddMeeting, setShowAddMeeting] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [viewMode, setViewMode] = useState("cards"); // cards | timeline
  const [openMeetingId, setOpenMeetingId] = useState(null);

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["board-meetings", firmId],
    queryFn: () => base44.entities.BoardMeeting.filter({ firm_id: firmId }, "-meeting_date", 500),
    enabled: !!firmId,
  });

  // Meetings from OTHER firms where this firm is tagged as mentioned.
  // Shown in a separate section so the firm can see when/why they were
  // discussed in another entity's board meetings (funding, redemptions, etc.).
  const { data: mentionedIn = [] } = useQuery({
    queryKey: ["board-meetings-mentioned", firmId],
    queryFn: async () => {
      // Fetch recent meetings across all firms, then filter client-side
      // for those where this firm appears in the mentions array.
      const all = await base44.entities.BoardMeeting.list("-meeting_date", 500);
      return all.filter(
        (m) => !m.deleted_at && m.firm_id !== firmId &&
          (m.mentions || []).some((mt) => mt.entity_id === firmId)
      );
    },
    enabled: !!firmId,
  });

  const activeMeetings = useMemo(() => meetings.filter((m) => !m.deleted_at), [meetings]);

  const visible = useMemo(() => {
    let list = [...activeMeetings];
    if (statusFilter === "upcoming") list = list.filter((m) => m.status === "upcoming");
    else if (statusFilter === "completed") list = list.filter((m) => m.status === "completed");
    else if (statusFilter === "needs_review") list = list.filter((m) => m.needs_review && !m.reviewed);

    if (topicSearch.trim()) {
      const q = topicSearch.toLowerCase();
      list = list.filter((m) =>
        (m.title || "").toLowerCase().includes(q) ||
        (m.meeting_topics || []).some((t) => (t || "").toLowerCase().includes(q)) ||
        (m.location || "").toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortBy === "date_asc") return (a.meeting_date || "9999").localeCompare(b.meeting_date || "9999");
      if (sortBy === "date_desc") return (b.meeting_date || "0").localeCompare(a.meeting_date || "0");
      // topic: alphabetical by title
      return (a.title || "").localeCompare(b.title || "");
    });
    return list;
  }, [activeMeetings, statusFilter, sortBy, topicSearch]);

  const counts = useMemo(() => ({
    upcoming: activeMeetings.filter((m) => m.status === "upcoming").length,
    completed: activeMeetings.filter((m) => m.status === "completed").length,
    needs_review: activeMeetings.filter((m) => m.needs_review && !m.reviewed).length,
  }), [activeMeetings]);

  const handleScrape = async () => {
    setScraping(true);
    try {
      const res = await base44.functions.invoke("scrapeBoardMeetings", { firm_id: firmId });
      const data = res?.data ?? res ?? {};
      const found = data.meetings || [];
      if (found.length === 0) {
        toast({ title: "No board meetings found", description: "The scrape didn't find any board meetings on the firm's website." });
      } else {
        const batchId = crypto.randomUUID();
        const records = found.map((m) => ({
          ...m,
          tenant_id: user?.linked_firm_id,
          firm_id: firmId,
          firm_name: firmName,
          scrub_batch_id: batchId,
        }));
        await base44.entities.BoardMeeting.bulkCreate(records);
        queryClient.invalidateQueries({ queryKey: ["board-meetings", firmId] });
        const reviewCount = found.filter((m) => m.needs_review).length;
        toast({
          title: `Found ${found.length} board meeting${found.length === 1 ? "" : "s"}`,
          description: reviewCount > 0 ? `${reviewCount} mention${reviewCount === 1 ? "" : "s"} of your portfolio flagged for review.` : undefined,
        });
      }
    } catch (err) {
      toast({ title: "Scrape failed", description: err?.message || "Could not scrape board meetings.", variant: "destructive" });
    } finally {
      setScraping(false);
    }
  };

  if (!firmId) {
    return (
      <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
        Save the firm first to scrape board meetings
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={handleScrape}
          disabled={scraping || !firmWebsite}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
          title={!firmWebsite ? "Add a website to the firm first" : "Scrape the firm's website for board meetings"}
        >
          {scraping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
          {scraping ? "Scraping…" : "Scrape Board Meetings"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setShowAddMeeting(true)}
          className="gap-1.5"
          title="Manually add a board meeting (optionally from a template)"
        >
          <CalendarClock className="w-3.5 h-3.5" /> Add Meeting
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setShowTemplates(true)}
          className="gap-1.5"
          title="Manage board meeting templates"
        >
          <Library className="w-3.5 h-3.5" /> Templates
        </Button>
        {!firmWebsite && (
          <span className="text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Add a website to the firm to enable scraping
          </span>
        )}

        <div className="flex items-center gap-1 ml-auto">
          {/* View toggle: Cards vs Timeline */}
          <div className="flex items-center rounded-md border border-gray-200 overflow-hidden mr-1">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`text-[11px] px-2 py-1 flex items-center gap-1 transition-colors ${
                viewMode === "cards" ? "bg-indigo-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
              title="Card view"
            >
              <LayoutGrid className="w-3 h-3" /> Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              className={`text-[11px] px-2 py-1 flex items-center gap-1 transition-colors ${
                viewMode === "timeline" ? "bg-indigo-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
              title="Chronological timeline view"
            >
              <CalendarClock className="w-3 h-3" /> Timeline
            </button>
          </div>
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          {[
            { key: "all", label: `All (${activeMeetings.length})` },
            { key: "upcoming", label: `Upcoming (${counts.upcoming})` },
            { key: "completed", label: `Completed (${counts.completed})` },
            { key: "needs_review", label: `Needs Review (${counts.needs_review})` },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setStatusFilter(opt.key)}
              className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                statusFilter === opt.key
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sort + topic search */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Input
            placeholder="Search by topic, title, or location…"
            value={topicSearch}
            onChange={(e) => setTopicSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-1">
          <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs border border-gray-200 rounded-md h-8 px-2 bg-white"
          >
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="topic">Topic (A–Z)</option>
          </select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-sm text-gray-400 italic py-4 text-center">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl">
          {activeMeetings.length === 0
            ? "No board meetings yet. Click \"Scrape Board Meetings\" to search the firm's website."
            : "No meetings match the current filter."}
        </div>
      ) : viewMode === "timeline" ? (
        <BoardMeetingTimeline
          meetings={visible}
          firmId={firmId}
          onOpenMeeting={(m) => setOpenMeetingId(m.id)}
        />
      ) : (
        <div className="space-y-2">
          {visible.map((m) => (
            <BoardMeetingCard key={m.id} meeting={m} firmId={firmId} onFirmClick={onFirmClick} />
          ))}
        </div>
      )}

      {/* When a meeting is clicked in timeline view, render it as a single expanded card */}
      {openMeetingId && viewMode === "timeline" && (() => {
        const m = activeMeetings.find((x) => x.id === openMeetingId);
        if (!m) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpenMeetingId(null)}>
            <div className="max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <BoardMeetingCard meeting={m} firmId={firmId} onFirmClick={onFirmClick} />
            </div>
          </div>
        );
      })()}

      {/* Meetings from other firms where THIS firm was mentioned */}
      {mentionedIn.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <h4 className="text-sm font-semibold text-gray-700">
              Mentioned in Other Firms' Meetings ({mentionedIn.length})
            </h4>
          </div>
          <div className="space-y-2">
            {mentionedIn.map((m) => {
              const mention = (m.mentions || []).find((mt) => mt.entity_id === firmId);
              return (
                <div key={m.id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800 truncate">{m.title || "Untitled"}</span>
                        <Badge variant="outline" className={`text-[10px] ${m.status === "upcoming" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                          {m.status === "upcoming" ? "Upcoming" : "Completed"}
                        </Badge>
                        {mention?.context && (
                          <Badge className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200">
                            {mention.context}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {fmtDate(m.meeting_date)}{m.end_date ? ` – ${fmtDate(m.end_date)}` : ""}
                        </span>
                        <span className="flex items-center gap-1 font-medium text-gray-600">
                          <Building className="w-3 h-3" /> {m.firm_name || "Unknown firm"}
                        </span>
                        {m.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {m.location}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AddBoardMeetingDialog open={showAddMeeting} onClose={() => setShowAddMeeting(false)} firmId={firmId} firmName={firmName} />
      <BoardMeetingTemplateLibrary open={showTemplates} onClose={() => setShowTemplates(false)} />
    </div>
  );
}