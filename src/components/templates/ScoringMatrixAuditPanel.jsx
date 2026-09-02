import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Lightbulb, FileText, Brain, RefreshCw, FileDown } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import ScoringAuditStatusSummary from "./ScoringAuditStatusSummary";
import { exportScoringAuditSummaryPdf } from "./scoringAuditPdfExport";

const SCORE_COLORS = {
  1: "bg-red-100 text-red-700 border-red-300",
  2: "bg-orange-100 text-orange-700 border-orange-300",
  3: "bg-yellow-100 text-yellow-700 border-yellow-300",
  4: "bg-lime-100 text-lime-700 border-lime-300",
  5: "bg-green-100 text-green-700 border-green-300"
};

export default function ScoringMatrixAuditPanel({ scoreId, score }) {
  const [auditData, setAuditData] = useState(null);

  const auditMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke("auditScoringMatrix", { score_id: scoreId });
      return response.data;
    },
    onSuccess: (data) => {
      setAuditData(data);
      toast({ title: "AI audit complete", description: "Scoring matrix audit generated successfully." });
    },
    onError: (err) => {
      toast({ title: "Audit failed", description: err?.message, variant: "destructive" });
    }
  });

  const runAudit = () => {
    auditMutation.mutate();
  };

  const [exporting, setExporting] = useState(false);
  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await exportScoringAuditSummaryPdf({ score, auditData });
      toast({ title: "PDF exported", description: "Audit summary report downloaded." });
    } catch (err) {
      toast({ title: "Export failed", description: err?.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  if (!auditData) {
    return (
      <div className="space-y-4">
        <ScoringAuditStatusSummary score={score} auditData={null} />
        <div className="border border-purple-200 rounded-lg p-6 bg-gradient-to-br from-purple-50 to-white">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Brain className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-purple-900">AI Scoring Matrix Audit</h4>
              <p className="text-xs text-purple-700 mt-1">
                Run an AI-powered audit of this scoring matrix to identify inconsistencies across evaluation columns,
                highlight criteria that need re-scoring review, and get an independent AI assessment with an executive summary,
                strengths, weaknesses, and follow-up recommendations.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={runAudit} disabled={auditMutation.isPending} className="bg-purple-600 hover:bg-purple-700 text-white">
                  {auditMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Analyzing scoring matrix...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Run AI Audit
                    </>
                  )}
                </Button>
                <Button size="sm" variant="outline" onClick={handleExportPdf} disabled={exporting}>
                  {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                  Export PDF Summary
                </Button>
                {auditMutation.isPending && (
                  <span className="text-xs text-purple-500">This may take 30-60 seconds...</span>
                )}
              </div>
              {auditMutation.isError && (
                <p className="text-xs text-red-600 mt-2">Error: {auditMutation.error?.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* What the audit covers */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold">Inconsistency Detection</span>
            </div>
            <p className="text-xs text-gray-500">Identifies criteria where Primary, Team, IC, and Final scores diverge significantly.</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Lightbulb className="w-4 h-4 text-yellow-500" />
              <span className="text-xs font-semibold">Re-Scoring Recommendations</span>
            </div>
            <p className="text-xs text-gray-500">Highlights specific criteria the analyst should review for potential re-scoring.</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-semibold">Executive Summary</span>
            </div>
            <p className="text-xs text-gray-500">Provides strengths, weaknesses, areas of concern, and follow-up items.</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Brain className="w-4 h-4 text-purple-500" />
              <span className="text-xs font-semibold">Independent AI Score</span>
            </div>
            <p className="text-xs text-gray-500">Generates its own independent score for each criterion based on all available data.</p>
          </div>
        </div>
      </div>
    );
  }

  const { executive_summary, strengths, weaknesses, areas_of_concern, follow_up_items, rescoring_recommendations, independent_scores, overall_assessment } = auditData;

  return (
    <div className="space-y-4">
      <ScoringAuditStatusSummary score={score} auditData={auditData} />
      {/* Header with re-run button */}
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-600" />
          <h4 className="text-sm font-semibold">AI Audit Results</h4>
          {overall_assessment?.confidence_level && (
            <Badge variant="outline" className="text-xs">
              Confidence: {overall_assessment.confidence_level}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExportPdf} disabled={exporting}>
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            Export PDF Summary
          </Button>
          <Button size="sm" variant="outline" onClick={runAudit} disabled={auditMutation.isPending}>
            {auditMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Re-run Audit
          </Button>
        </div>
      </div>

      {/* Overall AI Assessment */}
      {overall_assessment && (
        <div className="border border-purple-200 rounded-lg p-4 bg-gradient-to-br from-purple-50 to-white">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-sm font-semibold text-purple-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              AI Overall Assessment
            </h5>
            {overall_assessment.ai_overall_score != null && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">AI Score:</span>
                <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold border ${SCORE_COLORS[Math.round(overall_assessment.ai_overall_score)] || "border-gray-200"}`}>
                  {overall_assessment.ai_overall_score.toFixed(1)}
                </span>
              </div>
            )}
          </div>
          {overall_assessment.summary && (
            <p className="text-xs text-gray-700 leading-relaxed">{overall_assessment.summary}</p>
          )}
        </div>
      )}

      {/* Executive Summary */}
      {executive_summary && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h5 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-blue-500" />
            Executive Summary
          </h5>
          <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{executive_summary}</div>
        </div>
      )}

      {/* Strengths and Weaknesses side by side */}
      <div className="grid grid-cols-2 gap-3">
        {strengths && strengths.length > 0 && (
          <div className="border border-green-200 rounded-lg p-3 bg-green-50">
            <h5 className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" />
              Strengths
            </h5>
            <ul className="space-y-1.5">
              {strengths.map((s, i) => (
                <li key={i} className="text-xs text-green-700 flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-green-500" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {weaknesses && weaknesses.length > 0 && (
          <div className="border border-red-200 rounded-lg p-3 bg-red-50">
            <h5 className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4" />
              Weaknesses
            </h5>
            <ul className="space-y-1.5">
              {weaknesses.map((w, i) => (
                <li key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-red-500" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Areas of Concern and Follow-up Items */}
      <div className="grid grid-cols-2 gap-3">
        {areas_of_concern && areas_of_concern.length > 0 && (
          <div className="border border-amber-200 rounded-lg p-3 bg-amber-50">
            <h5 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Areas of Concern
            </h5>
            <ul className="space-y-1.5">
              {areas_of_concern.map((c, i) => (
                <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {follow_up_items && follow_up_items.length > 0 && (
          <div className="border border-blue-200 rounded-lg p-3 bg-blue-50">
            <h5 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4" />
              Follow-Up Items
            </h5>
            <ul className="space-y-1.5">
              {follow_up_items.map((f, i) => (
                <li key={i} className="text-xs text-blue-700 flex items-start gap-1.5">
                  <span className="text-blue-500 mt-0.5">→</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Re-Scoring Recommendations */}
      {rescoring_recommendations && rescoring_recommendations.length > 0 && (
        <div className="border border-orange-200 rounded-lg p-3 bg-orange-50">
          <h5 className="text-sm font-semibold text-orange-800 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            Re-Scoring Recommendations ({rescoring_recommendations.length})
          </h5>
          <div className="space-y-2">
            {rescoring_recommendations.map((r, i) => (
              <div key={i} className="border border-orange-200 rounded p-2 bg-white">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-orange-900">{r.block_name} → {r.criterion_name}</span>
                  {r.current_final_score != null && (
                    <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                      Current: {r.current_final_score}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-600 mb-1"><span className="font-medium">Concern:</span> {r.concern}</p>
                <p className="text-xs text-gray-600"><span className="font-medium">Action:</span> {r.recommended_action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Independent AI Scores */}
      {independent_scores && independent_scores.length > 0 && (
        <div className="border border-purple-200 rounded-lg overflow-hidden">
          <div className="p-3 bg-purple-50 border-b border-purple-200">
            <h5 className="text-sm font-semibold text-purple-900 flex items-center gap-1.5">
              <Brain className="w-4 h-4" />
              Independent AI Scores
            </h5>
            <p className="text-xs text-purple-600 mt-0.5">AI-generated scores based on level descriptors and all analyst notes</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-purple-50/50">
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-gray-600">Block</th>
                  <th className="text-left p-2 font-medium text-gray-600">Criterion</th>
                  <th className="text-center p-2 font-medium text-gray-600">AI Score</th>
                  <th className="text-left p-2 font-medium text-gray-600 min-w-[200px]">Score Description</th>
                  <th className="text-left p-2 font-medium text-gray-600 min-w-[300px]">Rationale</th>
                </tr>
              </thead>
              <tbody>
                {independent_scores.map((s, i) => (
                  <tr key={i} className="border-b hover:bg-purple-50/30">
                    <td className="p-2 text-gray-500">{s.block_name}</td>
                    <td className="p-2 font-medium">{s.criterion_name}</td>
                    <td className="p-2 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border ${SCORE_COLORS[s.ai_score] || "border-gray-200"}`}>
                          {s.ai_score}
                        </span>
                      </div>
                    </td>
                    <td className="p-2">
                      {s.ai_score_descriptor ? (
                        <span className="text-xs text-purple-700 bg-purple-50 border border-purple-100 rounded px-1.5 py-1 leading-snug">
                          {s.ai_score_descriptor}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300 italic">No descriptor available</span>
                      )}
                    </td>
                    <td className="p-2 text-gray-600">{s.ai_rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}