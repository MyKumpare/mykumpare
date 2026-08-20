import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Newspaper, Plus, X, Loader2, Save, Sparkles, Clock,
  History, AlertTriangle, CheckCircle2, Info, CalendarClock,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ── News Scrub Settings — admin-managed keywords and historical scraping
//    preferences that focus the nightly news scrub on priority topics ──

function formatTimeLabel(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

export default function NewsScrubSettings() {
  const queryClient = useQueryClient();
  const [keywords, setKeywords] = useState([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [runningScrub, setRunningScrub] = useState(false);
  const [runningHistorical, setRunningHistorical] = useState(false);
  const [includeHistorical, setIncludeHistorical] = useState(true);
  const [scheduleTime, setScheduleTime] = useState("02:00");
  const [scheduleEnabled, setScheduleEnabled] = useState(true);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["news_scrub_settings"],
    queryFn: () => base44.entities.NewsScrubSettings.list("-created_date", 10),
  });

  const existing = settings?.[0] || null;

  useEffect(() => {
    if (existing?.keywords) setKeywords(existing.keywords);
    if (existing?.schedule_time) setScheduleTime(existing.schedule_time);
    if (existing?.schedule_enabled !== undefined) setScheduleEnabled(existing.schedule_enabled);
  }, [existing?.id]);

  const addKeyword = () => {
    const k = keywordInput.trim();
    if (k && !keywords.includes(k)) setKeywords([...keywords, k]);
    setKeywordInput("");
  };

  const removeKeyword = (k) => setKeywords(keywords.filter(x => x !== k));

  const handleSave = async () => {
    setSaving(true);
    try {
      if (existing) {
        await base44.entities.NewsScrubSettings.update(existing.id, { keywords, schedule_time: scheduleTime, schedule_enabled: scheduleEnabled });
      } else {
        await base44.entities.NewsScrubSettings.create({ keywords, label: "Default", schedule_time: scheduleTime, schedule_enabled: scheduleEnabled });
      }
      queryClient.invalidateQueries({ queryKey: ["news_scrub_settings"] });
      toast({ title: "Settings saved", description: "Nightly news scrub keywords updated." });
    } catch (e) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleRunScrub = async () => {
    setRunningScrub(true);
    try {
      const res = await base44.functions.invoke('scrubFirmNews', { mode: 'all' });
      const count = res.data?.total_firms || 0;
      toast({
        title: "Nightly scrub started",
        description: `Enqueued ${count} firm${count > 1 ? "s" : ""} for news scrubbing using these keywords.`,
      });
    } catch (e) {
      toast({ title: "Scrub failed", description: e.message, variant: "destructive" });
    }
    setRunningScrub(false);
  };

  const handleRunHistorical = async () => {
    setRunningHistorical(true);
    try {
      const res = await base44.functions.invoke('scrubFirmNewsHistorical', { mode: 'all' });
      const count = res.data?.total_firms || 0;
      toast({
        title: "Historical scrub started",
        description: `Enqueued ${count} firm${count > 1 ? "s" : ""} for deep-dive historical news recovery. Results will appear in the News tabs as they are found.`,
      });
    } catch (e) {
      toast({ title: "Historical scrub failed", description: e.message, variant: "destructive" });
    }
    setRunningHistorical(false);
  };

  const hasChanges =
    JSON.stringify(keywords) !== JSON.stringify(existing?.keywords || []) ||
    scheduleTime !== (existing?.schedule_time || "02:00") ||
    scheduleEnabled !== (existing?.schedule_enabled !== undefined ? existing.schedule_enabled : true);

  return (
    <div className="space-y-4 py-1">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center">
          <Newspaper className="w-4 h-4 text-rose-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700">News Scrub Settings</p>
          <p className="text-xs text-gray-400">Configure keywords and historical scraping preferences for the nightly news scrub.</p>
        </div>
      </div>

      {/* Scheduling preferences */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <CalendarClock className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Nightly Schedule</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Controls when the automated news scrub runs across all active firms.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-500">{scheduleEnabled ? "Enabled" : "Disabled"}</span>
            <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
          </div>
        </div>

        {scheduleEnabled && (
          <div className="flex items-center gap-3 rounded-lg bg-indigo-50/40 border border-indigo-100 p-3">
            <Clock className="w-4 h-4 text-indigo-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-700">Run Time (Eastern)</p>
              <p className="text-xs text-gray-500 mt-0.5">The scrub runs daily at this time.</p>
            </div>
            <Select value={scheduleTime} onValueChange={setScheduleTime}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["00:00","01:00","02:00","03:00","04:00","05:00","06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00"].map(t => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {formatTimeLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!scheduleEnabled && (
          <div className="flex items-start gap-2 rounded-lg bg-gray-50 border border-gray-200 p-2.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-500">
              The nightly scrub is disabled. You can still run a scrub manually using the button below.
            </p>
          </div>
        )}
      </div>

      {/* Keywords editor */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-gray-700">Priority Keywords</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Add keywords to focus the scrub on specific topics. The AI will flag matching articles with higher alert levels.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <div className="flex gap-1.5">
              <Input
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                placeholder="e.g. SEC action, fund closure, leadership departure..."
                className="h-9 text-sm flex-1"
              />
              <Button type="button" variant="outline" size="sm" className="h-9 gap-1" onClick={addKeyword}>
                <Plus className="w-4 h-4" /> Add
              </Button>
            </div>

            {keywords.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {keywords.map(k => (
                  <span key={k} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                    {k}
                    <button type="button" onClick={() => removeKeyword(k)} className="hover:text-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <button type="button" onClick={() => setKeywords([])} className="text-xs text-gray-400 hover:text-red-500 ml-1 self-center">
                  Clear all
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No keywords set — the scrub will search for general news.</p>
            )}

            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={handleRunScrub}
                disabled={runningScrub}
              >
                {runningScrub ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {runningScrub ? "Starting..." : "Run Scrub Now"}
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1 text-xs bg-rose-600 hover:bg-rose-700 text-white"
                onClick={handleSave}
                disabled={saving || !hasChanges}
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? "Saving..." : "Save Keywords"}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Historical scraping preferences */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <History className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Historical Scraping</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Deep-dive news recovery searches across three time periods to find older articles the nightly scrub may have missed.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-500">{includeHistorical ? "Enabled" : "Disabled"}</span>
            <Switch checked={includeHistorical} onCheckedChange={setIncludeHistorical} />
          </div>
        </div>

        {includeHistorical && (
          <>
            {/* Time period strategy */}
            <div className="rounded-lg bg-amber-50/50 border border-amber-100 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Search Strategy — 3 Time Periods
              </p>
              <div className="space-y-1.5">
                {[
                  { label: "Recent", desc: "Past year (2025–2026)", icon: Clock },
                  { label: "Mid-term", desc: "2022–2024", icon: History },
                  { label: "Founding era", desc: "Earliest available through 2021", icon: History },
                ].map((p) => (
                  <div key={p.label} className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <span className="font-medium text-gray-700">{p.label}:</span>
                    <span className="text-gray-500">{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Warning note */}
            <div className="flex items-start gap-2 rounded-lg bg-gray-50 border border-gray-200 p-2.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-gray-500">
                Historical scrubs run in the background and may take several minutes per firm. Results are deduplicated against existing news records.
              </p>
            </div>

            {/* Run button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-9 gap-1.5 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={handleRunHistorical}
              disabled={runningHistorical}
            >
              {runningHistorical ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <History className="w-3.5 h-3.5" />}
              {runningHistorical ? "Starting historical scrub..." : "Run Historical Scrub (All Firms)"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}