import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { scrapeFirmBoardMeetings } from '../../shared/boardMeetingScrape.ts';

// Scrapes a firm's website (via web-enabled LLM) for board meetings, returning
// structured meetings with dates, location, format, topics, session type,
// agenda/minutes URLs, and mentions of the user's own firm or any investment
// manager / sub-manager in its portfolios (which flags the meeting for review).
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const firmId = body.firm_id;
    if (!firmId) return Response.json({ error: 'firm_id is required' }, { status: 400 });

    const tenantFirmId = (user.data?.linked_firm_id || user.linked_firm_id) as string | null;
    const { meetings, firm } = await scrapeFirmBoardMeetings(base44, firmId, tenantFirmId);
    if (!firm) return Response.json({ error: 'Firm not found' }, { status: 404 });

    return Response.json({ meetings, firm_name: firm.name, firm_id: firmId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}