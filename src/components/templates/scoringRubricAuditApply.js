/**
 * Pure helpers that apply a single discrete rubric-audit change to a blocks array.
 * Each change is self-contained and can be applied independently (used by the
 * "Apply Selected" action). "Apply All" instead replaces blocks with the AI's
 * cohesive recommended_blocks, so these helpers are only for selective acceptance.
 */

let _newId = 0;
const genId = (prefix) => `${prefix}_${Date.now()}_${++_newId}`;

export function applyChange(blocks, change) {
  const cloneBlock = (b) => ({ ...b, criteria: (b.criteria || []).map((c) => ({ ...c, descriptors: (c.descriptors || []).map((d) => ({ ...d })) })) });
  let next = blocks.map(cloneBlock);

  switch (change.type) {
    case "rename_block":
      next = next.map((b) => (b.id === change.block_id ? { ...b, name: change.new_name } : b));
      break;

    case "adjust_weight":
      next = next.map((b) => (b.id === change.block_id ? { ...b, weight: change.new_weight } : b));
      break;

    case "remove_block":
      next = next.filter((b) => b.id !== change.block_id);
      break;

    case "add_block":
      next = [...next, {
        id: genId("smb"),
        name: change.new_name || "New Block",
        weight: change.new_weight || 0,
        criteria: (change.criteria || []).map((c) => ({
          id: genId("smc"),
          number: c.number || 0,
          name: c.name || "",
          category: c.category || "",
          descriptors: (c.descriptors || []).map((d) => ({ level: d.level, text: d.text || "" })),
          bonus_penalty_enabled: false,
          bonus_penalty_range: { min: -1, max: 1 },
          bonus_penalty_guidance: ""
        }))
      }];
      break;

    case "rename_criterion":
      next = next.map((b) => b.id === change.block_id ? {
        ...b,
        criteria: (b.criteria || []).map((c) => c.id === change.criterion_id ? { ...c, name: change.new_name } : c)
      } : b);
      break;

    case "remove_criterion":
      next = next.map((b) => b.id === change.block_id ? {
        ...b,
        criteria: (b.criteria || []).filter((c) => c.id !== change.criterion_id)
      } : b);
      break;

    case "improve_descriptor":
      next = next.map((b) => b.id === change.block_id ? {
        ...b,
        criteria: (b.criteria || []).map((c) => c.id === change.criterion_id ? {
          ...c,
          descriptors: (c.descriptors || []).map((d) => d.level === change.level ? { ...d, text: change.new_text } : d)
        } : c)
      } : b);
      break;

    case "add_criterion":
      next = next.map((b) => {
        if (b.id !== change.block_id) return b;
        const crits = b.criteria || [];
        const newCrit = {
          id: genId("smc"),
          number: crits.length + 1,
          name: change.new_name || "New Criterion",
          category: change.category_label || "",
          descriptors: (change.descriptors || [1, 2, 3, 4, 5].map((level) => ({ level, text: "" }))).map((d) => ({ level: d.level, text: d.text || "" })),
          bonus_penalty_enabled: false,
          bonus_penalty_range: { min: -1, max: 1 },
          bonus_penalty_guidance: ""
        };
        return { ...b, criteria: [...crits, newCrit] };
      });
      break;

    case "merge_criteria": {
      const idsToMerge = new Set(change.criterion_ids || []);
      next = next.map((b) => {
        if (b.id !== change.block_id) return b;
        const crits = b.criteria || [];
        const remaining = crits.filter((c) => !idsToMerge.has(c.id));
        const merged = {
          id: genId("smc"),
          number: remaining.length + 1,
          name: change.new_name || "Merged Criterion",
          category: change.category_label || "",
          descriptors: (change.descriptors || [1, 2, 3, 4, 5].map((level) => ({ level, text: "" }))).map((d) => ({ level: d.level, text: d.text || "" })),
          bonus_penalty_enabled: false,
          bonus_penalty_range: { min: -1, max: 1 },
          bonus_penalty_guidance: ""
        };
        return { ...b, criteria: [...remaining, merged] };
      });
      break;
    }

    default:
      break;
  }

  return next;
}

export function applyChanges(blocks, changes) {
  return changes.reduce((acc, ch) => applyChange(acc, ch), blocks);
}