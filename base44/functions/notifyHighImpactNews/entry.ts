import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Sends an email alert to all admin users whenever a High-impact FirmNews item
 * is created. Invoked by the "High Impact News Alert" workflow (entity trigger),
 * so there is no end-user auth — data access uses the service role.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const newsId = body.news_id;
    if (!newsId) return Response.json({ error: 'news_id required' }, { status: 400 });

    // Re-fetch the record (workflow payloads can be truncated for large records).
    const news = await base44.asServiceRole.entities.FirmNews.get(newsId);
    if (!news) return Response.json({ error: 'News item not found' }, { status: 404 });
    if (news.deleted_at) return Response.json({ skipped: 'deleted' });
    if (news.alert_status !== 'High') return Response.json({ skipped: 'not high impact' });

    // Notify all admin users.
    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter((u) => u.role === 'admin' && u.email);
    if (admins.length === 0) return Response.json({ skipped: 'no admins to notify' });

    const subject = `🚨 High Impact News Alert — ${news.firm_name || 'Firm'}`;
    const emailBody = [
      `A high-impact news item was detected:`,
      ``,
      `Firm: ${news.firm_name || '—'}`,
      `Headline: ${news.headline}`,
      `Date: ${news.news_date || '—'}`,
      `Sentiment: ${news.news_status || 'Neutral'}`,
      news.summary ? `Summary: ${news.summary}` : null,
      news.article_url ? `Article: ${news.article_url}` : null,
      ``,
      `Review this alert in MyKumpare.`,
    ]
      .filter((l) => l !== null)
      .join('\n');

    let sent = 0;
    const errors = [];
    for (const admin of admins) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          subject,
          body: emailBody,
        });
        sent++;
      } catch (e) {
        errors.push({ email: admin.email, error: (e as Error).message });
      }
    }

    return Response.json({ sent, total_admins: admins.length, errors });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}