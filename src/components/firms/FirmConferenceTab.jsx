import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  CalendarDays, MapPin, DollarSign, ExternalLink, Trash2, Loader2, Sparkles, RefreshCw, Tag,
  ClipboardCheck, StickyNote, ChevronDown, ChevronUp, Save, Award,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/components/ui/use-toast";
import ConferenceAttendeePicker, { ConferenceAttendeeChips } from "@/components/conferences/ConferenceAttendeePicker";
import { scrubConferencesForFirm } from "@/components/conferences/conferenceScrub";

const PARTICP_COLORS = {
  Sponsoring: "bg-amber-50 text-amber-700 border-amber-200",
  Attending: "bg-blue-50 text-blue-700 border-blue-200",
  Speaking: "bg-purple-50 text-purple-700 border-purple-200",
  Exhibiting: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Unknown: "bg-gray-50 text-gray-600 border-gray-200",
};

const RSVP_OPTIONS = ["Not Responded", "Confirmed", "Tentative", "Declined"];

const RSVP_COLORS = {
  "Not Responded": "bg-gray-50 text-gray-600 border-gray-200",
  "Confirmed": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Tentative": "bg-amber-50 text-amber-700 border-amber-200",
  "Declined": "bg-rose-50 text-rose-700 border-rose-200",
};

const REG_OPTIONS = ["Not Registered", "Registered", "Waitlisted"];

const REG_COLORS = {
  "Not Registered": "bg-gray-50 text-gray-600 border-gray-200",
  "Registered": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Waitlisted": "bg-amber-50 text-amber-700 border-amber-200",
};

const LOGISTICS_OPTIONS = ["Pending Payment", "Registered", "Confirmed"];

