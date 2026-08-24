import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Extracts action items from board meeting minutes/notes using an LLM, creates
// a FollowUpTask for each, and flags high-priority follow-ups.
// - If body.meeting_id is provided, processes that single meeting.
// - Otherwise, processes every meeting with minutes_content or review_notes
//   that has not yet been extracted (action_items_extracted != true).
// Designed to run via the "Board Meeting Action Item Extractor" workflow, and
// can also be invoked manually from the BoardMeetingCard "Extract Actions" button.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const meetingId = body?.meeting_id;

    let meetingsToProcess: any[] = [];
    if (meetingId) {
      const m = await base44.asServiceRole.entities.BoardMeeting.get(meetingId).catch(() => null);
      if (m && !m.deleted_at) meetingsToProcess = [m];
    } else {
      const all = await base44.asServiceRole.entities.BoardMeeting.list('-meeting_date', 2000).catch(() => []);
      meetingsToProcess = (all || []).filter((m: any) =>
        !m.deleted_at && !m.action_items_extracted && (m.minutes_content || m.review_notes)
      );
    }

    if (!meetingsToProcess.length) {
      return Response.json({ status: 'ok', processed: 0, tasks_created: 0, high_priority: 0 });
    }

    let totalCreated = 0;
    let totalHighPriority = 0;
    let processed = 0;

    for (const meeting of meetingsToProcess) {
      const content = [meeting.minutes_content, meeting.review_notes].filter(Boolean).join('\n\n').trim();
      if (!content) { continue; }

      const prompt = `You are an assistant that extracts action items from board meeting notes and minutes. From the text below, extract every concrete action item, follow-up task, or to-do that was mentioned or assigned. For each item, determine whether it is a HIGH-PRIORITY follow-up — high priority means urgent, deadline-driven, compliance- or regulatory-related, financially material, or explicitly flagged as a priority in the text.

Return a JSON object with an "action_items" array. Each item must have:
- "description": a clear, actionable task statement (imperative, e.g. "Review the proposed fee schedule before the next meeting").
- "high_priority": boolean (true only if it meets the high-priority criteria above).
- "due_date": a YYYY-MM-DD string if an explicit deadline is mentioned, otherwise an empty string.

Meeting title: ${meeting.title || 'Untitled'}
Meeting date: ${meeting.meeting_date || 'unknown'}

Meeting notes:
"""
${content.slice(0, 8000)}
"""

Return ONLY the JSON object.`;

      let actionItems: any[] = [];
      try {
        const llmRes: any = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: 'object',
            properties: {
              action_items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    description: { type: 'string' },
                    high_priority: { type: 'boolean' },
                    due_date: { type: 'string' },
                  },
                },
              },
            },
          },
        });
        actionItems = llmRes?.action_items || [];
      } catch {
        continue;
      }

      if (!actionItems.length) {
        // Mark as extracted even if none found, so we don't reprocess
        try {
          await base44.asServiceRole.entities.BoardMeeting.update(meeting.id, {
            action_items_extracted: true,
            action_item_count: 0,
          });
        } catch {}
        processed++;
        continue;
      }

      // Find an originator contact (the firm's first active contact)
      let originatorContactId = '';
      let originatorContactName = '';
      if (meeting.firm_id) {
        const contacts = await base44.asServiceRole.entities.Contact.list('-created_date', 100).catch(() => []);
        const firmContact = (contacts || []).find((c: any) =>
          !c.deleted_at && c.contact_status !== 'Inactive' && (c.firm_ids || []).includes(meeting.firm_id)
        );
        if (firmContact) {
          originatorContactId = firmContact.id;
          originatorContactName = [firmContact.first_name, firmContact.last_name].filter(Boolean).join(' ');
        }
      }

      let createdCount = 0;
      let highCount = 0;
      for (const item of actionItems) {
        const desc = (item.description || '').trim();
        if (!desc) continue;
        const dueDate = item.due_date || meeting.meeting_date || new Date().toISOString().slice(0, 10);
        const isHigh = !!item.high_priority;
        try {
          await base44.asServiceRole.entities.FollowUpTask.create({
            originator_contact_id: originatorContactId || 'board-meeting-extractor',
            originator_contact_name: originatorContactName || 'Board Meeting Extractor',
            originator_firm_id: meeting.firm_id || '',
            originator_firm_name: meeting.firm_name || '',
            due_date: dueDate,
            task_description: desc,
            status: 'Not Started',
            is_high_priority: isHigh,
            board_meeting_id: meeting.id,
            assigned_to_firm_id: meeting.firm_id || '',
            assigned_to_firm_name: meeting.firm_name || '',
            activity_label: `Board Meeting: ${meeting.title || 'Untitled'}`,
            notes: `Auto-extracted from board meeting "${meeting.title || 'Untitled'}" on ${meeting.meeting_date || 'n/a'}${isHigh ? ' — flagged HIGH PRIORITY follow-up' : ''}`,
          });
          createdCount++;
          if (isHigh) highCount++;
        } catch {
          // skip failed task creation
        }
      }

      try {
        await base44.asServiceRole.entities.BoardMeeting.update(meeting.id, {
          action_items_extracted: true,
          action_item_count: createdCount,
        });
      } catch {}

      totalCreated += createdCount;
      totalHighPriority += highCount;
      processed++;
    }

    return Response.json({
      status: 'ok',
      processed,
      tasks_created: totalCreated,
      high_priority: totalHighPriority,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}