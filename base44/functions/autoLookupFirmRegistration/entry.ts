import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Auto-looks up a newly created firm's SEC CRD registration number and saves it
// to the firm record. Triggered by the "Auto Lookup Firm Registration" workflow
// (entity trigger on Firm create). Uses the LLM with web search against the
// SEC's Investment Adviser Public Disclosure registry (adviserinfo.sec.gov).
// Idempotent: skips firms that already have a registration_number set.
// input: { firm_id }
// returns: { found, registration_number, source_url, note, skipped }
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const firmId = (body.firm_id || '').trim();
    if (!firmId) return Response.json({ error: 'firm_id is required' }, { status: 400 });

    const firm: any = await svc.entities.Firm.get(firmId);
    if (!firm) return Response.json({ error: 'Firm not found' }, { status: 404 });
    if (firm.deleted_at) return Response.json({ skipped: true, reason: 'Firm is deleted' });

    // Skip if a registration number is already present (manual entry or prior run).
    if (firm.registration_number && String(firm.registration_number).trim()) {
      return Response.json({
        skipped: true,
        registration_number: firm.registration_number,
        source_url: firm.registration_source_url || '',
        reason: 'Registration number already set',
      });
    }

    const firmName = (firm.name || '').trim();
    if (!firmName) return Response.json({ skipped: true, reason: 'Firm has no name' });

    const prompt = [
      `You are looking up the official SEC CRD registration number for an investment firm from the U.S. Securities and Exchange Commission's public registry.`,
      `Firm name: ${firmName}`,
      ``,
      `Instructions:`,
      `- Search the SEC Investment Adviser Public Disclosure (IAPD) registry at adviserinfo.sec.gov for this exact firm legal entity name.`,
      `- Return the firm's CRD (IARD/CRD) number.`,
      `- Match on the legal entity name; if you cannot find an exact match, return found=false.`,
      `- Return ONLY the CRD number string (digits, no labels, no formatting like "CRD #"), the source URL of the IAPD page you found it on, and a short note.`,
    ].join('\n');

    const result: any = await svc.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          found: { type: 'boolean' },
          registration_number: { type: 'string' },
          source_url: { type: 'string' },
          note: { type: 'string' },
        },
      },
    });

    const found = !!result.found;
    const registrationNumber = (result.registration_number || '').trim();
    const sourceUrl = (result.source_url || '').trim();
    const note = (result.note || '').trim();

    if (found && registrationNumber) {
      await svc.entities.Firm.update(firmId, {
        registration_number: registrationNumber,
        registration_source_url: sourceUrl,
      });
    }

    return Response.json({
      found,
      registration_number: registrationNumber,
      source_url: sourceUrl,
      note,
      skipped: false,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}