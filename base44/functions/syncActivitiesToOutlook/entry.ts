import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const timezone = body.timezone || 'UTC';

    // Get Outlook connection (SHARED — builder's account)
    let accessToken;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('outlook');
      accessToken = conn.accessToken;
    } catch (e) {
      return Response.json({
        error: 'Outlook Calendar is not connected. Please authorize the Calendars.ReadWrite permission.',
        notConnected: true
      }, { status: 400 });
    }

    const today = new Date().toISOString().substring(0, 10);

    // Fetch upcoming activities (from today forward)
    const activities = await base44.asServiceRole.entities.ContactActivity.filter(
      { activity_date: { $gte: today } },
      'activity_date',
      500
    );

    // Fetch upcoming tasks (not completed/cancelled)
    const tasks = await base44.asServiceRole.entities.FollowUpTask.filter(
      { due_date: { $gte: today }, status: { $in: ['Not Started', 'In-process'] } },
      'due_date',
      500
    );

    let synced = 0;
    let skipped = 0;
    const errors = [];
    let scopeError = false;

    const createOutlookEvent = async (subject, dateStr, bodyContent) => {
      const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subject: subject.substring(0, 255),
          body: { contentType: 'text', content: bodyContent || 'Synced from MyKumpare' },
          start: { dateTime: `${dateStr}T09:00:00`, timeZone: timezone },
          end: { dateTime: `${dateStr}T09:30:00`, timeZone: timezone },
          reminderMinutesBeforeStart: 15,
          isReminderOn: true,
          showAs: 'busy'
        })
      });

      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401 || res.status === 403) {
          scopeError = true;
        }
        throw new Error(`Outlook API error: ${res.status} ${text.substring(0, 200)}`);
      }

      const data = await res.json();
      return data.id;
    };

    // Sync activities
    for (const activity of activities) {
      if (scopeError) break;
      if (activity.outlook_event_id) { skipped++; continue; }

      const dateStr = activity.activity_date?.substring(0, 10);
      if (!dateStr) { skipped++; continue; }

      const firms = (activity.associated_firms_contacts || []).map(f => f.firm_name).filter(Boolean);
      const contacts = (activity.associated_firms_contacts || []).flatMap(f => (f.contacts || []).map(c => c.contact_name)).filter(Boolean);

      const subjectParts = [];
      if (activity.activity_type) subjectParts.push(`[${activity.activity_type}]`);
      if (activity.subjects && activity.subjects.length) subjectParts.push(activity.subjects.join(', '));
      else subjectParts.push('Activity');
      const subject = subjectParts.join(' ');

      const bodyParts = ['Synced from MyKumpare Activity Calendar'];
      if (firms.length) bodyParts.push(`Firms: ${firms.join(', ')}`);
      if (contacts.length) bodyParts.push(`Contacts: ${contacts.join(', ')}`);
      if (activity.notes) bodyParts.push(`Notes: ${activity.notes.replace(/<[^>]*>/g, '').trim()}`);

      try {
        const eventId = await createOutlookEvent(subject, dateStr, bodyParts.join('\n'));
        await base44.asServiceRole.entities.ContactActivity.update(activity.id, { outlook_event_id: eventId });
        synced++;
      } catch (e) {
        errors.push({ type: 'activity', id: activity.id, subject, error: e.message });
        if (scopeError) break;
      }
    }

    // Sync tasks
    if (!scopeError) {
      for (const task of tasks) {
        if (task.outlook_event_id) { skipped++; continue; }

        const dateStr = task.due_date?.substring(0, 10);
        if (!dateStr) { skipped++; continue; }

        const firms = (task.assigned_firms_contacts || []).map(f => f.firm_name).filter(Boolean);
        const contacts = (task.assigned_firms_contacts || []).flatMap(f => (f.contacts || []).map(c => c.contact_name)).filter(Boolean);

        const descText = (task.task_description || '').replace(/<[^>]*>/g, '').trim() || 'Follow-up task';
        const subject = `[Task] ${descText.substring(0, 248)}`;

        const bodyParts = ['Synced from MyKumpare Activity Calendar', `Status: ${task.status}`];
        if (firms.length) bodyParts.push(`Firms: ${firms.join(', ')}`);
        if (contacts.length) bodyParts.push(`Contacts: ${contacts.join(', ')}`);

        try {
          const eventId = await createOutlookEvent(subject, dateStr, bodyParts.join('\n'));
          await base44.asServiceRole.entities.FollowUpTask.update(task.id, { outlook_event_id: eventId });
          synced++;
        } catch (e) {
          errors.push({ type: 'task', id: task.id, subject, error: e.message });
          if (scopeError) break;
        }
      }
    }

    if (scopeError) {
      return Response.json({
        error: 'Outlook Calendar permission is missing. Please authorize the Calendars.ReadWrite permission.',
        notConnected: true,
        synced,
        skipped
      }, { status: 400 });
    }

    return Response.json({
      synced,
      skipped,
      total: activities.length + tasks.length,
      errorCount: errors.length,
      errors: errors.slice(0, 5)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}