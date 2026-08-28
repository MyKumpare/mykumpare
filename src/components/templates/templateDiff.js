/**
 * Computes a structured diff between a prior template version and the current
 * edited state. Returns an ordered list of change entries grouped by section,
 * each with a type (added | removed | modified) and human-readable details.
 *
 * Works for both Scoring Matrix templates (scoring_blocks + rating_config) and
 * Process Templates (stages + documentation_checklist).
 */

const norm = (v) => (v == null ? "" : v);
const numStr = (v) => (v == null || isNaN(v) ? "" : String(v));
const boolStr = (v) => (v == null ? "" : v ? "Yes" : "No");

function descriptorText(descriptors, level) {
  const d = (descriptors || []).find((x) => x.level === level);
  return d ? d.text || "" : "";
}

/**
 * @param {Object} original - the prior template version (saved record)
 * @param {Object} current  - the current edited state in the dialog
 * @returns {Array<{section, type, label, oldValue, newValue}>}
 */
export function computeTemplateDiff(original, current) {
  const changes = [];

  // ── Header fields ──────────────────────────────────────────────
  if (norm(original.name) !== norm(current.name)) {
    changes.push({ section: "General", type: "modified", label: "Name", oldValue: original.name, newValue: current.name });
  }
  if (norm(original.template_type) !== norm(current.template_type)) {
    changes.push({ section: "General", type: "modified", label: "Template Type", oldValue: original.template_type, newValue: current.template_type });
  }
  if (norm(original.template_category) !== norm(current.template_category)) {
    changes.push({ section: "General", type: "modified", label: "Category", oldValue: original.template_category, newValue: current.template_category });
  }
  if (norm(original.sample_file_name) !== norm(current.sample_file_name)) {
    changes.push({ section: "General", type: "modified", label: "Sample Document", oldValue: original.sample_file_name, newValue: current.sample_file_name });
  }

  const isScoring = (current.template_category || original.template_category) === "Scoring Matrix";

  if (isScoring) {
    diffScoringBlocks(original.scoring_blocks || [], current.scoring_blocks || [], changes);
    diffRatingConfig(original.rating_config, current.rating_config, changes);
  } else {
    diffStages(original.stages || [], current.stages || [], changes);
    diffDocChecklist(original.documentation_checklist || [], current.documentation_checklist || [], changes);
  }

  return changes;
}

function diffScoringBlocks(oldBlocks, newBlocks, changes) {
  const oldById = Object.fromEntries(oldBlocks.map((b) => [b.id, b]));
  const newById = Object.fromEntries(newBlocks.map((b) => [b.id, b]));

  // Removed blocks
  oldBlocks.forEach((b) => {
    if (!newById[b.id]) {
      changes.push({ section: "Scoring Blocks", type: "removed", label: `Block: ${b.name || "(unnamed)"}`, oldValue: b.name, newValue: "" });
    }
  });
  // Added + modified blocks
  newBlocks.forEach((b) => {
    const old = oldById[b.id];
    if (!old) {
      changes.push({ section: "Scoring Blocks", type: "added", label: `Block: ${b.name || "(unnamed)"}`, oldValue: "", newValue: b.name });
    } else {
      if (norm(old.name) !== norm(b.name)) {
        changes.push({ section: "Scoring Blocks", type: "modified", label: `Block name`, oldValue: old.name, newValue: b.name, context: b.name });
      }
      if (numStr(old.weight) !== numStr(b.weight)) {
        changes.push({ section: "Scoring Blocks", type: "modified", label: `Block weight`, oldValue: `${old.weight}%`, newValue: `${b.weight}%`, context: b.name });
      }
      if (!!old.multiplier_enabled !== !!b.multiplier_enabled || numStr(old.multiplier) !== numStr(b.multiplier)) {
        changes.push({
          section: "Scoring Blocks", type: "modified", label: "Block multiplier",
          oldValue: old.multiplier_enabled ? `×${old.multiplier ?? 1}` : "Off",
          newValue: b.multiplier_enabled ? `×${b.multiplier ?? 1}` : "Off",
          context: b.name
        });
      }
      diffCriteria(old.criteria || [], b.criteria || [], b.name, changes);
    }
  });
}

