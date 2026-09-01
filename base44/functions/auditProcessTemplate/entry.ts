import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Audits a PROCESS TEMPLATE (the staged due-diligence workflow structure:
 * stages, sub-stages, and documentation checklist) — not any filled-in
 * responses — for redundancy, efficiency, completeness gaps, sequencing
 * issues, and clarity. Returns findings, a complete recommended structure
 * (for side-by-side preview), and discrete independently-applicable changes.
 *
 * Input: { stages: <Template.stages array>, documentation_checklist: <Template.documentation_checklist array> }
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { stages, documentation_checklist } = body;

    if (!Array.isArray(stages)) {
      return Response.json({ error: 'stages array is required' }, { status: 400 });
    }

    const processData = {
      stages: stages.map((s: any) => ({
        id: s.id,
        name: s.name,
        sub_stages: (s.sub_stages || []).map((ss: any) => ({ id: ss.id, name: ss.name }))
      })),
      documentation_checklist: (documentation_checklist || []).map((it: any) => ({ id: it.id, name: it.name }))
    };

    const prompt = `You are an expert consultant who designs and audits investment-manager due-diligence process templates. You are auditing the STRUCTURE of a process template (its ordered stages, sub-stages, and documentation checklist) — NOT any filled-in responses.

Your task is to make the process more efficient, eliminate redundancy, and ensure it is complete and well-sequenced. Analyze the process for:

1. REDUNDANCY — overlapping or duplicate stages, sub-stages, or checklist items that measure or request the same thing and could be consolidated or merged. Name the specific stages/sub-stages/checklist items that overlap.
2. EFFICIENCY — unnecessary steps, bottlenecks, overly granular sub-stages that add no value, steps that could be parallelized or merged, and opportunities to streamline the workflow so analysts spend less time on low-value work. Cite the specific step and explain the waste.
3. COMPLETENESS GAPS — missing standard due-diligence stages (e.g. initial screening, on-site meeting, reference checks, legal/compliance review, operational due diligence, investment committee approval), missing key documentation items, or missing sub-stages that a rigorous process should contain. For each gap, name the missing item and explain what firm-data gap it would leave uncaught (e.g. undisclosed fee structures, unverified AUM, missing regulatory disclosures, untested risk controls, absent team-stability checks).
4. SEQUENCING & FLOW — stages out of logical order, dependencies not respected (e.g. reference checks before on-site, legal review before IC approval), approval/handoff logic gaps, and anything that creates rework or dead-ends. Name the specific stages whose order is wrong.
5. CLARITY — vague or ambiguous stage/sub-stage/checklist names that could be misinterpreted by different analysts, and naming that does not make the purpose of the step obvious. Quote the exact name and suggest a concrete replacement.

## Current Process Structure
${JSON.stringify(processData, null, 2)}

## CRITICAL INSTRUCTION — YOU MUST FIND ISSUES
No real-world due-diligence process template is perfect. A process with ${processData.stages.length} stages ALWAYS has room for improvement in redundancy, efficiency, completeness, sequencing, or clarity. You MUST produce AT LEAST 4 findings and AT LEAST 4 discrete changes. An empty or near-empty result is a failure — it means you did not analyze the process seriously. Scrutinize every stage name, every sub-stage, every checklist item, and the overall ordering. Look hard for:
- Stages or sub-stages that overlap with each other or request redundant information
- Missing standard due-diligence steps that any rigorous process should have (e.g. operational due diligence, background checks, fee verification, capacity analysis, key-person risk assessment)
- Checklist items that are vague ("Review documents" is not actionable — it should specify WHICH documents and WHAT to look for)
- Stages whose names are ambiguous or could be interpreted differently by different analysts
- Sequencing issues where a later stage should logically come before an earlier one
- Steps that collect firm data but don't verify or cross-check it against a source

## Instructions
- Produce a comprehensive set of findings (AT LEAST 4). Each finding has a category (one of: "Redundancy", "Efficiency", "Completeness", "Sequencing", "Clarity"), a severity (high/medium/low), a short title, and a description. The description MUST reference specific stage/sub-stage/checklist names from the input and explain concretely what the issue is and why it matters — vague descriptions like "the process could be improved" are not acceptable.
- Produce a COMPLETE recommended process structure with two top-level arrays: "recommended_stages" and "recommended_doc_checklist". Reuse existing stage/sub-stage/checklist IDs wherever an item is kept or only lightly edited; generate new IDs only for genuinely new items (strings like "rec_stage_<n>", "rec_sub_<n>", "rec_doc_<n>"). Keep the same schema as the input. Preserve a sensible ordered sequence. The recommended structure MUST differ from the input — it is the improved version.
- Produce a list of discrete, independently-applicable "changes" (AT LEAST 4). Each change must be self-contained and reference existing IDs from the input where it modifies an existing item. The rationale for each change MUST be specific and actionable — explain exactly what to change, why it improves the process, and what firm-data gap it addresses. Each change has:
  - id: a short unique string (e.g. "chg_1")
  - type: one of "rename_stage" | "remove_stage" | "add_stage" | "merge_stages" | "move_stage" | "rename_sub_stage" | "remove_sub_stage" | "add_sub_stage" | "merge_sub_stages" | "move_sub_stage" | "add_doc_item" | "remove_doc_item" | "rename_doc_item" | "merge_doc_items"
  - category: one of the finding categories
  - severity: high/medium/low
  - title: short human-readable label
  - rationale: why this change improves the process
  - stage_id: id of the affected stage (for stage-level and sub-stage-level changes)
  - sub_stage_id: id of the affected sub-stage (for sub-stage-level changes)
  - stage_ids: array of stage ids (merge_stages only)
  - sub_stage_ids: array of sub-stage ids (merge_sub_stages only)
  - target_stage_id: destination stage id (move_stage for new position reference, move_sub_stage for new parent, add_sub_stage for parent)
  - new_name: new name (rename_*, merge_*, add_stage, add_sub_stage, add_doc_item)
  - sub_stages: array of {id, name} (add_stage only — the new stage's sub-stages)
  - doc_item_ids: array of doc item ids (merge_doc_items only)
  - new_position: integer index (move_stage only — 0-based target position in the stages list)
  Only include the fields relevant to the change type; omit the others.

Return ONLY a JSON object with this exact shape:
{
  "findings": [{ "category": "", "severity": "", "title": "", "description": "" }],
  "recommended_stages": [{ "id": "", "name": "", "sub_stages": [{ "id": "", "name": "" }] }],
  "recommended_doc_checklist": [{ "id": "", "name": "" }],
  "changes": [{ "id": "", "type": "", "category": "", "severity": "", "title": "", "rationale": "", "stage_id": "", "sub_stage_id": "", "stage_ids": [], "sub_stage_ids": [], "target_stage_id": "", "new_name": "", "sub_stages": [], "doc_item_ids": [], "new_position": 0 }]
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
        recommended_stages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              sub_stages: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' }
                  }
                }
              }
            }
          }
        },
        recommended_doc_checklist: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' }
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
              stage_id: { type: 'string' },
              sub_stage_id: { type: 'string' },
              stage_ids: { type: 'array', items: { type: 'string' } },
              sub_stage_ids: { type: 'array', items: { type: 'string' } },
              target_stage_id: { type: 'string' },
              new_name: { type: 'string' },
              sub_stages: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' }
                  }
                }
              },
              doc_item_ids: { type: 'array', items: { type: 'string' } },
              new_position: { type: 'integer' }
            }
          }
        }
      }
    };

    const llmResponse = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: responseSchema,
      add_context_from_internet: false,
      model: "claude_sonnet_4_6"
    });

    return Response.json({ success: true, data: llmResponse });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}