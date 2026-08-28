import React, { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, X, FileText, FileSpreadsheet, Radar as RadarIcon, History, Building } from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import { exportFirmScoringHistoryPdf } from "./firmScoringExportPdf";
import { exportFirmScoringHistoryExcel } from "./firmScoringExportExcel";
import { toast } from "@/components/ui/use-toast";
import html2canvas from "html2canvas";

const SCORE_COLORS = {
  1: "bg-red-100 text-red-700 border-red-300",
  2: "bg-orange-100 text-orange-700 border-orange-300",
  3: "bg-yellow-100 text-yellow-700 border-yellow-300",
  4: "bg-lime-100 text-lime-700 border-lime-300",
  5: "bg-green-100 text-green-700 border-green-300",
};

export default function FirmScoringExportWizard({ open, onClose, firms = [] }) {
  const [search, setSearch] = useState("");
  const [selectedFirmId, setSelectedFirmId] = useState(null);
  const [isExporting, setIsExporting] = useState(null); // "pdf" | "excel" | null
  const radarRef = useRef(null);

  const selectedFirm = useMemo(
    () => firms.find((f) => f.id === selectedFirmId && !f.deleted_at) || null,
    [firms, selectedFirmId]
  );

  // Fetch all scoring matrix scores for the selected firm
  const { data: scores = [], isLoading: scoresLoading } = useQuery({
    queryKey: ["firmScoringExport", selectedFirmId],
    queryFn: () => base44.entities.ScoringMatrixScore.filter({ firm_id: selectedFirmId }, "-scoring_start_date", 500),
    enabled: !!selectedFirmId && open,
  });

  // Latest finalized score (for the radar chart + detail)
  const latestFinal = useMemo(
    () => scores.find((s) => s.is_closed && s.final_score_finalized) || scores.find((s) => s.is_closed) || scores[0] || null,
    [scores]
  );

  // Radar chart data from the latest finalized score's final scores
  const radarData = useMemo(() => {
    if (!latestFinal) return [];
    const rows = [];
    (latestFinal.scoring_blocks || []).forEach((block) => {
      (block.criteria || []).forEach((crit) => {
        rows.push({
          criterion: crit.name || `#${crit.number}`,
          final: crit.final_score ?? 0,
          primary: crit.primary_score ?? 0,
        });
      });
    });
    return rows;
  }, [latestFinal]);

  const searchLower = search.toLowerCase().trim();
  const filteredFirms = useMemo(
    () => firms.filter((f) => !f.deleted_at && (!searchLower || (f.name || "").toLowerCase().includes(searchLower))).sort((a, b) => a.name.localeCompare(b.name)),
    [firms, searchLower]
  );

  if (!open) return null;

  const handleClose = () => {
    setSearch("");
    setSelectedFirmId(null);
    setIsExporting(null);
    onClose();
  };

  const handleExportPdf = async () => {
    if (!selectedFirm || scores.length === 0) return;
    setIsExporting("pdf");
    try {
      let radarImgDataUrl = null;
      if (radarRef.current && radarData.length > 0) {
        const canvas = await html2canvas(radarRef.current, { backgroundColor: "#ffffff", scale: 2 });
        radarImgDataUrl = canvas.toDataURL("image/png");
      }
      await exportFirmScoringHistoryPdf({ firm: selectedFirm, scores, radarImgDataUrl });
      toast({ title: "PDF exported", description: "The firm scoring history PDF has been downloaded." });
    } catch (err) {
      toast({ title: "PDF export failed", description: err?.message, variant: "destructive" });
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportExcel = async () => {
    if (!selectedFirm || scores.length === 0) return;
    setIsExporting("excel");
    try {
      exportFirmScoringHistoryExcel({ firm: selectedFirm, scores });
      toast({ title: "Excel exported", description: "The firm scoring history workbook has been downloaded." });
    } catch (err) {
      toast({ title: "Excel export failed", description: err?.message, variant: "destructive" });
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
              <RadarIcon className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Firm Scoring Export Wizard</h3>
              <p className="text-xs text-gray-500">Pick a firm to export its full scoring history and final radar chart</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Step 1: Firm picker */}
          {!selectedFirm && (
            <div>
              <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5 mb-2">
                <Building className="w-3.5 h-3.5" /> Select a firm
              </label>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setSearch("")}
                  placeholder="Search firms by name..."
                  className="w-full pl-10 pr-9 h-10 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="border border-gray-200 rounded-lg max-h-[50vh] overflow-y-auto">
                {filteredFirms.length === 0 ? (
                  <p className="text-sm text-gray-400 italic py-6 text-center">No firms found</p>
                ) : (
                  filteredFirms.slice(0, 200).map((firm) => (
                    <button
                      key={firm.id}
                      onClick={() => setSelectedFirmId(firm.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-indigo-50 text-left border-b border-gray-50 last:border-0 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden bg-gray-100 shrink-0">
                        {firm.logo_url ? (
                          <img src={firm.logo_url} alt="" className="w-full h-full object-contain p-0.5" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                        ) : (
                          <Building className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-800 truncate">{firm.name}</span>
                    </button>
                  ))
                )}
                {filteredFirms.length > 200 && (
                  <p className="text-xs text-gray-400 text-center py-2">Showing first 200 results — refine your search to see more.</p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Review + export */}
          {selectedFirm && (
            <>
              {/* Selected firm banner */}
              <div className="flex items-center gap-3 border border-indigo-200 bg-indigo-50 rounded-lg p-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden bg-white shrink-0">
                  {selectedFirm.logo_url ? (
                    <img src={selectedFirm.logo_url} alt="" className="w-full h-full object-contain p-1" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  ) : (
                    <Building className="w-5 h-5 text-indigo-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-indigo-900 truncate">{selectedFirm.name}</p>
                  <p className="text-xs text-indigo-600">
                    {(selectedFirm.firm_types || (selectedFirm.firm_type ? [selectedFirm.firm_type] : [])).join(", ") || "—"}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-indigo-600" onClick={() => setSelectedFirmId(null)}>
                  Change firm
                </Button>
              </div>

              {scoresLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                </div>
              ) : scores.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl">
                  <History className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No scoring evaluations found for this firm.</p>
                </div>
              ) : (
                <>
                  {/* Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <SummaryCard label="Evaluations" value={scores.length} />
                    <SummaryCard label="Finalized" value={scores.filter((s) => s.is_closed).length} />
                    <SummaryCard label="Products" value={new Set(scores.map((s) => s.product_id).filter(Boolean)).size} />
                    <SummaryCard label="Templates" value={new Set(scores.map((s) => s.template_name).filter(Boolean)).size} />
                  </div>

                  {/* Radar chart preview */}
                  {radarData.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <RadarIcon className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-semibold text-gray-700">
                          Final Radar Chart {latestFinal && `— ${latestFinal.product_name} (v${latestFinal.version_number || 1})`}
                        </span>
                      </div>
                      <div ref={radarRef} className="border border-gray-200 rounded-lg p-3 bg-white">
                        <ResponsiveContainer width="100%" height={320}>
                          <RadarChart data={radarData}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 10 }} />
                            <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 9 }} />
                            <Radar name="Primary" dataKey="primary" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                            <Radar name="Final" dataKey="final" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
                            <Tooltip />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* History list */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <History className="w-4 h-4 text-indigo-500" />
                      <span className="text-sm font-semibold text-gray-700">Scoring History</span>
                      <Badge variant="secondary" className="text-xs ml-auto">{scores.length} version{scores.length !== 1 ? "s" : ""}</Badge>
                    </div>
                    <div className="border border-gray-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-gray-50">
                      {scores.map((s) => {
                        let wf = null;
                        let tw = 0, ts = 0;
                        (s.scoring_blocks || []).forEach((b) => {
                          const bw = (b.weight || 0) / 100;
                          (b.criteria || []).forEach((c) => {
                            if (c.final_score != null) { ts += c.final_score * bw; tw += bw; }
                          });
                        });
                        if (tw > 0) wf = (ts / tw).toFixed(2);
                        return (
                          <div key={s.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 bg-gray-100 border-gray-300 text-gray-600 shrink-0">
                              v{s.version_number || 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{s.product_name || "—"}</span>
                                <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                              </div>
                              <div className="text-gray-400 truncate">{s.template_name || "—"}</div>
                            </div>
                            {wf != null && (
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold border ${SCORE_COLORS[Math.round(wf)] || "border-gray-200"}`}>
                                {wf}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Export buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                    <Button onClick={handleExportPdf} disabled={!!isExporting} className="bg-rose-600 hover:bg-rose-700">
                      {isExporting === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                      Export PDF
                    </Button>
                    <Button onClick={handleExportExcel} disabled={!!isExporting} variant="outline" className="text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                      {isExporting === "excel" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                      Export Excel
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="border border-gray-200 rounded-lg px-3 py-2 bg-white">
      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-gray-800">{value}</p>
    </div>
  );
}