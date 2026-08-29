import { base44 } from "@/api/base44Client";
import { syncProductFundingStatus } from "@/components/products/fundingStatusSync";

/**
 * Creates and updates DdNotification records based on the supervisor assignments
 * and decisions stored in a DueDiligence record's stages.
 *
 * - When a supervisor is assigned to a stage (supervisor_contact_id set),
 *   a "supervisor_request" notification is created for that supervisor.
 * - When a supervisor has made a decision (status != "pending"), an
 *   "approval_decision" notification is created for the primary analyst.
 * - When a decision is made, the original "supervisor_request" notification
 *   for that stage is marked as "completed".
 *
 * Deduplication: before creating, we check whether a notification with the
 * same (due_diligence_id, contact_id, type, stage_name, supervisor_status)
 * already exists.
 *
 * @param {object} ddRecord - The saved DueDiligence record (must include id + stages).
 */
export async function syncDdNotifications(ddRecord) {
  if (!ddRecord?.id || !Array.isArray(ddRecord.stages)) return;

  for (const stage of ddRecord.stages) {
    const supStatus = stage.supervisor_status || "pending";

    // 0. Clean up stale supervisor_request notifications for this stage.
    //    If the assigned supervisor has changed (or been removed), mark the
    //    previous approver's pending notification as "completed" so they can
    //    no longer see or act on the approval buttons.
    const stageRequests = await base44.entities.DdNotification.filter(
      {
        due_diligence_id: ddRecord.id,
        type: "supervisor_request",
        stage_name: stage.name || "",
      },
      "-created_date",
      50
    );
    for (const req of stageRequests) {
      if (req.status === "completed") continue;
      if (req.contact_id !== stage.supervisor_contact_id) {
        await base44.entities.DdNotification.update(req.id, { status: "completed" });
      }
    }

    if (!stage.supervisor_contact_id) continue;

    // 1. Supervisor request — created when a supervisor is assigned and
    //    status is still "pending". Only one per (stage, supervisor) pair.
    if (supStatus === "pending") {
      const existing = await base44.entities.DdNotification.filter(
        {
          due_diligence_id: ddRecord.id,
          contact_id: stage.supervisor_contact_id,
          type: "supervisor_request",
          stage_name: stage.name || "",
        },
        "-created_date",
        10
      );

      if (existing.length === 0) {
        await base44.entities.DdNotification.create({
          contact_id: stage.supervisor_contact_id,
          contact_name: stage.supervisor_name || "",
          type: "supervisor_request",
          title: `Supervisor approval requested: "${stage.name || "Stage"}"`,
          message: `Stage "${stage.name || "Stage"}" of ${ddRecord.product_name || "due diligence"}${ddRecord.firm_name ? ` for ${ddRecord.firm_name}` : ""} requires your review and approval.`,
          due_diligence_id: ddRecord.id,
          firm_name: ddRecord.firm_name || "",
          product_name: ddRecord.product_name || "",
          stage_name: stage.name || "",
          supervisor_status: "pending",
          status: "unread",
        });

        // ─── Send email notification to the supervisor ───
        // SendEmail only reaches registered app users; if the supervisor is not
        // a registered user the call is silently skipped (in-app notification still works).
        try {
          const supervisorContact = await base44.entities.Contact.get(stage.supervisor_contact_id);
          if (supervisorContact?.email) {
            await base44.integrations.Core.SendEmail({
              to: supervisorContact.email,
              subject: `Approval Request: "${stage.name || "Stage"}" — ${ddRecord.product_name || "Due Diligence"}`,
              body: `<p>Hello ${stage.supervisor_name || supervisorContact.first_name || ""},</p>` +
                `<p>You have been requested to review and approve stage <strong>"${stage.name || "Stage"}"</strong> ` +
                `for <strong>${ddRecord.product_name || "due diligence"}</strong>${ddRecord.firm_name ? ` at <strong>${ddRecord.firm_name}</strong>` : ""}.</p>` +
                `<p>Please log in to MyKumpare to review the sub-stages and approve, reject, or put on hold.</p>` +
                `<p style="color:#888;font-size:12px;margin-top:16px;">This is an automated notification from MyKumpare.</p>`,
            });
          }
        } catch { /* supervisor not a registered user — in-app notification still works */ }
      }
    }

    // 2. Approval decision — created when the supervisor has made a decision,
    //    notifying the primary analyst. One per (stage, decision) pair.
    if (supStatus !== "pending" && ddRecord.primary_analyst_contact_id) {
      const existing = await base44.entities.DdNotification.filter(
        {
          due_diligence_id: ddRecord.id,
          contact_id: ddRecord.primary_analyst_contact_id,
          type: "approval_decision",
          stage_name: stage.name || "",
          supervisor_status: supStatus,
        },
        "-created_date",
        10
      );

      if (existing.length === 0) {
        const label =
          supStatus === "approved" ? "approved" :
          supStatus === "rejected" ? "rejected" : "put on hold";

        const feedback = stage.rejection_feedback || "";
        const messageBody = supStatus === "rejected" && feedback
          ? `${stage.supervisor_name || "Supervisor"} has ${label} stage "${stage.name || "Stage"}" for ${ddRecord.product_name || "due diligence"}${ddRecord.firm_name ? ` (${ddRecord.firm_name})` : ""}.\n\nRejection Feedback: ${feedback}`
          : `${stage.supervisor_name || "Supervisor"} has ${label} stage "${stage.name || "Stage"}" for ${ddRecord.product_name || "due diligence"}${ddRecord.firm_name ? ` (${ddRecord.firm_name})` : ""}.`;

        await base44.entities.DdNotification.create({
          contact_id: ddRecord.primary_analyst_contact_id,
          contact_name: ddRecord.primary_analyst_name || "",
          type: "approval_decision",
          title: `Stage "${stage.name || "Stage"}" ${label}`,
          message: messageBody,
          due_diligence_id: ddRecord.id,
          firm_name: ddRecord.firm_name || "",
          product_name: ddRecord.product_name || "",
          stage_name: stage.name || "",
          supervisor_status: supStatus,
          rejection_feedback: feedback,
          status: "unread",
        });

        // Send email notification for rejections with feedback
        if (supStatus === "rejected" && feedback) {
          try {
            const analystContact = await base44.entities.Contact.get(ddRecord.primary_analyst_contact_id);
            if (analystContact?.email) {
              await base44.integrations.Core.SendEmail({
                to: analystContact.email,
                subject: `Stage Rejected: "${stage.name || "Stage"}" — ${ddRecord.product_name || "Due Diligence"}`,
                body: `<p>Hello ${ddRecord.primary_analyst_name || analystContact.first_name || ""},</p>` +
                  `<p>Stage <strong>"${stage.name || "Stage"}"</strong> for <strong>${ddRecord.product_name || "due diligence"}</strong>${ddRecord.firm_name ? ` at <strong>${ddRecord.firm_name}</strong>` : ""} has been <strong style="color:#dc2626;">rejected</strong> by ${stage.supervisor_name || "the supervisor"}.</p>` +
                  `<div style="margin:12px 0;padding:10px;border-left:3px solid #dc2626;background:#fef2f2;border-radius:4px;">` +
                  `<p style="margin:0;font-weight:600;color:#991b1b;font-size:13px;">Rejection Feedback:</p>` +
                  `<p style="margin:4px 0 0 0;color:#7f1d1d;font-size:13px;white-space:pre-wrap;">${feedback}</p>` +
                  `</div>` +
                  `<p>Please log in to MyKumpare to review the feedback and take corrective action.</p>` +
                  `<p style="color:#888;font-size:12px;margin-top:16px;">This is an automated notification from MyKumpare.</p>`,
              });
            }
          } catch { /* analyst not a registered user — in-app notification still works */ }
        }
      }

      // 3. Mark the original supervisor_request notification as "completed"
      //    since the supervisor has now made a decision.
      const pendingRequests = await base44.entities.DdNotification.filter(
        {
          due_diligence_id: ddRecord.id,
          contact_id: stage.supervisor_contact_id,
          type: "supervisor_request",
          stage_name: stage.name || "",
        },
        "-created_date",
        10
      );

      for (const req of pendingRequests) {
        if (req.status !== "completed") {
          await base44.entities.DdNotification.update(req.id, { status: "completed" });
        }
      }
    }
  }
}

