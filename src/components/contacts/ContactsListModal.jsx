import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, User, Building2 } from "lucide-react";

export default function ContactsListModal({ open, onOpenChange, contacts = [], firms = [] }) {
  const [firmSearch, setFirmSearch] = useState("");

  const getFirmName = (id) => firms.find((f) => f.id === id)?.name || "";

  const filtered = contacts.filter((c) => {
    if (!firmSearch.trim()) return true;
    return c.firm_ids?.some((fid) =>
      getFirmName(fid).toLowerCase().includes(firmSearch.toLowerCase())
    );
  });

  const sorted = [...filtered].sort((a, b) => a.last_name.localeCompare(b.last_name));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>All Contacts ({contacts.length})</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Filter by firm name..."
            value={firmSearch}
            onChange={(e) => setFirmSearch(e.target.value)}
            className="pl-10 h-9"
          />
        </div>

        <div className="overflow-y-auto flex-1 space-y-2 mt-1">
          {sorted.length === 0 ? (
            <div className="text-sm text-gray-400 italic text-center py-8">
              {firmSearch ? "No contacts found for this firm" : "No contacts yet"}
            </div>
          ) : (
            sorted.map((c) => (
              <div key={c.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    {c.first_name} {c.last_name}
                  </div>
                  {c.title && <div className="text-xs text-gray-500">{c.title}</div>}
                  {c.email && <div className="text-xs text-indigo-600">{c.email}</div>}
                  {c.firm_ids?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.firm_ids.map((fid) => (
                        <span key={fid} className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">
                          {getFirmName(fid)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}