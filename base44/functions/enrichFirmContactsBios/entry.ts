import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { assertSafePublicUrl } from '../../shared/urlSafety.ts';

/**
 * Targeted enrichment: fetches the firm's people page, extracts all personnel,
 * matches them to existing contacts, and fetches individual biography pages
 * ONLY for matched contacts with empty/stub bios. This is faster than the
 * full enrichFirmFromWebsite because it skips firm-level extraction and only
 * fetches bio pages for contacts that actually need them (bounded to existing
 * contacts, not all people on the page).
 */

const CONSENT_COOKIES = [
  'CookieConsent={stamp%3D%27-consented%27%2Cnecessary%3Atrue%2Cpreferences%3Atrue%2Cstatistics%3Atrue%2Cmarketing%3Atrue%2Cmethod%3A%27explicit%27%2Cver%3A1}',
  'OptanonConsent=isIABGlobal=false&datestamp=Mon+Jan+01+2024+00%3A00%3A00+GMT-0000&version=6.30.0&consentId=consent&interactionCount=1&landingPath=NotLandingPage&groups=C0001%3A1%2CC0002%3A1%2CC0003%3A1%2CC0004%3A1%2CC0005%3A1',
  'cookieconsent_status=allow',
].join('; ');

// Complete browser-like headers — some sites (WAFs / anti-bot plugins) 403
// bare scraper requests; the Sec-Fetch-* / sec-ch-ua headers pass them.
function browserHeaders(cookieHeader: string): Record<string, string> {
  return {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'Cookie': cookieHeader,
  };
}

const COMMON_PEOPLE_PATHS = [
  '/about-xponance/people', '/about/people', '/about/firm', '/about/our-team',
  '/team', '/our-team', '/people', '/our-people', '/leadership', '/team-members',
  '/staff', '/about-us', '/company', '/personnel', '/professionals',
];

const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v', 'esq', 'cfa', 'cpa', 'mba', 'phd', 'md', 'cmfc', 'apfi', 'cipm', 'chfc', 'clu', 'cfp', 'frm']);

async function fetchPage(url: string): Promise<string> {
  // SSRF guard: reject internal/private/link-local/loopback targets before fetching.
  try { await assertSafePublicUrl(url); } catch { return ''; }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      headers: browserHeaders(CONSENT_COOKIES),
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) return '';
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text') && !contentType.includes('html')) return '';
    const html = await response.text();
    return htmlToText(html, url);
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

function htmlToText(html: string, baseUrl: string): string {
  let result = html.replace(/<img[^>]*>/gi, (match) => {
    const srcMatch = match.match(/\ssrc\s*=\s*["']([^"']+)["']/i) ||
      match.match(/\sdata-src\s*=\s*["']([^"']+)["']/i);
    const altMatch = match.match(/\salt\s*=\s*["']([^"']*)["']/i);
    let src = srcMatch ? srcMatch[1].trim() : '';
    if (!src || src.startsWith('data:')) return '';
    try { src = new URL(src, baseUrl).href; } catch { return ''; }
    return `\n[IMAGE: alt="${altMatch ? altMatch[1] : ''}" src="${src}"]\n`;
  });
  // Extract internal links (for bio page discovery).
  let baseHost = '';
  try { baseHost = new URL(baseUrl).host.toLowerCase(); } catch { /* ignore */ }
  result = result.replace(/<a\s[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, text) => {
    const cleanText = text.replace(/<[^>]+>/g, '').trim();
    try {
      const url = new URL(href.trim(), baseUrl).href;
      let linkHost = '';
      try { linkHost = new URL(url).host.toLowerCase(); } catch { /* ignore */ }
      if (linkHost === baseHost) return `${cleanText} [LINK: ${url}]`;
    } catch { /* ignore */ }
    return cleanText;
  });
  result = result
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<\/?(div|p|br|h[1-6]|li|ul|ol|span|a|td|tr|table|section|article|main|dt|dd|dl|details|summary|button|label|figcaption|figure|blockquote)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
  return result;
}

