// Shared helpers for discovering and extracting a contact's headshot/photo
// from their firm's website, then falling back to a general web search.
// Imported by scrapeContactPhoto (single contact). Reuses the people-page
// discovery + extraction from contactBioScrape.ts so the firm-website path
// is consistent with the biography scraper.

import { fetchPage, cleanStr } from './enrichmentUtils.ts';
import {
  normalizeName, discoverPeoplePage, extractPeopleFromPage,
  discoverBioUrlByPattern,
} from './contactBioScrape.ts';

// Extract the headshot URL from an individual profile page via LLM.
// The page text contains [IMAGE: ...] markers; the LLM picks the one
// that is the person's headshot (closest to their name, a face photo).
export async function extractPhotoFromProfilePage(
  base44: any,
  personName: string,
  profileUrl: string,
): Promise<string> {
  const pageText = await fetchPage(profileUrl);
  if (!pageText || pageText.length < 50) return '';
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `On this profile page, find the headshot/profile photo of "${personName}". Return ONLY the image URL (the src from the [IMAGE: ...] marker that is the person's face photo). If no photo is found, return an empty string.

--- PAGE CONTENT ---
${pageText.substring(0, 20000)}
--- END ---`,
      response_json_schema: {
        type: 'object',
        properties: {
          photo_url: { type: 'string' },
        },
      },
    });
    return cleanStr(res?.photo_url);
  } catch {
    return '';
  }
}

// Resolve a possibly-relative image URL against a base page URL.
export function resolveImageUrl(imgUrl: string, baseUrl: string): string {
  if (!imgUrl) return '';
  if (/^https?:\/\//i.test(imgUrl)) return imgUrl;
  if (imgUrl.startsWith('//')) return 'https:' + imgUrl;
  try {
    return new URL(imgUrl, baseUrl).href;
  } catch {
    return imgUrl;
  }
}

// Main: try the firm website (people page → photo, or individual profile → photo),
// then fall back to a general web search. Returns { photo_url, source, sources_tried }.
export async function discoverContactPhoto(
  base44: any,
  fullName: string,
  firstName: string,
  lastName: string,
  firmIds: string[],
): Promise<{ photo_url: string; source: string; sources_tried: string[] }> {
  const sourcesTried: string[] = [];
  let foundPhoto = '';
  let foundSource = '';

  // 1) Try each related firm's website.
  for (const fid of firmIds) {
    if (foundPhoto) break;
    let firm: any = null;
    try { firm = await base44.entities.Firm.get(fid); } catch { continue; }
    if (!firm || firm.deleted_at) continue;
    const website = cleanStr(firm.website);
    if (!website) continue;
    sourcesTried.push(`${firm.name} (${website})`);

    const peoplePageUrl = await discoverPeoplePage(website);
    if (!peoplePageUrl) continue;

    const peoplePageText = await fetchPage(peoplePageUrl);
    if (!peoplePageText || peoplePageText.length < 100) continue;

    // The people-page extraction already returns photo_url per person.
    const people = await extractPeopleFromPage(base44, peoplePageText);
    const key = normalizeName(fullName);
    const match = people.find((p: any) => {
      const pFull = `${p.first_name || ''} ${p.last_name || ''}`.trim();
      return normalizeName(pFull) === key;
    });

    if (match?.photo_url) {
      foundPhoto = resolveImageUrl(match.photo_url, peoplePageUrl);
      foundSource = 'firm_website';
    }

    // If no photo on the people page but there's an individual profile, scrape it.
    if (!foundPhoto) {
      let bioUrl = match?.bio_url || '';
      if (!bioUrl) {
        bioUrl = await discoverBioUrlByPattern(peoplePageUrl, firstName, lastName);
      }
      if (bioUrl) {
        const photo = await extractPhotoFromProfilePage(base44, fullName, bioUrl);
        if (photo) {
          foundPhoto = resolveImageUrl(photo, bioUrl);
          foundSource = 'firm_website';
        }
      }
    }
  }

  // 2) Fallback: general web search for the person's headshot.
  if (!foundPhoto) {
    sourcesTried.push('General web search');
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Find a professional headshot/photo of "${fullName}"${firmIds.length > 0 ? ' (an investment professional)' : ''}. Search the web for their photo on their firm's website, LinkedIn, or other professional sources. Return the direct image URL (the src of the <img> tag pointing to the photo). If you cannot find a photo, return an empty string.`,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: {
            photo_url: { type: 'string' },
            source_url: { type: 'string' },
          },
        },
      });
      const photo = cleanStr(res?.photo_url);
      if (photo) {
        foundPhoto = photo;
        foundSource = 'web_search';
      }
    } catch { /* web search may fail; continue */ }
  }

  return {
    photo_url: foundPhoto,
    source: foundSource,
    sources_tried: sourcesTried,
  };
}