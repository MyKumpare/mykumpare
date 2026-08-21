import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Looks up a firm's registration/identifier number from the public registry of
// its governing regulatory body (e.g. SEC -> adviserinfo.sec.gov -> CRD number).
// Uses the LLM with web search so it works across regulatory bodies.
// input: { firm_name, regulatory_body, jurisdiction, country }
// returns: { found, registration_number, source_url, note }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const firmName = (body.firm_name || '').trim();
    const regulatoryBody = (body.regulatory_body || '').trim();
    const jurisdiction = (body.jurisdiction || '').trim();
    const country = (body.country || '').trim();

    if (!firmName) return Response.json({ error: 'Firm name is required' }, { status: 400 });
    if (!regulatoryBody) return Response.json({ error: 'Governing regulatory body is required' }, { status: 400 });

    const prompt = [
      `You are looking up the official registration/identifier number for an investment firm from its governing regulatory body's public registry.`,
      `Firm name: ${firmName}`,
      `Governing regulatory body: ${regulatoryBody}`,
      jurisdiction ? `Jurisdiction: ${jurisdiction}` : '',
      country ? `Country / Region: ${country}` : '',
      '',
      `Instructions:`,
      `- Search the public registry website of the governing regulatory body for this exact firm.`,
      `- For the U.S. Securities Exchange Commission (SEC), search adviserinfo.sec.gov (Investment Adviser Public Disclosure / IAPD) and return the firm's CRD (IARD/CRD) number.`,
      `- For other regulators, use their official public registry and return the equivalent registration/identifier number.`,
      `- Match on the legal entity name; if you cannot find an exact match, return found=false.`,
      `- Return ONLY the registration number string (no labels, no formatting like "CRD #"), the source URL of the registry page you found it on, and a short note.`,
    ].filter(Boolean).join('\n');

    const result = await base44.integrations.Core.InvokeLLM({
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

    return Response.json({
      found: !!result.found,
      registration_number: result.registration_number || '',
      source_url: result.source_url || '',
      note: result.note || '',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}