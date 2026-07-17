import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Fetches a website's content directly (homepage + common sub-pages like /about, /team)
 * and passes it to the LLM for structured extraction.
 * This is more reliable than relying solely on add_context_from_internet web search.
 */

const COMMON_PATHS = [
  '/about',
  '/about/firm',
  '/about/our-team',
  '/team',
  '/our-team',
  '/people',
  '/our-people',
  '/leadership',
  '/team-members',
  '/staff',
  '/contact',
  '/about-us',
  '/company',
  '/philosophy',
  '/approach',
];

// Common cookie consent cookies that signal "user accepted all cookies".
// Many cookie consent platforms (OneTrust, Cookiebot, Quantcast, TrustArc, etc.)
// check for these on the server side and return full content when present.
const CONSENT_COOKIES = [
  // Cookiebot
  'CookieConsent={stamp%3D%27-consented%27%2Cnecessary%3Atrue%2Cpreferences%3Atrue%2Cstatistics%3Atrue%2Cmarketing%3Atrue%2Cmethod%3A%27explicit%27%2Cver%3A1}',
  // OneTrust / Optanon
  'OptanonConsent=isIABGlobal=false&datestamp=Mon+Jan+01+2024+00%3A00%3A00+GMT-0000&version=6.30.0&consentId=consent&interactionCount=1&landingPath=NotLandingPage&groups=C0001%3A1%2CC0002%3A1%2CC0003%3A1%2CC0004%3A1%2CC0005%3A1',
  'eupubconsent-v2=CP-xxx',
  // Quantcast Choice
  'qcSxc=1',
  // TrustArc
  'notice_preferences=2:',
  'cmapi_cookie_privacy=permit%201,2,3,4',
  // Generic / custom banners
  'cookieconsent_status=allow',
  'cookies_accepted=true',
  'accept_cookies=true',
  'gdpr-consent=1',
  'hasConsented=true',
  'privacy_consent=1',
  'viewed_cookie_policy=true',
].join('; ');

async function fetchPage(url: string, maxRedirects = 3): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': CONSENT_COOKIES,
        'DNT': '0',
      },
      redirect: 'follow',
    });
    if (!response.ok) {
      // Always consume the body to avoid stalled-response deadlocks under load.
      try { await response.body?.cancel(); } catch { /* ignore */ }
      return '';
    }
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text') && !contentType.includes('html')) {
      try { await response.body?.cancel(); } catch { /* ignore */ }
      return '';
    }
    const html = await response.text();
    return htmlToText(html, url);
  } catch {
    return '';
  }
}

function extractImgUrl(imgTag: string, baseUrl: string): string {
  // Try standard src, then common lazy-loading attributes
  const srcMatch =
    imgTag.match(/\ssrc\s*=\s*["']([^"']+)["']/i) ||
    imgTag.match(/\sdata-src\s*=\s*["']([^"']+)["']/i) ||
    imgTag.match(/\sdata-lazy-src\s*=\s*["']([^"']+)["']/i) ||
    imgTag.match(/\sdata-original\s*=\s*["']([^"']+)["']/i);
  let src = srcMatch ? srcMatch[1].trim() : '';
  // Fallback: first URL in srcset (responsive images)
  if (!src) {
    const srcsetMatch = imgTag.match(/\ssrcset\s*=\s*["']([^"']+)["']/i);
    if (srcsetMatch) {
      src = srcsetMatch[1].split(',')[0].trim().split(/\s+/)[0];
    }
  }
  if (!src || src.startsWith('data:')) return '';
  return resolveUrl(baseUrl, src);
}