function diffCriteria(oldCrits, newCrits, blockName, changes) {
  const oldById = Object.fromEntries(oldCrits.map((c) => [c.id, c]));
  const newById = Object.fromEntries(newCrits.map((c) => [c.id, c]));

  oldCrits.forEach((c) => {
    if (!newById[c.id]) {
      changes.push({ section: "Criteria", type: "removed", label: `Criterion: ${c.name || "(unnamed)"}`, oldValue: c.name, newValue: "", context: blockName });
    }
  });
  newCrits.forEach((c) => {
    const old = oldById[c.id];
    if (!old) {
      changes.push({ section: "Criteria", type: "added", label: `Criterion: ${c.name || "(unnamed)"}`, oldValue: "", newValue: c.name, context: blockName });
      return;
    }
    if (norm(old.name) !== norm(c.name)) {
      changes.push({ section: "Criteria", type: "modified", label: "Criterion name", oldValue: old.name, newValue: c.name, context: blockName });
    }
    if (norm(old.category) !== norm(c.category)) {
      changes.push({ section: "Criteria", type: "modified", label: "Criterion category", oldValue: old.category, newValue: c.category, context: c.name });
    }
    if (!!old.multiplier_enabled !== !!c.multiplier_enabled || numStr(old.multiplier) !== numStr(c.multiplier)) {
      changes.push({
        section: "Criteria", type: "modified", label: "Criterion multiplier",
        oldValue: old.multiplier_enabled ? `×${old.multiplier ?? 1}` : "Off",
        newValue: c.multiplier_enabled ? `×${c.multiplier ?? 1}` : "Off",
        context: c.name
      });
    }
    // Descriptor text changes (levels 1-5)
    for (let lvl = 1; lvl <= 5; lvl++) {
      const ot = descriptorText(old.descriptors, lvl);
      const nt = descriptorText(c.descriptors, lvl);
      if (ot !== nt) {
        changes.push({ section: "Criteria", type: "modified", label: `Level ${lvl} descriptor`, oldValue: ot, newValue: nt, context: c.name });
      }
    }
    // Bonus/penalty config
    if (!!old.bonus_penalty_enabled !== !!c.bonus_penalty_enabled) {
      changes.push({ section: "Criteria", type: "modified", label: "Bonus/Penalty enabled", oldValue: boolStr(old.bonus_penalty_enabled), newValue: boolStr(c.bonus_penalty_enabled), context: c.name });
    }
    if (numStr(old.bonus_penalty_range?.min) !== numStr(c.bonus_penalty_range?.min) || numStr(old.bonus_penalty_range?.max) !== numStr(c.bonus_penalty_range?.max)) {
      changes.push({
        section: "Criteria", type: "modified", label: "Bonus/Penalty range",
        oldValue: old.bonus_penalty_range ? `[${old.bonus_penalty_range.min}, ${old.bonus_penalty_range.max}]` : "",
        newValue: c.bonus_penalty_range ? `[${c.bonus_penalty_range.min}, ${c.bonus_penalty_range.max}]` : "",
        context: c.name
      });
    }
    if (norm(old.bonus_penalty_guidance) !== norm(c.bonus_penalty_guidance)) {
      changes.push({ section: "Criteria", type: "modified", label: "Bonus/Penalty guidance", oldValue: old.bonus_penalty_guidance, newValue: c.bonus_penalty_guidance, context: c.name });
    }
  });
}

