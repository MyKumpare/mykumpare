import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { X, ClipboardList, Calendar, Tag, Building2, User, FileText, Trash2, ExternalLink, Pencil } from "lucide-react";
import { format } from "date-fns";

const ACTIVITY_TYPE_COLORS = {
  Call: "bg-blue-50 text-blue-700 border-blue-200",
  Email: "bg-purple-50 text-purple-700 border-purple-200",
  Meeting: "bg-green-50 text-green-700 border-green-200",
  Note: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Other: "bg-gray-50 text-gray-600 border-gray-200",
};

const ACTIVITY_TYPES = ["Call", "Email", "Meeting", "Note", "Other"];

function fmt(dateStr) {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr + "T00:00:00"), "MMMM d, yyyy"); } catch { return dateStr; }
}

export default function ActivityDetailModal({ open, activity, onClose, onOpenContact, onDeleted }) {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => {
    if (activity) {
      setForm({
        activity_type: activity.activity_type || "Call",
        activity_date: activity.activity_date || "",
        subject: activity.subject || "",
        notes: activity.notes || "",
        associated_firms_contacts: activity.associated_firms_contacts || [],
      });
      setEditing(false);
      setConfirmDelete(false);
    }
  }, [activity]);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ContactActivity.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact_activities"] });
      queryClient.invalidateQueries({ queryKey: ["all_activities_for_firm"] });
      queryClient.invalidateQueries({ queryKey: ["all_activities"] });
      onClose();
      if (onDeleted) onDeleted();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.ContactActivity.update(activity.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact_activities"] });
      queryClient.invalidateQueries({ queryKey: ["all_activities_for_firm"] });
      queryClient.invalidateQueries({ queryKey: ["all_activities"] });
      setEditing(false);
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list(),
    enabled: open && !!activity,
  });

  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list(),
    enabled: open && !!activity,
  });

  if (!open || !activity) return null;

  const contact = contacts.find(c => c.id === activity.contact_id);
  const contactName = contact
    ? [contact.salutation, contact.first_name, contact.last_name].filter(Boolean).join(" ")
    : "Unknown Contact";

  const colorClass = ACTIVITY_TYPE_COLORS[form.activity_type] || ACTIVITY_TYPE_COLORS.Other;

  const firmMap = {};
  firms.forEach(f => { firmMap[f.id] = f; });

  const primaryFirmId = (contact?.firm_ids || [])[0];
  const primaryFirm = primaryFirmId ? firmMap[primaryFirmId] : null;

  const handleSave = () => {
    updateMutation.mutate(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-amber-600" />
            {editing ? "Edit Activity" : "Activity Detail"}
          </h2>
          <button type="button" onClick={onClose}>
            <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {editing ? (
            <>
              {/* Type */}
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Activity Type</label>
                <div className="flex flex-wrap gap-2">
                  {ACTIVITY_TYPES.map(t => (
                    <button key={t} type="button"
                      onClick={() => setForm(f => ({ ...f, activity_type: t }))}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${form.activity_type === t ? ACTIVITY_TYPE_COLORS[t] : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Date</label>
                <input type="date" value={form.activity_date}
                  onChange={e => setForm(f => ({ ...f, activity_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300" />
              </div>

              {/* Subject */}
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Subject</label>
                <input type="text" value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="Subject..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300" />
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Notes</label>
                <textarea value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={4} placeholder="Notes..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gray-300" />
              </div>

              {/* Associated Firms & Contacts (read-only in edit mode) */}
              {form.associated_firms_contacts?.length > 0 && (
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-2">Associated Firms & Contacts</label>
                  <div className="space-y-2">
                    {form.associated_firms_contacts.map((entry, i) => (
                      <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 mb-1">
                          <Building2 className="w-3 h-3 text-indigo-400" /> {entry.firm_name}
                        </p>
                        {entry.contacts?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pl-4">
                            {entry.contacts.map((c, j) => (
                              <span key={j} className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full">
                                <User className="w-2.5 h-2.5" /> {c.contact_name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Type + Date */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${colorClass}`}>
                  <Tag className="w-3 h-3" />
                  {activity.activity_type}
                </span>
                <span className="text-sm text-gray-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {fmt(activity.activity_date)}
                </span>
              </div>

              {/* Subject */}
              {activity.subject && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Subject</p>
                  <p className="text-base font-semibold text-gray-800">{activity.subject}</p>
                </div>
              )}

              {/* Contact + Firm */}
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Originator</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700 flex-shrink-0">
                    {(contact?.first_name || "?")[0]}{(contact?.last_name || "")[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">{contactName}</p>
                    {contact?.title && <p className="text-xs text-gray-400 truncate">{contact.title}</p>}
                  </div>
                  {onOpenContact && contact && (
                    <button
                      type="button"
                      onClick={() => onOpenContact(contact, () => {})}
                      className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium whitespace-nowrap"
                    >
                      <ExternalLink className="w-3 h-3" /> View Contact
                    </button>
                  )}
                </div>
                {primaryFirm && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 pl-10">
                    <Building2 className="w-3 h-3 text-indigo-400" />
                    {primaryFirm.name}
                  </div>
                )}
              </div>

              {/* Notes */}
              {activity.notes && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Notes
                  </p>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{activity.notes}</p>
                  </div>
                </div>
              )}

              {/* Associated Firms & Contacts */}
              {activity.associated_firms_contacts?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> Associated Firms & Contacts
                  </p>
                  <div className="space-y-2">
                    {activity.associated_firms_contacts.map((entry, i) => (
                      <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 mb-1">
                          <Building2 className="w-3 h-3 text-indigo-400" /> {entry.firm_name}
                        </p>
                        {entry.contacts?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pl-4">
                            {entry.contacts.map((c, j) => (
                              <span key={j} className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full">
                                <User className="w-2.5 h-2.5" /> {c.contact_name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-2">
          {editing ? (
            <>
              <button type="button" onClick={() => setEditing(false)}
                className="h-9 px-4 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleSave} disabled={updateMutation.isPending}
                className="flex-1 h-9 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50">
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </>
          ) : confirmDelete ? (
            <>
              <span className="text-xs text-red-600 font-medium flex-1">Delete this activity?</span>
              <button type="button" onClick={() => setConfirmDelete(false)}
                className="h-8 px-3 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={() => deleteMutation.mutate(activity.id)}
                disabled={deleteMutation.isPending}
                className="h-8 px-3 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors disabled:opacity-50">
                {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setConfirmDelete(true)}
                className="h-8 px-3 rounded-lg border border-red-200 text-xs text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
              <button type="button" onClick={() => setEditing(true)}
                className="h-8 px-3 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
              <button type="button" onClick={onClose}
                className="flex-1 h-9 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}