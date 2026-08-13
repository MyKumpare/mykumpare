import React, { useState, useMemo } from "react";
import {
  Search, Trash2, Check, RefreshCw, AlertTriangle, Building2, User, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function OrphanedContactsCleanup({ onFirmClick }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [assigningId, setAssigningId] = useState(null);
  const [firmSearch, setFirmSearch] = useState("");
  const [batchFirmSearch, setBatchFirmSearch] = useState("");
  const [showBatchAssign, setShowBatchAssign] = useState(false);

  const { data: allContacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });

  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date"),
  });

  const firmMap = useMemo(
    () => Object.fromEntries((firms || []).map((f) => [f.id, f])),
    [firms]
  );

  // Orphaned contacts = no firm_ids or empty array
  const orphans = useMemo(() => {
    return (allContacts || []).filter(
      (c) => !c.firm_ids || c.firm_ids.length === 0
    );
  }, [allContacts]);

  const handleScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanned(true);
      setScanning(false);
      setSelectedIds(new Set());
    }, 600);
  };

  const toggle = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (orphans.every((o) => selectedIds.has(o.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orphans.map((o) => o.id)));
    }
  };

  const filteredFirms = useMemo(() => {
    const q = firmSearch.trim().toLowerCase();
    const batchQ = batchFirmSearch.trim().toLowerCase();
    const query = assigningId ? q : batchQ;
    if (!query) return firms;
    return (firms || []).filter((f) => (f.name || "").toLowerCase().includes(query));
  }, [firms, firmSearch, batchFirmSearch, assigningId]);

  const assignFirm = async (contactId, firmId) => {
    try {
      await base44.entities.Contact.update(contactId, {
        firm_ids: [firmId],
      });
      toast({
        title: "✅ Firm assigned",
        description: `${firmMap[firmId]?.name || "Firm"} linked to contact.`,
      });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setAssigningId(null);
      setFirmSearch("");
    } catch (err) {
      toast({
        title: "Failed to assign firm",
        description: err.message || "Could not update contact.",
        variant: "destructive",
      });
    }
  };

  const batchAssign = async (firmId) => {
    if (selectedIds.size === 0 || !firmId) return;
    setDeleting(true);
    let success = 0;
    let error = 0;
    for (const id of Array.from(selectedIds)) {
      try {
        await base44.entities.Contact.update(id, { firm_ids: [firmId] });
        success++;
      } catch {
        error++;
      }
    }
    toast({
      title: "Batch assign complete",
      description: `${success} contact(s) updated${error ? `, ${error} error(s)` : ""}.`,
    });
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    setSelectedIds(new Set());
    setShowBatchAssign(false);
    setBatchFirmSearch("");
    setDeleting(false);
  };

  const deleteContact = async (contact) => {
    const name = [contact.salutation, contact.first_name, contact.last_name]
      .filter(Boolean)
      .join(" ");
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
    try {
      await base44.entities.Contact.delete(contact.id);
      toast({ title: "Contact deleted", description: name });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err.message || "Could not delete contact.",
        variant: "destructive",
      });
    }
  };

  const batchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} contact(s)? This cannot be undone.`))
      return;
    setDeleting(true);
    let success = 0;
    let error = 0;
    for (const id of Array.from(selectedIds)) {
      try {
        await base44.entities.Contact.delete(id);
        success++;
      } catch {
        error++;
      }
    }
    toast({
      title: "Batch delete complete",
      description: `${success} deleted${error ? `, ${error} error(s)` : ""}.`,
    });
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    setSelectedIds(new Set());
    setDeleting(false);
  };

  const formatName = (c) =>
    [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix]
      .filter(Boolean)
      .join(" ");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-orange-600" />
        <p className="text-sm font-semibold text-gray-700">Orphaned Contacts</p>
      </div>
      <p className="text-xs text-gray-500">
        Contacts must be associated with at least one firm. Scan for contacts with no
        firm link, then assign a firm or delete them.
      </p>

      {!scanned && !scanning && (
        <div className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-dashed border-gray-200 bg-white text-center">
          <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
            <Search className="w-5 h-5 text-orange-600" />
          </div>
          <Button
            type="button"
            onClick={handleScan}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            Scan for Orphaned Contacts
          </Button>
        </div>
      )}

      {scanning && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Scanning contacts...
        </div>
      )}

      {scanned && !scanning && (
        <>
          {orphans.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-dashed border-green-200 bg-green-50 text-center">
              <Check className="w-6 h-6 text-green-600" />
              <p className="text-sm font-semibold text-green-700">
                No orphaned contacts found
              </p>
              <p className="text-xs text-green-600">
                All contacts have at least one associated firm.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleScan}
                className="mt-2 text-green-700 hover:bg-green-100"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Re-scan
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-800">{orphans.length}</span>{" "}
                  orphaned contact(s) found
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleScan}
                    className="text-gray-500 hover:bg-gray-100"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Re-scan
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowBatchAssign((v) => !v)}
                    disabled={selectedIds.size === 0}
                    className="gap-1"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    Assign to Selected ({selectedIds.size})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={batchDelete}
                    disabled={selectedIds.size === 0 || deleting}
                    className="bg-rose-600 hover:bg-rose-700 text-white gap-1"
                  >
                    {deleting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Delete ({selectedIds.size})
                  </Button>
                </div>
              </div>

              {showBatchAssign && selectedIds.size > 0 && (
                <div className="border rounded-lg overflow-hidden bg-white">
                  <div className="px-3 py-2 bg-indigo-50 border-b text-xs font-medium text-indigo-700">
                    Assign {selectedIds.size} contact(s) to a firm
                  </div>
                  <Input
                    autoFocus
                    placeholder="Search firms..."
                    value={batchFirmSearch}
                    onChange={(e) => setBatchFirmSearch(e.target.value)}
                    className="h-8 border-0 border-b rounded-none text-sm"
                  />
                  <div className="max-h-40 overflow-y-auto">
                    {filteredFirms.length === 0 ? (
                      <div className="text-xs text-gray-400 italic text-center py-3">
                        No firms found
                      </div>
                    ) : (
                      filteredFirms.slice(0, 20).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                          onClick={() => batchAssign(f.id)}
                        >
                          {f.name}
                          <span className="ml-1.5 text-xs text-gray-400">
                            {f.firm_type || (f.firm_types || []).join(", ")}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="border-t px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowBatchAssign(false);
                        setBatchFirmSearch("");
                      }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 px-1">
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                >
                  {orphans.every((o) => selectedIds.has(o.id))
                    ? "Unselect all"
                    : "Select all"}
                </button>
              </div>

              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {orphans.map((c) => {
                  const isSelected = selectedIds.has(c.id);
                  const isAssigning = assigningId === c.id;
                  return (
                    <div
                      key={c.id}
                      className={`flex items-start gap-2 p-3 rounded-lg border transition-colors ${
                        isSelected
                          ? "border-orange-300 bg-orange-50"
                          : "border-gray-100 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <button
                        onClick={() => toggle(c.id)}
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? "bg-orange-600 border-orange-600 text-white"
                            : "border-gray-300"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </button>
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {c.photo_url ? (
                          <img
                            src={c.photo_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">
                          {formatName(c)}
                        </p>
                        {c.email && (
                          <p className="text-xs text-gray-500 truncate">{c.email}</p>
                        )}
                        {c.title && (
                          <p className="text-xs text-gray-400 truncate">{c.title}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isAssigning ? (
                          <div className="border rounded-lg overflow-hidden w-48">
                            <Input
                              autoFocus
                              placeholder="Search firms..."
                              value={firmSearch}
                              onChange={(e) => setFirmSearch(e.target.value)}
                              className="h-7 border-0 border-b rounded-none text-xs"
                            />
                            <div className="max-h-32 overflow-y-auto">
                              {filteredFirms.length === 0 ? (
                                <div className="text-xs text-gray-400 italic text-center py-2">
                                  No firms
                                </div>
                              ) : (
                                filteredFirms.slice(0, 10).map((f) => (
                                  <button
                                    key={f.id}
                                    type="button"
                                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-indigo-50 hover:text-indigo-700"
                                    onClick={() => assignFirm(c.id, f.id)}
                                  >
                                    {f.name}
                                  </button>
                                ))
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setAssigningId(null);
                                setFirmSearch("");
                              }}
                              className="w-full border-t px-2 py-1 text-xs text-gray-400 hover:text-gray-600 text-left"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => setAssigningId(c.id)}
                            >
                              <Building2 className="w-3 h-3" />
                              Assign Firm
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-red-600 hover:bg-red-50"
                              onClick={() => deleteContact(c)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}