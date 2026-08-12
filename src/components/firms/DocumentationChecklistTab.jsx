import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import DatePicker from "@/components/ui/date-picker";
import StageNotesEditor from "./StageNotesEditor";
import AddDocumentDialog from "./AddDocumentDialog";
import { FileText, CheckCircle2, Circle, Clock, Plus, ChevronDown, ChevronRight, Search, Check, ExternalLink, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const todayStr = () => format(new Date(), "yyyy-MM-dd");

const STATUS_CONFIG = {
  pending: { label: "Pending", icon: Circle, badgeClass: "bg-gray-100 text-gray-500", iconClass: "text-gray-300", bgClass: "bg-gray-50 border-gray-200" },
  reviewed: { label: "Reviewed", icon: Clock, badgeClass: "bg-blue-100 text-blue-700", iconClass: "text-blue-600", bgClass: "bg-blue-50 border-blue-200" },
  completed: { label: "Completed", icon: CheckCircle2, badgeClass: "bg-emerald-100 text-emerald-700", iconClass: "text-emerald-600", bgClass: "bg-emerald-50 border-emerald-200" },
};

/**
 * DD-level documentation checklist execution tab.
 * Shows checklist items copied from the template. For each item, the user can:
 *  - Attach a document from the firm's document list (or add a new one)
 *  - Auto-set add date (editable)
 *  - Review and complete the item
 *  - Add notes (rich text)
 *
 * Props:
 *   items: [{ id, name, document_id, document_name, document_url, add_date, status, notes }]
 *   firmId: string
 *   productId: string
 *   onChange: (newItems) => void
 */
export default function DocumentationChecklistTab({ items = [], firmId, productId, onChange }) {
  const [expanded, setExpanded] = useState({});
  const [addDocOpen, setAddDocOpen] = useState(false);
  const [search, setSearch] = useState({});

  // Fetch firm documents for selection
  const { data: firmDocs = [] } = useQuery({
    queryKey: ["firm-documents", firmId],
    queryFn: () => base44.entities.FirmDocument.filter({ deleted_at: { $exists: false }, firm_id: firmId }, "-created_date", 500),
    enabled: !!firmId,
  });

  // Filter documents that are tagged to this product OR have no product tags (general firm docs)
  const availableDocs = useMemo(() => {
    return firmDocs.filter((d) => {
      if (!productId) return true;
      const pids = d.product_ids || [];
      return pids.length === 0 || pids.includes(productId);
    });
  }, [firmDocs, productId]);

  const toggleExpand = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const updateItem = (id, changes) => {
    onChange(items.map((it) => (it.id === id ? { ...it, ...changes } : it)));
  };

  const handleAttachDoc = (itemId, doc) => {
    updateItem(itemId, {
      document_id: doc.id,
      document_name: doc.file_name,
      document_url: doc.file_url,
      add_date: todayStr(),
      status: "reviewed",
    });
  };

  const handleClearDoc = (itemId) => {
    updateItem(itemId, {
      document_id: "",
      document_name: "",
      document_url: "",
      status: "pending",
    });
  };

  const handleStatusChange = (itemId, status) => {
    updateItem(itemId, { status });
  };

  const completedCount = items.filter((it) => it.status === "completed").length;
  const progressPct = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-center">
        <FileText className="w-6 h-6 text-gray-300 mx-auto mb-1" />
        <p className="text-xs text-gray-500">No documentation checklist items. Select a template with checklist items to populate.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-teal-200 bg-teal-50/30 p-3 min-w-0">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-gray-700">Documentation Checklist</Label>
        <span className="text-[10px] text-gray-500">{completedCount}/{items.length} completed</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-teal-600 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Items */}
      <div className="space-y-1.5">
        {items.map((item, index) => {
          const status = item.status || "pending";
          const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
          const StatusIcon = statusCfg.icon;
          const isExpanded = expanded[item.id];
          const itemSearch = search[item.id] || "";
          const filteredDocs = availableDocs.filter((d) =>
            !itemSearch || (d.file_name || "").toLowerCase().includes(itemSearch.toLowerCase())
          );

          return (
            <div key={item.id} className={cn("rounded-md border px-2 py-1.5 transition-colors", statusCfg.bgClass)}>
              {/* Header */}
              <div className="flex items-center gap-2">
                <StatusIcon className={cn("w-3.5 h-3.5 shrink-0", statusCfg.iconClass)} />
                <button type="button" onClick={() => toggleExpand(item.id)} className="text-gray-400 hover:text-gray-600 shrink-0">
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                <span className={cn("text-xs font-medium flex-1 truncate", status === "completed" ? "text-emerald-700" : "text-gray-700")}>
                  {index + 1}. {item.name || "Unnamed item"}
                </span>
                {item.document_name && (
                  <span className="text-[10px] text-gray-500 truncate max-w-[120px] flex items-center gap-0.5">
                    <FileText className="w-2.5 h-2.5" /> {item.document_name}
                  </span>
                )}
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0", statusCfg.badgeClass)}>
                  {statusCfg.label}
                </span>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="mt-2 space-y-2 pl-5 grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] lg:items-start lg:gap-x-3">
                  {/* Document attachment */}
                  <div className="space-y-1 min-w-0">
                    <Label className="text-[10px] text-gray-500">Attached Document</Label>
                    {item.document_id ? (
                      <div className="flex items-center gap-1.5 rounded border border-teal-200 bg-teal-50/50 px-2 py-1">
                        <FileText className="w-3 h-3 text-teal-600 shrink-0" />
                        <a href={item.document_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-teal-700 hover:underline truncate flex-1" title={item.document_name}>
                          {item.document_name}
                        </a>
                        <a href={item.document_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-teal-600">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] text-gray-500" onClick={() => handleClearDoc(item.id)}>
                          Change
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {/* Document search popover */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] w-full justify-between">
                              <span className="text-gray-400">Select from document list...</span>
                              <ChevronDown className="w-3 h-3 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[320px] p-0" align="start">
                            <div className="p-2 border-b">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                <Input
                                  placeholder="Search documents..."
                                  value={itemSearch}
                                  onChange={(e) => setSearch((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                  className="h-7 text-xs pl-7"
                                  autoFocus
                                />
                              </div>
                            </div>
                            <div className="max-h-40 overflow-y-auto py-1">
                              {filteredDocs.length === 0 ? (
                                <p className="px-3 py-2 text-xs text-gray-400 italic">No documents found</p>
                              ) : (
                                filteredDocs.map((doc) => (
                                  <button
                                    key={doc.id}
                                    type="button"
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 flex items-center gap-2"
                                    onClick={() => { handleAttachDoc(item.id, doc); setSearch((prev) => ({ ...prev, [item.id]: "" })); }}
                                  >
                                    <FileText className="w-3 h-3 text-gray-400 shrink-0" />
                                    <span className="truncate flex-1">{doc.file_name}</span>
                                    {doc.entry_date && <span className="text-[10px] text-gray-400">{doc.entry_date}</span>}
                                  </button>
                                ))
                              )}
                            </div>
                            <div className="border-t">
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2 text-xs text-teal-600 hover:bg-teal-50 flex items-center gap-1.5 font-medium"
                                onClick={() => setAddDocOpen(true)}
                              >
                                <Plus className="w-3 h-3" /> Add New Document
                              </button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </div>

                  {/* Add date + status */}
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-gray-500">Add Date</Label>
                    <DatePicker value={item.add_date || ""} onChange={(d) => updateItem(item.id, { add_date: d })} allowEmpty className="h-7 text-xs" />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-gray-500">Status</Label>
                    <Select value={item.status || "pending"} onValueChange={(v) => handleStatusChange(item.id, v)}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                        <SelectItem value="reviewed" className="text-xs">Reviewed</SelectItem>
                        <SelectItem value="completed" className="text-xs">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Rich text notes */}
                  <div className="lg:col-span-3">
                    <StageNotesEditor
                      value={item.notes || ""}
                      onChange={(html) => updateItem(item.id, { notes: html })}
                      label="Notes"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AddDocumentDialog open={addDocOpen} onOpenChange={setAddDocOpen} />
    </div>
  );
}