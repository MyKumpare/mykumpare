import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, FileText, FileSpreadsheet, X } from "lucide-react";
import { buildSummaryHtml, downloadScoringMatrixWord, downloadScoringMatrixExcel } from "./scoringMatrixSummaryExport";

/**
 * Read-only preview of a scoring matrix template summary, with Print,
 * Download Word (.doc), and Download Excel (.xlsx) actions.
 *
 * Props:
 *  - open, onOpenChange
 *  - templateName
 *  - blocks (scoring matrix sections)
 *  - ratingConfig (overall rating configuration)
 */
export default function ScoringMatrixSummaryDialog({ open, onOpenChange, templateName, blocks, ratingConfig }) {
  const html = useMemo(
    () => buildSummaryHtml(templateName, blocks, ratingConfig),
    [templateName, blocks, ratingConfig]
  );

  const handlePrint = () => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            Scoring Matrix Summary — {templateName || "Untitled"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 pb-2 border-b">
          <Button type="button" size="sm" onClick={handlePrint} className="h-8">
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => downloadScoringMatrixWord(templateName, blocks, ratingConfig)}
          >
            <FileText className="w-3.5 h-3.5" /> Download Word
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => downloadScoringMatrixExcel(templateName, blocks, ratingConfig)}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Download Excel
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 ml-auto"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-3.5 h-3.5" /> Close
          </Button>
        </div>

        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </DialogContent>
    </Dialog>
  );
}