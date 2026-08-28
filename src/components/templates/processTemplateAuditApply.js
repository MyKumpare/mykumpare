/**
 * Pure helpers that apply a single discrete process-template audit change to
 * the stages and documentation_checklist arrays. Each change is self-contained
 * and can be applied independently (used by the "Apply Selected" action).
 * "Apply All" instead replaces the structure with the AI's cohesive
 * recommended_stages / recommended_doc_checklist.
 */

let _newId = 0;
const genId = (prefix) => `${prefix}_${Date.now()}_${++_newId}`;

const cloneStages = (stages) => (stages || []).map((s) => ({
  id: s.id,
  name: s.name,
  sub_stages: (s.sub_stages || []).map((ss) => ({ ...ss }))
}));

const cloneDocs = (docs) => (docs || []).map((d) => ({ ...d }));

/**
 * Apply a single change. Returns { stages, docChecklist }.
 */
export function applyChange(stages, docChecklist, change) {
  let nextStages = cloneStages(stages);
  let nextDocs = cloneDocs(docChecklist);

  switch (change.type) {
    case "rename_stage":
      nextStages = nextStages.map((s) => (s.id === change.stage_id ? { ...s, name: change.new_name } : s));
      break;

    case "remove_stage":
      nextStages = nextStages.filter((s) => s.id !== change.stage_id);
      break;

    case "add_stage":
      nextStages = [...nextStages, {
        id: genId("stage"),
        name: change.new_name || "New Stage",
        sub_stages: (change.sub_stages || []).map((ss) => ({ id: genId("sub"), name: ss.name || "" }))
      }];
      break;

    case "merge_stages": {
      const idsToMerge = new Set(change.stage_ids || []);
      const remaining = nextStages.filter((s) => !idsToMerge.has(s.id));
      const mergedSubs = nextStages
        .filter((s) => idsToMerge.has(s.id))
        .flatMap((s) => (s.sub_stages || []).map((ss) => ({ id: genId("sub"), name: ss.name })));
      nextStages = [...remaining, {
        id: genId("stage"),
        name: change.new_name || "Merged Stage",
        sub_stages: mergedSubs
      }];
      break;
    }

    case "move_stage": {
      const idx = nextStages.findIndex((s) => s.id === change.stage_id);
      if (idx < 0) break;
      const [moved] = nextStages.splice(idx, 1);
      let pos = change.new_position;
      if (typeof pos !== "number" || isNaN(pos)) pos = nextStages.length;
      pos = Math.max(0, Math.min(pos, nextStages.length));
      nextStages.splice(pos, 0, moved);
      break;
    }

    case "rename_sub_stage":
      nextStages = nextStages.map((s) => s.id === change.stage_id ? {
        ...s,
        sub_stages: (s.sub_stages || []).map((ss) => ss.id === change.sub_stage_id ? { ...ss, name: change.new_name } : ss)
      } : s);
      break;

    case "remove_sub_stage":
      nextStages = nextStages.map((s) => s.id === change.stage_id ? {
        ...s,
        sub_stages: (s.sub_stages || []).filter((ss) => ss.id !== change.sub_stage_id)
      } : s);
      break;

    case "add_sub_stage":
      nextStages = nextStages.map((s) => {
        if (s.id !== (change.target_stage_id || change.stage_id)) return s;
        return { ...s, sub_stages: [...(s.sub_stages || []), { id: genId("sub"), name: change.new_name || "New Sub-stage" }] };
      });
      break;

    case "merge_sub_stages": {
      const idsToMerge = new Set(change.sub_stage_ids || []);
      nextStages = nextStages.map((s) => {
        if (s.id !== change.stage_id) return s;
        const subs = s.sub_stages || [];
        const remaining = subs.filter((ss) => !idsToMerge.has(ss.id));
        return { ...s, sub_stages: [...remaining, { id: genId("sub"), name: change.new_name || "Merged Sub-stage" }] };
      });
      break;
    }

    case "move_sub_stage": {
      // Find and remove the sub-stage from its current parent, then append to target.
      let movedSub = null;
      nextStages = nextStages.map((s) => {
        const subs = s.sub_stages || [];
        const found = subs.find((ss) => ss.id === change.sub_stage_id);
        if (found) {
          movedSub = { ...found };
          return { ...s, sub_stages: subs.filter((ss) => ss.id !== change.sub_stage_id) };
        }
        return s;
      });
      if (movedSub) {
        nextStages = nextStages.map((s) => s.id === change.target_stage_id ? { ...s, sub_stages: [...(s.sub_stages || []), movedSub] } : s);
      }
      break;
    }

    case "add_doc_item":
      nextDocs = [...nextDocs, { id: genId("doc"), name: change.new_name || "New Document" }];
      break;

    case "remove_doc_item":
      nextDocs = nextDocs.filter((d) => d.id !== change.doc_item_ids?.[0] && d.id !== change.stage_id);
      break;

    case "rename_doc_item":
      nextDocs = nextDocs.map((d) => (d.id === (change.doc_item_ids?.[0] || change.stage_id) ? { ...d, name: change.new_name } : d));
      break;

    case "merge_doc_items": {
      const idsToMerge = new Set(change.doc_item_ids || []);
      const remaining = nextDocs.filter((d) => !idsToMerge.has(d.id));
      nextDocs = [...remaining, { id: genId("doc"), name: change.new_name || "Merged Document" }];
      break;
    }

    default:
      break;
  }

  return { stages: nextStages, docChecklist: nextDocs };
}

/**
 * Apply a list of changes sequentially. Returns { stages, docChecklist }.
 */
export function applyChanges(stages, docChecklist, changes) {
  return changes.reduce(
    (acc, ch) => applyChange(acc.stages, acc.docChecklist, ch),
    { stages, docChecklist }
  );
}