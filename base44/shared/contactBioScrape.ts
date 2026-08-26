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
- Do not include navigation, headers, footers, or other page chrome — only the biography text.
- If no biography is found, return an empty string.

--- PAGE CONTENT ---
${pageText.substring(0, 50000)}
--- END ---`,
      response_json_schema: { type: 'object', properties: { biography: { type: 'string' } } },
    });
    return (res?.biography || '').trim();
  } catch {
    return '';
  }
}