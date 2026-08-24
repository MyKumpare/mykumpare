import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { scrapeFirmBoardMeetings } from '../../shared/boardMeetingScrape.ts';

// Automated board-meeting update detector. Re-scrapes the board meeting
// calendar of each tracked firm and compares against existing BoardMeeting
// records, creating BoardMeetingAlert records for newly-found meetings and
// for concrete field changes on tracked meetings (date, agenda URL, minutes
// URL). Designed to run on a schedule (see the "Board Meeting Update Detector"
// workflow) so the user is alerted in the Monitor section whenever a portfolio
// firm updates its board meeting calendar.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const tenantId = (user.data?.linked_firm_id || user.linked_firm_id) as string | null;
    const firmId = body.firm_id || null;

    // Determine target firms. If a single firm_id is passed, process just that
    // one. Otherwise process every firm that already has BoardMeeting records
    // (i.e. firms the user is actively tracking), capped to control LLM cost.
    let targetFirms: any[] = [];
    if (firmId) {
      const f = await base44.asServiceRole.entities.Firm.get(firmId).catch(() => null);
      if (f && !f.deleted_at) targetFirms.push(f);
    } else {
      const allMeetings = await base44.asServiceRole.entities.BoardMeeting.list('-meeting_date', 2000).catch(() => []);
      const firmIds: string[] = [];
      const seen = new Set<string>();
      for (const m of allMeetings) {
        if (m.deleted_at || !m.firm_id || seen.has(m.firm_id)) continue;
        seen.add(m.firm_id);
        firmIds.push(m.firm_id);
        if (firmIds.length >= 30) break; // cost cap
      }
      for (const fid of firmIds) {
        const f = await base44.asServiceRole.entities.Firm.get(fid).catch(() => null);
        if (f && !f.deleted_at) targetFirms.push(f);
      }
    }

    let newAlerts = 0;
    let updatedAlerts = 0;
    let firmsProcessed = 0;
    const errors: { firm_id: string; error: string }[] = [];

    for (const firm of targetFirms) {
      try {
        const effectiveTenant = firm.tenant_id || tenantId;
        const { meetings: scraped } = await scrapeFirmBoardMeetings(base44, firm.id, effectiveTenant);
        if (!scraped.length) { firmsProcessed++; continue; }

        const existing = await base44.asServiceRole.entities.BoardMeeting.filter({ firm_id: firm.id }).catch(() => []);
        const activeExisting = (existing || []).filter((m: any) => !m.deleted_at);

        const matchKey = (m: any) => `${(m.title || '').trim().toLowerCase()}|${(m.meeting_date || '').slice(0, 10)}`;
        const existingByTitleDate = new Map<string, any>();
        const existingBySource = new Map<string, any>();
        activeExisting.forEach((m: any) => {
          existingByTitleDate.set(matchKey(m), m);
          if (m.source_url) existingBySource.set(m.source_url, m);
        });

        // Load recent alerts for this firm to deduplicate (avoid re-alerting
        // the same change on every run). A signature uniquely identifies an
        // alert for this firm within the dedup window.
        const recentAlerts = await base44.asServiceRole.entities.BoardMeetingAlert
          .filter({ firm_id: firm.id }).catch(() => []);
        const dedupSigs = new Set<string>();
        const sinceMs = Date.now() - 14 * 24 * 60 * 60 * 1000;
        for (const a of (recentAlerts || [])) {
          if (a.deleted_at) continue;
          const created = new Date(a.created_date || 0).getTime();
          if (created < sinceMs) continue;
          const sig = `${(a.meeting_title || '').trim().toLowerCase()}|${(a.meeting_date || '').slice(0, 10)}|${a.alert_type}|${a.field_changed || ''}`;
          dedupSigs.add(sig);
        }

        for (const s of scraped) {
          const key = matchKey(s);
          let matched = existingByTitleDate.get(key);
          if (!matched && s.source_url) matched = existingBySource.get(s.source_url);

          if (!matched) {
            // New meeting detected on the firm's calendar.
            const sig = `${(s.title || '').trim().toLowerCase()}|${(s.meeting_date || '').slice(0, 10)}|new_meeting|`;
            if (dedupSigs.has(sig)) continue;
            dedupSigs.add(sig);
            await base44.asServiceRole.entities.BoardMeetingAlert.create({
              tenant_id: effectiveTenant || undefined,
              firm_id: firm.id,
              firm_name: firm.name,
              alert_type: 'new_meeting',
              meeting_title: s.title || 'Untitled board meeting',
              meeting_date: s.meeting_date || '',
              details: `New board meeting detected on ${firm.name}'s calendar: "${s.title || 'Untitled'}"${s.meeting_date ? ` on ${s.meeting_date}` : ''}.`,
              source_url: s.source_url || '',
              is_read: false,
              is_dismissed: false,
            });
            newAlerts++;
          } else {
            // Existing tracked meeting — look for concrete field changes.
            const changes: { field: string; previous_value: string; new_value: string }[] = [];
            const sd = (s.meeting_date || '').slice(0, 10);
            const md = (matched.meeting_date || '').slice(0, 10);
            if (sd && md && sd !== md) {
              changes.push({ field: 'meeting_date', previous_value: md, new_value: sd });
            }
            if (s.agenda_url && !matched.agenda_url) {
              changes.push({ field: 'agenda_url', previous_value: '', new_value: s.agenda_url });
            }
            if (s.minutes_url && !matched.minutes_url) {
              changes.push({ field: 'minutes_url', previous_value: '', new_value: s.minutes_url });
            }
            for (const c of changes) {
              const sig = `${(s.title || '').trim().toLowerCase()}|${(s.meeting_date || '').slice(0, 10)}|updated_meeting|${c.field}`;
              if (dedupSigs.has(sig)) continue;
              dedupSigs.add(sig);
              const detail = c.field === 'meeting_date'
                ? `"${s.title || 'Untitled'}" rescheduled from ${c.previous_value} to ${c.new_value}.`
                : `"${s.title || 'Untitled'}" now has a ${c.field === 'agenda_url' ? 'meeting agenda' : 'meeting minutes'} document available.`;
              await base44.asServiceRole.entities.BoardMeetingAlert.create({
                tenant_id: effectiveTenant || undefined,
                firm_id: firm.id,
                firm_name: firm.name,
                alert_type: 'updated_meeting',
                meeting_title: s.title || 'Untitled board meeting',
                meeting_date: s.meeting_date || '',
                meeting_id: matched.id,
                field_changed: c.field,
                previous_value: c.previous_value,
                new_value: c.new_value,
                details: `${firm.name}: ${detail}`,
                source_url: s.source_url || matched.source_url || '',
                is_read: false,
                is_dismissed: false,
              });
              updatedAlerts++;
            }
          }
        }
        firmsProcessed++;
      } catch (e: any) {
        errors.push({ firm_id: firm.id, error: e.message || String(e) });
      }
    }

    return Response.json({
      status: 'ok',
      firms_processed: firmsProcessed,
      new_alerts: newAlerts,
      updated_alerts: updatedAlerts,
      errors,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}