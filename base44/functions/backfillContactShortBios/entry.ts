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
 * Backfill short_biography for contacts that have a full biography but no
 * short bio yet. Processes one batch per invocation (idempotent: skips
 * contacts that already have a short_biography). Call repeatedly until
 * `remaining` is 0.
 *
 * Payload: { batch_size?: number }  (default 20)
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Admin only" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(parseInt(body.batch_size, 10) || 75, 150);
    const concurrency = Math.min(parseInt(body.concurrency, 10) || 6, 10);

    // Pull all contacts once; filter in code for those needing a short bio.
    const all = await base44.asServiceRole.entities.Contact.list("-created_date", 5000);
    const needing = all.filter(
      (c: any) => c.biography && c.biography.trim().length > 0 && !(c.short_biography && c.short_biography.trim())
    );
    const batch = needing.slice(0, batchSize);

    let processed = 0;
    const errors: any[] = [];

    // Run LLM generations with limited concurrency to respect rate limits.
    for (let i = 0; i < batch.length; i += concurrency) {
      const chunk = batch.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        chunk.map(async (c: any) => {
          const plainBio = stripHtml(c.biography).substring(0, 8000);
          if (!plainBio) return { id: c.id, name: `${c.first_name} ${c.last_name}`, shortBio: "", error: "Empty bio" };
          const res: any = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt:
              `Summarize the following professional biography into a concise 2-3 sentence overview. ` +
              `Capture the person's current role, key experience, and notable achievements. ` +
              `Write in third person. Do not add information that is not in the original text.\n\n` +
              `Biography:\n"""\n${plainBio}\n"""`,
            response_json_schema: {
              type: "object",
              properties: {
                short_bio: { type: "string", description: "A concise 2-3 sentence summary of the biography" },
              },
            },
          });
          const shortBio = (res?.short_bio || "").trim();
          if (!shortBio) return { id: c.id, name: `${c.first_name} ${c.last_name}`, shortBio: "", error: "Empty short bio returned" };
          await base44.asServiceRole.entities.Contact.update(c.id, { short_biography: shortBio });
          return { id: c.id, name: `${c.first_name} ${c.last_name}`, shortBio, error: null };
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled") {
          if (r.value.shortBio) processed++;
          else if (r.value.error) errors.push({ id: r.value.id, name: r.value.name, error: r.value.error });
        } else {
          errors.push({ error: String(r.reason?.message || r.reason) });
        }
      }
    }

    return Response.json({
      processed,
      remaining: Math.max(0, needing.length - processed),
      totalNeeding: needing.length,
      batchSize,
      errors,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}