function htmlToText(html: string, baseUrl: string): string {
  // Step 1: Convert all <img> tags into text markers with resolved absolute URLs
  // so the LLM can see and extract photo/logo URLs (images are normally stripped)
  let result = html.replace(/<img[^>]*>/gi, (match) => {
    const src = extractImgUrl(match, baseUrl);
    const altMatch = match.match(/\salt\s*=\s*["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : '';
    if (!src) return '';
    return `\n[IMAGE: alt="${alt}" src="${src}"]\n`;
  });

  // Step 2: For nav/footer/header sections, extract internal links (team/
  // people page URLs often live only in the nav menu) and keep [IMAGE: ...]
  // markers (logos are commonly in the header). Other nav text is noise.
  result = result.replace(/<(nav|footer|header)[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _tag, inner) => {
    const images = inner.match(/\[IMAGE:[^\]]*\]/g) || [];
    // Extract href URLs from <a> tags BEFORE image markers were applied —
    // the inner HTML may still have raw <a href="..."> tags since this runs
    // before the link conversion in Step 3.
    const links = inner.match(/<a\s[^>]*?href\s*=\s*["']([^"']+)["']/gi) || [];
    const linkMarkers = links
      .map((l) => {
        const hrefMatch = l.match(/href\s*=\s*["']([^"']+)["']/i);
        return hrefMatch ? `[LINK: ${resolveUrl(baseUrl, hrefMatch[1].trim())}]` : '';
      })
      .filter(Boolean);
    const parts = [...images, ...linkMarkers];
    return parts.length > 0 ? '\n' + parts.join('\n') : '';
  });

  // Step 3: Convert <a href="...">text</a> into "text [LINK: url]" so the LLM
  // can see and extract LinkedIn profile URLs and other link targets that
  // would otherwise be lost when tags are stripped. Internal links (same host)
  // are preserved too, so the LLM can identify individual bio/profile pages
  // linked from team directory cards.
  let baseHost = '';
  try { baseHost = new URL(baseUrl).host.toLowerCase(); } catch { /* ignore */ }
  result = result.replace(/<a\s[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, text) => {
    const cleanText = text.replace(/<[^>]+>/g, '').trim();
    const url = resolveUrl(baseUrl, href.trim());
    if (!url) return cleanText;
    let linkHost = '';
    try { linkHost = new URL(url).host.toLowerCase(); } catch { /* ignore */ }
    const isSocial = /linkedin|twitter|x\.com|facebook|instagram|youtube/i.test(url);
    const isInternal = !!baseHost && !!linkHost && linkHost === baseHost;
    // Preserve social links and internal links (likely bio/profile pages).
    if (isSocial || isInternal) {
      return `${cleanText} [LINK: ${url}]`;
    }
    return cleanText;
  });

  // Step 4: Remove scripts, styles, SVGs and remaining tags
  result = result
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<\/?(div|p|br|h[1-6]|li|ul|ol|span|a|td|tr|table|section|article|main)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  return result;
}

function resolveUrl(base: string, path: string): string {
  try {
    return new URL(path, base).href;
  } catch {
    return '';
  }
}

// Fetch an individual biography/profile page and extract the person's full
// biography text via a focused LLM pass. Returns '' if nothing is found.
async function extractBiographyFromPage(
  base44: any,
  personName: string,
  bioUrl: string,
): Promise<string> {
  const pageText = await fetchPage(bioUrl);
  if (!pageText || pageText.length < 50) return '';
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are extracting the biography of a specific person from their individual profile page.

Person name: "${personName}"

Below is the text content of their profile/biography page. Locate the section describing THIS person (often near their name, under a heading like "Biography", "About", "Profile", or "Overview"). Extract the COMPLETE biography text for this person. You MUST copy the biography VERBATIM — do not summarize, do not paraphrase, do not abbreviate, and do not omit any sentences or paragraphs. Include EVERY paragraph of the biography in full. If the page lists multiple people, extract only the biography belonging to "${personName}". If no biography text is found for this person, return an empty string.

--- PAGE CONTENT ---
${pageText.substring(0, 20000)}
--- END PAGE CONTENT ---`,
      response_json_schema: {
        type: 'object',
        properties: {
          biography: { type: 'string' },
        },
      },
    });
    return (res?.biography || '').trim();
  } catch {
    return '';
  }
}

// Discover a person's individual profile-page URL by scanning the fetched
// page text for an internal [LINK: ...] marker whose surrounding text contains
// the person's name. The LLM sometimes fails to populate bio_url, so this is a
// reliable fallback that inspects the link markers preserved by htmlToText.
function discoverBioUrl(
  pageContents: { url: string; text: string }[],
  firstName: string,
  lastName: string,
): string {
  if (!firstName && !lastName) return '';
  const first = (firstName || '').toLowerCase().trim();
  const last = (lastName || '').toLowerCase().trim();
  for (const page of pageContents) {
    if (!page.text) continue;
    // Find all [LINK: url] markers with a generous window of surrounding text.
    const regex = /\[LINK:\s*([^\]]+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(page.text)) !== null) {
      const url = m[1].trim();
      // Must be an internal link (same site) — skip social/external links.
      let linkHost = '';
      let pageHost = '';
      try { linkHost = new URL(url).host.toLowerCase(); } catch { /* ignore */ }
      try { pageHost = new URL(page.url).host.toLowerCase(); } catch { /* ignore */ }
      if (!linkHost || !pageHost || linkHost !== pageHost) continue;
      // Inspect text both before and after the marker (card layouts vary).
      const before = page.text.substring(Math.max(0, m.index - 120), m.index).toLowerCase();
      const after = page.text.substring(m.index, Math.min(page.text.length, m.index + 160)).toLowerCase();
      const ctx = before + ' ' + after;
      // Require the last name (more distinctive) and, if available, the first
      // name too, to avoid grabbing unrelated internal links.
      if (last && ctx.includes(last) && (!first || ctx.includes(first))) {
        return url;
      }
    }
  }
  return '';
}

// Fallback: when the listing page doesn't link to individual bio pages (e.g.
// Divi et_clickable cards, JS-rendered team grids), use web search to discover
// each person's individual profile/biography page URL on the firm's own domain.
// A single batched search for all missing-bio people keeps this within time
// limits. Returns a map of lowercased full name -> bio page URL.
async function discoverBioUrlsViaSearch(
  base44: any,
  people: any[],
  website: string,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!people || people.length === 0 || !website) return result;
  let domain = '';
  try { domain = new URL(website).host.toLowerCase(); } catch { /* ignore */ }
  const names = people
    .map((p) => [p.first_name, p.last_name].filter(Boolean).join(' ').trim())
    .filter(Boolean);
  if (names.length === 0) return result;
  try {
    // Search in small batches (5 people per call) for reliability — a single
    // search with 30+ names is too much for the LLM to resolve accurately.
    const BATCH = 5;
    for (let i = 0; i < names.length; i += BATCH) {
      const batch = names.slice(i, i + BATCH);
      try {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `Search the web for the individual biography/profile pages of the following people, who work at the firm whose website is ${domain}.

For EACH person, find the full URL of their individual biography or profile page ON THE FIRM'S OWN WEBSITE (${domain}). Only return URLs that contain "${domain}" — do NOT return LinkedIn, RocketReach, or any third-party URLs. If you cannot find an individual bio page on ${domain} for a person, leave their URL empty.

People:
${batch.map((n, i) => `${i + 1}. ${n}`).join('\n')}

Return a JSON object with a "results" array, where each item has "name" (the person's name) and "bio_url" (the full URL on ${domain}, or empty string if not found).`,
          add_context_from_internet: true,
          response_json_schema: {
            type: 'object',
            properties: {
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    bio_url: { type: 'string' },
                  },
                },
              },
            },
          },
        });
        const results = res?.results || [];
        for (const r of results) {
          const url = (r.bio_url || '').trim();
          const name = (r.name || '').trim().toLowerCase();
          if (url && /^https?:\/\/.+/.test(url) && name) {
            // Only accept URLs on the firm's own domain.
            let urlHost = '';
            try { urlHost = new URL(url).host.toLowerCase(); } catch { /* ignore */ }
            if (!domain || urlHost === domain || urlHost.endsWith('.' + domain)) {
              result.set(name, url);
            }
          }
        }
      } catch {
        // continue to next batch on error
      }
    }
  } catch {
    // ignore — fall back to link-based discovery only
  }
  return result;
}

