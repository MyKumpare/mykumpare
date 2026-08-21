import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  CalendarDays, MapPin, DollarSign, ExternalLink, Trash2, Loader2, Sparkles, RefreshCw, Tag,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/components/ui/use-toast";

const PARTICP_COLORS = {
  Sponsoring: "bg-amber-50 text-amber-700 border-amber-200",
  Attending: "bg-blue-50 text-blue-700 border-blue-200",
  Speaking: "bg-purple-50 text-purple-700 border-purple-200",
  Exhibiting: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Unknown: "bg-gray-50 text-gray-600 border-gray-200",
};

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

  const handleScrub = async () => {
    setScrubbing(true);
    try {
      const contactNames = (contacts || [])
        .filter(c => !c.deleted_at)
        .map(c => [c.first_name, c.last_name].filter(Boolean).join(" "))
        .filter(Boolean)
        .slice(0, 25);

      const prompt = `Search the web for conferences, industry events, summits, and forums that the investment firm "${firmName}" or any of its key personnel are sponsoring, attending, speaking at, or exhibiting at.

Key personnel (contacts) of the firm:
${contactNames.length ? contactNames.map((n, i) => `${i + 1}. ${n}`).join("\n") : "(no contact names available)"}

Focus on:
- Investment management, allocator, pension, endowment, and alternatives investment conferences
- Events where "${firmName}" is listed as a sponsor, attendee, speaker, panelist, or exhibitor
- Events where any of the listed personnel are speaking, paneling, or attending
- Upcoming and recent (within the last 12 months to the next 12 months) events

For each conference found, return:
- title: the conference name
- description: a 1-2 sentence description of what the conference is about
- start_date: YYYY-MM-DD (use the first day if a range; if only month/year is known, use the first day of that month)
- end_date: YYYY-MM-DD (last day if a range, otherwise omit)
- location: city, state/country, or venue
- fees: registration fee as a string (e.g. "$1,200", "Free", "Invite-only", "See website")
- url: link to the conference website or details page
- participation_type: one of "Sponsoring", "Attending", "Speaking", "Exhibiting", "Unknown" — how "${firmName}" or its personnel are involved
- source_contact_name: the name of the contact through whom this was found, if applicable (otherwise empty)

Only return real conferences you found evidence of on the web. Do not invent conferences. If none are found, return an empty list.`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        model: "gemini_3_flash",
        response_json_schema: {
          type: "object",
          properties: {
            conferences: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  start_date: { type: "string" },
                  end_date: { type: "string" },
                  location: { type: "string" },
                  fees: { type: "string" },
                  url: { type: "string" },
                  participation_type: { type: "string" },
                  source_contact_name: { type: "string" },
                },
              },
            },
          },
        },
      });

      const found = res?.conferences || [];
      if (!found.length) {
        toast({ title: "No conferences found", description: "The web scrub didn't find any conferences for this firm or its contacts." });
        setScrubbing(false);
        return;
      }

      // Dedup against existing records by normalized title + start_date
      const existingKeys = new Set(
        conferences.map(c => `${(c.title || "").toLowerCase().trim()}|${c.conference_date || ""}`)
      );
      const batchId = crypto.randomUUID();
      const toCreate = found
        .filter(f => {
          const key = `${(f.title || "").toLowerCase().trim()}|${f.start_date || ""}`;
          return !existingKeys.has(key);
        })
        .map(f => ({
          firm_id: firmId,
          firm_name: firmName,
          title: f.title?.trim() || "Untitled conference",
          description: f.description?.trim() || "",
          conference_date: f.start_date || undefined,
          end_date: f.end_date || undefined,
          location: f.location?.trim() || "",
          fees: f.fees?.trim() || "",
          url: f.url?.trim() || "",
          participation_type: ["Sponsoring", "Attending", "Speaking", "Exhibiting", "Unknown"].includes(f.participation_type)
            ? f.participation_type
            : "Unknown",
          source_contact_name: f.source_contact_name?.trim() || "",
          scrub_batch_id: batchId,
        }));

      if (toCreate.length) {
        await base44.entities.FirmConference.bulkCreate(toCreate);
        queryClient.invalidateQueries({ queryKey: ["firm_conferences", firmId] });
      }

      toast({
        title: "Conference scrub complete",
        description: `${toCreate.length} new conference${toCreate.length !== 1 ? "s" : ""} added${found.length - toCreate.length ? `, ${found.length - toCreate.length} duplicate${found.length - toCreate.length !== 1 ? "s" : ""} skipped` : ""}.`,
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
          {sorted.map((c) => {
            const pColor = PARTICP_COLORS[c.participation_type] || PARTICP_COLORS.Unknown;
            return (
              <div key={c.id} className="rounded-xl border border-gray-100 bg-white p-3 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${pColor}`}>
                        <Tag className="w-2.5 h-2.5" />
                        {c.participation_type}
                      </span>
                      {c.conference_date && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                          <CalendarDays className="w-3 h-3" />
                          {fmtRange(c.conference_date, c.end_date)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-800">
                      {c.url ? (
                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 hover:underline inline-flex items-center gap-1">
                          {c.title}
                          <ExternalLink className="w-3 h-3 text-gray-400" />
                        </a>
                      ) : c.title}
                    </p>
                    {c.description && (
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">{c.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 flex-wrap text-[11px] text-gray-500">
                      {c.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-gray-400" /> {c.location}
                        </span>
                      )}
                      {c.fees && (
                        <span className="inline-flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-gray-400" /> {c.fees}
                        </span>
                      )}
                      {c.source_contact_name && (
                        <span className="inline-flex items-center gap-1 text-indigo-500">
                          via {c.source_contact_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="text-gray-300 hover:text-red-500 flex-shrink-0"
                    title="Delete conference"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}