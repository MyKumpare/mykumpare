import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

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

    const firm = await base44.asServiceRole.entities.Firm.get(firmId).catch(() => null);
    if (!firm) return Response.json({ error: 'Firm not found' }, { status: 404 });

    // Build a watchlist of names to flag if mentioned: the user's own firm plus
    // every investment manager (advisor) and sub-manager in its portfolios.
    const watchlist: string[] = [];
    const watchlistMap: Record<string, { entity_type: string; entity_id: string; entity_name: string }> = {};

    const myFirmId = user.data?.linked_firm_id || user.linked_firm_id;
    if (myFirmId) {
      const myFirm = await base44.asServiceRole.entities.Firm.get(myFirmId).catch(() => null);
      if (myFirm?.name) {
        watchlist.push(myFirm.name);
        watchlistMap[myFirm.name.toLowerCase()] = {
          entity_type: 'our_firm',
          entity_id: myFirm.id,
          entity_name: myFirm.name,
        };
      }
      const portfolios = await base44.asServiceRole.entities.Portfolio.filter({ firm_id: myFirmId }).catch(() => []);
      for (const p of portfolios) {
        if (p.advisor_firm_name) {
          watchlist.push(p.advisor_firm_name);
          watchlistMap[p.advisor_firm_name.toLowerCase()] = {
            entity_type: 'investment_manager',
            entity_id: p.advisor_firm_id || '',
            entity_name: p.advisor_firm_name,
          };
        }
        for (const sm of p.sub_managers || []) {
          if (sm.firm_name) {
            watchlist.push(sm.firm_name);
            watchlistMap[sm.firm_name.toLowerCase()] = {
              entity_type: 'sub_manager',
              entity_id: sm.product_id || '',
              entity_name: sm.firm_name,
            };
          }
        }
      }
    }

    const website = firm.website || '';
    const firmName = firm.name || '';
    const watchlistStr = watchlist.length > 0 ? watchlist.join(', ') : '(none)';

    const prompt =
      `Search the website ${website || 'of "' + firmName + '"'} and the public web for board meetings of "${firmName}". ` +
      `For each board meeting you find evidence of, return: title, meeting_date (YYYY-MM-DD or null), end_date (YYYY-MM-DD or null), ` +
      `location (if known), meeting_format ("in-person", "virtual", or "hybrid" if known), meeting_topics (array of short topic strings), ` +
      `session_type ("public_meeting" or "closed_session" if known), agenda_url (URL to agenda document if available), ` +
      `minutes_url (URL to minutes document if available), source_url (URL where you found this meeting). ` +
      `Also check whether any of these entities are mentioned in the meeting content: ${watchlistStr}. ` +
      `For each mentioned entity, add an entry to the "mentions" array with { entity_name, context } where context is a short ` +
      `description of what the meeting says about that entity. Only return real board meetings you found evidence of — do not invent meetings.`;

    const res = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          meetings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                meeting_date: { type: 'string' },
                end_date: { type: 'string' },
                location: { type: 'string' },
                meeting_format: { type: 'string' },
                meeting_topics: { type: 'array', items: { type: 'string' } },
                session_type: { type: 'string' },
                agenda_url: { type: 'string' },
                minutes_url: { type: 'string' },
                source_url: { type: 'string' },
                mentions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      entity_name: { type: 'string' },
                      context: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const today = new Date().toISOString().slice(0, 10);
    const meetings = ((res as any)?.meetings || []).map((m: any) => {
      const mappedMentions = (m.mentions || []).map((mt: any) => {
        const key = (mt.entity_name || '').toLowerCase();
        const info = watchlistMap[key] || {};
        return {
          id: crypto.randomUUID(),
          entity_name: mt.entity_name || '',
          entity_type: info.entity_type || 'other',
          entity_id: info.entity_id || '',
          context: mt.context || '',
        };
      });
      const meetingDate = m.meeting_date || '';
      const status = meetingDate && meetingDate < today ? 'completed' : 'upcoming';
      return {
        title: m.title || 'Untitled board meeting',
        meeting_date: m.meeting_date || '',
        end_date: m.end_date || '',
        location: m.location || '',
        meeting_format: m.meeting_format || 'unknown',
        meeting_topics: m.meeting_topics || [],
        session_type: m.session_type || 'unknown',
        agenda_url: m.agenda_url || '',
        minutes_url: m.minutes_url || '',
        source_url: m.source_url || '',
        mentions: mappedMentions,
        status,
        needs_review: mappedMentions.length > 0,
        reviewed: false,
      };
    });

    return Response.json({ meetings, firm_name: firmName, firm_id: firmId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}