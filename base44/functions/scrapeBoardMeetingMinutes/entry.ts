import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Scrapes the meeting minutes for a single board meeting by visiting its
// source/minutes URL (via web-enabled LLM) and returning the extracted text
// content. Called from the "Get Minutes" action on a meeting card.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const meetingId = body.meeting_id;
    const sourceUrl = body.source_url;

    if (!meetingId && !sourceUrl) {
      return Response.json({ error: 'meeting_id or source_url is required' }, { status: 400 });
    }

    let meeting: any = null;
    if (meetingId) {
      meeting = await base44.asServiceRole.entities.BoardMeeting.get(meetingId).catch(() => null);
    }
    const url = sourceUrl || meeting?.minutes_url || meeting?.source_url || '';
    const title = meeting?.title || body.title || '';
    const firmName = meeting?.firm_name || body.firm_name || '';

    if (!url) {
      return Response.json({ error: 'No URL available to scrape minutes from', minutes_content: '', found: false });
    }

    const prompt =
      `Visit ${url} and extract the full meeting minutes for the board meeting "${title}"${firmName ? ' of ' + firmName : ''}. ` +
      `Return the minutes as structured text content, including any decisions, discussions, action items, and attendee information. ` +
      `If the minutes are not publicly available, return empty minutes_content and explain in notes.`;

    const res = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          minutes_content: { type: 'string' },
          found: { type: 'boolean' },
          notes: { type: 'string' },
        },
      },
    });

    return Response.json({
      minutes_content: (res as any)?.minutes_content || '',
      found: (res as any)?.found ?? !!(res as any)?.minutes_content,
      notes: (res as any)?.notes || '',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}