import React, { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Building2, X } from "lucide-react";

export default function ContactsBulkAssignFirmDialog({
  open,
  onOpenChange,
  firms = [],
  selectedCount,
  onAssign,
  busy,
}) {
  const [search, setSearch] = useState("");
  const [selectedFirm, setSelectedFirm] = useState(null);

  const filteredFirms = useMemo(() => {
    const q = search.toLowerCase().trim();
    return firms
      .filter((f) => !f.deleted_at)
      .filter((f) => !q || (f.name || "").toLowerCase().includes(q))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [firms, search]);

  const handleAssign = () => {
    if (!selectedFirm || !onAssign) return;
    onAssign(selectedFirm);
  };

  const handleClose = (v) => {
    if (!v) {
      setSearch("");
      setSelectedFirm(null);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            Assign {selectedCount} contact{selectedCount > 1 ? "s" : ""} to a firm
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500">
          The selected firm will be added to each contact's firm list. Contacts already linked to this firm will remain unchanged.
        </p>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search firms…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg mt-2">
          {filteredFirms.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No firms found</p>
          ) : (
            filteredFirms.map((firm) => (
              <button
                key={firm.id}
                type="button"
                onClick={() => setSelectedFirm(firm)}
                className={`w-full text-left px-3 py-2 text-sm border-b border-gray-100 last:border-0 transition-colors ${
                  selectedFirm?.id === firm.id
                    ? "bg-indigo-50 text-indigo-700 font-medium"
                    : "hover:bg-gray-50"
                }`}
              >
                {firm.name}
              </button>
            ))
          )}
        </div>
        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={!selectedFirm || busy}>
            {busy ? "Assigning…" : "Assign to " + (selectedFirm?.name || "Firm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}