import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Users, Trash2, X, Search, ArrowRight, User, Building2, Sparkles,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const RELATIONSHIP_TYPES = [
  "Mentor", "Mentee", "Former Colleague", "Client", "Service Provider",
  "Business Partner", "Referral Source", "Friend", "Family Member", "Other",
];

const TYPE_STYLES = {
  Mentor: "bg-amber-50 text-amber-700 border-amber-200",
  Mentee: "bg-teal-50 text-teal-700 border-teal-200",
  "Former Colleague": "bg-blue-50 text-blue-700 border-blue-200",
  Client: "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Service Provider": "bg-cyan-50 text-cyan-700 border-cyan-200",
  "Business Partner": "bg-purple-50 text-purple-700 border-purple-200",
  "Referral Source": "bg-rose-50 text-rose-700 border-rose-200",
  Friend: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Family Member": "bg-pink-50 text-pink-700 border-pink-200",
  Other: "bg-gray-50 text-gray-600 border-gray-200",
};

function fullName(c) {
  return [c?.salutation, c?.first_name, c?.middle_name, c?.last_name, c?.suffix]
    .filter(Boolean).join(" ").trim() || [c?.first_name, c?.last_name].filter(Boolean).join(" ");
}

// ContactRelationshipsTab — visualize and manage this contact's relationships
// with other contacts. Each relationship has a type (Mentor, Former Colleague,
// Client, etc.) and optional notes. Relationships are bidirectional: one record
// per pair, surfaced on both contacts' profiles.
export default function ContactRelationshipsTab({ contactId, contactName, onContactClick }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);
  const [relType, setRelType] = useState("Former Colleague");
  const [notes, setNotes] = useState("");

  // Fetch all relationships involving this contact (either side).
  const { data: allRelationships = [], isLoading } = useQuery({
    queryKey: ["contact_relationships", contactId],
    queryFn: async () => {
      const asA = await base44.entities.ContactRelationship.filter({ contact_a_id: contactId }, "-created_date", 500);
      const asB = await base44.entities.ContactRelationship.filter({ contact_b_id: contactId }, "-created_date", 500);
      // Deduplicate by id in case a record is returned by both queries.
      const seen = new Set();
      const merged = [...(asA || []), ...(asB || [])].filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id); return true;
      });
      return merged;
    },
    enabled: !!contactId,
  });

  // Fetch all contacts to resolve the "other side" of each relationship.
  const { data: allContacts = [] } = useQuery({
    queryKey: ["all_contacts_for_relationships"],
    queryFn: () => base44.entities.Contact.list(),
  });

  const { data: allFirms = [] } = useQuery({
    queryKey: ["all_firms_for_relationships"],
    queryFn: () => base44.entities.Firm.list(),
  });

  const firmNameFor = useMemo(() => {
    const map = {};
    allFirms.forEach((f) => { map[f.id] = f.name; });
    return map;
  }, [allFirms]);

  // For each relationship, resolve the "other" contact (the one that isn't this contact).
  const relationships = useMemo(() => {
    return allRelationships.map((r) => {
      const isA = r.contact_a_id === contactId;
      const otherId = isA ? r.contact_b_id : r.contact_a_id;
      const otherName = isA ? r.contact_b_name : r.contact_a_name;
      const other = allContacts.find((c) => c.id === otherId);
      const otherFirmId = other?.firm_ids?.[0];
      return {
        ...r,
        other_id: otherId,
        other_name: otherName || (other ? fullName(other) : "Unknown"),
        other_contact: other,
        other_firm_name: otherFirmId ? firmNameFor[otherFirmId] : null,
        other_decision_role: other?.decision_role,
      };
    });
  }, [allRelationships, allContacts, contactId, firmNameFor]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedContact || selectedContact.id === contactId) {
        throw new Error("Select a different contact to link.");
      }
      // Prevent duplicate pairs (either direction).
      const dup = relationships.find(
        (r) => r.other_id === selectedContact.id
      );
      if (dup) throw new Error("These contacts are already linked.");
      return base44.entities.ContactRelationship.create({
        contact_a_id: contactId,
        contact_a_name: contactName,
        contact_b_id: selectedContact.id,
        contact_b_name: fullName(selectedContact),
        relationship_type: relType,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact_relationships", contactId] });
      queryClient.invalidateQueries({ queryKey: ["contact_relationships", selectedContact?.id] });
      toast({ title: "Relationship linked" });
      setShowForm(false);
      setSelectedContact(null);
      setSearch("");
      setRelType("Former Colleague");
      setNotes("");
    },
    onError: (e) => toast({ title: "Could not link", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => base44.entities.ContactRelationship.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact_relationships", contactId] });
      toast({ title: "Relationship removed" });
    },
  });

  const filteredContacts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allContacts
      .filter((c) => !c.deleted_at && c.id !== contactId && (c.contact_status || "Active") === "Active")
      .filter((c) => !q || fullName(c).toLowerCase().includes(q) || (c.title || "").toLowerCase().includes(q))
      .slice(0, 50);
  }, [allContacts, contactId, search]);

  if (!contactId) {
    return (
      <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-xl">
        Save the contact first to manage relationships
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-gray-700">Relationships</span>
          {relationships.length > 0 && (
            <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-200 px-1.5 py-0.5 rounded-full font-medium">
              {relationships.length}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="w-3.5 h-3.5" /> Link a Contact
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-700">Link a Relationship</span>
            <button type="button" onClick={() => setShowForm(false)}><X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" /></button>
          </div>

          {/* Contact picker */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Connect to *</Label>
            {selectedContact ? (
              <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-2.5 py-2">
                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-800 truncate">{fullName(selectedContact)}</div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {selectedContact.title || ""}{selectedContact.title ? " · " : ""}
                    {selectedContact.firm_ids?.[0] ? firmNameFor[selectedContact.firm_ids[0]] : ""}
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedContact(null)} className="text-gray-300 hover:text-red-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden bg-white">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    autoFocus
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search contacts by name or title..."
                    className="w-full h-8 pl-8 pr-2 text-xs border-0 border-b rounded-none outline-none focus:ring-0 bg-gray-50"
                  />
                </div>
                <div className="max-h-44 overflow-y-auto">
                  {filteredContacts.length === 0 ? (
                    <p className="text-xs text-gray-400 italic text-center py-3">No contacts found</p>
                  ) : (
                    filteredContacts.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setSelectedContact(c); setSearch(""); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center gap-2"
                      >
                        <User className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <span className="flex-1 min-w-0">
                          <span className="font-medium text-gray-800">{fullName(c)}</span>
                          {c.title && <span className="text-gray-400"> · {c.title}</span>}
                        </span>
                        {c.firm_ids?.[0] && (
                          <span className="text-[10px] text-gray-400 flex items-center gap-0.5 flex-shrink-0">
                            <Building2 className="w-2.5 h-2.5" /> {firmNameFor[c.firm_ids[0]]}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Relationship type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Relationship Type *</Label>
            <Select value={relType} onValueChange={setRelType}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Notes</Label>
            <Textarea
              placeholder="Context about this relationship..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-12 text-xs"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={!selectedContact || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Linking..." : "Link Relationship"}
            </Button>
          </div>
        </div>
      )}

      {/* Relationship list */}
      {isLoading ? (
        <div className="text-xs text-gray-400 italic py-4 text-center">Loading...</div>
      ) : relationships.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl flex flex-col items-center gap-2">
          <Sparkles className="w-5 h-5 text-gray-300" />
          No relationships linked yet. Click "Link a Contact" to connect this contact with a mentor, colleague, or client.
        </div>
      ) : (
        <div className="space-y-2">
          {relationships.map((r) => {
            const style = TYPE_STYLES[r.relationship_type] || TYPE_STYLES.Other;
            return (
              <div key={r.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center flex-shrink-0 border border-indigo-100">
                    <User className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => onContactClick?.(r.other_contact)}
                      className="text-sm font-semibold text-gray-800 hover:text-indigo-700 hover:underline text-left truncate block"
                    >
                      {r.other_name}
                    </button>
                    <div className="text-[10px] text-gray-500 truncate flex items-center gap-1">
                      {r.other_firm_name && (
                        <span className="flex items-center gap-0.5">
                          <Building2 className="w-2.5 h-2.5" /> {r.other_firm_name}
                        </span>
                      )}
                      {r.other_decision_role && (
                        <span className="text-gray-400">· {r.other_decision_role}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${style}`}>
                      {r.relationship_type}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(r.id)}
                      className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors"
                      title="Remove relationship"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {r.notes && (
                  <p className="text-xs text-gray-600 mt-2 pl-10 whitespace-pre-wrap">{r.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {relationships.length > 0 && (
        <p className="text-[10px] text-gray-400 px-1">
          <ArrowRight className="w-3 h-3 inline mr-1" />
          Relationships are bidirectional — they appear on both contacts' profiles.
        </p>
      )}
    </div>
  );
}