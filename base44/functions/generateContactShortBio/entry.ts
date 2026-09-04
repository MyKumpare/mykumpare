import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Strip HTML tags + collapse whitespace so the LLM gets clean plain text.
function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generates a short_biography for a single contact from its full biography.
 * Idempotent: skips contacts with no biography or that already have a short bio.
 * Called by the "Auto Short Bio on Bio Create" entity-triggered workflow.
 *
 * Payload: { contact_id: string }
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const contactId = body.contact_id;
    if (!contactId) return Response.json({ error: "contact_id required" }, { status: 400 });

    const contact: any = await base44.asServiceRole.entities.Contact.get(contactId);
    if (!contact) return Response.json({ error: "Contact not found" }, { status: 404 });

    const plainBio = stripHtml(contact.biography || "");
    if (!plainBio) return Response.json({ skipped: true, reason: "no biography" });

    // Idempotent: skip if a short bio already exists.
    if (contact.short_biography && contact.short_biography.trim()) {
      return Response.json({ skipped: true, reason: "short bio already exists" });
    }

    const res: any = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt:
        `Summarize the following professional biography into a concise 2-3 sentence overview. ` +
        `Capture the person's current role, key experience, and notable achievements. ` +
        `Write in third person. Do not add information that is not in the original text.\n\n` +
        `Biography:\n"""\n${plainBio.substring(0, 8000)}\n"""`,
      response_json_schema: {
        type: "object",
        properties: {
          short_bio: { type: "string", description: "A concise 2-3 sentence summary of the biography" },
        },
      },
    });
    const shortBio = (res?.short_bio || "").trim();
    if (!shortBio) return Response.json({ error: "Empty short bio returned" }, { status: 500 });

    await base44.asServiceRole.entities.Contact.update(contactId, { short_biography: shortBio });

    return Response.json({ generated: true, contact_id: contactId, short_bio: shortBio });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}