function diffRatingConfig(oldRc, newRc, changes) {
  const o = oldRc || {};
  const n = newRc || {};
  if (!!o.pass_fail_enabled !== !!n.pass_fail_enabled) {
    changes.push({ section: "Rating Config", type: "modified", label: "Pass/Fail enabled", oldValue: boolStr(o.pass_fail_enabled), newValue: boolStr(n.pass_fail_enabled) });
  }
  if (numStr(o.pass_threshold) !== numStr(n.pass_threshold)) {
    changes.push({ section: "Rating Config", type: "modified", label: "Pass threshold", oldValue: o.pass_threshold, newValue: n.pass_threshold });
  }
  if (!!o.rating_enabled !== !!n.rating_enabled) {
    changes.push({ section: "Rating Config", type: "modified", label: "Rating options enabled", oldValue: boolStr(o.rating_enabled), newValue: boolStr(n.rating_enabled) });
  }
  const oldOpts = o.rating_options || [];
  const newOpts = n.rating_options || [];
  const oldById = Object.fromEntries(oldOpts.map((r) => [r.id, r]));
  const newById = Object.fromEntries(newOpts.map((r) => [r.id, r]));
  oldOpts.forEach((r) => { if (!newById[r.id]) changes.push({ section: "Rating Config", type: "removed", label: `Rating: ${r.label || "(unnamed)"}`, oldValue: r.label, newValue: "" }); });
  newOpts.forEach((r) => {
    const old = oldById[r.id];
    if (!old) { changes.push({ section: "Rating Config", type: "added", label: `Rating: ${r.label || "(unnamed)"}`, oldValue: "", newValue: r.label }); return; }
    if (norm(old.label) !== norm(r.label) || numStr(old.min_score) !== numStr(r.min_score) || numStr(old.max_score) !== numStr(r.max_score)) {
      changes.push({
        section: "Rating Config", type: "modified", label: `Rating "${old.label || "(unnamed)"}"`,
        oldValue: `${old.label} [${old.min_score}–${old.max_score}]`,
        newValue: `${r.label} [${r.min_score}–${r.max_score}]`
      });
    }
  });
}

function diffStages(oldStages, newStages, changes) {
  const oldById = Object.fromEntries(oldStages.map((s) => [s.id, s]));
  const newById = Object.fromEntries(newStages.map((s) => [s.id, s]));
  oldStages.forEach((s) => { if (!newById[s.id]) changes.push({ section: "Stages", type: "removed", label: `Stage: ${s.name || "(unnamed)"}`, oldValue: s.name, newValue: "" }); });
  newStages.forEach((s) => {
    const old = oldById[s.id];
    if (!old) { changes.push({ section: "Stages", type: "added", label: `Stage: ${s.name || "(unnamed)"}`, oldValue: "", newValue: s.name }); return; }
    if (norm(old.name) !== norm(s.name)) {
      changes.push({ section: "Stages", type: "modified", label: "Stage name", oldValue: old.name, newValue: s.name, context: s.name });
    }
    // sub-stages
    const oldSubs = old.sub_stages || [];
    const newSubs = s.sub_stages || [];
    const oldSubById = Object.fromEntries(oldSubs.map((ss) => [ss.id, ss]));
    const newSubById = Object.fromEntries(newSubs.map((ss) => [ss.id, ss]));
    oldSubs.forEach((ss) => { if (!newSubById[ss.id]) changes.push({ section: "Stages", type: "removed", label: `Sub-stage: ${ss.name || "(unnamed)"}`, oldValue: ss.name, newValue: "", context: s.name }); });
    newSubs.forEach((ss) => {
      const os = oldSubById[ss.id];
      if (!os) { changes.push({ section: "Stages", type: "added", label: `Sub-stage: ${ss.name || "(unnamed)"}`, oldValue: "", newValue: ss.name, context: s.name }); return; }
      if (norm(os.name) !== norm(ss.name)) {
        changes.push({ section: "Stages", type: "modified", label: "Sub-stage name", oldValue: os.name, newValue: ss.name, context: s.name });
      }
    });
  });
}

function diffDocChecklist(oldDocs, newDocs, changes) {
  const oldById = Object.fromEntries(oldDocs.map((d) => [d.id, d]));
  const newById = Object.fromEntries(newDocs.map((d) => [d.id, d]));
  oldDocs.forEach((d) => { if (!newById[d.id]) changes.push({ section: "Documentation Checklist", type: "removed", label: `Item: ${d.name || "(unnamed)"}`, oldValue: d.name, newValue: "" }); });
  newDocs.forEach((d) => {
    const old = oldById[d.id];
    if (!old) { changes.push({ section: "Documentation Checklist", type: "added", label: `Item: ${d.name || "(unnamed)"}`, oldValue: "", newValue: d.name }); return; }
    if (norm(old.name) !== norm(d.name)) {
      changes.push({ section: "Documentation Checklist", type: "modified", label: "Item name", oldValue: old.name, newValue: d.name });
    }
  });
}

export function summarizeChanges(changes) {
  const counts = { added: 0, removed: 0, modified: 0 };
  changes.forEach((c) => { counts[c.type] = (counts[c.type] || 0) + 1; });
  return counts;
}