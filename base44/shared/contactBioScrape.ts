// Shared helpers for discovering and extracting a contact's biography from
// their firm's website. Imported by enrichFirmContactsBios (bulk) and
// scrapeContactBiography (single contact) so the discovery logic lives once.

import { fetchPage, cleanStr } from './enrichmentUtils.ts';

const COMMON_PEOPLE_PATHS = [
  '/about-xponance/people', '/about/people', '/about/firm', '/about/our-team',
  '/team', '/our-team', '/people', '/our-people', '/leadership', '/team-members',
  '/staff', '/investment-staff', '/investment-team', '/investment-team-tab', '/investment-professionals',
  '/about-us', '/company', '/personnel', '/professionals',
];

const NAME_SUFFIXES = new Set([
  'jr', 'sr', 'ii', 'iii', 'iv', 'v', 'esq', 'cfa', 'cpa', 'mba', 'phd', 'md',
  'cmfc', 'apfi', 'cipm', 'chfc', 'clu', 'cfp', 'frm',
]);

export function normalizeName(name: string): string {
  return (name || '').toLowerCase().trim().replace(/[.,;'’]/g, '')
    .split(/\s+/).filter((t) => t && !NAME_SUFFIXES.has(t)).join(' ').trim();
}

export function slugifyName(name: string): string {
  return (name || '').toLowerCase().trim().replace(/[.'’]/g, '')
    .split(/\s+/).filter((t) => t && !NAME_SUFFIXES.has(t)).join(' ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function isStubBio(bio: string, firstName: string): boolean {
  const b = (bio || '').trim();
  if (!b) return true;
  if (b.length < 150) return true;
  const first = (firstName || '').trim().toLowerCase();
  if (first && b.toLowerCase().startsWith(first) && b.length < 200) return true;
  return false;
}

// Discover the people/team page URL from the homepage's internal links.
export async function discoverPeoplePage(website: string): Promise<string> {
  const homepage = await fetchPage(website);
  if (!homepage) return '';
  let baseHost = '';
  try { baseHost = new URL(website).host.toLowerCase(); } catch { /* ignore */ }
  const linkRegex = /\[LINK:\s*(https?:\/\/[^\]]+)\]/gi;
  const candidates: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(homepage)) !== null) {
    const url = m[1];
    let linkHost = '';
    try { linkHost = new URL(url).host.toLowerCase(); } catch { /* ignore */ }
    if (linkHost !== baseHost) continue;
    if (/\/(people|our-people|team|our-team|leadership|staff|investment-staff|investment-team|investment-team-tab|investment-professionals|personnel|professionals)\b/i.test(url)) {
      candidates.push(url);
    }
  }
  for (const path of COMMON_PEOPLE_PATHS) {
    try {
      const fullUrl = new URL(path, website).href;
      if (!candidates.includes(fullUrl)) candidates.push(fullUrl);
    } catch { /* ignore */ }
  }
  for (const url of candidates.slice(0, 8)) {
    const text = await fetchPage(url);
    if (text && text.length > 500) return url;
  }
  return '';
}

// Extract all people from the people page text using LLM.
export async function extractPeopleFromPage(base44: any, pageText: string): Promise<any[]> {
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Extract EVERY person listed on this team/people page. Return ALL of them — do not stop after the first few.

For each person, provide:
- first_name
- last_name
- title (their role/position)
- photo_url (the src URL from the [IMAGE: ...] marker closest to their name)
- bio_url (if their name is a link to an individual profile page, use that [LINK: ...] URL; otherwise leave empty)

The page is organized in sections (Executive, Investment Team, etc.). Go through EVERY section and extract EVERY person. If you see 40+ people, return all 40+.

--- PAGE CONTENT ---
${pageText.substring(0, 50000)}
--- END ---`,
      response_json_schema: {
        type: 'object',
        properties: {
          people: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                first_name: { type: 'string' },
                last_name: { type: 'string' },
                title: { type: 'string' },
                photo_url: { type: 'string' },
                bio_url: { type: 'string' },
              },
            },
          },
        },
      },
    });
    const people = res?.people || [];
    for (const p of people) {
      p.photo_url = cleanStr(p.photo_url);
      p.bio_url = cleanStr(p.bio_url);
    }
    return people.filter((p: any) => p.first_name || p.last_name);
  } catch {
    return [];
  }
}

// Discover a person's bio page URL via slug pattern probing.
export async function discoverBioUrlByPattern(
  peoplePageUrl: string,
  firstName: string,
  lastName: string,
): Promise<string> {
  if (!firstName || !lastName) return '';
  let basePath = peoplePageUrl;
  const kwMatch = basePath.match(/(.*?\/(?:people|our-people|team|our-team|leadership|staff|investment-staff|investment-team|investment-team-tab|investment-professionals|personnel|professionals)\/)/i);
  if (kwMatch) basePath = kwMatch[1];
  else if (!basePath.endsWith('/')) basePath += '/';

  const first = slugifyName(firstName);
  const last = slugifyName(lastName);
  const slug = `${first}-${last}`;
  if (!slug || slug === '-') return '';

  const url = basePath + slug + '/';
  const text = await fetchPage(url);
  if (text && text.length > 200) {
    const lower = text.toLowerCase();
    if (lower.includes(last.toLowerCase())) return url;
  }
  return '';
}

// Post-process a raw biography string from the LLM into presentable
// paragraphs. The LLM often returns the entire bio as a single line of text
// with no paragraph breaks. This function:
//  1. Normalizes existing newlines (\r\n → \n, 3+ newlines → 2).
//  2. If the text already has paragraph breaks (\n\n), trims each paragraph.
//  3. If the text has only single \n breaks, promotes them to \n\n.
//  4. If the text has no newlines at all, inserts \n\n before sentences that
//     start a new paragraph (common professional-bio paragraph starters like
//     "He", "She", "Mr.", "Prior to", "In 1984", etc.).
export function formatBioParagraphs(bio: string): string {
  if (!bio) return '';
  let text = bio.trim();
  // Normalize line endings and collapse excessive newlines.
  text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');

  // Case 1: already has \n\n paragraph breaks — clean each paragraph.
  if (text.includes('\n\n')) {
    return text
      .split('\n\n')
      .map((p) => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
      .filter((p) => p.length > 0)
      .join('\n\n');
  }

  // Case 2: has single \n breaks but no \n\n — promote to paragraph breaks.
  if (text.includes('\n')) {
    return text
      .split('\n')
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter((p) => p.length > 0)
      .join('\n\n');
  }

  // Case 3: no newlines at all — insert \n\n before common paragraph starters.
  // These are phrases that typically begin a new paragraph in professional bios.
  const starters =
    /\.\s+(?=(?:He|She|Mr\.|Ms\.|Mrs\.|Dr\.|Prof\.|His|Her|Their|They|In\s+\d{4}|After|Prior\s+to|Before|Following|During|Earlier|Previously|Most\s+recently|Currently|He\s+has|She\s+has|He\s+received|She\s+received|He\s+earned|She\s+earned|He\s+began|She\s+began|He\s+joined|She\s+joined|He\s+serves|She\s+serves|He\s+is|She\s+is|He\s+was|She\s+was|His\s+experience|Her\s+experience|His\s+career|Her\s+career|Mr\.\s+|Ms\.\s+|Mrs\.\s+|Dr\.\s+|Prof\.\s+)\b)/g;
  let formatted = text.replace(starters, '.\n\n');

  // If no paragraph starters were found and the bio is long, split every ~3
  // sentences so it's still readable.
  if (!formatted.includes('\n\n') && text.length > 300) {
    const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)/g) || [text];
    const paragraphs: string[] = [];
    let current: string[] = [];
    for (let i = 0; i < sentences.length; i++) {
      current.push(sentences[i]);
      if (current.length >= 3) {
        paragraphs.push(current.join('').trim());
        current = [];
      }
    }
    if (current.length > 0) paragraphs.push(current.join('').trim());
    formatted = paragraphs.filter((p) => p.length > 0).join('\n\n');
  }

  return formatted.trim();
}

// Extract biography from an individual profile page.
export async function extractBiographyFromPage(base44: any, personName: string, bioUrl: string): Promise<string> {
  const pageText = await fetchPage(bioUrl);
  if (!pageText || pageText.length < 50) return '';
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Extract the COMPLETE biography of "${personName}" from their profile page below.

CRITICAL INSTRUCTIONS:
- Copy the ENTIRE biography VERBATIM — do not summarize, paraphrase, or shorten.
- Include EVERY paragraph from the first sentence to the last sentence of the bio.
- Do NOT stop partway through. The biography must end with a complete sentence, not mid-sentence.
- If the bio is long (multiple paragraphs), include ALL of them.
- PRESERVE PARAGRAPH BREAKS: separate each paragraph with a double newline (\\n\\n). Do NOT collapse the entire bio into a single block of text — keep the original paragraph structure.
- Do not include navigation, headers, footers, or other page chrome — only the biography text.
- If no biography is found, return an empty string.

--- PAGE CONTENT ---
${pageText.substring(0, 50000)}
--- END ---`,
      response_json_schema: { type: 'object', properties: { biography: { type: 'string' } } },
    });
    return formatBioParagraphs(res?.biography || '');
  } catch {
    return '';
  }
}