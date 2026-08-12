import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, RotateCcw, Search, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";

const ENTITY_TYPES = [
  { key: "firms", label: "Firms", entity: "Firm" },
  { key: "products", label: "Products", entity: "Product" },
  { key: "contacts", label: "Contacts", entity: "Contact" },
  { key: "portfolios", label: "Portfolios", entity: "Portfolio" },
];

const QUERY_KEYS = {
  firms: ["deletedFirms"],
  products: ["deletedProducts"],
  contacts: ["deletedContacts"],
  portfolios: ["deletedPortfolios"],
};

const getDisplayName = (record) => {
  if (record.name) return record.name;
  if (record.portfolio_name) return record.portfolio_name;
  if (record.first_name || record.last_name) {
    return `${record.first_name || ""} ${record.last_name || ""}`.trim();
  }
  return "Unknown";
};

export default function DeletedRecordsModal({ open, onOpenChange }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("firms");
  const [busyId, setBusyId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [busyBulk, setBusyBulk] = useState(false);
  const queryClient = useQueryClient();

  // Fetch soft-deleted records for each entity type (only when the modal is open)
  const { data: deletedFirms = [], isLoading: firmsLoading } = useQuery({
    queryKey: ["deletedFirms"],
    queryFn: () => base44.entities.Firm.filter({ deleted_at: { $exists: true } }),
    enabled: open,
  });
  const { data: deletedProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ["deletedProducts"],
    queryFn: () => base44.entities.Product.filter({ deleted_at: { $exists: true } }),
    enabled: open,
  });
  const { data: deletedContacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["deletedContacts"],
    queryFn: () => base44.entities.Contact.filter({ deleted_at: { $exists: true } }),
    enabled: open,
  });
  const { data: deletedPortfolios = [], isLoading: portfoliosLoading } = useQuery({
    queryKey: ["deletedPortfolios"],
    queryFn: () => base44.entities.Portfolio.filter({ deleted_at: { $exists: true } }),
    enabled: open,
  });

  const deletedRecords = {
    firms: deletedFirms,
    products: deletedProducts,
    contacts: deletedContacts,
    portfolios: deletedPortfolios,
  };

  const loadingMap = {
    firms: firmsLoading,
    products: productsLoading,
    contacts: contactsLoading,
    portfolios: portfoliosLoading,
  };

  const invalidateAll = () => {
    Object.values(QUERY_KEYS).forEach(([key]) => queryClient.invalidateQueries({ queryKey: key }));
    // Also refresh the active lists so restored records reappear / permanent deletes clear out
    queryClient.invalidateQueries({ queryKey: ["firms"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    queryClient.invalidateQueries({ queryKey: ["portfolios"] });
  };

  const handleRestore = async (record) => {
    const entity = ENTITY_TYPES.find((e) => e.key === activeTab)?.entity;
    if (!entity) return;
    setBusyId(record.id);
    try {
      await base44.entities[entity].update(record.id, { deleted_at: null });
      invalidateAll();
      toast({ title: "Record restored", description: `"${getDisplayName(record)}" is visible again.` });
    } catch (error) {
      toast({ title: "Restore failed", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handlePermanentlyDelete = async (record) => {
    const entity = ENTITY_TYPES.find((e) => e.key === activeTab)?.entity;
    if (!entity) return;
    if (!window.confirm(`Permanently delete "${getDisplayName(record)}"? This action cannot be undone.`)) return;
    setBusyId(record.id);
    try {
      await base44.entities[entity].delete(record.id);
      invalidateAll();
      toast({ title: "Record permanently deleted" });
    } catch (error) {
      toast({ title: "Delete failed", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const allSelected = records.length > 0 && records.every((r) => prev.has(r.id));
      if (allSelected) return new Set();
      return new Set(records.map((r) => r.id));
    });
  };

  const handleBulkRestore = async () => {
    const entity = ENTITY_TYPES.find((e) => e.key === activeTab)?.entity;
    if (!entity || selectedIds.size === 0) return;
    setBusyBulk(true);
    const ids = Array.from(selectedIds);
    let ok = 0, fail = 0;
    await Promise.all(ids.map(async (id) => {
      try {
        await base44.entities[entity].update(id, { deleted_at: null });
        ok++;
      } catch {
        fail++;
      }
    }));
    invalidateAll();
    setSelectedIds(new Set());
    setBusyBulk(false);
    toast({ title: `Restored ${ok} record${ok !== 1 ? "s" : ""}${fail ? `, ${fail} failed` : ""}` });
  };

  const handleBulkDelete = async () => {
    const entity = ENTITY_TYPES.find((e) => e.key === activeTab)?.entity;
    if (!entity || selectedIds.size === 0) return;
    if (!window.confirm(`Permanently delete ${selectedIds.size} record${selectedIds.size !== 1 ? "s" : ""}? This action cannot be undone.`)) return;
    setBusyBulk(true);
    const ids = Array.from(selectedIds);
    let ok = 0, fail = 0;
    await Promise.all(ids.map(async (id) => {
      try {
        await base44.entities[entity].delete(id);
        ok++;
      } catch {
        fail++;
      }
    }));
    invalidateAll();
    setSelectedIds(new Set());
    setBusyBulk(false);
    toast({ title: `Deleted ${ok} record${ok !== 1 ? "s" : ""}${fail ? `, ${fail} failed` : ""}` });
  };

  const getRecordsForTab = () => {
    const tab = ENTITY_TYPES.find((e) => e.key === activeTab);
    if (!tab || !deletedRecords[activeTab]) return [];
    const q = searchQuery.toLowerCase();
    return deletedRecords[activeTab].filter((record) =>
      getDisplayName(record).toLowerCase().includes(q)
    );
  };

  const records = getRecordsForTab();
  const isLoading = loadingMap[activeTab];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Deleted Records</DialogTitle>
          <p className="text-xs text-gray-500 -mt-1">
            View soft-deleted records. Restore to make them visible again, or permanently delete to remove them for everyone.
          </p>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedIds(new Set()); setSearchQuery(""); }} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            {ENTITY_TYPES.map((type) => (
              <TabsTrigger key={type.key} value={type.key}>
                {type.label}
                {deletedRecords[type.key]?.length ? ` (${deletedRecords[type.key].length})` : ""}
              </TabsTrigger>
            ))}
          </TabsList>

          {ENTITY_TYPES.map((type) => (
            <TabsContent key={type.key} value={type.key} className="space-y-3">
              {deletedRecords[type.key] && deletedRecords[type.key].length > 0 ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search deleted records..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-9"
                    />
                  </div>

                  {records.length > 0 && (
                    <div className="flex items-center justify-between gap-2 px-1">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={records.length > 0 && records.every((r) => selectedIds.has(r.id))}
                          onCheckedChange={toggleSelectAll}
                        />
                        <span className="text-sm text-gray-600">
                          {selectedIds.size > 0 ? `${selectedIds.size} selected` : `Select all (${records.length})`}
                        </span>
                      </div>
                      {selectedIds.size > 0 && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                            disabled={busyBulk}
                            onClick={handleBulkRestore}
                          >
                            {busyBulk ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                            Restore Selected
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                            disabled={busyBulk}
                            onClick={handleBulkDelete}
                          >
                            {busyBulk ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            Delete Selected
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8 text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    ) : records.length > 0 ? (
                      records.map((record) => {
                        const isSelected = selectedIds.has(record.id);
                        return (
                          <div
                            key={record.id}
                            className={`p-3 rounded-lg border flex items-center justify-between transition-colors ${isSelected ? "border-indigo-300 bg-indigo-50" : "border-gray-200 bg-gray-50 hover:bg-gray-100"}`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelect(record.id)}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm text-gray-900 truncate">
                                  {getDisplayName(record)}
                                </p>
                                {record.deleted_at && (
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    Deleted {new Date(record.deleted_at).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 ml-3">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                disabled={busyId === record.id || busyBulk}
                                onClick={() => handleRestore(record)}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Restore
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                                disabled={busyId === record.id || busyBulk}
                                onClick={() => handlePermanentlyDelete(record)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-sm text-gray-400 italic py-4 text-center">
                        No matching deleted records
                      </div>
                    )}
                  </div>
                </>
              ) : isLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : (
                <div className="text-sm text-gray-400 italic py-8 text-center border border-dashed border-gray-200 rounded-lg">
                  No deleted {type.label.toLowerCase()}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}