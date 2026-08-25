import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Scrapes a firm's website (via a web-enabled LLM) for any Request for Proposal
// (RFP) or Request for Information (RFI) postings. Returns normalized records
// with posting date, start date, questions date range, due date, summary, the
// source URL, and a downloadable document URL when one is available.
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
      `Search the website ${website || 'of "' + firmName + '"'} and the public web for any Request for Proposal (RFP) or Request for Information (RFI) postings ` +
      `issued by, hosted by, or related to "${firmName}". For each RFP/RFI you find evidence of, return: ` +
      `title (title of the posting), rfp_type ("RFP", "RFI", or "Unknown"), posting_date (YYYY-MM-DD or null — the date the RFP/RFI was posted), ` +
      `start_date (YYYY-MM-DD or null — when the RFP/RFI opens/starts), questions_start_date (YYYY-MM-DD or null — start date for submitting questions), ` +
      `questions_end_date (YYYY-MM-DD or null — end date for submitting questions), due_date (YYYY-MM-DD or null — submission due date), ` +
      `summary (a short summary of what the RFP/RFI is about), source_url (URL where you found this posting), ` +
      `file_url (a direct URL to a downloadable RFP/RFI document if one is available, otherwise empty). ` +
      `Only return real RFP/RFI postings you found evidence of — do not invent any. If none are found, return an empty array.`;

    const res = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          rfps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                rfp_type: { type: 'string' },
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

    const today = new Date().toISOString().slice(0, 10);
    const records = ((res as any)?.rfps || []).map((r: any) => {
      const due = r.due_date || '';
      let status = 'Unknown';
      if (due) status = due < today ? 'Closed' : 'Open';
      return {
        title: r.title || 'Untitled RFP/RFI',
        rfp_type: r.rfp_type === 'RFP' || r.rfp_type === 'RFI' ? r.rfp_type : 'Unknown',
        posting_date: r.posting_date || '',
        start_date: r.start_date || '',
        questions_start_date: r.questions_start_date || '',
        questions_end_date: r.questions_end_date || '',
        due_date: due,
        summary: r.summary || '',
        source_url: r.source_url || '',
        file_url: r.file_url || '',
        file_name: '',
        status,
      };
    });

    return Response.json({ rfps: records, firm_name: firm.name, firm_id: firmId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}