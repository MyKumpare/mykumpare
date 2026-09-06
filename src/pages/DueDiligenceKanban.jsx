import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePersistentState } from "@/hooks/usePersistentState";
import { Button } from "@/components/ui/button";
import DueDiligenceKanbanBoard, { computeApprovalStatus } from "@/components/firms/DueDiligenceKanbanBoard";
import DdSummaryChart from "@/components/firms/DdSummaryChart";
import AddDueDiligenceDialog from "@/components/firms/AddDueDiligenceDialog";
import DueDiligenceDetailDialog from "@/components/firms/DueDiligenceDetailDialog";
import DdFilterTabs, { getDdCounts, filterDdRecords } from "@/components/firms/DdFilterTabs";
import { LayoutDashboard, List, Loader2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const GROUP_MODES = [
  { key: "approval_status", label: "Approval Pipeline", columns: ["In Pipeline", "Awaiting Approval", "Approved"] },
  { key: "status", label: "DD Status", columns: ["Pipeline", "Buy List", "Rejected"] },
  { key: "process_status", label: "Process Status", columns: ["Not Started", "In-process", "Completed"] },
];

export default function DueDiligenceKanban() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [groupMode, setGroupMode] = usePersistentState("ddKanban_groupMode", "approval_status");
  const [showDialog, setShowDialog] = usePersistentState("ddKanban_showDialog", false);
  const [editing, setEditing] = usePersistentState("ddKanban_editing", null);
  const [viewing, setViewing] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [activeTab, setActiveTab] = usePersistentState("ddKanban_activeTab", "active");

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["due-diligence-all"],
    queryFn: () => base44.entities.DueDiligence.filter({ deleted_at: null }, "-created_date", 500),
  });

  const { data: firms = [] } = useQuery({
    queryKey: ["firms-all"],
    queryFn: () => base44.entities.Firm.filter({ deleted_at: null }, "-created_date", 500),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-all"],
    queryFn: () => base44.entities.Product.filter({ deleted_at: null }, "-created_date", 500),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-all"],
    queryFn: () => base44.entities.Contact.filter({ deleted_at: null }, "-created_date", 500),
  });

  const activeRecords = useMemo(
    () => records.filter((r) => !r.deleted_at && r.status !== "Rejected"),
    [records]
  );

  // Enrich records with computed approval_status for the kanban grouping
  const enrichedRecords = useMemo(
    () => activeRecords.map((r) => ({ ...r, approval_status: computeApprovalStatus(r) })),
    [activeRecords]
  );

  const counts = getDdCounts(activeRecords);
  const filtered = filterDdRecords(enrichedRecords, activeTab);

  const handleMoveCard = async (rec, newColumn) => {
    if (groupMode === "status") {
      await base44.entities.DueDiligence.update(rec.id, { status: newColumn });
    } else if (groupMode === "process_status") {
      await base44.entities.DueDiligence.update(rec.id, { process_status: newColumn });
    }
    // approval_status is computed — no direct update
  };

  const findFirm = (id) => firms.find((f) => f.id === id && !f.deleted_at);
  const findProduct = (id) => products.find((p) => p.id === id && !p.deleted_at);
  const findContact = (id) => contacts.find((c) => c.id === id && !c.deleted_at);

  const handleCardClick = (rec) => {
    setViewing(rec);
    setShowDetail(true);
  };

  const handleFirmClick = (firmId) => {
    const firm = findFirm(firmId);
    if (firm) window.location.hash = `#/Home`;
  };

  const handleProductClick = (productId) => {
    const product = findProduct(productId);
    if (product) window.location.hash = `#/Home`;
  };

  const handleContactClick = (contactId) => {
    const contact = findContact(contactId);
    if (contact) window.location.hash = `#/Home`;
  };

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-gray-800">Due Diligence Pipeline</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
            onClick={() => { setEditing(null); setShowDialog(true); }}
          >
            <List className="w-4 h-4" /> Add Due Diligence
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => navigate("/")}
            title="Close and return to dashboard"
          >
            <X className="w-4 h-4" /> Close
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      {activeRecords.length > 0 && (
        <DdFilterTabs activeTab={activeTab} onChange={setActiveTab} counts={counts} />
      )}

      {/* Group mode toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 font-medium">Group by:</span>
        {GROUP_MODES.map((mode) => (
          <button
            key={mode.key}
            type="button"
            onClick={() => setGroupMode(mode.key)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full font-medium transition-colors",
              groupMode === mode.key
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Summary statistics chart */}
      {!isLoading && filtered.length > 0 && (
        <DdSummaryChart
          records={filtered}
          groupMode={groupMode}
          columns={GROUP_MODES.find((m) => m.key === groupMode).columns}
          onRecordClick={handleCardClick}
        />
      )}

      {/* Kanban board */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-8 text-center border border-dashed border-gray-200 rounded-xl">
          No due diligence records to display
        </div>
      ) : (
        <div className="h-[calc(100vh-280px)] min-h-[400px]">
          <DueDiligenceKanbanBoard
            records={filtered}
            columnField={groupMode}
            onMoveCard={handleMoveCard}
            onCardClick={handleCardClick}
            onProductClick={handleProductClick}
            onFirmClick={handleFirmClick}
            onContactClick={handleContactClick}
          />
        </div>
      )}

      <AddDueDiligenceDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        firmId={editing?.firm_id || ""}
        firmName={editing?.firm_name || ""}
        products={products.filter((p) => !p.deleted_at)}
        contacts={contacts.filter((c) => !c.deleted_at)}
        editingRecord={editing}
        onSubmit={(data) => {
          const op = editing
            ? base44.entities.DueDiligence.update(editing.id, data)
            : base44.entities.DueDiligence.create(data);
          op.finally(() => {
            queryClient.invalidateQueries({ queryKey: ["due-diligence-all"] });
            queryClient.invalidateQueries({ queryKey: ["due-diligence-search"] });
            queryClient.invalidateQueries({ queryKey: ["due-diligence"] });
          });
          setShowDialog(false);
        }}
        onDelete={(id) => {
          base44.entities.DueDiligence.delete(id);
          queryClient.invalidateQueries({ queryKey: ["due-diligence-all"] });
          queryClient.invalidateQueries({ queryKey: ["due-diligence-search"] });
          queryClient.invalidateQueries({ queryKey: ["due-diligence"] });
          setShowDialog(false);
          setEditing(null);
        }}
      />

      <DueDiligenceDetailDialog
        open={showDetail}
        onOpenChange={(v) => { setShowDetail(v); if (!v) setViewing(null); }}
        record={viewing}
        onEdit={(rec) => { setEditing(rec); setShowDialog(true); }}
      />
    </div>
  );
}