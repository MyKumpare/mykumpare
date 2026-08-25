import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, Globe, AlertTriangle, Filter, ArrowUpDown, Plus, FileSearch, EyeOff,
} from "lucide-react";
import FirmRfpRfiCard from "./FirmRfpRfiCard";
import AddRfpRfiDialog from "./AddRfpRfiDialog";
import { toast } from "@/components/ui/use-toast";
import { TERMINAL_PROGRESS } from "./rfpRfiProgress";

// "RFP/RFI Search" tab inside the firm form. Scrubs the firm's website for any
// Request for Proposal (RFP) or Request for Information (RFI) postings, lists
// them with filter/sort, and lets the user manually add or edit records.
export default function FirmRfpRfiTab({ firmId, firmName, firmWebsite }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [scraping, setScraping] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all"); // all | Open | Closed
  const [sortBy, setSortBy] = useState("due_asc"); // due_asc | due_desc | posted_desc | title
  const [search, setSearch] = useState("");
  const [hideCompleted, setHideCompleted] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["firm-rfp-rfi", firmId],
    queryFn: () => base44.entities.FirmRfpRfi.filter({ firm_id: firmId }, "-due_date", 500),
    enabled: !!firmId,
  });

  const active = useMemo(() => records.filter((r) => !r.deleted_at), [records]);

  const visible = useMemo(() => {
    let list = [...active];
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    if (hideCompleted) list = list.filter((r) => !TERMINAL_PROGRESS.includes(r.progress_status));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        (r.title || "").toLowerCase().includes(q) ||
        (r.summary || "").toLowerCase().includes(q) ||
        (r.rfp_type || "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortBy === "due_asc") return (a.due_date || "9999").localeCompare(b.due_date || "9999");
      if (sortBy === "due_desc") return (b.due_date || "0").localeCompare(a.due_date || "0");
      if (sortBy === "posted_desc") return (b.posting_date || "0").localeCompare(a.posting_date || "0");
      return (a.title || "").localeCompare(b.title || "");
    });
    return list;
  }, [active, statusFilter, sortBy, search]);

  const counts = useMemo(() => ({
    Open: active.filter((r) => r.status === "Open").length,
    Closed: active.filter((r) => r.status === "Closed").length,
  }), [active]);

  const handleScrape = async () => {
    setScraping(true);
    try {
      const res = await base44.functions.invoke("scrapeFirmRfpRfi", { firm_id: firmId });
      const data = res?.data ?? res ?? {};
      const found = data.rfps || [];
      if (found.length === 0) {
        toast({ title: "No RFP/RFI found", description: "The scrub didn't find any RFP or RFI postings on the firm's website." });
      } else {
        const batchId = crypto.randomUUID();
        const toCreate = found.map((r) => ({
          ...r,
          tenant_id: user?.linked_firm_id,
          firm_id: firmId,
          firm_name: firmName,
          scrub_batch_id: batchId,
        }));
        await base44.entities.FirmRfpRfi.bulkCreate(toCreate);
        queryClient.invalidateQueries({ queryKey: ["firm-rfp-rfi", firmId] });
        queryClient.invalidateQueries({ queryKey: ["rfp-rfi-dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["rfp-rfi-due-this-week"] });
        toast({ title: `Found ${found.length} RFP/RFI${found.length === 1 ? "" : "s"}` });
      }
    } catch (err) {
      toast({ title: "Scrub failed", description: err?.message || "Could not scrub RFP/RFI.", variant: "destructive" });
    } finally {
      setScraping(false);
    }
  };

  const openEdit = (record) => {
    setEditing(record);
    setShowAdd(true);
  };
  const closeDialog = () => {
    setShowAdd(false);
    setEditing(null);
  };

  if (!firmId) {
    return (
      <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
        Save the firm first to scrub for RFP/RFI postings
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
          className="bg-primary hover:bg-primary/90 text-white gap-1.5"
          title={!firmWebsite ? "Add a website to the firm first" : "Scrub the firm's website for RFP/RFI postings"}
        >
          {scraping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
          {scraping ? "Scrubbing…" : "Scrub RFP/RFI"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => { setEditing(null); setShowAdd(true); }}
          className="gap-1.5"
          title="Manually add an RFP/RFI record"
        >
          <Plus className="w-3.5 h-3.5" /> Add RFP/RFI
        </Button>
        {!firmWebsite && (
          <span className="text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Add a website to the firm to enable scrubbing
          </span>
        )}

        <div className="flex items-center gap-1 ml-auto">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          {[
            { key: "all", label: `All (${active.length})` },
            { key: "Open", label: `Open (${counts.Open})` },
            { key: "Closed", label: `Closed (${counts.Closed})` },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setStatusFilter(opt.key)}
              className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                statusFilter === opt.key
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer select-none ml-1">
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(e) => setHideCompleted(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <EyeOff className="w-3 h-3 text-gray-400" />
          Hide completed
        </label>
      </div>

      {/* Sort + search */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Input
            placeholder="Search by title, summary, or type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
            <option value="due_asc">Due date (earliest)</option>
            <option value="due_desc">Due date (latest)</option>
            <option value="posted_desc">Recently posted</option>
            <option value="title">Title (A–Z)</option>
          </select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-sm text-gray-400 italic py-4 text-center">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl flex flex-col items-center gap-2">
          <FileSearch className="w-8 h-8 text-gray-300" />
          {active.length === 0
            ? "No RFP/RFI yet. Click \"Scrub RFP/RFI\" to search the firm's website."
            : "No records match the current filter."}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((r) => (
            <FirmRfpRfiCard key={r.id} record={r} onEdit={openEdit} />
          ))}
        </div>
      )}

      <AddRfpRfiDialog
        open={showAdd}
        onClose={closeDialog}
        firmId={firmId}
        firmName={firmName}
        editingRecord={editing}
        user={user}
      />
    </div>
  );
}