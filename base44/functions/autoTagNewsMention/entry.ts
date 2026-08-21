import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { autoTagNewsItemById, autoTagNewsItems } from '../../shared/newsAutoTag.ts';

// Auto-tags a FirmNews record with contacts/firms mentioned in its headline or
// summary. Called after manual news entry. Also supports a one-off "backfill"
// mode (admin only) that tags all existing news so historical articles get linked.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    // Backfill: auto-tag all existing news (admin only)
    if (body.mode === 'backfill') {
      if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
      const allNews = await base44.asServiceRole.entities.FirmNews.list('-created_date', 5000);
      const active = allNews.filter(n => !n.deleted_at);
      const results = await autoTagNewsItems(base44, active);
      return Response.json({ status: 'success', processed: active.length, tagged: results.length });
    }

    // Single news item (manual entry)
    const newsId = body.news_id;
    if (!newsId) return Response.json({ error: 'news_id is required' }, { status: 400 });
    const result = await autoTagNewsItemById(base44, newsId);
    return Response.json({ status: 'success', result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}