import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { cleanStr } from '../../shared/enrichmentUtils.ts';
import {
  normalizeName, isStubBio, discoverPeoplePage, discoverBioUrlByPattern,
  extractPeopleFromPage, extractBiographyFromPage,
} from '../../shared/contactBioScrape.ts';

/**
 * Scrapes a single contact's biography. Tries the related firm's website
 * first (discover people page → find the contact's profile → extract bio),
 * then falls back to a general web search via InvokeLLM if the firm site has
 * no usable bio. Updates the contact's biography (and bio_url when found).
 */

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { contact_id } = body;
    if (!contact_id) return Response.json({ error: 'contact_id is required' }, { status: 400 });

    const contact = await base44.entities.Contact.get(contact_id);
    if (!contact) return Response.json({ error: 'Contact not found' }, { status: 404 });

    const firstName = cleanStr(contact.first_name) || '';
    const lastName = cleanStr(contact.last_name) || '';
    const fullName = `${firstName} ${lastName}`.trim();
    if (!fullName) return Response.json({ error: 'Contact has no name to search for' }, { status: 400 });

    const firmIds: string[] = Array.isArray(contact.firm_ids) ? contact.firm_ids : [];
    const sourcesTried: string[] = [];
    let foundBio = '';
    let foundBioUrl = '';

    // 1) Try each related firm's website.
    for (const fid of firmIds) {
      if (foundBio) break;
      let firm: any = null;
      try { firm = await base44.entities.Firm.get(fid); } catch { continue; }
      if (!firm || firm.deleted_at) continue;
      const website = cleanStr(firm.website);
      if (!website) continue;
      sourcesTried.push(`${firm.name} (${website})`);

      const peoplePageUrl = await discoverPeoplePage(website);
      if (!peoplePageUrl) continue;

      // Find this contact on the people page.
      const peoplePageText = await (await import('../../shared/enrichmentUtils.ts')).fetchPage(peoplePageUrl);
      if (!peoplePageText || peoplePageText.length < 100) continue;

      const people = await extractPeopleFromPage(base44, peoplePageText);
      const key = normalizeName(fullName);
      const match = people.find((p: any) => {
        const pFull = `${p.first_name || ''} ${p.last_name || ''}`.trim();
        return normalizeName(pFull) === key;
      });

      let bioUrl = match?.bio_url || '';
      if (!bioUrl) {
        bioUrl = await discoverBioUrlByPattern(peoplePageUrl, firstName, lastName);
      }
      if (bioUrl) {
        const bio = await extractBiographyFromPage(base44, fullName, bioUrl);
        if (bio && bio.length > 60) {
          foundBio = bio;
          foundBioUrl = bioUrl;
        }
      }
    }

    // 2) Fallback: general web search.
    if (!foundBio) {
      sourcesTried.push('General web search');
      try {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `Find the professional biography of "${fullName}"${firmIds.length > 0 ? ' (an investment professional)' : ''}. Search the web for their biography on their firm's website, LinkedIn, or other professional sources. Return the COMPLETE biography text verbatim — do not summarize or paraphrase. If you find a biography, include every paragraph. If no biography can be found, return an empty string.`,
          add_context_from_internet: true,
          model: 'gemini_3_flash',
          response_json_schema: {
            type: 'object',
            properties: {
              biography: { type: 'string' },
              source_url: { type: 'string' },
            },
          },
        });
        const bio = cleanStr(res?.biography);
        if (bio && bio.length > 60) {
          foundBio = bio;
          foundBioUrl = cleanStr(res?.source_url) || '';
        }
      } catch { /* web search may fail; continue */ }
    }

    if (!foundBio) {
      return Response.json({
        success: false,
        message: 'No biography could be found on the firm website(s) or the general web.',
        sources_tried: sourcesTried,
      });
    }

    // Update the contact — only overwrite biography if the new one is richer.
    const updateData: any = {};
    if (foundBio.length > (contact.biography || '').length) {
      updateData.biography = foundBio;
    }
    if (foundBioUrl && !contact.bio_url) {
      updateData.bio_url = foundBioUrl;
    }
    if (Object.keys(updateData).length > 0) {
      await base44.entities.Contact.update(contact_id, updateData);
    }

    return Response.json({
      success: true,
      biography: foundBio,
      bio_url: foundBioUrl,
      source: foundBioUrl ? 'firm_website' : 'web_search',
      sources_tried: sourcesTried,
      updated_fields: Object.keys(updateData),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}