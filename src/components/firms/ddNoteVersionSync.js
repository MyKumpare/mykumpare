import { base44 } from "@/api/base44Client";

/**
 * Creates version history entries for stage notes that changed during a save.
 *
 * Compares the previous DueDiligence record's stage notes against the newly
 * saved record's stage notes. For each stage where notes differ (or are new),
 * a DdStageNoteVersion record is created capturing who edited, when, and the
 * full notes content at that point.
 *
 * @param {object} savedRecord   - The newly saved DueDiligence record (must include id + stages).
 * @param {object|null} previousRecord - The record before the update (null on create).
 */
export async function saveStageNoteVersions(savedRecord, previousRecord) {
  if (!savedRecord?.id || !Array.isArray(savedRecord.stages)) return;

  try {
    const user = await base44.auth.me();
    const editedById = user?.id || "";
    const editedByName = user?.full_name || user?.email || "Unknown";
    const now = new Date().toISOString();

    const versionsToCreate = [];

    for (const stage of savedRecord.stages) {
      const currentNotes = stage.notes || "";
      // Skip empty notes (no point logging empty content)
      if (!currentNotes.trim() || currentNotes === "<p><br></p>") continue;

      const prevStage = previousRecord?.stages?.find((s) => s.id === stage.id);
      const prevNotes = prevStage?.notes || "";

      // Only create a version if notes actually changed
      if (prevNotes === currentNotes) continue;

      versionsToCreate.push({
        due_diligence_id: savedRecord.id,
        stage_id: stage.id || "",
        stage_name: stage.name || "",
        notes_content: currentNotes,
        edited_by_id: editedById,
        edited_by_name: editedByName,
        edited_date: now,
      });
    }

    if (versionsToCreate.length > 0) {
      await base44.entities.DdStageNoteVersion.bulkCreate(versionsToCreate);
    }
  } catch (err) {
    // Version logging is best-effort — never block the main save flow
    console.warn("Failed to save stage note versions:", err);
  }
}