import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, parseISO, isValid } from "date-fns";
import {
  StickyNote, History, Phone, Mail, Users, FileText,
  MoreHorizontal, Clock, ChevronRight, Loader2, Save, Pencil, Check,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const ACTIVITY_ICONS = {
  Call: { icon: Phone, color: "text-blue-600", bg: "bg-blue-100" },
  Email: { icon: Mail, color: "text-green-600", bg: "bg-green-100" },
  Meeting: { icon: Users, color: "text-purple-600", bg: "bg-purple-100" },
  Note: { icon: FileText, color: "text-amber-600", bg: "bg-amber-100" },
  Other: { icon: MoreHorizontal, color: "text-gray-500", bg: "bg-gray-100" },
};

function parseDate(str) {
  if (!str) return null;
  const d = parseISO(str);
  return isValid(d) ? d : null;
}

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * Combined "Quick Notes & Recent Interactions" panel for the contact profile.
 *
 * Shows:
 *  - An inline-editable quick notes area (bound to the Contact `notes` field)
 *  - The 3 most recent interaction activities for this contact
 *  - A "View all" link that switches to the Activities/Timeline tab
 *
 * Props:
 *   contactId      — the saved contact's id (null for unsaved contacts)
 *   notes          — current notes value (from parent state)
 *   onNotesChange  — callback when notes text changes (edit mode)
 *   onViewAll     — callback to switch to the full activities/timeline tab
 *   readOnly       — true when the dialog is in view mode (no inline editing)
 */
export default function ContactQuickNotesPanel({ contactId, notes, onNotesChange, onViewAll, readOnly = false }) {
  const queryClient = useQueryClient();
  const [editingNotes, setEditingNotes] = useState(false);
  const [draftNotes, setDraftNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["contact_activities", contactId],
    queryFn: () => base44.entities.ContactActivity.filter({ contact_id: contactId }, "-activity_date", 5),
    enabled: !!contactId,
  });

  const recent = useMemo(() => {
    const items = activities.map((a) => ({
      id: a.id,
      date: a.activity_date,
      type: a.activity_type || "Activity",
      subject: a.subjects?.length ? a.subjects.join(", ") : a.subject || null,
      notes: a.notes,
      iconCfg: ACTIVITY_ICONS[a.activity_type] || ACTIVITY_ICONS.Other,
    }));
    items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return items.slice(0, 3);
  }, [activities]);

  const startEdit = () => {
    setDraftNotes(notes || "");
    setEditingNotes(true);
  };

  const cancelEdit = () => {
    setEditingNotes(false);
    setDraftNotes("");
  };

  const saveNotes = async () => {
    if (!contactId) {
      // For unsaved contacts, just push to parent state
      onNotesChange?.(draftNotes);
      setEditingNotes(false);
      return;
    }
    setSaving(true);
    try {
      await base44.entities.Contact.update(contactId, { notes: draftNotes });
      onNotesChange?.(draftNotes);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setEditingNotes(false);
      toast({ title: "Notes saved", description: "Quick notes updated." });
    } catch (err) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <StickyNote className="w-4 h-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-gray-800">Quick Notes & Recent Interactions</h3>
      </div>

      {/* Quick Notes */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Quick Notes</Label>
          {readOnly && !editingNotes && contactId && (
            <button
              type="button"
              onClick={startEdit}
              className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
          )}
        </div>

        {!readOnly && !editingNotes ? (
          // Edit mode in the dialog — bound to parent state
          <textarea
            placeholder="Jot down quick notes about your conversations with this contact..."
            value={notes || ""}
            onChange={(e) => onNotesChange?.(e.target.value)}
            className="w-full min-h-20 text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 bg-white"
          />
        ) : editingNotes ? (
          // Inline edit from view mode
          <div className="space-y-2">
            <textarea
              autoFocus
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              className="w-full min-h-20 text-sm border border-indigo-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 bg-white"
              placeholder="Jot down quick notes about your conversations with this contact..."
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={saveNotes}
                disabled={saving}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md flex items-center gap-1 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-md border border-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          // View mode — display notes
          <div
            className="text-sm text-gray-800 bg-white rounded-lg border border-gray-200 px-3 py-2 min-h-20 whitespace-pre-wrap cursor-pointer hover:border-indigo-200 transition-colors"
            onClick={contactId ? startEdit : undefined}
          >
            {notes && notes.trim() ? notes : <span className="text-gray-400 italic">No quick notes yet — click to add notes about your conversations.</span>}
          </div>
        )}
      </div>

      {/* Recent Interactions */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <History className="w-3 h-3" /> Recent Interactions
          </Label>
          {onViewAll && (recent.length > 0 || isLoading) && (
            <button
              type="button"
              onClick={onViewAll}
              className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
            >
              View all <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {!contactId ? (
          <div className="text-xs text-gray-400 italic py-3 text-center border border-dashed border-gray-200 rounded-lg">
            Save the contact first to see interaction history
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-3 text-xs text-gray-400 gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </div>
        ) : recent.length === 0 ? (
          <div className="text-xs text-gray-400 italic py-3 text-center border border-dashed border-gray-200 rounded-lg">
            No interactions logged yet
          </div>
        ) : (
          <div className="space-y-1.5">
            {recent.map((item) => {
              const { icon: Icon, color, bg } = item.iconCfg;
              const dateObj = parseDate(item.date);
              const noteText = stripHtml(item.notes);
              return (
                <div key={item.id} className="flex gap-2 items-start bg-white rounded-lg border border-gray-200 px-2.5 py-2">
                  <div className={`w-6 h-6 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-3 h-3 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-xs font-semibold ${color}`}>{item.type}</span>
                      {item.subject && <span className="text-xs text-gray-500 truncate">· {item.subject}</span>}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5 text-gray-400" />
                      <span className="text-[10px] text-gray-400">
                        {dateObj ? format(dateObj, "MMM d, yyyy") : "—"}
                      </span>
                    </div>
                    {noteText && (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{noteText}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Label({ className, children }) {
  return <label className={className}>{children}</label>;
}