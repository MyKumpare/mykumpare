import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { X, Link2, Search, Building, ClipboardList, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * LinkVideoDialog — link a VideoLibraryItem to investment firms and/or due
 * diligence projects so they appear on the firm summary page.
 *
 * Props:
 *   video — VideoLibraryItem record
 *   onClose — () => void
 */
export default function LinkVideoDialog({ video, onClose }) {
  const queryClient = useQueryClient();
  const [firmSearch, setFirmSearch] = useState("");
  const [ddSearch, setDdSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [firmIds, setFirmIds] = useState(new Set(video?.linked_firm_ids || []));
  const [ddIds, setDdIds] = useState(new Set(video?.linked_dd_ids || []));

  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-name", 500),
  });

  const { data: dueDiligences = [] } = useQuery({
    queryKey: ["due_diligences"],
    queryFn: () => base44.entities.DueDiligence.list("-created_date", 500),
  });

  if (!video) return null;

  const filteredFirms = useMemo(() => {
    const q = firmSearch.toLowerCase().trim();
    return firms.filter((f) => !q || (f.name || "").toLowerCase().includes(q));
  }, [firms, firmSearch]);

  const filteredDds = useMemo(() => {
    const q = ddSearch.toLowerCase().trim();
    return dueDiligences.filter((d) => {
      const name = `${d.firm_name || ""} — ${d.product_name || ""}`.toLowerCase();
      return !q || name.includes(q);
    });
  }, [dueDiligences, ddSearch]);

  const toggleFirm = (id) => {
    setFirmIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDd = (id) => {
    setDdIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const firmIdArr = Array.from(firmIds);
    const ddIdArr = Array.from(ddIds);
      const firmNames = firmIdArr.map((id) => firms.find((f) => f.id === id)?.name).filter(Boolean);
      const ddNames = ddIdArr.map((id) => {
        const d = dueDiligences.find((dd) => dd.id === id);
        return d ? `${d.firm_name || ""} — ${d.product_name || ""}` : "";
      }).filter(Boolean);

      await base44.entities.VideoLibraryItem.update(video.id, {
        linked_firm_ids: firmIdArr,
        linked_firm_names: firmNames,
        linked_dd_ids: ddIdArr,
        linked_dd_names: ddNames,
      });
      queryClient.invalidateQueries({ queryKey: ["video_library_items"] });
      onClose();
    } catch (err) {
      alert("Failed to save links: " + (err?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-xl z-10">
          <div className="flex items-center gap-2 min-w-0">
            <Link2 className="w-5 h-5 text-indigo-600 flex-shrink-0" />
            <h2 className="text-sm font-semibold text-gray-800 truncate">Link to Firms & Due Diligence</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Video info */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-semibold text-gray-800 truncate">{video.title}</p>
            {video.description && <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{video.description}</p>}
          </div>

          {/* Firms section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Building className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-700">Investment Firms</h3>
              {firmIds.size > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">{firmIds.size} linked</span>
              )}
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                value={firmSearch}
                onChange={(e) => setFirmSearch(e.target.value)}
                placeholder="Search firms..."
                className="h-8 pl-8 text-xs"
              />
            </div>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-50">
              {filteredFirms.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No firms found</p>
              ) : (
                filteredFirms.slice(0, 100).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => toggleFirm(f.id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-50 transition-colors ${firmIds.has(f.id) ? "bg-indigo-50/50" : ""}`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${firmIds.has(f.id) ? "bg-indigo-600 border-indigo-600 text-white" : "border-gray-300"}`}>
                      {firmIds.has(f.id) && <Check className="w-3 h-3" />}
                    </div>
                    <span className="text-xs text-gray-700 truncate">{f.name}</span>
                    {f.firm_types?.length > 0 && (
                      <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">{f.firm_types[0]}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Due Diligence section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-700">Due Diligence Projects</h3>
              {ddIds.size > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">{ddIds.size} linked</span>
              )}
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                value={ddSearch}
                onChange={(e) => setDdSearch(e.target.value)}
                placeholder="Search due diligence..."
                className="h-8 pl-8 text-xs"
              />
            </div>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-50">
              {filteredDds.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No due diligence projects found</p>
              ) : (
                filteredDds.slice(0, 100).map((d) => (
                  <button
                    key={d.id}
                    onClick={() => toggleDd(d.id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-50 transition-colors ${ddIds.has(d.id) ? "bg-indigo-50/50" : ""}`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${ddIds.has(d.id) ? "bg-indigo-600 border-indigo-600 text-white" : "border-gray-300"}`}>
                      {ddIds.has(d.id) && <Check className="w-3 h-3" />}
                    </div>
                    <span className="text-xs text-gray-700 truncate">
                      {d.firm_name || "—"} <span className="text-gray-400">/</span> {d.product_name || "—"}
                    </span>
                    {d.status && (
                      <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">{d.status}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Link2 className="w-3.5 h-3.5" /> Save Links</>}
          </Button>
        </div>
      </div>
    </div>
  );
}