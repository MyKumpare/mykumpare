import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Generates a weekly summary of all tracked FirmNews items.
// Returns structured data (news items grouped by firm + an AI executive
// synthesis) that the frontend renders into a downloadable PDF digest.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const days = Math.min(Math.max(parseInt(body.days, 10) || 7, 1), 90);

    // Compute the date window (ISO dates, exclusive of today's end)
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const startStr = start.toISOString().split('T')[0];
    const endStr = now.toISOString().split('T')[0];

    // RLS automatically scopes reads to the user's tenant (admins see all)
    const allNews = await base44.entities.FirmNews.list('-news_date', 1000);

    const weekNews = allNews.filter(n =>
      !n.deleted_at &&
      n.news_date &&
      n.news_date >= startStr &&
      n.news_date <= endStr
    );

    // Aggregate stats
    const stats = {
      total: weekNews.length,
      high: weekNews.filter(n => n.alert_status === 'High').length,
      medium: weekNews.filter(n => n.alert_status === 'Medium').length,
      low: weekNews.filter(n => n.alert_status === 'Low').length,
      positive: weekNews.filter(n => n.news_status === 'Positive').length,
      negative: weekNews.filter(n => n.news_status === 'Negative').length,
      neutral: weekNews.filter(n => n.news_status === 'Neutral').length,
    };

    if (!weekNews.length) {
      return Response.json({
        status: 'success',
        week_start: startStr,
        week_end: endStr,
        generated_at: now.toISOString(),
        total_items: 0,
        firm_count: 0,
        firms: [],
        summary: 'No news items were tracked during this period.',
        key_themes: [],
        high_alert_items: [],
        stats,
      });
    }

    // Group items by firm
    const byFirm = new Map<string, { firm_id: string; firm_name: string; items: any[] }>();
    for (const n of weekNews) {
      const key = n.firm_id || 'unknown';
      if (!byFirm.has(key)) {
        byFirm.set(key, { firm_id: key, firm_name: n.firm_name || 'Unknown Firm', items: [] });
      }
      byFirm.get(key)!.items.push({
        id: n.id,
        news_date: n.news_date,
        headline: n.headline,
        summary: n.summary,
        alert_status: n.alert_status || 'Low',
        news_status: n.news_status || 'Neutral',
        article_url: n.article_url,
        source_type: n.source_type || 'firm',
        source_name: n.source_name,
      });
    }
    const firms = Array.from(byFirm.values()).sort((a, b) => b.items.length - a.items.length);

    // Build a compact prompt for the AI synthesis
    const headlinesForLLM = weekNews.slice(0, 120).map(n =>
      `- [${n.alert_status || 'Low'}/${n.news_status || 'Neutral'}] ${n.firm_name || 'Unknown'}: ${n.headline}`
    ).join('\n');

    let summary = '';
    let keyThemes: string[] = [];
    try {
      const llmRes: any = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a financial research analyst preparing a weekly intelligence digest for an investment team. Based on the tracked news items below from the past week, write a concise executive summary (3-5 sentences) of the key themes, notable events, and sentiment trends. Also list 3-6 key themes as short bullet labels. Be professional, objective, and insightful. Highlight any high-impact or negative developments.\n\nNews items from the past week:\n${headlinesForLLM}`,
        response_json_schema: {
          type: 'object',
          properties: {
            executive_summary: { type: 'string' },
            key_themes: { type: 'array', items: { type: 'string' } },
          },
        },
      });
      summary = llmRes?.executive_summary || '';
      keyThemes = Array.isArray(llmRes?.key_themes) ? llmRes.key_themes.filter((t: any) => t && String(t).trim()).map((t: any) => String(t).trim()) : [];
    } catch (e) {
      console.error('LLM synthesis failed:', e.message);
      summary = 'AI synthesis was unavailable for this period. See the per-firm breakdown below for the full list of tracked items.';
      keyThemes = [];
    }

    // Pull out high-impact items for the highlighted section
    const highAlertItems = weekNews
      .filter(n => n.alert_status === 'High')
      .sort((a, b) => (b.news_date || '').localeCompare(a.news_date || ''))
      .map(n => ({
        firm_name: n.firm_name || 'Unknown Firm',
        news_date: n.news_date,
        headline: n.headline,
        news_status: n.news_status || 'Neutral',
        article_url: n.article_url,
      }));

    return Response.json({
      status: 'success',
      week_start: startStr,
      week_end: endStr,
      generated_at: now.toISOString(),
      total_items: weekNews.length,
      firm_count: firms.length,
      firms,
      summary,
      key_themes: keyThemes,
      high_alert_items: highAlertItems,
      stats,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}