const LOGISTICS_COLORS = {
  "Pending Payment": "bg-amber-50 text-amber-700 border-amber-200",
  "Registered": "bg-blue-50 text-blue-700 border-blue-200",
  "Confirmed": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const SPONSOR_OPTIONS = ["Not Sponsoring", "Considering", "Sponsoring"];

const SPONSOR_COLORS = {
  "Not Sponsoring": "bg-gray-50 text-gray-600 border-gray-200",
  "Considering": "bg-amber-50 text-amber-700 border-amber-200",
  "Sponsoring": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function fmtCurrency(n) {
  if (n == null || n === "" || isNaN(Number(n))) return "";
  return Number(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtDate(d) {
  if (!d) return "—";
  try { return format(new Date(d + "T00:00:00"), "MMM d, yyyy"); } catch { return d; }
}

function fmtRange(start, end) {
  if (!start && !end) return "—";
  if (start && end) return `${fmtDate(start)} – ${fmtDate(end)}`;
  return fmtDate(start || end);
}

export default function FirmConferenceTab({ firmId, firmName }) {
  const queryClient = useQueryClient();
  const [scrubbing, setScrubbing] = useState(false);

  const { data: conferences = [], isLoading } = useQuery({
    queryKey: ["firm_conferences", firmId],
    queryFn: () => base44.entities.FirmConference.filter({ firm_id: firmId }, "conference_date"),
    enabled: !!firmId,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["firm_contacts_for_conferences", firmId],
    queryFn: () => base44.entities.Contact.filter({ firm_ids: firmId }, "first_name"),
    enabled: !!firmId,
  });

  // Fetch the current user's own firm (Xponance) colleagues for the internal attendees picker
  const { data: ownFirmContacts = [] } = useQuery({
    queryKey: ["own_firm_contacts_for_conferences"],
    queryFn: async () => {
      const me = await base44.auth.me();
      const ownFirmId = me?.data?.linked_firm_id;
      if (!ownFirmId) return [];
      return base44.entities.Contact.filter({ firm_ids: ownFirmId }, "first_name", 500);
    },
  });

  const handleScrub = async () => {
    setScrubbing(true);
    try {
      const result = await scrubConferencesForFirm({
        firmId,
        firmName,
        contacts,
        existingConferences: conferences,
      });

      if (result.found === 0) {
        toast({ title: "No conferences found", description: "The web scrub didn't find any conferences for this firm or its contacts." });
        setScrubbing(false);
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["firm_conferences", firmId] });
      queryClient.invalidateQueries({ queryKey: ["all_conferences"] });

      toast({
        title: "Conference scrub complete",
        description: `${result.created} new conference${result.created !== 1 ? "s" : ""} added${result.duplicates ? `, ${result.duplicates} duplicate${result.duplicates !== 1 ? "s" : ""} skipped` : ""}.`,
      });
    } catch (e) {
      toast({ title: "Scrub failed", description: e.message, variant: "destructive" });
    }
    setScrubbing(false);
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.FirmConference.delete(id);
      queryClient.invalidateQueries({ queryKey: ["firm_conferences", firmId] });
    } catch (e) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  const handleRsvpChange = async (conf, newStatus) => {
    try {
      await base44.entities.FirmConference.update(conf.id, { rsvp_status: newStatus });
      queryClient.invalidateQueries({ queryKey: ["firm_conferences", firmId] });
      queryClient.invalidateQueries({ queryKey: ["all_conferences"] });
      toast({ title: "RSVP updated", description: `${conf.title}: ${newStatus}` });
    } catch (e) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    }
  };

  const handleRegChange = async (conf, newStatus) => {
    try {
      await base44.entities.FirmConference.update(conf.id, { registration_status: newStatus });
      queryClient.invalidateQueries({ queryKey: ["firm_conferences", firmId] });
      queryClient.invalidateQueries({ queryKey: ["all_conferences"] });
      toast({ title: "Registration updated", description: `${conf.title}: ${newStatus}` });
    } catch (e) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    }
  };

  const handleLogisticsChange = async (conf, newStatus) => {
    try {
      await base44.entities.FirmConference.update(conf.id, { logistics_status: newStatus });
      queryClient.invalidateQueries({ queryKey: ["firm_conferences", firmId] });
      queryClient.invalidateQueries({ queryKey: ["all_conferences"] });
      toast({ title: "Status updated", description: `${conf.title}: ${newStatus}` });
    } catch (e) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    }
  };

  const handleSponsorChange = async (conf, data) => {
    try {
      await base44.entities.FirmConference.update(conf.id, data);
      queryClient.invalidateQueries({ queryKey: ["firm_conferences", firmId] });
      queryClient.invalidateQueries({ queryKey: ["all_conferences"] });
      toast({ title: "Sponsorship updated", description: `${conf.title}` });
    } catch (e) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    }
  };

  const handleAttendeeChange = async (conf, contactIds) => {
    try {
      await base44.entities.FirmConference.update(conf.id, { internal_attendee_contact_ids: contactIds });
      queryClient.invalidateQueries({ queryKey: ["firm_conferences", firmId] });
      queryClient.invalidateQueries({ queryKey: ["all_conferences"] });
    } catch (e) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    }
  };

  const sorted = [...conferences].sort((a, b) => {
    const da = a.conference_date || "";
    const db = b.conference_date || "";
    return db.localeCompare(da); // newest first
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-gray-500">
          Scrub the web for conferences sponsored or attended by <span className="font-semibold text-gray-700">{firmName}</span> or its contacts.
        </p>
        <Button
          type="button"
          size="sm"
          className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
          onClick={handleScrub}
          disabled={scrubbing}
        >
          {scrubbing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {scrubbing ? "Scrubbing..." : "Scrub Conferences"}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-xs text-gray-400 italic py-4 text-center">Loading...</div>
      ) : sorted.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl">
          No conferences on file yet. Click <span className="font-medium text-indigo-500">Scrub Conferences</span> to search the web.
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((c) => (
            <ConferenceRecordCard
              key={c.id}
              conf={c}
              ownFirmContacts={ownFirmContacts}
              onRsvpChange={handleRsvpChange}
              onRegChange={handleRegChange}
              onLogisticsChange={handleLogisticsChange}
              onSponsorChange={handleSponsorChange}
              onAttendeeChange={handleAttendeeChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConferenceRecordCard({ conf, ownFirmContacts, onRsvpChange, onRegChange, onLogisticsChange, onSponsorChange, onAttendeeChange, onDelete }) {
  const queryClient = useQueryClient();
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState(conf.internal_notes || "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [sponsorStatusDraft, setSponsorStatusDraft] = useState(conf.sponsorship_status || "Not Sponsoring");
  const [sponsorAmountDraft, setSponsorAmountDraft] = useState(conf.sponsorship_amount ?? "");
  const [sponsorDeliverablesDraft, setSponsorDeliverablesDraft] = useState(conf.sponsorship_deliverables || "");
  const [savingSponsor, setSavingSponsor] = useState(false);

  const pColor = PARTICP_COLORS[conf.participation_type] || PARTICP_COLORS.Unknown;
  const rsvp = conf.rsvp_status || "Not Responded";
  const rsvpColor = RSVP_COLORS[rsvp] || RSVP_COLORS["Not Responded"];
  const reg = conf.registration_status || "Not Registered";
  const regColor = REG_COLORS[reg] || REG_COLORS["Not Registered"];
  const logistics = conf.logistics_status || "Pending Payment";
  const logisticsColor = LOGISTICS_COLORS[logistics] || LOGISTICS_COLORS["Pending Payment"];
  const sponsor = conf.sponsorship_status || "Not Sponsoring";
  const sponsorColor = SPONSOR_COLORS[sponsor] || SPONSOR_COLORS["Not Sponsoring"];

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await base44.entities.FirmConference.update(conf.id, { internal_notes: notesDraft });
      queryClient.invalidateQueries({ queryKey: ["firm_conferences", conf.firm_id] });
      queryClient.invalidateQueries({ queryKey: ["all_conferences"] });
      toast({ title: "Notes saved" });
    } catch (e) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
    setSavingNotes(false);
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${pColor}`}>
              <Tag className="w-2.5 h-2.5" />
              {conf.participation_type}
            </span>
            {sponsor !== "Not Sponsoring" && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${sponsorColor}`}>
                <Award className="w-2.5 h-2.5" />
                {sponsor}
                {conf.sponsorship_amount != null && conf.sponsorship_amount !== "" ? ` · ${fmtCurrency(conf.sponsorship_amount)}` : ""}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${rsvpColor}`}>
              <ClipboardCheck className="w-2.5 h-2.5" />
              {rsvp}
            </span>
            {reg !== "Not Registered" && (
              <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${regColor}`}>
                {reg}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${logisticsColor}`}>
              <ClipboardCheck className="w-2.5 h-2.5" />
              {logistics}
            </span>
            {conf.conference_date && (
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                <CalendarDays className="w-3 h-3" />
                {fmtRange(conf.conference_date, conf.end_date)}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-800">
            {conf.url ? (
              <a href={conf.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 hover:underline inline-flex items-center gap-1">
                {conf.title}
                <ExternalLink className="w-3 h-3 text-gray-400" />
              </a>
            ) : conf.title}
          </p>
          {conf.description && (
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">{conf.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 flex-wrap text-[11px] text-gray-500">
            {conf.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3 text-gray-400" /> {conf.location}
              </span>
            )}
            {conf.fees && (
              <span className="inline-flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-gray-400" /> {conf.fees}
              </span>
            )}
            {conf.source_contact_name && (
              <span className="inline-flex items-center gap-1 text-indigo-500">
                via {conf.source_contact_name}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDelete(conf.id)}
          className="text-gray-300 hover:text-red-500 flex-shrink-0"
          title="Delete conference"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* RSVP + internal notes management */}
      <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-[11px] font-medium text-gray-500 inline-flex items-center gap-1">
            <ClipboardCheck className="w-3 h-3" /> RSVP:
          </label>
          <select
            value={rsvp}
            onChange={e => onRsvpChange(conf, e.target.value)}
            className="h-7 rounded-md border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            {RSVP_OPTIONS.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <label className="text-[11px] font-medium text-gray-500 ml-1">Registration:</label>
          <select
            value={reg}
            onChange={e => onRegChange(conf, e.target.value)}
            className="h-7 rounded-md border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            {REG_OPTIONS.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <label className="text-[11px] font-medium text-gray-500 ml-1">Status:</label>
          <select
            value={logistics}
            onChange={e => onLogisticsChange(conf, e.target.value)}
            className="h-7 rounded-md border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            {LOGISTICS_OPTIONS.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSponsorOpen(o => !o)}
            className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-indigo-600"
          >
            <Award className="w-3 h-3" />
            Sponsorship
            {sponsor !== "Not Sponsoring" ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> : null}
            {sponsorOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <ConferenceAttendeePicker
            contacts={ownFirmContacts || []}
            selectedIds={conf.internal_attendee_contact_ids || []}
            onChange={(ids) => onAttendeeChange(conf, ids)}
          />
          <button
            type="button"
            onClick={() => setNotesOpen(o => !o)}
            className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-indigo-600"
          >
            <StickyNote className="w-3 h-3" />
            Internal notes
            {conf.internal_notes ? <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> : null}
            {notesOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Internal attendees chips */}
        <ConferenceAttendeeChips
          contacts={ownFirmContacts || []}
          selectedIds={conf.internal_attendee_contact_ids || []}
        />

        {/* Sponsorship panel */}
        {sponsorOpen && (
          <div className="space-y-2 rounded-md border border-gray-100 bg-gray-50/50 p-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-[11px] font-medium text-gray-500 inline-flex items-center gap-1">
                <Award className="w-3 h-3" /> Status:
              </label>
              <select
                value={sponsorStatusDraft}
                onChange={e => setSponsorStatusDraft(e.target.value)}
                className="h-7 rounded-md border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                {SPONSOR_OPTIONS.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <label className="text-[11px] font-medium text-gray-500 ml-1">Amount ($):</label>
              <input
                type="number"
                min="0"
                step="any"
                value={sponsorAmountDraft}
                onChange={e => setSponsorAmountDraft(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="e.g. 25000"
                className="h-7 w-28 rounded-md border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-500">Deliverables (what we get):</label>
              <textarea
                value={sponsorDeliverablesDraft}
                onChange={e => setSponsorDeliverablesDraft(e.target.value)}
                placeholder="e.g. Booth, logo on website, 2 speaking slots, 5 attendee passes..."
                rows={2}
                className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setSponsorStatusDraft(conf.sponsorship_status || "Not Sponsoring");
                  setSponsorAmountDraft(conf.sponsorship_amount ?? "");
                  setSponsorDeliverablesDraft(conf.sponsorship_deliverables || "");
                  setSponsorOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs gap-1"
                disabled={savingSponsor}
                onClick={async () => {
                  setSavingSponsor(true);
                  try {
                    await onSponsorChange(conf, {
                      sponsorship_status: sponsorStatusDraft,
                      sponsorship_amount: sponsorAmountDraft === "" ? null : Number(sponsorAmountDraft),
                      sponsorship_deliverables: sponsorDeliverablesDraft,
                    });
                    setSponsorOpen(false);
                  } finally {
                    setSavingSponsor(false);
                  }
                }}
              >
                {savingSponsor ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save sponsorship
              </Button>
            </div>
          </div>
        )}

        {/* Sponsorship summary (collapsed) */}
        {!sponsorOpen && sponsor !== "Not Sponsoring" && (
          <div className="text-[11px] text-gray-600 bg-gray-50 rounded-md px-2 py-1.5 leading-relaxed">
            <span className="font-medium">Sponsorship:</span> {sponsor}
            {conf.sponsorship_amount != null && conf.sponsorship_amount !== "" ? ` · ${fmtCurrency(conf.sponsorship_amount)}` : ""}
            {conf.sponsorship_deliverables ? <> · <span className="text-gray-500">{conf.sponsorship_deliverables}</span></> : null}
          </div>
        )}

        {notesOpen && (
          <div className="space-y-1.5">
            <textarea
              value={notesDraft}
              onChange={e => setNotesDraft(e.target.value)}
              placeholder="Add internal notes — who is attending, logistics, follow-ups..."
              rows={3}
              className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setNotesDraft(conf.internal_notes || ""); setNotesOpen(false); }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleSaveNotes}
                disabled={savingNotes || notesDraft === (conf.internal_notes || "")}
              >
                {savingNotes ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save notes
              </Button>
            </div>
          </div>
        )}

        {!notesOpen && conf.internal_notes && (
          <p className="text-[11px] text-gray-500 bg-gray-50 rounded-md px-2 py-1.5 leading-relaxed whitespace-pre-wrap">
            {conf.internal_notes}
          </p>
        )}
      </div>
    </div>
  );
}