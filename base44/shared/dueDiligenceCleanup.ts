// Core due diligence cleanup operations shared between the single-record
// cascade/merge backend functions and the bulk integrity cleanup function.
// Both callers pass a service-role client (svc) so records owned by other
// users can be cleaned up.

// Cascading due diligence deletion: deletes the DD record plus its related
// stage note versions and notifications, then recomputes the product's
// product_status so it isn't left stuck in an auto-set state (In-Process /
// Approved) backed by no DD record. Manual statuses (On-Hold, Rejected,
// Removed) are never touched.
export async function cascadeDeleteDueDiligence(svc: any, ddId: string) {
  const counts: any = {};
  const dd = await svc.entities.DueDiligence.get(ddId);
  if (!dd) return { dd: null, counts };

  // --- Stage note versions (prior approvals / note history) ---
  const versions = await svc.entities.DdStageNoteVersion.filter({ due_diligence_id: ddId });
  if (versions.length) {
    await svc.entities.DdStageNoteVersion.deleteMany({ due_diligence_id: ddId });
  }
  counts.stage_note_versions = versions.length;

  // --- Notifications (approver + assigned team member notifications) ---
  const notifications = await svc.entities.DdNotification.filter({ due_diligence_id: ddId });
  if (notifications.length) {
    await svc.entities.DdNotification.deleteMany({ due_diligence_id: ddId });
  }
  counts.notifications = notifications.length;

  // --- Delete the DD record itself ---
  await svc.entities.DueDiligence.delete(ddId);

  // --- Recompute the product's product_status now that this DD is gone ---
  if (dd.product_id) {
    try {
      const product = await svc.entities.Product.get(dd.product_id);
      if (product && (product.product_status === "In-Process" || product.product_status === "Approved")) {
        const remaining = (await svc.entities.DueDiligence.filter({ product_id: dd.product_id }))
          .filter((r: any) => !r.deleted_at);
        const hasBuyList = remaining.some((r: any) => r.status === "Buy List");
        const hasActive = remaining.some((r: any) => r.status !== "Buy List" && r.status !== "Rejected");
        const newStatus = hasBuyList ? "Approved" : (hasActive ? "In-Process" : "Not Reviewed");
        if (newStatus !== product.product_status) {
          await svc.entities.Product.update(dd.product_id, { product_status: newStatus });
          counts.product_status_reverted = { from: product.product_status, to: newStatus };
        }
      }
    } catch { /* product not found — no-op */ }
  }

  return { dd, counts };
}

// Merge duplicate DD records into a single primary. Repoints linked records
// (stage note versions, notifications, external chats) from each secondary
// onto the primary, merges analyst_history (deduped), then deletes the
// secondaries. Throws on tenant mismatch so callers can surface the error.
export async function mergeDueDiligenceRecords(svc: any, primaryId: string, secondaryIds: string[]) {
  const primary = await svc.entities.DueDiligence.get(primaryId);
  if (!primary) throw new Error('Primary due diligence record not found');

  const counts = { stage_note_versions: 0, notifications: 0, external_chats: 0, analyst_history_added: 0, deleted: 0 };

  const existingKeys = new Set(
    (primary.analyst_history || []).map((h: any) =>
      `${h?.analyst_type || ''}|${h?.contact_id || ''}|${h?.start_date || ''}`
    )
  );
  const mergedAnalystHistory = [...(primary.analyst_history || [])];

  for (const secId of secondaryIds) {
    const sec = await svc.entities.DueDiligence.get(secId);
    if (!sec) continue;

    // Tenant guard: every secondary must belong to the same tenant as the primary.
    if (sec.tenant_id && primary.tenant_id && sec.tenant_id !== primary.tenant_id) {
      throw new Error(`Secondary record ${secId} belongs to a different tenant`);
    }

    // --- Repoint stage note versions (status / approval history) ---
    try {
      const versions = await svc.entities.DdStageNoteVersion.filter({ due_diligence_id: secId });
      if (versions.length) {
        await svc.entities.DdStageNoteVersion.updateMany(
          { due_diligence_id: secId },
          { $set: { due_diligence_id: primaryId } }
        );
        counts.stage_note_versions += versions.length;
      }
    } catch {}

    // --- Repoint notifications (approver + team member activities) ---
    try {
      const notifications = await svc.entities.DdNotification.filter({ due_diligence_id: secId });
      if (notifications.length) {
        await svc.entities.DdNotification.updateMany(
          { due_diligence_id: secId },
          { $set: { due_diligence_id: primaryId } }
        );
        counts.notifications += notifications.length;
      }
    } catch {}

    // --- Repoint external chats (external firm chat activities) ---
    try {
      const chats = await svc.entities.ExternalChat.filter({ due_diligence_id: secId });
      if (chats.length) {
        await svc.entities.ExternalChat.updateMany(
          { due_diligence_id: secId },
          { $set: { due_diligence_id: primaryId } }
        );
        counts.external_chats += chats.length;
      }
    } catch {}

    // --- Merge analyst_history (dedupe by type+contact+start_date) ---
    for (const h of (sec.analyst_history || [])) {
      const key = `${h?.analyst_type || ''}|${h?.contact_id || ''}|${h?.start_date || ''}`;
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        mergedAnalystHistory.push(h);
        counts.analyst_history_added++;
      }
    }

    // --- Delete the secondary DD record (linked records already moved) ---
    try {
      await svc.entities.DueDiligence.delete(secId);
      counts.deleted++;
    } catch {}
  }

  // Persist the merged analyst_history onto the primary.
  if (counts.analyst_history_added > 0) {
    await svc.entities.DueDiligence.update(primaryId, { analyst_history: mergedAnalystHistory });
  }

  return { primary, counts };
}