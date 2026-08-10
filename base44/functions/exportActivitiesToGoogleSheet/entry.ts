import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const CONNECTOR_ID = '6a7a0a0053ff7a2369c7c5d4';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get the app user's Google Sheets connection (APP_USER mode)
    let accessToken;
    try {
      const conn = await base44.asServiceRole.connectors.getCurrentAppUserConnection(CONNECTOR_ID);
      accessToken = conn.accessToken;
    } catch (e) {
      return Response.json({
        error: 'Google Sheets is not connected. Please connect your Google account.',
        notConnected: true
      }, { status: 400 });
    }

    // Fetch all activities and tasks
    const activities = await base44.asServiceRole.entities.ContactActivity.list('-activity_date', 5000);
    const tasks = await base44.asServiceRole.entities.FollowUpTask.list('-due_date', 5000);

    const dateStr = new Date().toISOString().substring(0, 10);
    const spreadsheetTitle = `MyKumpare Calendar Export - ${dateStr}`;

    // Create a new spreadsheet with two sheets
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: { title: spreadsheetTitle },
        sheets: [
          { properties: { title: 'Activities' } },
          { properties: { title: 'Tasks' } }
        ]
      })
    });

    if (!createRes.ok) {
      const text = await createRes.text();
      return Response.json({
        error: `Google Sheets API error: ${createRes.status} ${text.substring(0, 300)}`,
        notConnected: createRes.status === 401 || createRes.status === 403
      }, { status: 500 });
    }

    const spreadsheet = await createRes.json();
    const spreadsheetId = spreadsheet.spreadsheetId;
    const spreadsheetUrl = spreadsheet.spreadsheetUrl;

    // Build activity rows
    const activityHeader = ['Date', 'Type', 'Subjects', 'Notes', 'Firm Type', 'Associated Firms', 'Associated Contacts'];
    const activityRows = activities.map(a => {
      const firms = (a.associated_firms_contacts || []).map(f => f.firm_name).filter(Boolean);
      const contacts = (a.associated_firms_contacts || []).flatMap(f => (f.contacts || []).map(c => c.contact_name)).filter(Boolean);
      return [
        a.activity_date || '',
        a.activity_type || '',
        (a.subjects || []).join(', '),
        (a.notes || '').replace(/<[^>]*>/g, '').trim(),
        a.firm_type || '',
        firms.join(', '),
        contacts.join(', ')
      ];
    });

    // Write activities
    const activitiesRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:append?range=Activities!A1&valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: [activityHeader, ...activityRows] })
      }
    );

    if (!activitiesRes.ok) {
      const text = await activitiesRes.text();
      return Response.json({
        error: `Google Sheets write error: ${activitiesRes.status} ${text.substring(0, 300)}`,
        spreadsheetUrl
      }, { status: 500 });
    }

    // Build task rows
    const taskHeader = ['Due Date', 'Description', 'Status', 'Assigned Firms', 'Assigned Contacts'];
    const taskRows = tasks.map(t => {
      const firms = (t.assigned_firms_contacts || []).map(f => f.firm_name).filter(Boolean);
      const contacts = (t.assigned_firms_contacts || []).flatMap(f => (f.contacts || []).map(c => c.contact_name)).filter(Boolean);
      return [
        t.due_date || '',
        (t.task_description || '').replace(/<[^>]*>/g, '').trim(),
        t.status || '',
        firms.join(', '),
        contacts.join(', ')
      ];
    });

    // Write tasks
    const tasksRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:append?range=Tasks!A1&valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: [taskHeader, ...taskRows] })
      }
    );

    if (!tasksRes.ok) {
      const text = await tasksRes.text();
      return Response.json({
        error: `Google Sheets write error: ${tasksRes.status} ${text.substring(0, 300)}`,
        spreadsheetUrl
      }, { status: 500 });
    }

    return Response.json({
      success: true,
      spreadsheetUrl,
      spreadsheetId,
      activityCount: activities.length,
      taskCount: tasks.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}