// For every person whose biography is missing (or only a short snippet on the
// listing page), fetch their individual profile page and extract the FULL
// biography verbatim. Bio page URLs are resolved in priority order: (1) the
// LLM-provided bio_url from the listing page, (2) an internal [LINK: ...]
// marker near the person's name, (3) a web-search fallback for sites that
// don't expose individual bio page links in their HTML. Bounded concurrency +
// capped total to keep the function within time limits.
async function enrichMissingBiographies(
  base44: any,
  people: any[],
  pageContents: { url: string; text: string }[],
  website: string,
): Promise<void> {
  // Only process people who don't already have a REAL biography. The Phase 1
  // extraction sometimes puts a person's name (e.g. "Jerrod Stoller" or
  // "Corey Moore, CFA") in the biography field when the listing page has no
  // bio — these name-only stubs must be treated as "missing" so the real bio
  // is fetched from their individual profile page. Real bios are paragraphs.
  const MAX = 30;
  const CONCURRENCY = 6;
  const isStubBio = (p: any): boolean => {
    const bio = (p.biography || '').trim();
    if (!bio) return true;
    if (bio.length < 60) {
      const first = (p.first_name || '').trim().toLowerCase();
      if (first && bio.toLowerCase().startsWith(first)) return true;
    }
    return false;
  };
  const queue = people.filter(isStubBio).slice(0, MAX);
  if (queue.length === 0) return;

  // One batched web search to discover individual bio page URLs for everyone
  // in the queue (for sites that don't link to them in the listing HTML).
  const searchResults = await discoverBioUrlsViaSearch(base44, queue, website);

  let cursor = 0;
  const worker = async () => {
    while (cursor < queue.length) {
      const i = cursor++;
      const person = queue[i];
      const fullName = [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
      // Resolve a bio URL: (1) LLM-provided, (2) link-marker discovery, (3) web search.
      let bioUrl = person.bio_url || '';
      if (!bioUrl) {
        bioUrl = discoverBioUrl(pageContents, person.first_name, person.last_name);
      }
      if (!bioUrl) {
        bioUrl = searchResults.get(fullName.toLowerCase()) || '';
      }
      if (!bioUrl) continue;
      const bio = await extractBiographyFromPage(base44, fullName, bioUrl);
      // The individual profile page is the authoritative source — always use
      // its full biography when non-empty (it is never a summary).
      if (bio) {
        person.biography = bio;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker()),
  );
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { firm_name, website_url } = body;

    if (!firm_name) return Response.json({ error: 'firm_name is required' }, { status: 400 });

    let website = website_url || '';

    // If no website provided, try web search to find it
    if (!website) {
      try {
        const discovery = await base44.integrations.Core.InvokeLLM({
          prompt: `Search the web for the investment firm "${firm_name}". Find their official website URL. Return only the full URL including https://. If you cannot find it, return an empty string.`,
          add_context_from_internet: true,
          response_json_schema: {
            type: 'object',
            properties: {
              website: { type: 'string' },
            },
          },
        });
        const found = discovery?.website || '';
        if (found && /^https?:\/\/.+/.test(found)) {
          website = found;
        }
      } catch {
        // continue without website
      }
    }

    if (!website) {
      return Response.json({ error: 'Could not find a website for this firm. Please enter the website URL manually.' }, { status: 404 });
    }

    // Normalize the URL
    if (!website.startsWith('http')) {
      website = 'https://' + website;
    }

    // Fetch homepage + common sub-pages
    const pageContents: { url: string; text: string }[] = [];
    const homepageText = await fetchPage(website);
    if (homepageText) {
      pageContents.push({ url: website, text: homepageText.substring(0, 8000) });
    }

    // Fetch sub-pages in parallel
    // Team/people pages often contain many staff across tabbed sections — give them a larger
    // content budget so contacts from every tab are captured rather than truncated.
    const subPagePromises = COMMON_PATHS.map(async (path) => {
      const fullUrl = resolveUrl(website, path);
      if (!fullUrl || fullUrl === website) return null;
      const text = await fetchPage(fullUrl);
      if (text && text.length > 100) {
        const isPeoplePage = /\/(people|our-people|team|our-team|leadership|staff)\b/i.test(path);
        const limit = isPeoplePage ? 18000 : 6000;
        return { url: fullUrl, text: text.substring(0, limit) };
      }
      return null;
    });
    let subPages = (await Promise.all(subPagePromises)).filter(Boolean) as { url: string; text: string }[];

    // Discover team/people pages from internal links on ALL fetched pages.
    // Many sites use non-standard paths (e.g. /about-xponance/people/) that
    // aren't in COMMON_PATHS. Internal links are preserved as [LINK: url]
    // markers, so we scan every fetched page for team/people keywords.
    {
      let baseHost = '';
      try { baseHost = new URL(website).host.toLowerCase(); } catch { /* ignore */ }
      const discovered = new Set<string>();
      const allText = [homepageText, ...subPages.map((p) => p.text)].filter(Boolean);
      for (const text of allText) {
        const linkRegex = /\[LINK:\s*(https?:\/\/[^\]]+)\]/gi;
        let lmatch: RegExpExecArray | null;
        while ((lmatch = linkRegex.exec(text)) !== null) {
          const url = lmatch[1];
          let linkHost = '';
          try { linkHost = new URL(url).host.toLowerCase(); } catch { /* ignore */ }
          if (!linkHost || linkHost !== baseHost) continue;
          if (/\/(people|our-people|team|our-team|leadership|staff|personnel|professionals)\b/i.test(url)) {
            if (url !== website) discovered.add(url);
          }
        }
      }
      // Also try keyword-based path discovery: extract path segments that
      // look like team pages from any internal links (catches /about-xponance/people/
      // even when the full URL doesn't match the keyword regex).
      for (const text of allText) {
        const pathRegex = /\[LINK:\s*https?:\/\/[^^\]]*?\/[^[\]]*?(people|our-people|team|our-team|leadership)\b[^\]]*\]/gi;
        let pmatch: RegExpExecArray | null;
        while ((pmatch = pathRegex.exec(text)) !== null) {
          const url = pmatch[0].replace(/\[LINK:\s*/, '').replace(/\]$/, '').trim();
          if (url !== website) discovered.add(url);
        }
      }
      const existingUrls = new Set([website, ...subPages.map((p) => p.url)]);
      const toFetch = [...discovered].filter((u) => !existingUrls.has(u)).slice(0, 5);
      const teamPages = (await Promise.all(
        toFetch.map(async (teamUrl) => {
          const text = await fetchPage(teamUrl);
          if (text && text.length > 100) return { url: teamUrl, text: text.substring(0, 18000) };
          return null;
        }),
      )).filter(Boolean) as { url: string; text: string }[];
      subPages = subPages.concat(teamPages);
    }

    // Sort so people/team pages come first (most important for contact extraction),
    // keeping homepage at the front.
    subPages.sort((a, b) => {
      const aPeople = /\/(people|our-people|team|our-team|leadership|staff)\b/i.test(a.url) ? 0 : 1;
      const bPeople = /\/(people|our-people|team|our-team|leadership|staff)\b/i.test(b.url) ? 0 : 1;
      return aPeople - bPeople;
    });
    for (const page of subPages) {
      pageContents.push(page);
    }

    const combinedContent = pageContents.map((p) => `[Page: ${p.url}]\n${p.text}`).join('\n\n---\n\n');

    if (!combinedContent || combinedContent.length < 50) {
      return Response.json({ error: `Could not fetch content from ${website}. The site may be blocking automated access.` }, { status: 502 });
    }

    // Now pass the fetched content to the LLM for structured extraction
    const extractionPrompt = `You are extracting information about the investment firm "${firm_name}" from their website content below.

Website content (combined from multiple pages):
---
${combinedContent.substring(0, 40000)}
---

Extract the following information from this website content:
- Official firm name (exact name as it appears on the website)
- Company description (2-3 sentences about what they do, their investment approach, etc.)
- Year the firm was founded
- Website URL
- LinkedIn URL
- General contact email address
- Firm type(s): classify as one or more of "Investment Manager", "Allocator", "Investment Consultant", "Manager of Managers", "Securities Brokerage", "Trade Organizations"
- Firm logo URL (full URL starting with http)
- Office addresses (street address, city, state, postal code, country)
- Phone numbers (for US numbers: country_code, area_code, number_mid, number_last)
- Key personnel: for each person found, include first_name, last_name, title, email, linkedin_url, phone, biography (full text), photo_url (full URL starting with http), and bio_url (the full URL of this person's individual biography/profile page, if linked from a team card).

IMPORTANT:
- Images on the page appear as [IMAGE: alt="..." src="https://..."] markers.
  - The firm logo is typically one of the first images (often in the header/nav section) — look at the alt text and position to identify it. Set logo_url to that image's src URL.
  - For each person, find the [IMAGE: ...] marker that appears closest to that person's name and bio. Set that person's photo_url to the image's src URL.
  - Only use the exact src URL from the [IMAGE: ...] marker — do not modify or construct URLs yourself; the URLs are already absolute.
- Links appear as [LINK: https://...] markers next to their link text.
  - For the firm's linkedin_url, find a LinkedIn link (e.g. linkedin.com/company/...) — usually in the footer or header. Use the exact URL from the [LINK: ...] marker.
  - For each person's linkedin_url, find the [LINK: linkedin.com/in/...] marker that appears closest to that person's name. Set that person's linkedin_url to the exact URL from that marker.
  - For each person's bio_url, find the internal [LINK: ...] marker whose link text wraps that person's name or card (e.g. a link to /people/<name-slug>/). Set bio_url to the exact URL from that marker. Leave empty if their name is not itself a link and no individual profile page link exists.
  - Only use the exact URL from the [LINK: ...] marker — do not modify or construct URLs yourself.
- Only include information you actually find in the content above
- Do not fabricate or guess
- Leave fields empty/null if not found
- For biography, copy the complete text — do not summarize. If the biography is NOT present on this listing page (only name/title are shown), leave biography empty but still set bio_url to that person's individual profile page link`;

    const enrichedData = await base44.integrations.Core.InvokeLLM({
      prompt: extractionPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          website: { type: 'string' },
          email: { type: 'string' },
          linkedin_url: { type: 'string' },
          year_founded: { type: 'integer' },
          firm_types: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['Investment Manager', 'Allocator', 'Investment Consultant', 'Manager of Managers', 'Securities Brokerage', 'Trade Organizations'],
            },
          },
          logo_url: { type: 'string' },
          addresses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                is_headquarters: { type: 'boolean' },
                country: { type: 'string' },
                state: { type: 'string' },
                city: { type: 'string' },
                postal_code: { type: 'string' },
                address_line1: { type: 'string' },
                address_line2: { type: 'string' },
              },
            },
          },
          phones: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                phone_type: { type: 'string' },
                country_code: { type: 'string' },
                area_code: { type: 'string' },
                number_mid: { type: 'string' },
                number_last: { type: 'string' },
              },
            },
          },
          people: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                first_name: { type: 'string' },
                last_name: { type: 'string' },
                title: { type: 'string' },
                email: { type: 'string' },
                linkedin_url: { type: 'string' },
                biography: { type: 'string' },
                phone: { type: 'string' },
                photo_url: { type: 'string' },
                bio_url: { type: 'string' },
              },
            },
          },
        },
      },
    });

    if (!enrichedData.name) enrichedData.name = firm_name;

    // Clean up string "null" values that the LLM sometimes returns for missing fields
    const cleanStr = (v: any): any => (v === 'null' || v === 'undefined' ? '' : v);
    enrichedData.logo_url = cleanStr(enrichedData.logo_url) || '';
    enrichedData.email = cleanStr(enrichedData.email) || '';
    enrichedData.linkedin_url = cleanStr(enrichedData.linkedin_url) || '';
    enrichedData.website = cleanStr(enrichedData.website) || '';
    enrichedData.description = cleanStr(enrichedData.description) || '';
    for (const person of enrichedData.people || []) {
      person.photo_url = cleanStr(person.photo_url) || '';
      person.email = cleanStr(person.email) || '';
      person.linkedin_url = cleanStr(person.linkedin_url) || '';
      person.biography = cleanStr(person.biography) || '';
      person.bio_url = cleanStr(person.bio_url) || '';
    }

    // Phase 2: gather individual biographies that weren't on the listing page.
    // Many firm "people" pages only show name + title on cards; the full bio lives
    // on a separate profile page linked from each card. For any person missing a
    // biography but with a bio_url, fetch that page and extract the biography.
    await enrichMissingBiographies(base44, enrichedData.people || [], pageContents, website);

    // Rehost images
    try {
      const imageUrls: string[] = [];
      if (enrichedData.logo_url) imageUrls.push(enrichedData.logo_url);
      for (const person of enrichedData.people || []) {
        if (person.photo_url) imageUrls.push(person.photo_url);
      }

      if (imageUrls.length > 0) {
        const rehostResponse = await base44.functions.invoke('rehostImages', {
          image_urls: imageUrls,
          website: website,
        });
        const results = rehostResponse?.data?.results || [];
        for (const r of results) {
          if (r.rehosted) {
            if (enrichedData.logo_url === r.original) enrichedData.logo_url = r.rehosted;
            for (const person of enrichedData.people || []) {
              if (person.photo_url === r.original) person.photo_url = r.rehosted;
            }
          }
        }
      }
    } catch {
      // keep original URLs if rehosting fails
    }

    // bio_url is an internal helper for biography gathering — strip it before
    // returning so it doesn't leak into the stored contact record.
    for (const person of enrichedData.people || []) {
      delete person.bio_url;
    }

    return Response.json(enrichedData);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});