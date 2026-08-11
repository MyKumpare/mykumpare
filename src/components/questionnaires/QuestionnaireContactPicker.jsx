import React, { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronDown, Search, Check, Plus, User, Loader2, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";
import { findContactDuplicates } from "@/components/contacts/contactDuplicateCheck";

const CONTACT_TYPE_OPTIONS = [
  "Allocator",
  "Investment Consultant",
  "Investment Manager",
  "Securities Broker",
  "Trade Organization Representative",
];

function parseName(searchStr) {
  const parts = searchStr.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "", last_name: "" };
  if (parts.length === 1) return { first_name: "", last_name: parts[0] };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

function contactLabel(c) {
  return `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.email || "Unknown";
}

/**
 * Contact picker for the Send Questionnaire dialog.
 * - Filter by contact type
 * - Alphabetical sort
 * - Add a new contact inline when search returns no match
 * - Duplicate validation: match/near-match must be accepted/rejected before adding
 */
export default function QuestionnaireContactPicker({
  value,
  onChange,
  contacts = [],
  firmId,
  user,
  placeholder = "Select a contact...",
  emptyText = "No contacts found.",
  disabled = false,
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState(null); // { newContact, matches }
  const prevFirmIdRef = useRef(firmId);

  // Auto-open the picker when a firm is selected, so the contact list is
  // immediately visible without requiring an extra click.
  useEffect(() => {
    if (firmId && !prevFirmIdRef.current && !disabled) {
      setOpen(true);
    }
    prevFirmIdRef.current = firmId;
  }, [firmId, disabled]);

  // Contacts belonging to the selected firm
  const firmContacts = useMemo(
    () => contacts.filter((c) => !c.deleted_at && c.firm_ids?.includes(firmId)),
    [contacts, firmId]
  );

  const sorted = useMemo(
    () => [...firmContacts].sort((a, b) => contactLabel(a).localeCompare(contactLabel(b))),
    [firmContacts]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return sorted.filter((c) => {
      if (typeFilter !== "all" && c.contact_type !== typeFilter) return false;
      if (!q) return true;
      return contactLabel(c).toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q);
    });
  }, [sorted, search, typeFilter]);

  const selectedLabel = value
    ? contactLabel(firmContacts.find((c) => c.id === value) || { first_name: "", last_name: "" })
    : placeholder;

  const canAddNew = search.trim().length > 0 && filtered.length === 0 && !adding && !duplicateMatches;

  const startAddNew = () => {
    const parsed = parseName(search.trim());
    if (!parsed.first_name || !parsed.last_name) {
      toast({ title: "Enter a full name", description: "Type both a first and last name to add a new contact.", variant: "destructive" });
      return;
    }
    // Check against ALL contacts (not just this firm's) so duplicates at
    // other firms are caught and surfaced for user review.
    const matches = findContactDuplicates(parsed, contacts);
    if (matches.length > 0) {
      setDuplicateMatches({ newContact: parsed, matches });
      return;
    }
    confirmAddNew(parsed);
  };

  const confirmAddNew = async (parsed) => {
    setAdding(true);
    try {
      const created = await base44.entities.Contact.create({
        ...parsed,
        firm_ids: firmId ? [firmId] : [],
        tenant_id: user?.linked_firm_id,
      });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: "Contact created", description: `${parsed.first_name} ${parsed.last_name} was added.` });
      onChange(created.id, created);
      setOpen(false);
      setSearch("");
      setDuplicateMatches(null);
    } catch (err) {
      toast({ title: "Failed to create contact", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const acceptDuplicate = () => {
    if (duplicateMatches) confirmAddNew(duplicateMatches.newContact);
  };

  const rejectDuplicate = () => {
    setDuplicateMatches(null);
  };

  return (
    <Popover open={open && !disabled} onOpenChange={(o) => { setOpen(o); if (!o) { setSearch(""); setDuplicateMatches(null); } }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="w-full justify-between font-normal"
          onClick={() => setOpen(!open)}
        >
          <span className={value ? "text-gray-900" : "text-gray-400"}>{selectedLabel}</span>
          <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0" align="start">
        {/* Contact type filter */}
        <div className="p-2 border-b">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All contact types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All contact types</SelectItem>
              {CONTACT_TYPE_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Search */}
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              autoFocus
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setDuplicateMatches(null); }}
              className="pl-8 h-8"
            />
          </div>
        </div>

        {/* Duplicate review prompt */}
        {duplicateMatches && (
          <div className="p-3 border-b bg-amber-50 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <p className="font-medium mb-1">Possible duplicate contact</p>
                <p>“{duplicateMatches.newContact.first_name} {duplicateMatches.newContact.last_name}” may already exist:</p>
              </div>
            </div>
            <div className="max-h-[120px] overflow-y-auto space-y-1">
              {duplicateMatches.matches.map((m) => (
                <div key={m.contact.id} className="rounded border border-amber-200 bg-white px-2 py-1.5 text-xs">
                  <div className="font-medium text-gray-800">{m.name}</div>
                  {m.email && <div className="text-gray-500">{m.email}</div>}
                  <ul className="mt-0.5 list-disc list-inside text-gray-500">
                    {m.reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={rejectDuplicate} className="flex-1">
                Reject
              </Button>
              <Button type="button" size="sm" onClick={acceptDuplicate} className="flex-1">
                Accept & Add
              </Button>
            </div>
          </div>
        )}

        {/* List */}
        {!duplicateMatches && (
          <div className="max-h-[200px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-400">
                {search.trim() ? "No contacts match your search." : emptyText}
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onChange(c.id, c); setOpen(false); setSearch(""); }}
                  className="flex items-center justify-between w-full px-3 py-1.5 text-sm hover:bg-gray-50 text-left"
                >
                  <span className="truncate">{contactLabel(c)}</span>
                  {value === c.id && <Check className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 ml-2" />}
                </button>
              ))
            )}
          </div>
        )}

        {/* Add new */}
        {canAddNew && !duplicateMatches && (
          <div className="border-t p-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full justify-start text-indigo-600"
              onClick={startAddNew}
              disabled={adding}
            >
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {adding ? "Creating..." : `Add new contact: "${search.trim()}"`}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}