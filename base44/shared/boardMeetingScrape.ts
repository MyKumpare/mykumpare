// Shared board-meeting scrape logic used by both the interactive scraper
// (scrapeBoardMeetings) and the automated update detector
// (detectBoardMeetingUpdates). Builds a portfolio watchlist from the tenant's
// own firm + portfolios, asks a web-enabled LLM to find board meetings on the
// firm's website, and returns normalized meeting objects with mentions.

export async function buildWatchlist(base44: any, tenantFirmId: string | null) {
  const watchlist: string[] = [];
  const watchlistMap: Record<string, { entity_type: string; entity_id: string; entity_name: string }> = {};
  if (!tenantFirmId) return { watchlist, watchlistMap };

  const myFirm = await base44.asServiceRole.entities.Firm.get(tenantFirmId).catch(() => null);
  if (myFirm?.name) {
    watchlist.push(myFirm.name);
    watchlistMap[myFirm.name.toLowerCase()] = {
      entity_type: 'our_firm',
      entity_id: myFirm.id,
      entity_name: myFirm.name,
    };
  }
  const portfolios = await base44.asServiceRole.entities.Portfolio.filter({ firm_id: tenantFirmId }).catch(() => []);
  for (const p of portfolios || []) {
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
  return { watchlist, watchlistMap };
}

export async function scrapeFirmBoardMeetings(base44: any, firmId: string, tenantFirmId?: string | null) {
  const firm = await base44.asServiceRole.entities.Firm.get(firmId).catch(() => null);
  if (!firm) return { meetings: [] as any[], firm: null as any };

  const { watchlist, watchlistMap } = await buildWatchlist(base44, tenantFirmId || null);
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

  return { meetings, firm };
}