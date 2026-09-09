import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Extract all text content from an xlsx/xls file by parsing it directly,
// so the LLM receives every row instead of relying on its own file parsing
// (which can silently miss rows in spreadsheet files).
async function extractXlsxText(file_url: string): Promise<string | null> {
  try {
    const XLSX = await import('npm:xlsx@0.18.5');
    const resp = await fetch(file_url);
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const lines: string[] = [];
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
      for (const row of rows) {
        const cells = (row as any[]).map((c) => String(c ?? '').trim()).filter((c) => c.length > 0);
        if (cells.length > 0) lines.push(cells.join('\n'));
      }
    }
    return lines.length > 0 ? lines.join('\n\n') : null;
  } catch {
    return null;
  }
}

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
      ? `Analyze this document and extract the COMPLETE scoring matrix / scorecard structure.
CRITICAL: You MUST extract EVERY section and EVERY sub-section/criterion from the document. Do NOT skip or omit any sections. If the document has 6 sections with multiple criteria each, you MUST return all 6 sections and all criteria within each.

Extract:
1. ALL main weighted blocks/sections and their percentage weights (should sum to 100). Include every section header found in the document (e.g. "Section 1", "Section 2", "Section 3", etc.)
2. ALL individual criteria within each block (with numbers and names). Include every numbered criterion (e.g. 1.a, 1.b, 1.c, 1.d, 2.a, 2.b, etc.)
3. Sub-categories within each criterion
4. ALL level descriptors for each criterion - the text describing what each score level means. Include every numbered level (e.g. (1), (2), (3), (4), (5))
5. BONUS/PENALTY detection: if a criterion is labeled as BONUS or PENALTY (e.g. "Alignment of Interests (BONUS) (0-2)", "Market Insights (BONUS) (0-3)", "Financial Solvency/Burnrate (-10-5)", "Is the Firm GIPS Compliance (-1-3)"), set bonus_penalty_enabled=true and extract the min/max range from the label (e.g. (0-2) → min:0, max:2; (-1-3) → min:-1, max:3; (-5-5) → min:-5, max:5). For BONUS-labeled criteria, descriptors use levels starting from 0 or +1. For PENALTY-labeled criteria, descriptors may include negative values. Always populate the descriptors array with all levels described in the document. Include a bonus_penalty_guidance string summarizing when/how to apply the adjustment.

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
          "bonus_penalty_enabled": false,
          "bonus_penalty_range": {"min": -1, "max": 1},
          "bonus_penalty_guidance": "Apply this bonus/penalty when...",
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
}

IMPORTANT: For regular (non-bonus/penalty) criteria set bonus_penalty_enabled=false and omit bonus_penalty_range/bonus_penalty_guidance. For bonus/penalty criteria set bonus_penalty_enabled=true and populate bonus_penalty_range with the actual min/max values from the document label.`
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
                        bonus_penalty_enabled: { type: 'boolean' },
                        bonus_penalty_range: {
                          type: 'object',
                          properties: {
                            min: { type: 'number' },
                            max: { type: 'number' }
                          }
                        },
                        bonus_penalty_guidance: { type: 'string' },
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

    // For xlsx/xls files, extract the raw text programmatically so the LLM
    // sees every row. For other file types (pdf, docx, txt), pass the file
    // directly to the LLM via file_urls. For pasted text, include it inline.
    let extractedText: string | null = null;
    let useFileUrls: string[] | undefined = undefined;

    if (file_url) {
      const lowerUrl = file_url.toLowerCase();
      if (lowerUrl.endsWith('.xlsx') || lowerUrl.endsWith('.xls')) {
        extractedText = await extractXlsxText(file_url);
      }
      // If xlsx extraction failed or it's a non-xlsx file, fall back to file_urls
      if (!extractedText) {
        useFileUrls = [file_url];
      }
    }

    let fullPrompt = prompt;
    if (extractedText) {
      fullPrompt += '\n\n--- DOCUMENT TEXT (extracted from spreadsheet, contains ALL rows) ---\n' + extractedText;
    } else if (pasted_text) {
      fullPrompt += '\n\n--- DOCUMENT TEXT ---\n' + pasted_text;
    }

    const llmResponse = await base44.integrations.Core.InvokeLLM({
      prompt: fullPrompt,
      file_urls: useFileUrls,
      response_json_schema: responseSchema,
      add_context_from_internet: false
    });

    return Response.json({ success: true, data: llmResponse });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}