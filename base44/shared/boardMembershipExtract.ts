// Shared helper for extracting board memberships from a contact's biography
// or professional experience. Imported by scrapeContactBiography,
// scrapeContactProfilePage, enrichFirmContactsBios, and enrichFirmFromWebsite
// so the extraction logic lives once.

// Extract structured board memberships from a biography text using LLM.
// Returns an array of { organization_name, role, start_year, end_year }.
export async function extractBoardMembershipsFromBio(
  base44: any,
  personName: string,
  biography: string,
): Promise<any[]> {
  if (!biography || biography.trim().length < 60) return [];
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are extracting board memberships and trustee positions from the biography of a person named "${personName}".

Biography:
"""
${biography.substring(0, 8000)}
"""

Extract EVERY board, trustee, or governance position mentioned in the biography. A board membership is a role on a board of directors, board of trustees, advisory board, or similar governance body of an EXTERNAL organization (not the person's own employer). Look for phrases like:
- "serves on the board of..."
- "is a trustee of..."
- "board member of..."
- "chairman of the board of..."
- "director of [Organization]"
- "serves on the [Organization] board"
- "member of the [Organization] board of trustees"

For each board membership, extract:
- organization_name: the name of the organization whose board they serve on
- role: their role on the board (e.g. "Board Member", "Trustee", "Chairman", "Director", "Vice Chair", "Lead Director")
- start_year: the year they joined (as a string, empty if not stated)
- end_year: the year they left (as a string, empty if current/ongoing)

Only include EXTERNAL board positions — roles on boards of outside organizations, not internal committees at their own firm. Only include what is explicitly stated in the biography. Do not fabricate.

Return a JSON object with a "board_memberships" array (empty array if none found).`,
      response_json_schema: {
        type: 'object',
        properties: {
          board_memberships: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                organization_name: { type: 'string' },
                role: { type: 'string' },
                start_year: { type: 'string' },
                end_year: { type: 'string' },
              },
            },
          },
        },
      },
    });
    return Array.isArray(res?.board_memberships) ? res.board_memberships : [];
  } catch {
    return [];
  }
}

// Deduplicate and merge board memberships: new items are added only if they
// don't already exist (matched by organization_name + role).
export function mergeBoardMemberships(existing: any[], newItems: any[]): any[] {
  const result = [...(existing || [])];
  const key = (m: any) => `${(m.organization_name || '').toLowerCase()}|${(m.role || '').toLowerCase()}`;
  const existingKeys = new Set(result.map(key));
  for (const item of newItems) {
    if (!item || !item.organization_name) continue;
    const k = key(item);
    if (!existingKeys.has(k)) {
      result.push({ ...item, id: crypto.randomUUID() });
      existingKeys.add(k);
    }
  }
  return result;
}