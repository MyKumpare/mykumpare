import React from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Pencil, Trash2, ExternalLink, CalendarDays, CalendarClock,
  HelpCircle, CalendarPlus, FileDown, Paperclip, PackageCheck, StickyNote, History,
} from "lucide-react";
import { useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { progressStyle, decisionStyle, productMatchStyle } from "./rfpRfiProgress";
import RfpRfiVersionHistoryDialog from "./RfpRfiVersionHistoryDialog";

const TYPE_STYLES = {
  RFP: "bg-primary/15 text-primary border-primary/30",
  RFI: "bg-amber-100 text-amber-700 border-amber-200",
  Unknown: "bg-gray-100 text-gray-500 border-gray-200",
};

const STATUS_STYLES = {
  Open: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Closed: "bg-red-100 text-red-700 border-red-200",
  Unknown: "bg-gray-100 text-gray-500 border-gray-200",
};

function fmt(d) {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return d;
  }
}

export default function FirmRfpRfiCard({ record, onEdit }) {
  const queryClient = useQueryClient();
  const [historyOpen, setHistoryOpen] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Delete this RFP/RFI record?")) return;
    try {
      await base44.entities.FirmRfpRfi.delete(record.id);
      queryClient.invalidateQueries({ queryKey: ["firm-rfp-rfi", record.firm_id] });
      queryClient.invalidateQueries({ queryKey: ["rfp-rfi-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["rfp-rfi-due-this-week"] });
      toast({ title: "RFP/RFI deleted" });
    } catch (err) {
      toast({ title: "Delete failed", description: err?.message || "Could not delete.", variant: "destructive" });
    }
  };

  const typeStyle = TYPE_STYLES[record.rfp_type] || TYPE_STYLES.Unknown;
  const statusStyle = STATUS_STYLES[record.status] || STATUS_STYLES.Unknown;
  const questionsRange = record.questions_start_date || record.questions_end_date
    ? `${fmt(record.questions_start_date)} – ${fmt(record.questions_end_date)}`
    : "—";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3.5 space-y-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-primary shrink-0" />
          <h4 className="font-semibold text-sm text-gray-800 truncate">{record.title}</h4>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 relative"
            title="Version history"
          >
            <History className="w-3.5 h-3.5" />
            {(record.version_history?.length > 0) && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary border border-white" />
            )}
          </button>
          <button type="button" onClick={() => onEdit(record)} className="p-1 rounded hover:bg-gray-100 text-gray-500" title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={handleDelete} className="p-1 rounded hover:bg-red-50 text-red-500" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className={`text-[10px] ${typeStyle}`}>{record.rfp_type}</Badge>
        <Badge variant="outline" className={`text-[10px] ${statusStyle}`}>{record.status}</Badge>
        <Badge variant="outline" className={`text-[10px] ${progressStyle(record.progress_status)}`}>
          {record.progress_status || "Draft"}
        </Badge>
        <Badge variant="outline" className={`text-[10px] ${decisionStyle(record.decision_status)}`}>
          {record.decision_status || "Needs Review"}
        </Badge>
        {record.product_match_status && record.product_match_status !== "Not Checked" && (
          <Badge variant="outline" className={`text-[10px] gap-1 ${productMatchStyle(record.product_match_status)}`}>
            <PackageCheck className="w-2.5 h-2.5" />
            {record.product_match_status}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <div className="flex items-center gap-1.5 text-gray-600">
          <CalendarPlus className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-gray-400">Posted:</span> <span className="font-medium">{fmt(record.posting_date)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-600">
          <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-gray-400">Starts:</span> <span className="font-medium">{fmt(record.start_date)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-600">
          <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-gray-400">Questions:</span> <span className="font-medium">{questionsRange}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-600">
          <CalendarClock className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-gray-400">Due:</span> <span className="font-medium text-red-600">{fmt(record.due_date)}</span>
        </div>
      </div>

      {record.summary && (
        <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-2.5 border border-gray-100">
          {record.summary}
        </p>
      )}

      {record.matched_product_names?.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {record.matched_product_names.map((n) => (
            <span key={n} className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md px-2 py-0.5">
              <PackageCheck className="w-3 h-3" /> {n}
            </span>
          ))}
        </div>
      )}
      {record.product_match_summary && (
        <p className="text-[11px] text-gray-500 leading-relaxed bg-gray-50 rounded-md p-2 border border-gray-100">
          {record.product_match_summary}
        </p>
      )}

      {record.notes && (
        <div className="flex items-start gap-1.5 text-xs text-gray-600 bg-amber-50/60 rounded-lg p-2.5 border border-amber-100">
          <StickyNote className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed whitespace-pre-wrap line-clamp-4">{record.notes}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-gray-100">
        {record.source_url && (
          <a href={record.source_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <ExternalLink className="w-3.5 h-3.5" /> Source link
          </a>
        )}
        {record.file_url && (
          <a href={record.file_url} target="_blank" rel="noopener noreferrer" download
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            {record.file_name ? <Paperclip className="w-3.5 h-3.5" /> : <FileDown className="w-3.5 h-3.5" />}
            {record.file_name || "Attached file"}
          </a>
        )}
        {!record.source_url && !record.file_url && (
          <span className="text-xs text-gray-400 italic">No link or file attached</span>
        )}
      </div>

      <RfpRfiVersionHistoryDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        record={record}
      />
    </div>
  );
}