import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { file_url, pasted_text, template_category, template_type } = body;

    if (!file_url && !pasted_text) {
      return Response.json({ error: 'Either file_url or pasted_text is required' }, { status: 400 });
    }

    const isScoringMatrix = template_category === 'Scoring Matrix';

    const prompt = isScoringMatrix
      ? `Analyze this document and extract the complete scoring matrix / scorecard structure.
Extract:
1. Main weighted blocks/sections and their percentage weights (should sum to 100)
2. Individual criteria within each block (with numbers and names)
3. Sub-categories within each criterion
4. Level descriptors (1-5) for each criterion - the text describing what each score level means

Return a JSON object with this exact structure:
{
  "blocks": [
    {
      "name": "Block name",
      "weight": 20,
      "criteria": [
        {
          "number": 1,
          "name": "Criterion name",
          "category": "Sub-category",
          "descriptors": [
            {"level": 1, "text": "descriptor"},
            {"level": 2, "text": "descriptor"},
            {"level": 3, "text": "descriptor"},
            {"level": 4, "text": "descriptor"},
            {"level": 5, "text": "descriptor"}
          ]
        }
      ]
    }
  ]
}`
      : `Analyze this document and extract the complete process template / due diligence structure.
Extract:
1. Main stages/sections (ordered)
2. Sub-stages within each stage
3. Any documentation checklist items

Return a JSON object with this exact structure:
{
  "stages": [
    {
      "name": "Stage name",
      "sub_stages": [
        {"name": "Sub-stage name"}
      ]
    }
  ],
  "documentation_checklist": [
    {"name": "Checklist item name"}
  ]
}`;

    const responseSchema = isScoringMatrix
      ? {
          type: 'object',
          properties: {
            blocks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  weight: { type: 'number' },
                  criteria: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
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
        }
      : {
          type: 'object',
          properties: {
            stages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  sub_stages: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' }
                      }
                    }
                  }
                }
              }
            },
            documentation_checklist: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' }
                }
              }
            }
          }
        };

    const llmResponse = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: file_url ? [file_url] : undefined,
      response_json_schema: responseSchema,
      add_context_from_internet: false
    });

    // If pasted text, we need to pass it as part of the prompt since file_urls is for files
    let result = llmResponse;
    if (pasted_text && !file_url) {
      const textResponse = await base44.integrations.Core.InvokeLLM({
        prompt: prompt + '\n\n--- DOCUMENT TEXT ---\n' + pasted_text,
        response_json_schema: responseSchema,
        add_context_from_internet: false
      });
      result = textResponse;
    }

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}