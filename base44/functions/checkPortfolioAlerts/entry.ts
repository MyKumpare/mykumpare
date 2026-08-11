import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Called by the "Portfolio Alerts" workflow when a Portfolio record is updated.
// Checks two alert conditions and sends email notifications to the portfolio creator:
//   1. Funding status changed to "Terminated"
//   2. Allocation limit reached (advisor allocations reach portfolio total, or
//      sub-manager allocations reach advisor total)
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json();
    const { portfolio_id, changed_fields, old_funding_status } = body;

    if (!portfolio_id) {
      return Response.json({ error: 'portfolio_id required' }, { status: 400 });
    }

    // Re-fetch the portfolio to get current full data
    const portfolio = await svc.entities.Portfolio.get(portfolio_id);
    if (!portfolio) {
      return Response.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    const fields = Array.isArray(changed_fields) ? changed_fields : [];
    const alerts = [];

    // ── Alert 1: Funding status changed to "Terminated" ──
    if (
      fields.includes('funding_status') &&
      portfolio.funding_status === 'Terminated' &&
      old_funding_status !== 'Terminated'
    ) {
      alerts.push({
        type: 'funding_terminated',
        subject: `Portfolio Terminated: ${portfolio.portfolio_name}`,
        banner: 'Funding Status Change',
        message: `The funding status for portfolio "${portfolio.portfolio_name}" has been changed to "Terminated".`,
      });
    }

    // ── Alert 2: Allocation limit reached ──
    if (fields.includes('allocation_history')) {
      const allocHistory = portfolio.allocation_history || [];

      const calcTotal = (level) =>
        allocHistory
          .filter((e) => e.level === level)
          .reduce((sum, e) =>
            e.activity_type === 'Redemption' ? sum - (e.amount || 0) : sum + (e.amount || 0), 0);

      const portfolioTotal = calcTotal('portfolio');
      const advisorTotal = calcTotal('advisor');
      const subManagerTotal = calcTotal('sub_manager');

      // Advisor allocations reached portfolio total
      if (portfolioTotal > 0 && advisorTotal >= portfolioTotal * 0.999) {
        alerts.push({
          type: 'allocation_limit_portfolio',
          subject: `Allocation Limit Reached: ${portfolio.portfolio_name}`,
          banner: 'Allocation Limit Reached',
          message: `Advisor allocations for portfolio "${portfolio.portfolio_name}" have reached the portfolio total ($${advisorTotal.toLocaleString()} of $${portfolioTotal.toLocaleString()}). No further allocations are available.`,
        });
      }

      // Sub-manager allocations reached advisor total
      if (advisorTotal > 0 && subManagerTotal >= advisorTotal * 0.999) {
        alerts.push({
          type: 'allocation_limit_advisor',
          subject: `Sub-Manager Allocation Limit Reached: ${portfolio.portfolio_name}`,
          banner: 'Sub-Manager Allocation Limit Reached',
          message: `Sub-manager allocations for portfolio "${portfolio.portfolio_name}" have reached the advisor total ($${subManagerTotal.toLocaleString()} of $${advisorTotal.toLocaleString()}). No further sub-manager allocations are available.`,
        });
      }
    }

    if (alerts.length === 0) {
      return Response.json({ status: 'no_alerts' });
    }

    // Look up the portfolio creator's email
    let creatorEmail = null;
    let creatorName = null;
    if (portfolio.created_by_id) {
      try {
        const creator = await svc.entities.User.get(portfolio.created_by_id);
        creatorEmail = creator?.email;
        creatorName = creator?.full_name;
      } catch (e) {
        // Creator not found — skip email
      }
    }

    if (!creatorEmail) {
      return Response.json({ status: 'no_recipient', alerts: alerts.length });
    }

    // Get Outlook connector token for sending emails
    let outlookToken = null;
    try {
      const { accessToken } = await svc.connectors.getConnection('outlook');
      outlookToken = accessToken;
    } catch (e) {
      return Response.json({ error: 'Outlook connector not available: ' + e.message }, { status: 500 });
    }

    let sent = 0;
    for (const alert of alerts) {
      const htmlBody = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">Portfolio Alert</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 13px;">${alert.banner}</p>
          </div>
          <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
            <p style="color: #374151; font-size: 14px;">Hi ${creatorName || creatorEmail},</p>
            <p style="color: #374151; font-size: 14px; line-height: 1.6;">${alert.message}</p>
            <p style="color: #374151; font-size: 14px; line-height: 1.6;">Please review this portfolio in MyKumpare.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 11px;">This is an automated alert from the MyKumpare platform.</p>
          </div>
        </div>
      `;

      try {
        const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${outlookToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              subject: alert.subject,
              body: { contentType: 'HTML', content: htmlBody },
              toRecipients: [{ emailAddress: { address: creatorEmail } }],
            },
            saveToSentItems: true,
          }),
        });

        if (response.ok) sent++;
      } catch (e) {
        // Email failed — continue to next alert
      }
    }

    return Response.json({ status: 'alerts_sent', sent, total: alerts.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}