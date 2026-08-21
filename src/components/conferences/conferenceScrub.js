import { base44 } from "@/api/base44Client";

const PARTICP_TYPES = ["Sponsoring", "Attending", "Speaking", "Exhibiting", "Unknown"];

function buildPrompt(firmName, contactNames) {
  return `Search the web for conferences, industry events, summits, and forums that the investment firm "${firmName}" or any of its key personnel are sponsoring, attending, speaking at, or exhibiting at.

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
}

/**
 * Scrubs the web for conferences for a single firm, dedups against existing
 * records, and bulk-creates new FirmConference records.
 *
 * @param {object} opts
 * @param {string} opts.firmId
 * @param {string} opts.firmName
 * @param {Array}  [opts.contacts=[]]      Contacts belonging to the firm (for personnel names)
 * @param {Array}  [opts.existingConferences=[]] Existing FirmConference records for dedup
 * @returns {Promise<{found:number, created:number, duplicates:number}>}
 */
export async function scrubConferencesForFirm({ firmId, firmName, contacts = [], existingConferences = [] }) {
  const contactNames = (contacts || [])
    .filter(c => !c.deleted_at)
    .map(c => [c.first_name, c.last_name].filter(Boolean).join(" "))
    .filter(Boolean)
    .slice(0, 25);

  const prompt = buildPrompt(firmName, contactNames);

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
  if (!found.length) return { found: 0, created: 0, duplicates: 0 };

  const existingKeys = new Set(
    (existingConferences || [])
      .map(c => `${(c.title || "").toLowerCase().trim()}|${c.conference_date || ""}`)
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
      participation_type: PARTICP_TYPES.includes(f.participation_type) ? f.participation_type : "Unknown",
      source_contact_name: f.source_contact_name?.trim() || "",
      scrub_batch_id: batchId,
    }));

  if (toCreate.length) {
    await base44.entities.FirmConference.bulkCreate(toCreate);
  }

  return {
    found: found.length,
    created: toCreate.length,
    duplicates: found.length - toCreate.length,
  };
}