function normalizeName(name: string): string {
  return (name || '').toLowerCase().trim().replace(/[.,;'’]/g, '')
    .split(/\s+/).filter((t) => t && !NAME_SUFFIXES.has(t)).join(' ').trim();
}

function slugifyName(name: string): string {
  return (name || '').toLowerCase().trim().replace(/[.'’]/g, '')
    .split(/\s+/).filter((t) => t && !NAME_SUFFIXES.has(t)).join(' ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function isStubBio(bio: string, firstName: string): boolean {
  const b = (bio || '').trim();
  if (!b) return true;
  // Treat short bios as stubs — many sites show a short tagline/quote on
  // the team listing while the full bio is on the profile page.
  if (b.length < 150) return true;
  // Also treat name-only stubs (e.g. "Jerrod Stoller") as stubs.
  const first = (firstName || '').trim().toLowerCase();
  if (first && b.toLowerCase().startsWith(first) && b.length < 200) return true;
  return false;
}

// Discover the people/team page URL from the homepage's internal links.
async function discoverPeoplePage(website: string): Promise<string> {
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
    if (/\/(people|our-people|team|our-team|leadership|staff|personnel|professionals)\b/i.test(url)) {
      candidates.push(url);
    }
  }
  // Try common paths as fallback.
  for (const path of COMMON_PEOPLE_PATHS) {
    try {
      const fullUrl = new URL(path, website).href;
      if (!candidates.includes(fullUrl)) candidates.push(fullUrl);
    } catch { /* ignore */ }
  }
  // Return the first candidate that returns substantial content.
  for (const url of candidates.slice(0, 8)) {
    const text = await fetchPage(url);
    if (text && text.length > 500) return url;
  }
  return '';
}

// Extract all people from the people page text using LLM.
async function extractPeopleFromPage(base44: any, pageText: string, pageUrl: string): Promise<any[]> {
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
    const cleanStr = (v: any) => (v === 'null' || v === 'undefined' ? '' : v) || '';
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
async function discoverBioUrlByPattern(
  peoplePageUrl: string,
  firstName: string,
  lastName: string,
): Promise<string> {
  if (!firstName || !lastName) return '';
  // Extract the base path from the people page URL (e.g. /about-xponance/people/).
  let basePath = peoplePageUrl;
  const kwMatch = basePath.match(/(.*?\/(?:people|our-people|team|our-team|leadership|staff|personnel|professionals)\/)/i);
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
async function extractBiography(base44: any, personName: string, bioUrl: string): Promise<string> {
  const pageText = await fetchPage(bioUrl);
  if (!pageText || pageText.length < 50) return '';
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Extract the COMPLETE biography of "${personName}" from their profile page. Copy the biography VERBATIM — do not summarize or paraphrase. Include every paragraph. If no biography is found, return an empty string.

--- PAGE CONTENT ---
${pageText.substring(0, 20000)}
--- END ---`,
      response_json_schema: { type: 'object', properties: { biography: { type: 'string' } } },
    });
    return (res?.biography || '').trim();
  } catch {
    return '';
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { firm_id, website_url } = body;
    if (!firm_id) return Response.json({ error: 'firm_id is required' }, { status: 400 });

    const firm = await base44.asServiceRole.entities.Firm.get(firm_id);
    if (!firm) return Response.json({ error: 'Firm not found' }, { status: 404 });

    const website = website_url || firm.website || '';
    if (!website) return Response.json({ error: 'No website URL available for this firm' }, { status: 400 });

    // Discover the people page.
    const peoplePageUrl = await discoverPeoplePage(website);
    if (!peoplePageUrl) {
      return Response.json({ error: 'Could not find a people/team page on the website' }, { status: 404 });
    }

    // Fetch and extract all people from the people page.
    const peoplePageText = await fetchPage(peoplePageUrl);
    if (!peoplePageText || peoplePageText.length < 100) {
      return Response.json({ error: 'People page has no content' }, { status: 502 });
    }
    const people = await extractPeopleFromPage(base44, peoplePageText, peoplePageUrl);
    if (people.length === 0) {
      return Response.json({ firm: firm.name, peoplePageUrl, updated: [], message: 'No people found on the page' });
    }

    // Load contacts linked to this firm.
    const allContacts = await base44.asServiceRole.entities.Contact.list(null, 500);
    const firmContacts = allContacts.filter((c: any) => !c.deleted_at && (c.firm_ids || []).includes(firm.id));
    const contactsByKey = new Map<string, any>();
    for (const c of firmContacts) {
      const full = `${c.first_name || ''} ${c.last_name || ''}`.trim();
      contactsByKey.set(normalizeName(full), c);
    }

    // Match and identify contacts needing bios.
    const toEnrich: { person: any; contact: any }[] = [];
    for (const person of people) {
      const personFull = `${person.first_name || ''} ${person.last_name || ''}`.trim();
      const key = normalizeName(personFull);
      const match = contactsByKey.get(key);
      if (!match) continue;
      toEnrich.push({ person, contact: match });
    }

    if (toEnrich.length === 0) {
      return Response.json({ firm: firm.name, peoplePageUrl, peopleFound: people.length, updated: [], message: 'No matched contacts needing updates' });
    }

    // For each matched contact, fill empty fields and fetch biography if needed.
    // Bounded concurrency to stay within time limits.
    const CONCURRENCY = 5;
    const updates: any[] = [];
    let cursor = 0;

    const worker = async () => {
      while (cursor < toEnrich.length) {
        const i = cursor++;
        const { person, contact } = toEnrich[i];
        const fullName = `${person.first_name || ''} ${person.last_name || ''}`.trim();
        const updateData: any = {};
        const updatedFields: string[] = [];

        // Fill empty scalar fields (append-only, never overwrite).
        if (person.title && !(contact.title || '').trim()) {
          updateData.title = person.title;
          updatedFields.push('Title');
        }
        if (person.photo_url && !(contact.photo_url || '').trim()) {
          updateData.photo_url = person.photo_url;
          updatedFields.push('Photo');
        }

        // Biography: fetch if contact has empty/stub bio.
        if (isStubBio(contact.biography, contact.first_name)) {
          let bioUrl = person.bio_url || '';
          // If no bio_url from extraction, try slug pattern.
          if (!bioUrl) {
            bioUrl = await discoverBioUrlByPattern(peoplePageUrl, person.first_name, person.last_name);
          }
          if (bioUrl) {
            const bio = await extractBiography(base44, fullName, bioUrl);
            if (bio && bio.length > 60) {
              updateData.biography = bio;
              updatedFields.push('Biography');
            }
          }
        }

        if (Object.keys(updateData).length > 0) {
          try {
            await base44.asServiceRole.entities.Contact.update(contact.id, updateData);
            updates.push({
              contact_id: contact.id,
              name: fullName,
              updated_fields: updatedFields,
              bio_len: updateData.biography ? updateData.biography.length : 0,
            });
          } catch (e) {
            updates.push({ contact_id: contact.id, name: fullName, error: e.message });
          }
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, toEnrich.length) }, () => worker()));

    return Response.json({
      firm: firm.name,
      peoplePageUrl,
      peopleFound: people.length,
      contactsMatched: toEnrich.length,
      updated: updates,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});