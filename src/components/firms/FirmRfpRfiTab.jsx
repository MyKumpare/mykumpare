import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Globe, Plus, Pencil, Trash2, FileText, ExternalLink, AlertTriangle, CalendarDays,
} from "lucide-react";
import RfpRfiDialog from "./RfpRfiDialog";
import { toast } from "@/components/ui/use-toast";

const fmt = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—");

// "RFP / RFI" tab inside the firm form. Scrubs the firm's website for any
// Request for Proposal / Request for Information postings and lists them with
// posting date, start date, questions window, due date, summary, source link,
// and an attached solicitation file. Records can also be added/edited/deleted
// manually.
export default function FirmRfpRfiTab({ firmId, firmName, firmWebsite }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [scrubbing, setScrubbing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["firm-rfp-rfi", firmId],
    queryFn: () => base44.entities.FirmRfpRfi.filter({ firm_id: firmId }, "-due_date", 500),
    enabled: !!firmId,
  });

  const active = records.filter((r) => !r.deleted_at);

  const handleScrub = async () => {
    setScrubbing(true);
    try {
      const res = await base44.functions.invoke("scrubFirmRfpRfi", { firm_id: firmId });
      const data = res?.data ?? res ?? {};
      const found = data.rfp_rfis || [];
      if (found.length === 0) {
        toast({ title: "No RFPs/RFIs found", description: "The scrub didn't find any solicitations on the firm's website." });
      } else {
        const batchId = crypto.randomUUID();
        const toCreate = found.map((r) => ({
          ...r,
          tenant_id: user?.linked_firm_id,
          firm_id: firmId,
          firm_name: firmName,
          scrub_batch_id: batchId,
          file_name: r.file_url ? "Solicitation document" : "",
        }));
        await base44.entities.FirmRfpRfi.bulkCreate(toCreate);
        queryClient.invalidateQueries({ queryKey: ["firm-rfp-rfi", firmId] });
        toast({ title: `Found ${found.length} RFP/RFI${found.length === 1 ? "" : "s"}` });
      }
    } catch (err) {
      toast({ title: "Scrub failed", description: err?.message || "Could not scrub RFPs/RFIs.", variant: "destructive" });
    } finally {
      setScrubbing(false);
    }
  };

  const handleDelete = async (rec) => {
    if (!confirm(`Delete "${rec.title}"?`)) return;
    try {
      await base44.entities.FirmRfpRfi.update(rec.id, { deleted_at: new Date().toISOString() });
      queryClient.invalidateQueries({ queryKey: ["firm-rfp-rfi", firmId] });
      toast({ title: "✅ RFP/RFI deleted" });
    } catch (err) {
      toast({ title: "Delete failed", description: err?.message, variant: "destructive" });
    }
  };

  if (!firmId) {
    return (
      <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
        Save the firm first to scrub RFPs/RFIs
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
          onClick={handleScrub}
          disabled={scrubbing || !firmWebsite}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
          title={!firmWebsite ? "Add a website to the firm first" : "Scrub the firm's website for RFPs/RFIs"}
        >
          {scrubbing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
          {scrubbing ? "Scrubbing…" : "Scrub Website"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          className="gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </Button>
        {!firmWebsite && (
          <span className="text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Add a website to the firm to enable scrubbing
          </span>
        )}
        <span className="ml-auto text-xs text-gray-400">{active.length} record{active.length === 1 ? "" : "s"}</span>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-sm text-gray-400 italic py-4 text-center">Loading…</div>
      ) : active.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl">
          No RFPs/RFIs yet. Click "Scrub Website" to search the firm's website, or "Add" to enter one manually.
        </div>
      ) : (
        <div className="space-y-2">
          {active.map((r) => (
            <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Badge className={r.type === "RFI" ? "bg-amber-100 text-amber-700 hover:bg-amber-100" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-100"}>
                  {r.type}
                </Badge>
                <span className="text-sm font-semibold text-gray-800 flex-1 min-w-0 break-words">{r.title}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button type="button" onClick={() => { setEditing(r); setDialogOpen(true); }} className="text-gray-400 hover:text-indigo-600 p-1" title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => handleDelete(r)} className="text-gray-400 hover:text-red-500 p-1" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Dates grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-gray-400">Posted: </span>
                  <span className="text-gray-700 font-medium">{fmt(r.posting_date)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Start: </span>
                  <span className="text-gray-700 font-medium">{fmt(r.start_date)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Due: </span>
                  <span className="text-gray-700 font-medium">{fmt(r.due_date)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Questions: </span>
                  <span className="text-gray-700 font-medium">{fmt(r.questions_start_date)} – {fmt(r.questions_end_date)}</span>
                </div>
              </div>

              {r.summary && (
                <p className="text-xs text-gray-600 whitespace-pre-wrap">{r.summary}</p>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                {r.source_url && (
                  <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                    <ExternalLink className="w-3.5 h-3.5" /> Source
                  </a>
                )}
                {r.file_url && (
                  <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                    <FileText className="w-3.5 h-3.5" /> {r.file_name || "Attached file"}
                  </a>
                )}
                {r.due_date && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400 ml-auto">
                    <CalendarDays className="w-3.5 h-3.5" /> Due {fmt(r.due_date)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <RfpRfiDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        firmId={firmId}
        firmName={firmName}
        editing={editing}
        user={user}
      />
    </div>
  );
}