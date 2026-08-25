import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, Building, Tag } from "lucide-react";

// Context categories for why a firm was mentioned in a board meeting.
const MENTION_CONTEXTS = [
  "New Funding",
  "Redemption",
  "Capital Addition",
  "Termination",
  "Watch Status",
  "Performance Discussion",
  "Due Diligence Update",
  "Other",
];

// Dialog to tag a firm as mentioned in a board meeting. Adds an entry to
// the meeting's `mentions` array so the meeting shows up in the mentioned
// firm's Board Meetings tab.
export default function TagMentionedFirmDialog({ open, onClose, meeting, onTagged }) {
  const [search, setSearch] = useState("");
  const [selectedFirm, setSelectedFirm] = useState(null);
  const [context, setContext] = useState(MENTION_CONTEXTS[0]);
  const [contextNote, setContextNote] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: firms = [], isLoading } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-name", 5000),
    enabled: open,
  });

  const q = search.toLowerCase().trim();
  const filtered = useMemo(() => {
    return firms
      .filter((f) => !f.deleted_at && f.id !== meeting?.firm_id)
      .filter((f) => !q || (f.name || "").toLowerCase().includes(q))
      .slice(0, 50);
  }, [firms, q, meeting?.firm_id]);

  const handleSave = async () => {
    if (!selectedFirm || !meeting) return;
    setSaving(true);
    try {
      const existingMentions = meeting.mentions || [];
      // Avoid duplicate tags for the same firm
      if (existingMentions.some((m) => m.entity_id === selectedFirm.id)) {
        onClose();
        return;
      }
      const newMention = {
        id: crypto.randomUUID(),
        entity_name: selectedFirm.name,
        entity_type: "other",
        entity_id: selectedFirm.id,
        context: `${context}${contextNote.trim() ? ": " + contextNote.trim() : ""}`,
      };
      await base44.entities.BoardMeeting.update(meeting.id, {
        mentions: [...existingMentions, newMention],
        needs_review: true,
      });
      onTagged?.();
      // Reset
      setSelectedFirm(null);
      setContext(MENTION_CONTEXTS[0]);
      setContextNote("");
      setSearch("");
      onClose();
    } catch (err) {
      console.error("Failed to tag firm:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSelectedFirm(null);
    setContext(MENTION_CONTEXTS[0]);
    setContextNote("");
    setSearch("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Tag className="w-4 h-4 text-indigo-600" />
            Tag Mentioned Firm
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <p className="text-xs text-gray-500">
            Tag a firm mentioned in this meeting. It will appear in that firm's Board Meetings tab so they can see why they were mentioned.
          </p>

          {/* Firm search */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Firm</Label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search firms…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-8"
              />
            </div>
            {selectedFirm ? (
              <div className="flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 p-2">
                <Building className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-medium text-gray-800 flex-1">{selectedFirm.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedFirm(null)}
                  className="text-xs text-gray-400 hover:text-red-500"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded-md border border-gray-200">
                {isLoading ? (
                  <div className="p-2 text-xs text-gray-400 text-center">Loading…</div>
                ) : filtered.length === 0 ? (
                  <div className="p-2 text-xs text-gray-400 text-center">
                    {q ? "No firms found" : "Start typing to search"}
                  </div>
                ) : (
                  filtered.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSelectedFirm(f)}
                      className="w-full text-left px-2.5 py-1.5 text-sm hover:bg-indigo-50 border-b border-gray-100 last:border-0 flex items-center gap-2"
                    >
                      <Building className="w-3.5 h-3.5 text-gray-400" />
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Context */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Reason</Label>
            <Select value={context} onValueChange={setContext}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MENTION_CONTEXTS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Optional note */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Note (optional)</Label>
            <Input
              placeholder="Add context, e.g. 'approved $5M capital addition'…"
              value={contextNote}
              onChange={(e) => setContextNote(e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!selectedFirm || saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
            Tag Firm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}