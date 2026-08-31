import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { FileDown, Loader2, X, LayoutTemplate, ArrowUpRight } from "lucide-react";
import { recordDisplayName } from "./summaryReportTemplateConfig";
import { exportRecordSummary } from "./summaryReportExport";

/**
 * A button + template picker that generates a branded summary PDF for the
 * current record using one of the user's saved SummaryReportTemplates.
 *
 * @param {string} entityType - "Firm" | "Product" | "Portfolio" | "Contact"
 * @param {object} record      - The entity record being viewed
 * @param {string} [className] - Optional class override for the trigger button
 */
export default function SummaryExportButton({ entityType, record, className }) {
  const [open, setOpen] = useState(false);
  const [generatingId, setGeneratingId] = useState(null);
  const navigate = useNavigate();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["summary_report_templates", entityType],
    queryFn: async () => {
      const list = await base44.entities.SummaryReportTemplate.list("-updated_date", 200);
      return (Array.isArray(list) ? list : []).filter((t) => t.entity_type === entityType);
    },
    enabled: open,
  });

  const handleGenerate = async (template) => {
    setGeneratingId(template.id);
    try {
      await exportRecordSummary(template, record);
    } finally {
      setGeneratingId(null);
      setOpen(false);
    }
  };

  // Only show for an existing, saved record
  if (!record?.id) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={className || "text-gray-500 hover:text-gray-700 hover:bg-gray-100 gap-1.5"}
        onClick={() => setOpen(true)}
      >
        <FileDown className="w-3.5 h-3.5" />
        Summary PDF
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(o)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <LayoutTemplate className="w-4 h-4 text-teal-600" />
                Export Summary PDF
              </span>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </DialogTitle>
            <p className="text-xs text-gray-500 mt-1">
              Choose a saved template to generate a branded PDF for{" "}
              <span className="font-medium text-gray-700">
                {recordDisplayName(entityType, record)}
              </span>
              .
            </p>
          </DialogHeader>

          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            )}
            {!isLoading && templates.length === 0 && (
              <div className="text-center py-8">
                <LayoutTemplate className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500 mb-1">No {entityType} templates yet</p>
                <p className="text-xs text-gray-400 mb-4">
                  Create one in Summary Report Templates first.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setOpen(false);
                    navigate("/SummaryReportTemplates");
                  }}
                >
                  Go to Summary Report Templates
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => handleGenerate(tpl)}
                disabled={generatingId === tpl.id}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 text-left disabled:opacity-60"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{tpl.name}</p>
                  <p className="text-[11px] text-gray-400">
                    {tpl.selected_fields?.length || 0} fields • {tpl.page_orientation}
                  </p>
                </div>
                {generatingId === tpl.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                ) : (
                  <FileDown className="w-4 h-4 text-gray-400" />
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}