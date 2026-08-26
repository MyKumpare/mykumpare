import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Phone, Users, Mail, FileText, Plus, X, Loader2, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

const QUICK_TYPES = [
  { value: "Call", icon: Phone, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", activeBg: "bg-blue-600" },
  { value: "Meeting", icon: Users, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200", activeBg: "bg-purple-600" },
  { value: "Email", icon: Mail, color: "text-green-600", bg: "bg-green-50", border: "border-green-200", activeBg: "bg-green-600" },
  { value: "Note", icon: FileText, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", activeBg: "bg-amber-600" },
];

/**
 * QuickActivityLogFab — a floating action button shown on the contact profile
 * (view mode) that opens a compact popover to log a Call, Meeting, Email, or
 * Note in seconds, without opening the full activity log form. The contact is
 * pre-filled as the originator; the activity is saved directly to the
 * ContactActivity entity.
 */
export default function QuickActivityLogFab({ contact, firms = [], onSaved }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [activityType, setActivityType] = useState("Call");
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split("T")[0]);
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  if (!contact) return null;

  const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
  const contactFirmId = (contact.firm_ids || [])[0];
  const contactFirm = firms.find((f) => f.id === contactFirmId);
  const contactFirmName = contactFirm?.name || "";
  const firmTypes = contactFirm?.firm_types?.length
    ? contactFirm.firm_types
    : contactFirm?.firm_type
    ? [contactFirm.firm_type]
    : [];
  const firmType = firmTypes.length === 1 ? firmTypes[0] : null;

  const handleSave = async () => {
    if (!activityType || !activityDate) return;
    setSaving(true);
    try {
      await base44.entities.ContactActivity.create({
        contact_id: contact.id,
        activity_type: activityType,
        activity_date: activityDate,
        subjects: subject.trim() ? [subject.trim()] : [],
        notes: notes.trim(),
        associated_firms_contacts: contactFirmId
          ? [{ firm_id: contactFirmId, firm_name: contactFirmName, contacts: [{ contact_id: contact.id, contact_name: contactName }] }]
          : [],
        firm_type: firmType || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["contact_activities", contact.id] });
      queryClient.invalidateQueries({ queryKey: ["all_activities_for_firm", contactFirmId] });
      toast({ title: "✅ Activity logged", description: `${activityType} with ${contactName}` });
      // Reset form
      setActivityType("Call");
      setActivityDate(new Date().toISOString().split("T")[0]);
      setSubject("");
      setNotes("");
      setOpen(false);
      if (onSaved) onSaved();
    } catch (err) {
      toast({ title: "Could not save activity", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Floating Action Button — fixed to the dialog's bottom-right corner */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="absolute bottom-4 right-4 z-30 w-12 h-12 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center group"
        title="Quick log a call or meeting"
      >
        {open ? <X className="w-5 h-5" /> : <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform" />}
      </button>

      {/* Quick-log popover */}
      {open && (
        <div className="absolute bottom-20 right-4 z-30 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-500" /> Quick Log
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">{contactName}{contactFirmName ? ` · ${contactFirmName}` : ""}</p>
          </div>

          {/* Body */}
          <div className="p-3 space-y-3">
            {/* Activity type pills */}
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Type</p>
              <div className="grid grid-cols-4 gap-1.5">
                {QUICK_TYPES.map((t) => {
                  const Icon = t.icon;
                  const selected = activityType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setActivityType(t.value)}
                      className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-[10px] font-medium transition-all ${
                        selected
                          ? `${t.activeBg} text-white border-transparent shadow-sm`
                          : `${t.bg} ${t.color} ${t.border} hover:shadow-sm`
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {t.value}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date */}
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Date</p>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="date"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  className="h-8 text-xs pl-8"
                />
              </div>
            </div>

            {/* Subject */}
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Subject</p>
              <Input
                placeholder="Brief subject (optional)..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            {/* Notes */}
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
              <Textarea
                placeholder="What happened? (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-16 text-xs resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-3 py-2.5 border-t border-gray-100 flex gap-2 justify-end bg-gray-50/50">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs bg-primary hover:bg-primary/90 text-white"
              disabled={!activityType || !activityDate || saving}
              onClick={handleSave}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              {saving ? "Saving..." : "Log Activity"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}