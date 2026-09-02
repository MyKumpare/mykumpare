import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { score_id } = body;

    if (!score_id) {
      return Response.json({ error: 'score_id is required' }, { status: 400 });
    }

    // Fetch the scoring matrix score record
    const score = await base44.entities.ScoringMatrixScore.get(score_id);
    if (!score) {
      return Response.json({ error: 'Scoring matrix score not found' }, { status: 404 });
    }

    // Fetch the template for descriptor context
    let template = null;
    if (score.template_id) {
      try {
        template = await base44.entities.Template.get(score.template_id);
      } catch {
        // Template may not be accessible; continue without it
      }
    }

    // Fetch due diligence for context
    let dueDiligence = null;
    if (score.due_diligence_id) {
      try {
        dueDiligence = await base44.entities.DueDiligence.get(score.due_diligence_id);
      } catch {
        // Continue without it
      }
    }

    // Fetch product for context
    let product = null;
    if (score.product_id) {
      try {
        product = await base44.entities.Product.get(score.product_id);
      } catch {
        // Continue without it
      }
    }

    // Fetch firm for context
    let firm = null;
    if (score.firm_id) {
      try {
        firm = await base44.entities.Firm.get(score.firm_id);
      } catch {
        // Continue without it
      }
    }

    // Build the context for the LLM
    const scoringData = {
      template_name: score.template_name,
      firm_name: score.firm_name,
      product_name: score.product_name,
      status: score.status,
      primary_analyst: score.primary_analyst_name,
      secondary_analyst: score.secondary_analyst_name,
      secondary_scoring_enabled: score.secondary_scoring_enabled,
      blocks: (score.scoring_blocks || []).map((block: any) => ({
        name: block.name,
        weight: block.weight,
        criteria: (block.criteria || []).map((crit: any) => ({
          number: crit.number,
          name: crit.name,
          category: crit.category,
          primary_score: crit.primary_score,
          primary_notes: crit.primary_notes,
          secondary_score: crit.secondary_score,
          secondary_notes: crit.secondary_notes,
          team_score: crit.team_score,
          team_notes: crit.team_notes,
          team_status: crit.team_status,
          adjusted_primary_score: crit.adjusted_primary_score,
          adjusted_primary_notes: crit.adjusted_primary_notes,
          ic_score: crit.ic_score,
          ic_notes: crit.ic_notes,
          ic_status: crit.ic_status,
          final_score: crit.final_score,
          final_notes: crit.final_notes
        }))
      }))
    };

    const templateDescriptors = template?.scoring_blocks
      ? (template.scoring_blocks as any[]).map((block: any) => ({
          name: block.name,
          weight: block.weight,
          criteria: (block.criteria || []).map((crit: any) => ({
            number: crit.number,
            name: crit.name,
            category: crit.category,
            descriptors: crit.descriptors || []
          }))
        }))
      : null;

    const contextData = {
      product: product ? {
        name: product.name,
        description: product.description,
        asset_class: product.asset_class,
        geography: product.geography,
        style: product.style,
        investment_process: product.investment_process,
        inv_desc_edge: product.inv_desc_edge,
        inv_desc_philosophy: product.inv_desc_philosophy,
        inv_desc_process: product.inv_desc_process,
        inv_desc_universe: product.inv_desc_universe
      } : null,
      firm: firm ? {
        name: firm.name,
        description: firm.description,
        firm_type: firm.firm_type,
        year_founded: firm.year_founded
      } : null,
      due_diligence: dueDiligence ? {
        status: dueDiligence.status,
        current_stage: dueDiligence.current_stage_name,
        decision: dueDiligence.decision
      } : null
    };

    const prompt = `You are an expert investment due diligence auditor. You are auditing a scoring matrix evaluation for an investment manager product.

Your task is to:
1. Analyze the consistency of scoring across all evaluation columns (Primary, Secondary, Team, Adjusted Primary, IC, and Final scores)
2. Identify inconsistencies and significant deviations between the columns
3. Highlight specific criteria that should be reviewed for potential re-scoring
4. Provide an executive summary of the evaluation
5. Identify strengths, weaknesses, areas of concern, and follow-up items
6. Provide your OWN independent score for each criterion based on the level descriptors and all notes/justifications provided

## Scoring Matrix Data
${JSON.stringify(scoringData, null, 2)}

## Template Level Descriptors (what each score 1-5 means for each criterion)
${templateDescriptors ? JSON.stringify(templateDescriptors, null, 2) : 'Not available'}

## Context
${JSON.stringify(contextData, null, 2)}

## CRITICAL INSTRUCTION — YOU MUST BE THOROUGH AND SPECIFIC
A scoring matrix with ${(score.scoring_blocks || []).length} blocks always has inconsistencies, unsupported scores, or missing notes. You MUST produce at least 3 rescoring_recommendations, at least 3 strengths, at least 3 weaknesses, at least 3 areas_of_concern, and at least 3 follow_up_items. An empty or near-empty result is a failure. Every item MUST reference specific criterion names and specific scores — vague statements like "some criteria need review" are not acceptable.

## Instructions
- Compare Primary vs Team vs IC vs Final scores for each criterion. Flag any deviation of 2 or more points as a significant inconsistency. Name the exact criterion and state both scores.
- For criteria where the team or IC score differs significantly from the primary or final score, note this as an area for re-scoring review. Explain which direction the score should move and why.
- For criteria with empty or one-word notes, flag them as unsupported scores — a score without justification is a data gap.
- For your independent scores: use the level descriptors and ALL notes from every column to determine what you believe the correct score should be. If descriptors are not available, use the notes and your expertise to assess. Your ai_rationale MUST reference specific notes or descriptor levels.
- Your independent scores should be integers 1-5.
- Be specific and actionable in your recommendations. Every follow_up_item must be a concrete action the analyst can take (e.g. "Request audited financials to verify the AUM figure cited in the Capacity criterion" — not "do more research").
- The executive summary should be 2-3 paragraphs covering the overall quality of the evaluation and the manager.
- Strengths and weaknesses should reference specific criteria and scores.
- Areas of concern should focus on evaluation process issues (inconsistencies, missing notes, unsupported scores, criteria where the firm data is thin or unverified).
- Follow-up items should be specific actions the analyst should take, including identifying what firm data is missing or needs verification.

Return a JSON object with this exact structure:
{
  "executive_summary": "2-3 paragraph summary",
  "strengths": ["specific strength 1", "specific strength 2"],
  "weaknesses": ["specific weakness 1", "specific weakness 2"],
  "areas_of_concern": ["concern 1", "concern 2"],
  "follow_up_items": ["action item 1", "action item 2"],
  "rescoring_recommendations": [
    {
      "block_name": "Block name",
      "criterion_name": "Criterion name",
      "current_final_score": 3,
      "concern": "Why this needs re-scoring",
      "recommended_action": "What the analyst should do"
    }
  ],
  "independent_scores": [
    {
      "block_name": "Block name",
      "criterion_name": "Criterion name",
      "ai_score": 3,
      "ai_rationale": "Why the AI gives this score based on descriptors and notes"
    }
  ],
  "overall_assessment": {
    "ai_overall_score": 3.5,
    "confidence_level": "High|Medium|Low",
    "summary": "One paragraph overall assessment"
  }
}`;

    const responseSchema = {
      type: 'object',
      properties: {
        executive_summary: { type: 'string' },
        strengths: {
          type: 'array',
          items: { type: 'string' }
        },
        weaknesses: {
          type: 'array',
          items: { type: 'string' }
        },
        areas_of_concern: {
          type: 'array',
          items: { type: 'string' }
        },
        follow_up_items: {
          type: 'array',
          items: { type: 'string' }
        },
        rescoring_recommendations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              block_name: { type: 'string' },
              criterion_name: { type: 'string' },
              current_final_score: { type: 'integer' },
              concern: { type: 'string' },
              recommended_action: { type: 'string' }
            }
          }
        },
        independent_scores: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              block_name: { type: 'string' },
              criterion_name: { type: 'string' },
              ai_score: { type: 'integer' },
              ai_rationale: { type: 'string' }
            }
          }
        },
        overall_assessment: {
          type: 'object',
          properties: {
            ai_overall_score: { type: 'number' },
            confidence_level: { type: 'string' },
            summary: { type: 'string' }
          }
        }
      }
    };

    const llmResponse = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: responseSchema,
      add_context_from_internet: false,
      model: 'claude_sonnet_4_6'
    });

    // Enrich each independent score with the descriptor text for the AI score
    // level and the full set of level descriptors so the UI can show what each
    // score option means instead of just the number.
    if (Array.isArray(llmResponse?.independent_scores) && template?.scoring_blocks) {
      const descLookup: Record<string, any[]> = {};
      (template.scoring_blocks as any[]).forEach((block: any) => {
        (block.criteria || []).forEach((crit: any) => {
          const key = `${block.name}::${crit.name}`;
          descLookup[key] = crit.descriptors || [];
        });
      });
      llmResponse.independent_scores = llmResponse.independent_scores.map((s: any) => {
        const descs = descLookup[`${s.block_name}::${s.criterion_name}`] || [];
        const matched = descs.find((d: any) => d.level === s.ai_score);
        return {
          ...s,
          ai_score_descriptor: matched?.text || '',
          descriptors: descs
        };
      });
    }

    return Response.json({ success: true, data: llmResponse });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}