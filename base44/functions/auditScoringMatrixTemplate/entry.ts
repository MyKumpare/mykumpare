import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

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

    if (!Array.isArray(scoring_blocks)) {
      return Response.json({ error: 'scoring_blocks array is required' }, { status: 400 });
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

    const prompt = `You are an expert consultant who designs and audits investment-manager due-diligence scoring matrix rubrics. You are auditing the STRUCTURE of a scoring matrix rubric (its blocks, weighted criteria, and 1-5 level descriptors) — NOT any filled-in scores.

Your task is to make the rubric more rigorous, fair, and efficient. Analyze the rubric for:

1. INHERENT BIAS — criteria or descriptor language that systematically favors or disfavors certain manager types (e.g., size, geography, style, tenure, ownership structure), subjective/ambiguous wording, recency bias, confirmation bias, survivorship bias, cultural bias, or criteria that conflate "we like them" with "they are skilled".
2. REDUNDANCY — overlapping or duplicate criteria across blocks that measure the same thing and could be consolidated or merged.
3. SCORING LOGIC & DESCRIPTOR QUALITY — gaps between adjacent levels, non-monotonic descriptors, ambiguous or unobservable descriptors, missing calibration, levels that are not behaviorally anchored, criteria where a 1-5 scale is the wrong granularity.
4. WEIGHT BALANCE — blocks whose weights over- or under-emphasize what matters, or weights that don't sum to 100.
5. EFFICIENCY & EFFECTIVENESS — criteria that add little signal, missing criteria that would add signal, opportunities to streamline, and anything that makes the rubric easier to apply consistently across analysts.

## Current Rubric Structure
${JSON.stringify(rubricData, null, 2)}

## CRITICAL INSTRUCTION — YOU MUST FIND ISSUES
No real-world scoring rubric is perfect. A rubric with ${rubricData.length} blocks and multiple criteria ALWAYS has room for improvement in bias, redundancy, descriptor quality, weight balance, or efficiency. You MUST produce AT LEAST 3 findings and AT LEAST 3 discrete changes. An empty result is a failure — it means you did not analyze the rubric seriously. Scrutinize every block, every criterion name, every descriptor text, and every weight. Look hard for:
- Ambiguous or subjective descriptor wording that two analysts could score differently
- Weights that don't sum to exactly 100, or that over/under-weight a block relative to its importance
- Criteria that overlap with criteria in other blocks
- Missing criteria that any due-diligence rubric should have (e.g., risk management, fee alignment, capacity, team stability)
- Descriptors where adjacent levels (e.g., 3 vs 4) are not clearly distinguishable
- Criteria that are too vague to be observable or measurable

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

    const llmResponse = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: responseSchema,
      add_context_from_internet: false,
      model: "claude_opus_4_8"
    });

    return Response.json({ success: true, data: llmResponse });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}