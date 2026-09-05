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

function buildName(c: any): string {
  return [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix]
    .filter(Boolean)
    .join(" ") + (c.designations?.length ? `, ${c.designations.join(", ")}` : "");
}

function buildContext(c: any, firmMap: Record<string, any>): string {
  const parts: string[] = [];

  const name = buildName(c);
  if (name) parts.push(`Name: ${name}`);
  if (c.title) parts.push(`Current Title: ${c.title}`);

  // Firm info
  const firms = (c.firm_ids || [])
    .map((id: string) => firmMap[id])
    .filter(Boolean);
  if (firms.length) {
    const firmLines = firms.map((f: any) => {
      const bits = [f.name];
      if (f.firm_type || (f.firm_types && f.firm_types.length)) {
        const ft = f.firm_types?.length ? f.firm_types.join(", ") : f.firm_type;
        if (ft) bits.push(`(${ft})`);
      }
      if (f.location) bits.push(`— ${f.location}`);
      return bits.join(" ");
    });
    parts.push(`Firm(s): ${firmLines.join("; ")}`);
  }

  // Roles
  const roles: string[] = [];
  if (c.contact_roles?.length) roles.push(...c.contact_roles);
  if (c.investment_team_roles?.length) roles.push(...c.investment_team_roles);
  if (c.contact_firm_roles?.length) roles.push(...c.contact_firm_roles);
  if (roles.length) parts.push(`Role(s): ${roles.join(", ")}`);

  if (c.decision_role) parts.push(`Decision Role: ${c.decision_role}`);
  if (c.influence_level && c.influence_level !== "Undetermined") {
    parts.push(`Influence Level: ${c.influence_level}`);
  }

  // Education
  if (c.education?.length) {
    const edu = c.education.map((e: any) => {
      const bits = [e.institution];
      if (e.degree) bits.push(e.degree);
      if (e.graduation_year) bits.push(`(${e.graduation_year})`);
      return bits.join(" ");
    });
    parts.push(`Education: ${edu.join("; ")}`);
  }

  // Professional experience
  if (c.professional_experience?.length) {
    const exp = c.professional_experience.map((e: any) => {
      const bits = [e.title, e.company_name].filter(Boolean);
      const years = [e.start_year, e.end_year].filter(Boolean).join("–");
      return years ? `${bits.join(", ")} (${years})` : bits.join(", ");
    });
    parts.push(`Experience: ${exp.join("; ")}`);
  }

  // Board memberships
  if (c.board_memberships?.length) {
    const boards = c.board_memberships.map((b: any) => {
      const bits = [b.organization_name];
      if (b.role) bits.push(b.role);
      return bits.join(" — ");
    });
    parts.push(`Board Memberships: ${boards.join("; ")}`);
  }

  // If a full biography exists, include it as additional context
  const plainBio = stripHtml(c.biography || "");
  if (plainBio) parts.push(`Full Biography: ${plainBio.substring(0, 4000)}`);

  return parts.join("\n");
}

/**
 * Generates short_biography for contacts that are missing one, using their
 * current firm and role information (does NOT require a full biography).
 * Admin-only. Idempotent: skips contacts that already have a short_biography.
 *
 * Payload: {
 *   contact_ids?: string[]   // specific contacts to process (optional)
 *   batch_size?: number      // default 50, max 150
 * }
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Admin only" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(parseInt(body.batch_size, 10) || 50, 150);
    const concurrency = 5;

    // Load firms for context building
    const firms = await base44.asServiceRole.entities.Firm.list("name", 2000);
    const firmMap: Record<string, any> = Object.fromEntries(firms.map((f: any) => [f.id, f]));

    // Determine which contacts to process
    let candidates: any[];
    if (Array.isArray(body.contact_ids) && body.contact_ids.length > 0) {
      const fetched = await Promise.all(
        (body.contact_ids as string[]).map((id) =>
          base44.asServiceRole.entities.Contact.get(id).catch(() => null)
        )
      );
      candidates = fetched.filter((c: any) => c && !c.deleted_at);
    } else {
      candidates = await base44.asServiceRole.entities.Contact.list("-created_date", 5000);
      candidates = candidates.filter((c: any) => !c.deleted_at);
    }

    // Filter to those missing a short bio
    const needing = candidates.filter(
      (c: any) => !(c.short_biography && c.short_biography.trim())
    );

    const batch = needing.slice(0, batchSize);

    let processed = 0;
    const errors: any[] = [];

    for (let i = 0; i < batch.length; i += concurrency) {
      const chunk = batch.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        chunk.map(async (c: any) => {
          const context = buildContext(c, firmMap);
          if (!context || context.length < 10) {
            return { id: c.id, name: buildName(c), shortBio: "", error: "Insufficient context (no firm or role info)" };
          }

          const res: any = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt:
              `Write a concise professional summary (2-3 sentences, third person) for the following contact based on their current firm and role information. ` +
              `Focus on their current position, firm, and area of expertise. Do not add information that is not provided. ` +
              `If education or experience details are available, weave them in naturally.\n\n` +
              `Contact Information:\n"""\n${context}\n"""`,
            response_json_schema: {
              type: "object",
              properties: {
                short_bio: { type: "string", description: "A concise 2-3 sentence professional summary" },
              },
            },
          });
          const shortBio = (res?.short_bio || "").trim();
          if (!shortBio) return { id: c.id, name: buildName(c), shortBio: "", error: "Empty short bio returned" };

          await base44.asServiceRole.entities.Contact.update(c.id, { short_biography: shortBio });
          return { id: c.id, name: buildName(c), shortBio, error: null };
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
      totalNeeding: needing.length,
      remaining: Math.max(0, needing.length - processed),
      batchSize,
      errors,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}