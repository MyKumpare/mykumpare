import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Scrubs a firm's website (via a web-enabled LLM) for any Request for Proposal
// (RFP) or Request for Information (RFI) postings. Returns normalized records
// with posting date, start date, questions window, due date, summary, source
// link, and a linked solicitation document when available.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const firmId = body.firm_id;
    if (!firmId) return Response.json({ error: 'firm_id is required' }, { status: 400 });

    const firm = await base44.asServiceRole.entities.Firm.get(firmId).catch(() => null);
    if (!firm) return Response.json({ error: 'Firm not found' }, { status: 404 });

    const website = firm.website || '';
    const firmName = firm.name || '';

    const prompt =
      `Search the website ${website || 'of "' + firmName + '"'} and the public web for any Request for Proposal (RFP) or Request for Information (RFI) ` +
      `posted by or related to "${firmName}". These are formal procurement solicitations — look for pages titled "RFP", "RFI", ` +
      `"Request for Proposal", "Request for Information", "Solicitations", "Procurement", "Bids", or "Opportunities". ` +
      `For each RFP/RFI you find real evidence of, return: ` +
      `type ("RFP" or "RFI"), title, posting_date (YYYY-MM-DD or null — date the solicitation was posted/published), ` +
      `start_date (YYYY-MM-DD or null — when the solicitation period opens), ` +
      `questions_start_date (YYYY-MM-DD or null — when the window to submit questions opens), ` +
      `questions_end_date (YYYY-MM-DD or null — deadline to submit questions), ` +
      `due_date (YYYY-MM-DD or null — final submission deadline), ` +
      `summary (a short summary of what the RFP/RFI is about), ` +
      `source_url (URL where you found this solicitation), ` +
      `file_url (URL to the solicitation document if one is linked, otherwise empty string). ` +
      `Only return real RFPs/RFIs you found evidence of — do not invent any. If none are found, return an empty array.`;

    const res = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          rfp_rfis: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                title: { type: 'string' },
                posting_date: { type: 'string' },
                start_date: { type: 'string' },
                questions_start_date: { type: 'string' },
                questions_end_date: { type: 'string' },
                due_date: { type: 'string' },
                summary: { type: 'string' },
                source_url: { type: 'string' },
                file_url: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const items = ((res as any)?.rfp_rfis || []).map((r: any) => ({
      type: r.type === 'RFI' ? 'RFI' : 'RFP',
      title: r.title || 'Untitled RFP/RFI',
      posting_date: r.posting_date || '',
      start_date: r.start_date || '',
      questions_start_date: r.questions_start_date || '',
      questions_end_date: r.questions_end_date || '',
      due_date: r.due_date || '',
      summary: r.summary || '',
      source_url: r.source_url || '',
      file_url: r.file_url || '',
    }));

    return Response.json({ rfp_rfis: items, firm_name: firmName, firm_id: firmId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}