/**
 * Deletes all DdNotification records associated with a due diligence record.
 * Called when a DD record is deleted to prevent orphaned notifications.
 *
 * @param {string} ddId - The ID of the deleted DueDiligence record.
 */
export async function deleteDdNotifications(ddId) {
  if (!ddId) return;
  try {
    const notifs = await base44.entities.DdNotification.filter(
      { due_diligence_id: ddId },
      "-created_date",
      200
    );
    for (const n of notifs) {
      await base44.entities.DdNotification.delete(n.id);
    }
  } catch { /* no-op — best effort cleanup */ }
}

/**
 * Synchronizes the product_status from the due diligence record:
 *
 * - When a DD is started (created) for a product whose status is "Not Reviewed",
 *   the product is automatically moved to "In-Process".
 * - When a DD reaches "Buy List" status, the product is automatically moved
 *   to "Approved".
 *
 * @param {object} ddRecord - The saved DueDiligence record (must include product_id + status).
 * @param {object} queryClient - React Query client for cache invalidation.
 */
export async function syncProductStatusFromDd(ddRecord, queryClient) {
  if (!ddRecord?.product_id) return;

  try {
    const product = await base44.entities.Product.get(ddRecord.product_id);
    if (!product) return;

    // "Buy List" → "Approved" (terminal state — highest priority)
    if (ddRecord.status === "Buy List" && product.product_status !== "Approved") {
      await base44.entities.Product.update(ddRecord.product_id, { product_status: "Approved" });
      if (queryClient) queryClient.invalidateQueries({ queryKey: ["products"] });
      // DD just completed — recompute funding status (Funded if in an active portfolio).
      await syncProductFundingStatus({ id: ddRecord.product_id, firm_id: product.firm_id }, queryClient);
      return;
    }

    // DD started for a product still in "Not Reviewed" → move to "In-Process"
    if (product.product_status === "Not Reviewed") {
      await base44.entities.Product.update(ddRecord.product_id, { product_status: "In-Process" });
      if (queryClient) queryClient.invalidateQueries({ queryKey: ["products"] });
    }
  } catch { /* product not found or update failed — no-op */ }
}