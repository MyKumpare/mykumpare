import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Daily stale-contact interaction checker.
 *
 * Reads the ContactReminderSettings threshold (default 30 days), computes how
 * long it has been since each contact's most recent recorded ContactActivity,
 * and flags contacts whose last interaction exceeds the threshold.
 *
 * - Creates a ContactInteractionReminder (status "pending") for each newly
 *   stale contact (one-time alert per stale period — dismissed/resolved
 *   reminders are not re-alerted).
 * - Updates days_since_last_interaction on existing pending reminders.
 * - Auto-resolves pending reminders for contacts that have since had a new
 *   interaction (days_since now below threshold).
 * - Emails a summary of newly-flagged stale contacts to every admin user.
 *
 * Invoked daily by the "Stale Contact Interaction Reminders" scheduled
 * workflow, so there is no end-user auth — data access uses the service role.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // ── Load settings (create defaults if none exist yet) ──────────────
    let settings = (await base44.asServiceRole.entities.ContactReminderSettings.list("-created_date", 1))[0];
    if (!settings) {
      settings = await base44.asServiceRole.entities.ContactReminderSettings.create({
        days_threshold: 30,
        schedule_enabled: true,
        schedule_time: "07:00",
      });
    }

    if (settings.schedule_enabled === false) {
      return Response.json({ skipped: "schedule disabled", settings_id: settings.id });
    }

    const thresholdDays: number = Number(settings.days_threshold) || 30;
    const now = new Date();
    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(now.getTime() - thresholdMs);

    // ── Build contact_id → latest activity_date map ────────────────────
    // Fetch activities newest-first in batches; stop once we pass the
    // cutoff (any contact not yet seen has no recent activity → stale).
    const latestByContact = new Map<string, string>();
    let skip = 0;
    const batchSize = 500;
    let reachedOld = false;
    let safetyBatches = 0;
    while (!reachedOld && safetyBatches < 40) {
      const batch = await base44.asServiceRole.entities.ContactActivity.list("-activity_date", batchSize, skip);
      if (batch.length === 0) break;
      for (const a of batch) {
        if (!a.contact_id) continue;
        if (!latestByContact.has(a.contact_id)) {
          latestByContact.set(a.contact_id, a.activity_date);
        }
      }
      // If the oldest activity in this batch is before the cutoff, every
      // contact not yet seen is already stale — no need to keep paging.
      const oldest = batch[batch.length - 1]?.activity_date;
      if (oldest && new Date(oldest) < cutoffDate) reachedOld = true;
      skip += batch.length;
      safetyBatches++;
      if (batch.length < batchSize) break;
    }

    // ── Fetch all active contacts ─────────────────────────────────────
    const contacts = await base44.asServiceRole.entities.Contact.list("-created_date", 2000);
    const activeContacts = contacts.filter((c) => !c.deleted_at && c.contact_status !== "Inactive");

    // ── Fetch firms for firm-name denormalization ──────────────────────
    const firmIds = new Set<string>();
    for (const c of activeContacts) {
      const fid = c.firm_ids?.[0];
      if (fid) firmIds.add(fid);
    }
    const firmNameById = new Map<string, string>();
    for (const fid of firmIds) {
      try {
        const f = await base44.asServiceRole.entities.Firm.get(fid);
        if (f) firmNameById.set(fid, f.name || "");
      } catch { /* firm may be deleted */ }
    }

    // ── Compute stale contacts ────────────────────────────────────────
    type StaleInfo = {
      contact_id: string;
      contact_name: string;
      firm_id: string;
      firm_name: string;
      last_interaction_date: string;
      days_since: number;
    };
    const staleContacts: StaleInfo[] = [];
    const contactLatest = new Map<string, { date: string; days: number }>();

    for (const c of activeContacts) {
      const lastDateStr = latestByContact.get(c.id);
      let lastDate: Date | null = null;
      let daysSince: number;

      if (lastDateStr) {
        lastDate = new Date(lastDateStr);
        daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000));
      } else {
        // No interactions ever — measure from contact creation date.
        const created = c.created_date ? new Date(c.created_date) : now;
        daysSince = Math.floor((now.getTime() - created.getTime()) / (24 * 60 * 60 * 1000));
      }

      contactLatest.set(c.id, { date: lastDateStr || "", days: daysSince });

      if (daysSince >= thresholdDays) {
        const fid = c.firm_ids?.[0] || "";
        const fullName = [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix]
          .filter(Boolean).join(" ").trim() || c.first_name || "Unknown";
        staleContacts.push({
          contact_id: c.id,
          contact_name: fullName,
          firm_id: fid,
          firm_name: firmNameById.get(fid) || "",
          last_interaction_date: lastDateStr || "",
          days_since: daysSince,
        });
      }
    }

    // ── Sync reminder records ─────────────────────────────────────────
    // Fetch existing reminders keyed by contact_id so we only alert once
    // per stale period.
    const existingReminders = await base44.asServiceRole.entities.ContactInteractionReminder.list("-created_date", 2000);
    const reminderByContact = new Map<string, any>();
    for (const r of existingReminders) {
      if (r.contact_id && !reminderByContact.has(r.contact_id)) {
        reminderByContact.set(r.contact_id, r);
      }
    }

    const staleIds = new Set(staleContacts.map((s) => s.contact_id));
    const newlyFlagged: StaleInfo[] = [];
    let resolvedCount = 0;

    for (const s of staleContacts) {
      const existing = reminderByContact.get(s.contact_id);
      if (!existing) {
        // New stale contact → create pending reminder + alert.
        await base44.asServiceRole.entities.ContactInteractionReminder.create({
          contact_id: s.contact_id,
          contact_name: s.contact_name,
          firm_id: s.firm_id,
          firm_name: s.firm_name,
          last_interaction_date: s.last_interaction_date,
          days_since_last_interaction: s.days_since,
          threshold_days: thresholdDays,
          status: "pending",
          alert_sent_at: new Date().toISOString(),
        });
        newlyFlagged.push(s);
      } else if (existing.status === "pending") {
        // Already alerted — just refresh the day count.
        await base44.asServiceRole.entities.ContactInteractionReminder.update(existing.id, {
          days_since_last_interaction: s.days_since,
          last_interaction_date: s.last_interaction_date,
          firm_name: s.firm_name || existing.firm_name,
        });
      }
      // dismissed reminders stay dismissed; resolved reminders stay resolved.
    }

    // Auto-resolve pending reminders whose contact is no longer stale.
    for (const [cid, r] of reminderByContact) {
      if (r.status === "pending" && !staleIds.has(cid)) {
        await base44.asServiceRole.entities.ContactInteractionReminder.update(r.id, {
          status: "resolved",
          resolved_at: new Date().toISOString(),
        });
        resolvedCount++;
      }
    }

    // ── Email summary of newly-flagged contacts to admins ────────────
    let sent = 0;
    const errors: any[] = [];
    if (newlyFlagged.length > 0) {
      const users = await base44.asServiceRole.entities.User.list();
      const admins = users.filter((u) => u.role === "admin" && u.email);
      if (admins.length > 0) {
        const dateStr = now.toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        });
        const subject = `⏰ Stale Contact Reminders — ${newlyFlagged.length} contact${newlyFlagged.length === 1 ? "" : "s"} need outreach (${dateStr})`;

        const rows = newlyFlagged
          .slice()
          .sort((a, b) => b.days_since - a.days_since)
          .map((s, i) => {
            const last = s.last_interaction_date
              ? new Date(s.last_interaction_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "<em>never</em>";
            const firm = s.firm_name ? ` · ${escapeHtml(s.firm_name)}` : "";
            return [
              `<tr>`,
              `<td style="padding:10px 0;border-bottom:1px solid #f3f4f6;vertical-align:top;">`,
              `<div style="font-size:11px;color:#9ca3af;margin-bottom:2px;">#${i + 1}${firm}</div>`,
              `<div style="font-weight:600;color:#111827;font-size:14px;">${escapeHtml(s.contact_name)}</div>`,
              `<div style="color:#b45309;font-size:12px;margin-top:2px;">${s.days_since} days since last interaction · last: ${last}</div>`,
              `</td>`,
              `</tr>`,
            ].join("");
          }).join("");

        const body = [
          `<h2 style="margin:0 0 8px;color:#111827;">Stale Contact Reminders</h2>`,
          `<p style="margin:0 0 4px;color:#6b7280;font-size:13px;">${dateStr}</p>`,
          `<p style="margin:8px 0 12px;color:#374151;">${newlyFlagged.length} contact${newlyFlagged.length === 1 ? "" : "s"} have not had a recorded interaction in over ${thresholdDays} days:</p>`,
          `<table style="width:100%;border-collapse:collapse;">${rows}</table>`,
          `<p style="margin:16px 0 0;color:#9ca3af;font-size:11px;">Review and log new interactions in MyKumpare to clear these reminders.</p>`,
        ].join("");

        for (const admin of admins) {
          try {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: admin.email,
              subject,
              body,
            });
            sent++;
          } catch (e) {
            errors.push({ email: admin.email, error: (e as Error).message });
          }
        }
      }
    }

    // ── Update settings run metadata ──────────────────────────────────
    await base44.asServiceRole.entities.ContactReminderSettings.update(settings.id, {
      last_run_at: new Date().toISOString(),
      last_alert_count: newlyFlagged.length,
    });

    return Response.json({
      threshold_days: thresholdDays,
      total_contacts: activeContacts.length,
      stale_contacts: staleContacts.length,
      newly_flagged: newlyFlagged.length,
      resolved: resolvedCount,
      emails_sent: sent,
      errors,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}