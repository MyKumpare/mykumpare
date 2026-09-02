import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

let _newId = 0;
const genId = (prefix: string) => `${prefix}_${Date.now()}_${++_newId}`;

/**
 * Apply a single discrete rubric-audit change to a blocks array (deep clone).
 * Mirrors the frontend scoringRubricAuditApply.js logic so the backend can
 * build recommended_blocks from the LLM's discrete changes without a second
 * heavy LLM call.
 */
function applyChangeToBlocks(blocks: any[], change: any): any[] {
  const cloneBlock = (b: any) => ({
    ...b,
    criteria: (b.criteria || []).map((c: any) => ({
      ...c,
      descriptors: (c.descriptors || []).map((d: any) => ({ ...d }))
    }))
  });
  let next = blocks.map(cloneBlock);

  switch (change.type) {
    case 'rename_block':
      next = next.map((b) => (b.id === change.block_id ? { ...b, name: change.new_name } : b));
      break;
    case 'adjust_weight':
      next = next.map((b) => (b.id === change.block_id ? { ...b, weight: change.new_weight } : b));
      break;
    case 'remove_block':
      next = next.filter((b) => b.id !== change.block_id);
      break;
    case 'add_block':
      next = [...next, {
        id: genId('smb'),
        name: change.new_name || 'New Block',
        weight: change.new_weight || 0,
        criteria: (change.criteria || []).map((c: any) => ({
          id: genId('smc'),
          number: c.number || 0,
          name: c.name || '',
          category: c.category || '',
          descriptors: (c.descriptors || []).map((d: any) => ({ level: d.level, text: d.text || '' })),
          bonus_penalty_enabled: false,
          bonus_penalty_range: { min: -1, max: 1 },
          bonus_penalty_guidance: ''
        }))
      }];
      break;
    case 'rename_criterion':
      next = next.map((b) => b.id === change.block_id ? {
        ...b,
        criteria: (b.criteria || []).map((c) => c.id === change.criterion_id ? { ...c, name: change.new_name } : c)
      } : b);
      break;
    case 'remove_criterion':
      next = next.map((b) => b.id === change.block_id ? {
        ...b,
        criteria: (b.criteria || []).filter((c) => c.id !== change.criterion_id)
      } : b);
      break;
    case 'improve_descriptor':
      next = next.map((b) => b.id === change.block_id ? {
        ...b,
        criteria: (b.criteria || []).map((c) => c.id === change.criterion_id ? {
          ...c,
          descriptors: (c.descriptors || []).map((d) => d.level === change.level ? { ...d, text: change.new_text } : d)
        } : c)
      } : b);
      break;
    case 'add_criterion':
      next = next.map((b) => {
        if (b.id !== change.block_id) return b;
        const crits = b.criteria || [];
        const newCrit = {
          id: genId('smc'),
          number: crits.length + 1,
          name: change.new_name || 'New Criterion',
          category: change.category_label || '',
          descriptors: (change.descriptors || [1, 2, 3, 4, 5].map((level) => ({ level, text: '' }))).map((d: any) => ({ level: d.level, text: d.text || '' })),
          bonus_penalty_enabled: false,
          bonus_penalty_range: { min: -1, max: 1 },
          bonus_penalty_guidance: ''
        };
        return { ...b, criteria: [...crits, newCrit] };
      });
      break;
    case 'merge_criteria': {
      const idsToMerge = new Set(change.criterion_ids || []);
      next = next.map((b) => {
        if (b.id !== change.block_id) return b;
        const crits = b.criteria || [];
        const remaining = crits.filter((c) => !idsToMerge.has(c.id));
        const merged = {
          id: genId('smc'),
          number: remaining.length + 1,
          name: change.new_name || 'Merged Criterion',
          category: change.category_label || '',
          descriptors: (change.descriptors || [1, 2, 3, 4, 5].map((level) => ({ level, text: '' }))).map((d: any) => ({ level: d.level, text: d.text || '' })),
          bonus_penalty_enabled: false,
          bonus_penalty_range: { min: -1, max: 1 },
          bonus_penalty_guidance: ''
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

function applyChangesToBlocks(blocks: any[], changes: any[]): any[] {
  return changes.reduce((acc, ch) => applyChangeToBlocks(acc, ch), blocks);
}

/**
 * Audits a scoring matrix TEMPLATE (the rubric structure: blocks, criteria, level
 * descriptors) — not the filled-in scores — for inherent biases, redundancy that
 * could be consolidated, scoring-logic gaps, and overall efficiency/effectiveness.
 *
 * Returns:
 *  - findings: categorized issues with severity
 *  - recommended_blocks: a complete, improved rubric structure (for side-by-side preview)
 *  - changes: discrete, independently-applicable operations the user can accept
 *    individually or all together
 *
 * Input: { scoring_blocks: <Template.scoring_blocks array> }
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { scoring_blocks } = body;

    console.log('[auditScoringMatrixTemplate] STEP 1: Input received', {
      blockCount: Array.isArray(scoring_blocks) ? scoring_blocks.length : 'NOT_AN_ARRAY',
      blockIds: Array.isArray(scoring_blocks) ? scoring_blocks.map((b: any) => b?.id) : [],
      blockNames: Array.isArray(scoring_blocks) ? scoring_blocks.map((b: any) => b?.name) : []
    });

    if (!Array.isArray(scoring_blocks)) {
      console.log('[auditScoringMatrixTemplate] FAIL: scoring_blocks is not an array — returning 400');
      return Response.json({ error: 'scoring_blocks array is required' }, { status: 400 });
    }

    if (scoring_blocks.length === 0) {
      console.log('[auditScoringMatrixTemplate] FAIL: scoring_blocks is empty — nothing to audit');
      return Response.json({ error: 'scoring_blocks array is empty — nothing to audit' }, { status: 400 });
    }

    const rubricData = scoring_blocks.map((block: any) => ({
      id: block.id,
      name: block.name,
      weight: block.weight,
      criteria: (block.criteria || []).map((crit: any) => ({
        id: crit.id,
        number: crit.number,
        name: crit.name,
        category: crit.category,
        descriptors: (crit.descriptors || []).map((d: any) => ({ level: d.level, text: d.text })),
        bonus_penalty_enabled: crit.bonus_penalty_enabled,
        bonus_penalty_range: crit.bonus_penalty_range,
        bonus_penalty_guidance: crit.bonus_penalty_guidance
      }))
    }));

    const totalCriteria = rubricData.reduce((sum: number, b: any) => sum + (b.criteria?.length || 0), 0);
    const totalWeight = rubricData.reduce((sum: number, b: any) => sum + (Number(b.weight) || 0), 0);

    // Build a visible process trace so the user can confirm what was analyzed.
    const processTrace: any[] = [];
    processTrace.push({
      step: 1,
      label: 'Input validation',
      detail: `Received ${rubricData.length} block(s) with ${totalCriteria} total criteria. Weights sum to ${totalWeight}.`,
      status: 'ok'
    });
    processTrace.push({
      step: 2,
      label: 'Rubric normalization',
      detail: rubricData.map((b: any) => `Block "${b.name}" (${b.weight}%) — ${(b.criteria || []).length} criteria: ${(b.criteria || []).map((c: any) => c.name).join(', ') || 'none'}`).join('\n'),
      status: 'ok'
    });
    processTrace.push({
      step: 3,
      label: 'Descriptor scan',
      detail: `${totalCriteria} criteria scanned for behaviorally-anchored descriptors. ${(function() {
        let generic = 0, anchored = 0;
        for (const b of rubricData) for (const c of (b.criteria || [])) {
          const texts = (c.descriptors || []).map((d: any) => (d.text || '').toLowerCase().trim());
          const genericSet = ['poor', 'below average', 'average', 'above average', 'excellent', 'good', 'fair', 'strong', 'weak'];
          if (texts.every((t: string) => genericSet.includes(t))) generic++;
          else anchored++;
        }
        return `${generic} use generic labels, ${anchored} have custom descriptors.`;
      })()}`,
      status: 'ok'
    });
    processTrace.push({
      step: 4,
      label: 'Analysis dimensions',
      detail: 'Checking 5 dimensions: (1) Inherent Bias, (2) Redundancy, (3) Scoring Logic & Descriptor Quality, (4) Weight Balance, (5) Efficiency & Effectiveness.',
      status: 'ok'
    });

    console.log('[auditScoringMatrixTemplate] STEP 2: Rubric normalized for LLM', {
      blocks: rubricData.length,
      totalCriteria,
      totalWeight,
      blockSummary: rubricData.map((b: any) => ({
        id: b.id, name: b.name, weight: b.weight,
        criteriaCount: b.criteria?.length || 0,
        criteriaNames: (b.criteria || []).map((c: any) => c.name)
      }))
    });

    const prompt = `You are an expert consultant who designs and audits investment-manager due-diligence scoring matrix rubrics. You are auditing the STRUCTURE of a scoring matrix rubric (its blocks, weighted criteria, and 1-5 level descriptors) — NOT any filled-in scores.

Your task is to make the rubric more rigorous, fair, and efficient. Analyze the rubric for:

1. INHERENT BIAS — criteria or descriptor language that systematically favors or disfavors certain manager types (e.g., size, geography, style, tenure, ownership structure), subjective/ambiguous wording, recency bias, confirmation bias, survivorship bias, cultural bias, or criteria that conflate "we like them" with "they are skilled". Quote the exact descriptor text that is biased.
2. REDUNDANCY — overlapping or duplicate criteria across blocks that measure the same thing and could be consolidated or merged. Name the specific criteria that overlap and explain the duplication.
3. SCORING LOGIC & DESCRIPTOR QUALITY — gaps between adjacent levels, non-monotonic descriptors, ambiguous or unobservable descriptors, missing calibration, levels that are not behaviorally anchored, criteria where a 1-5 scale is the wrong granularity. For each issue, cite the criterion and quote the problematic descriptor text.
4. WEIGHT BALANCE — blocks whose weights over- or under-emphasize what matters, or weights that don't sum to 100. State the current weight, what it should be, and why.
5. EFFICIENCY & EFFECTIVENESS — criteria that add little signal, missing criteria that would add signal, opportunities to streamline, and anything that makes the rubric easier to apply consistently across analysts. For missing criteria, name the specific firm-data gap the rubric fails to capture (e.g., fee alignment, capacity constraints, team stability, risk management, regulatory compliance, performance attribution, downside protection).

## Current Rubric Structure
${JSON.stringify(rubricData, null, 2)}

## CRITICAL INSTRUCTION — YOU MUST FIND ISSUES
No real-world scoring rubric is perfect. A rubric with ${rubricData.length} blocks and multiple criteria ALWAYS has room for improvement in bias, redundancy, descriptor quality, weight balance, or efficiency. You MUST produce AT LEAST 5 findings and AT LEAST 5 discrete changes. An empty or near-empty result is a failure — it means you did not analyze the rubric seriously. Scrutinize every block, every criterion name, every descriptor text, and every weight. Look hard for:
- Ambiguous or subjective descriptor wording that two analysts could score differently — quote the exact text and explain the ambiguity
- Weights that don't sum to exactly 100, or that over/under-weight a block relative to its importance — state the current and recommended weights
- Criteria that overlap with criteria in other blocks — name both criteria and explain the duplication
- Missing criteria that any due-diligence rubric should have (e.g., risk management, fee alignment, capacity, team stability, regulatory compliance, performance attribution, downside protection, key-person risk) — for each, explain what firm-data gap the missing criterion leaves uncaught
- Descriptors where adjacent levels (e.g., 3 vs 4) are not clearly distinguishable — quote both levels and explain why they blur together
- Criteria that are too vague to be observable or measurable — quote the criterion name and suggest a concrete, observable replacement
- Descriptor text that is copy-pasted or nearly identical across levels — this is a calibration failure
- Criteria where all 5 levels exist but the level 1 or level 5 descriptor is unrealistically extreme or too mild, compressing the usable range

## Instructions
- Produce a comprehensive set of findings (AT LEAST 3). Each finding has a category (one of: "Bias", "Redundancy", "Scoring Logic", "Weight Balance", "Efficiency", "Effectiveness"), a severity (high/medium/low), a short title, and a description.
- Produce a COMPLETE recommended rubric structure ("recommended_blocks") that implements your improvements. Reuse existing block/criterion IDs wherever an item is kept or only lightly edited; generate new IDs (strings like "rec_b_<n>" for blocks and "rec_c_<n>" for criteria) only for genuinely new items. Keep the same schema as the input. Ensure weights sum to 100. The recommended_blocks MUST differ from the input — it is the improved version.
- Produce a list of discrete, independently-applicable "changes" (AT LEAST 3). Each change must be self-contained and reference existing IDs from the input rubric where it modifies an existing item. Each change has:
  - id: a short unique string (e.g. "chg_1")
  - type: one of "rename_block" | "adjust_weight" | "rename_criterion" | "improve_descriptor" | "add_criterion" | "remove_criterion" | "merge_criteria" | "add_block" | "remove_block"
  - category: one of the finding categories
  - severity: high/medium/low
  - title: short human-readable label
  - rationale: why this change improves the rubric
  - block_id: id of the affected block (for block-level and criterion-level changes)
  - criterion_id: id of the affected criterion (for criterion-level changes)
  - criterion_ids: array of criterion ids (for merge_criteria only)
  - new_name: new name (rename_*, merge_criteria, add_criterion, add_block)
  - new_weight: new weight (adjust_weight, add_block)
  - level: descriptor level (improve_descriptor only)
  - new_text: new descriptor text (improve_descriptor only)
  - category_label: new category (add_criterion only)
  - descriptors: array of {level, text} (add_criterion, merge_criteria, add_block only)
  - criteria: array of {id, number, name, category, descriptors:[{level,text}]} (add_block only)
  Only include the fields relevant to the change type; omit the others.

Return ONLY a JSON object with this exact shape:
{
  "findings": [{ "category": "", "severity": "", "title": "", "description": "" }],
  "recommended_blocks": [{ "id": "", "name": "", "weight": 0, "criteria": [{ "id": "", "number": 1, "name": "", "category": "", "descriptors": [{ "level": 1, "text": "" }] }] }],
  "changes": [{ "id": "", "type": "", "category": "", "severity": "", "title": "", "rationale": "", "block_id": "", "criterion_id": "", "criterion_ids": [], "new_name": "", "new_weight": 0, "level": 1, "new_text": "", "category_label": "", "descriptors": [], "criteria": [] }]
}`;

    const responseSchema = {
      type: 'object',
      properties: {
        findings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              severity: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' }
            }
          }
        },
        recommended_blocks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              weight: { type: 'number' },
              criteria: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    number: { type: 'integer' },
                    name: { type: 'string' },
                    category: { type: 'string' },
                    descriptors: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          level: { type: 'integer' },
                          text: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        changes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string' },
              category: { type: 'string' },
              severity: { type: 'string' },
              title: { type: 'string' },
              rationale: { type: 'string' },
              block_id: { type: 'string' },
              criterion_id: { type: 'string' },
              criterion_ids: { type: 'array', items: { type: 'string' } },
              new_name: { type: 'string' },
              new_weight: { type: 'number' },
              level: { type: 'integer' },
              new_text: { type: 'string' },
              category_label: { type: 'string' },
              descriptors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    level: { type: 'integer' },
                    text: { type: 'string' }
                  }
                }
              },
              criteria: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    number: { type: 'integer' },
                    name: { type: 'string' },
                    category: { type: 'string' },
                    descriptors: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          level: { type: 'integer' },
                          text: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };

    processTrace.push({
      step: 5,
      label: 'AI analysis',
      detail: `Sent ${prompt.length}-char prompt with the full rubric structure and a JSON schema requiring findings, recommended blocks, and discrete changes. Waiting for AI response…`,
      status: 'pending'
    });

    console.log('[auditScoringMatrixTemplate] STEP 3: Invoking LLM', {
      model: "automatic",
      promptLength: prompt.length,
      hasJsonSchema: true,
      addContextFromInternet: false
    });

    // Single LLM call for findings + discrete changes only. The recommended
    // rubric structure is built on the backend by applying those changes to
    // the original blocks — no need for the LLM to reproduce the entire rubric
    // (which was the heavy output causing 120s proxy timeouts on large rubrics).
    const auditPrompt = `You are an expert consultant auditing the STRUCTURE of an investment-manager due-diligence scoring matrix rubric (blocks, weighted criteria, 1-5 level descriptors) — NOT filled-in scores.

Analyze for: (1) Inherent Bias, (2) Redundancy, (3) Scoring Logic & Descriptor Quality, (4) Weight Balance, (5) Efficiency & Effectiveness.

## Current Rubric
${JSON.stringify(rubricData, null, 2)}

## Instructions
Produce AT LEAST 3 findings and AT LEAST 3 discrete changes. Each finding: {category (Bias|Redundancy|Scoring Logic|Weight Balance|Efficiency|Effectiveness), severity (high|medium|low), title, description}. Each change: {id, type (rename_block|adjust_weight|rename_criterion|improve_descriptor|add_criterion|remove_criterion|merge_criteria|add_block|remove_block), category, severity, title, rationale, block_id, criterion_id, criterion_ids, new_name, new_weight, level, new_text, category_label, descriptors, criteria}. Only include fields relevant to the change type.

Return ONLY JSON: { "findings": [...], "changes": [...] }`;

    const auditSchema = {
      type: 'object',
      properties: {
        findings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              severity: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' }
            }
          }
        },
        changes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string' },
              category: { type: 'string' },
              severity: { type: 'string' },
              title: { type: 'string' },
              rationale: { type: 'string' },
              block_id: { type: 'string' },
              criterion_id: { type: 'string' },
              criterion_ids: { type: 'array', items: { type: 'string' } },
              new_name: { type: 'string' },
              new_weight: { type: 'number' },
              level: { type: 'integer' },
              new_text: { type: 'string' },
              category_label: { type: 'string' },
              descriptors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { level: { type: 'integer' }, text: { type: 'string' } }
                }
              },
              criteria: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    number: { type: 'integer' },
                    name: { type: 'string' },
                    category: { type: 'string' },
                    descriptors: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: { level: { type: 'integer' }, text: { type: 'string' } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };

    console.log('[auditScoringMatrixTemplate] STEP 3: Invoking single LLM call (findings + changes)');

    let llmResponse: any = null;
    let lastError: string = '';
    try {
      llmResponse = await base44.integrations.Core.InvokeLLM({
        prompt: auditPrompt,
        response_json_schema: auditSchema,
        add_context_from_internet: false,
        model: "gpt_5_mini"
      });
      console.log('[auditScoringMatrixTemplate] LLM call completed', {
        findingsCount: llmResponse?.findings?.length || 0,
        changesCount: llmResponse?.changes?.length || 0
      });
    } catch (err: any) {
      console.log('[auditScoringMatrixTemplate] LLM call failed:', err?.message || String(err));
      lastError = err?.message || String(err);
    }

    const findingsRaw = llmResponse?.findings || [];
    const changesRaw = llmResponse?.changes || [];

    if (!findingsRaw.length && !changesRaw.length) {
      return Response.json({ error: `AI audit could not produce results: ${lastError || 'LLM returned empty results'}. Please try again.` }, { status: 500 });
    }

    // Build the recommended rubric by applying all discrete changes to the
    // original blocks — no second LLM call needed.
    const recommendedBlocks = applyChangesToBlocks(scoring_blocks, changesRaw);

    const llmResponseFinal: any = {
      findings: findingsRaw,
      changes: changesRaw,
      recommended_blocks: recommendedBlocks
    };

    const findingsCount = findingsRaw.length;
    const changesCount = changesRaw.length;
    const recBlocksCount = recommendedBlocks.length;

    // Update the AI analysis step with the outcome
    const aiStep = processTrace.find((s: any) => s.step === 5);
    if (aiStep) {
      aiStep.status = findingsCount > 0 || changesCount > 0 ? 'ok' : 'warning';
      aiStep.detail += `\nAI returned ${findingsCount} finding(s), ${changesCount} change(s), and ${recBlocksCount} recommended block(s).`;
    }

    processTrace.push({
      step: 6,
      label: 'Result validation',
      detail: findingsCount === 0 && changesCount === 0
        ? 'WARNING: AI returned no findings and no changes. This can happen if the rubric is very small or the AI could not identify issues. Try adding more criteria or descriptors.'
        : `Audit complete. ${findingsCount} finding(s) across bias, redundancy, scoring logic, weight balance, and efficiency. ${changesCount} actionable change(s) ready to apply.`,
      status: findingsCount === 0 && changesCount === 0 ? 'warning' : 'ok'
    });

    console.log('[auditScoringMatrixTemplate] STEP 4: Audit complete', {
      findingsCount,
      changesCount,
      recommendedBlocksCount: recBlocksCount,
      findingTitles: findingsRaw.map((f: any) => f?.title)
    });

    return Response.json({ success: true, data: llmResponseFinal, process_trace: processTrace });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}