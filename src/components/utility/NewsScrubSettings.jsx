import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Newspaper, Plus, X, Loader2, Save, Sparkles, Clock } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// ── News Scrub Settings — admin-managed keywords that focus the nightly
//    news scrub on priority topics across all firms ──
export default function NewsScrubSettings() {
  const queryClient = useQueryClient();
  const [keywords, setKeywords] = useState([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [runningScrub, setRunningScrub] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["news_scrub_settings"],
    queryFn: () => base44.entities.NewsScrubSettings.list("-created_date", 10),
  });

  const existing = settings?.[0] || null;

  useEffect(() => {
    if (existing?.keywords) setKeywords(existing.keywords);
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
        await base44.entities.NewsScrubSettings.update(existing.id, { keywords });
      } else {
        await base44.entities.NewsScrubSettings.create({ keywords, label: "Default" });
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

  const hasChanges = JSON.stringify(keywords) !== JSON.stringify(existing?.keywords || []);

  return (
    <div className="space-y-4 py-1">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center">
          <Newspaper className="w-4.5 h-4.5 text-rose-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700">News Scrub Settings</p>
          <p className="text-xs text-gray-400">Configure the keywords and schedule for the nightly news scrub.</p>
        </div>
      </div>

      {/* Nightly schedule info */}
      <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 flex items-start gap-2.5">
        <Clock className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold text-gray-700">Nightly Schedule</p>
          <p className="text-xs text-gray-500 mt-0.5">
            The news scrub runs automatically every night at 2:00 AM Eastern Time across all active firms.
            The keywords below are passed to the AI search so it prioritizes articles matching these topics.
          </p>
        </div>
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
    </div>
  );
}