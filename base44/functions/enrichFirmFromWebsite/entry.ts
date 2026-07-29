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
  '/about/team',
  '/about/people',
  '/about/leadership',
  '/about/staff',
  '/team',
  '/our-team',
  '/people',
  '/our-people',
  '/leadership',
  '/team-members',
  '/staff',
  '/contact',
  '/about-us',
  '/about-us/our-team',
  '/about-us/team',
  '/about-us/people',
  '/about-us/our-people',
  '/about-us/leadership',
  '/about-us/staff',
  '/company',
  '/philosophy',
  '/approach',
];

// Common cookie consent cookies that signal "user accepted all cookies".
// Many cookie consent platforms (OneTrust, Cookiebot, Quantcast, TrustArc, etc.)
// check for these on the server side and return full content when present.
// These are sent on EVERY request as a baseline; platform-specific cookies
// discovered via detectConsentCookies() are appended per-site.
const CONSENT_COOKIES = [
  // Cookiebot
  'CookieConsent={stamp%3D%27-consented%27%2Cnecessary%3Atrue%2Cpreferences%3Atrue%2Cstatistics%3Atrue%2Cmarketing%3Atrue%2Cmethod%3A%27explicit%27%2Cver%3A1}',
  // OneTrust / Optanon
  'OptanonConsent=isIABGlobal=false&datestamp=Mon+Jan+01+2024+00%3A00%3A00+GMT-0000&version=6.30.0&consentId=consent&interactionCount=1&landingPath=NotLandingPage&groups=C0001%3A1%2CC0002%3A1%2CC0003%3A1%2CC0004%3A1%2CC0005%3A1&AwaitingReconsent=false',
  'OptanonAlertBoxClosed=2024-01-01T00:00:00.000Z',
  // IAB TCF v2 (Sourcepoint, Didomi, Usercentrics, etc.) — a minimal valid-looking TC string
  'euconsent-v2=CPdE5gAPdE5gAAAKBENCsAAAAAH_AAAAAAAYW4wAQAAAAgAAAA',
  'eupubconsent-v2=CPdE5gAPdE5gAAAKBENCsAAAAAH_AAAAAAAYW4wAQAAAAgAAAA',
  // Quantcast Choice
  'qcSxc=1',
  'addtl_consent=1~',
  // TrustArc
  'notice_preferences=2:',
  'cmapi_cookie_privacy=permit%201,2,3,4',
  // Didomi
  'didomi_token=eyJ1c2VyX2lkIjoiY29uc2VudCJ9',
  'didomi_test_token=1',
  // Usercentrics
  'uc_settings=1',
  'uc_state=consented',
  // Iubenda
  'cookieconsent=true',
  'consent_cookie=true',
  // Borlabs Cookie (WordPress)
  '_borlabs-cookie-1=1',
  '_borlabs-cookie-3=1',
  // Generic / custom banners
  'cookieconsent_status=allow',
  'cookies_accepted=true',
  'accept_cookies=true',
  'gdpr-consent=1',
  'hasConsented=true',
  'privacy_consent=1',
  'viewed_cookie_policy=true',
  'cookie_consent=1',
  'cookiesConsent=1',
  'consent=yes',
].join('; ');

// Per-invocation platform-specific consent cookies, detected from the
// homepage's raw HTML. Appended to the baseline CONSENT_COOKIES on every fetch.
let dynamicConsentCookies = '';

// A complete set of browser-like request headers. Some sites (WAFs / anti-bot
// plugins) 403 requests that look like a bare scraper — sending the Sec-Fetch-*
// and sec-ch-ua headers a real browser emits is enough to pass them.
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
    'DNT': '0',
    'Cookie': cookieHeader,
  };
}

/**
 * Detects which cookie-consent platform a site uses from its raw HTML and
 * returns the platform-specific "accept all" cookies. Many platforms gate
 * content (or hide it behind a banner) server-side until these are present.
 */
function detectConsentCookies(rawHtml: string): string {
  if (!rawHtml) return '';
  const lower = rawHtml.toLowerCase();
  const cookies: string[] = [];
  // OneTrust / Cookiebot SDK
  if (lower.includes('cookielaw.org') || lower.includes('onetrust') || lower.includes('optanon')) {
    cookies.push('OptanonAlertBoxClosed=' + new Date('2024-01-01T00:00:00.000Z').toUTCString());
    cookies.push('OptanonConsent=isIABGlobal=false&datestamp=Mon+Jan+01+2024+00%3A00%3A00+GMT-0000&version=6.30.0&consentId=consent&interactionCount=1&landingPath=NotLandingPage&groups=C0001%3A1%2CC0002%3A1%2CC0003%3A1%2CC0004%3A1%2CC0005%3A1&AwaitingReconsent=false');
  }
  // Cookiebot
  if (lower.includes('cookiebot')) {
    cookies.push('CookieConsent={stamp%3D%27-consented%27%2Cnecessary%3Atrue%2Cpreferences%3Atrue%2Cstatistics%3Atrue%2Cmarketing%3Atrue%2Cmethod%3A%27explicit%27%2Cver%3A1}');
  }
  // Quantcast Choice
  if (lower.includes('quantcast') || lower.includes('qcsxc')) {
    cookies.push('qcSxc=1');
    cookies.push('addtl_consent=1~');
  }
  // TrustArc / TRUSTe
  if (lower.includes('trustarc') || lower.includes('truste.com')) {
    cookies.push('notice_preferences=2:');
    cookies.push('cmapi_cookie_privacy=permit%201,2,3,4');
  }
  // Didomi
  if (lower.includes('didomi')) {
    cookies.push('euconsent-v2=CPdE5gAPdE5gAAAKBENCsAAAAAH_AAAAAAAYW4wAQAAAAgAAAA');
  }
  // Usercentrics
  if (lower.includes('usercentrics')) {
    cookies.push('uc_settings=1');
    cookies.push('uc_state=consented');
  }
  // Sourcepoint / IAB TCF
  if (lower.includes('sourcepoint') || lower.includes('consensu.org') || lower.includes('privacy-mgmt.com')) {
    cookies.push('euconsent-v2=CPdE5gAPdE5gAAAKBENCsAAAAAH_AAAAAAAYW4wAQAAAAgAAAA');
    cookies.push('eupubconsent-v2=CPdE5gAPdE5gAAAKBENCsAAAAAH_AAAAAAAYW4wAQAAAAgAAAA');
  }
  // Iubenda
  if (lower.includes('iubenda')) {
    cookies.push('cookieconsent=true');
    cookies.push('consent_cookie=true');
  }
  // Borlabs Cookie (WordPress)
  if (lower.includes('borlabs-cookie') || lower.includes('borlabs')) {
    cookies.push('_borlabs-cookie-1=1');
    cookies.push('_borlabs-cookie-3=1');
  }
  return cookies.join('; ');
}

/** Fetches raw HTML (no conversion) — used to detect the consent platform. */
async function fetchRawHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      headers: browserHeaders(CONSENT_COOKIES),
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) {
      try { await response.body?.cancel(); } catch { /* ignore */ }
      return '';
    }
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text') && !contentType.includes('html')) {
      try { await response.body?.cancel(); } catch { /* ignore */ }
      return '';
    }
    return await response.text();
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPage(url: string, maxRedirects = 3): Promise<string> {
  const cookieHeader = dynamicConsentCookies
    ? CONSENT_COOKIES + '; ' + dynamicConsentCookies
    : CONSENT_COOKIES;
  const doFetch = async (): Promise<string> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {
        headers: browserHeaders(cookieHeader),
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!response.ok) {
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
    } finally {
      clearTimeout(timeout);
    }
  };
  // Single retry on failure — handles intermittent timeouts and rate-limiting.
  let result = await doFetch();
  if (!result || result.length < 100) {
    await new Promise((r) => setTimeout(r, 500));
    result = await doFetch();
  }
  return result;
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
  // Step 0: Extract person data from embedded JSON in <script> tags BEFORE
  // scripts are stripped. Many WordPress sites render team grids via JS with
  // person data embedded as a JSON data object in a <script> tag. Without this,
  // the entire team member dataset is lost when scripts are stripped below.
  const embeddedPersonData = extractPersonDataFromScripts(html);

  // Step 1: Convert all <img> tags into text markers with resolved absolute URLs
  // so the LLM can see and extract photo/logo URLs (images are normally stripped)
  let result = html.replace(/<img[^>]*>/gi, (match) => {
    const src = extractImgUrl(match, baseUrl);
    const altMatch = match.match(/\salt\s*=\s*["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : '';
    if (!src) return '';
    return `\n[IMAGE: alt="${alt}" src="${src}"]\n`;
  });

  // Step 2: For nav/header sections, extract internal links (team/people page
  // URLs often live only in the nav menu) and keep [IMAGE: ...] markers (logos
  // are commonly in the header). Other nav/header text is navigation noise.
  // IMPORTANT: <footer> is NOT stripped here — footers almost always hold the
  // firm's contact block (address, phone, email), so that text must reach the
  // LLM. Stripping it was why addresses/phones were silently dropped.
  result = result.replace(/<(nav|header)[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _tag, inner) => {
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

  // Prepend person data extracted from embedded JSON in <script> tags so they
  // are not truncated by the page text limit (80,000 chars for people pages).
  // If appended at the end, markers for people later in the list are cut off
  // when the text is truncated, resulting in missing contacts and photos.
  if (embeddedPersonData) {
    result = embeddedPersonData + result;
  }

  return result;
}

function resolveUrl(base: string, path: string): string {
  try {
    return new URL(path, base).href;
  } catch {
    return '';
  }
}

// Extract person data from embedded JSON in <script> tags. Many WordPress
// sites render team grids via JavaScript, with the person data embedded as a
// JSON data object inside a <script> tag (often a page-builder data object).
// Without this, the htmlToText() function strips all <script> tags and the
// person data is completely lost — only a few people (found on other pages)
// are extracted instead of the full team.
function extractPersonDataFromScripts(html: string): string {
  const markers: string[] = [];
  const seen = new Set<string>();

  // Find all <script> tag contents
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    const content = scriptMatch[1];
    if (!content.includes('/person/') || !content.includes('"permalink"')) continue;

    // Find all person permalink URLs and extract surrounding data fields.
    // Each person object typically has: permalink, title, roles[], image{imgSrc}
    const permalinkRegex = /"permalink"\s*:\s*"(https?:\/\/[^"]*\/person\/[^"]+)"/gi;
    let pMatch: RegExpExecArray | null;
    while ((pMatch = permalinkRegex.exec(content)) !== null) {
      const permalink = pMatch[1];
      if (seen.has(permalink)) continue;
      seen.add(permalink);

      // Look for title, roles, and imgSrc within a window AFTER the permalink.
      // IMPORTANT: start at pMatch.index (NOT pMatch.index - 500) so the regex
      // doesn't match the PREVIOUS person's title/roles/imgSrc that appears
      // before the current permalink in the JSON.
      const windowStart = pMatch.index;
      const windowEnd = Math.min(content.length, pMatch.index + 2000);
      const window = content.substring(windowStart, windowEnd);

      // Extract title (person name)
      const titleMatch = window.match(/"title"\s*:\s*"([^"]+)"/);
      const name = titleMatch ? titleMatch[1] : '';
      if (!name) continue;

      // Extract roles
      const rolesMatch = window.match(/"roles"\s*:\s*\[([\s\S]*?)\]/);
      let roles = '';
      if (rolesMatch) {
        roles = rolesMatch[1]
          .split(',')
          .map((r) => r.replace(/"/g, '').trim())
          .filter(Boolean)
          .join('; ');
      }

      // Extract image URL
      const imgMatch = window.match(/"imgSrc"\s*:\s*"([^"]+)"/);
      const photoUrl = imgMatch ? imgMatch[1] : '';

      let marker = `[PERSON: name="${name}"`;
      if (roles) marker += ` title="${roles}"`;
      if (photoUrl) marker += ` photo_url="${photoUrl}"`;
      marker += ` bio_url="${permalink}"]`;
      markers.push(marker);
    }
  }

  return markers.length > 0
    ? '\n--- Embedded Team Data ---\n' + markers.join('\n') + '\n--- End Team Data ---\n'
    : '';
}

// Fetch an individual biography/profile page and extract the person's full
// biography text via a focused LLM pass. Returns '' if nothing is found.
async function extractBiographyFromPage(
  base44: any,
  personName: string,
  bioUrl: string,
  pageText?: string,
): Promise<string> {
  if (!pageText) {
    pageText = await fetchPage(bioUrl);
  }
  if (!pageText || pageText.length < 50) return '';
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are extracting the biography of a specific person from their individual profile page.

Person name: "${personName}"

Below is the text content of their profile/biography page. Locate the section describing THIS person (often near their name, under a heading like "Biography", "About", "Profile", or "Overview"). Extract the COMPLETE biography text for this person. You MUST copy the biography VERBATIM — do not summarize, do not paraphrase, do not abbreviate, and do not omit any sentences or paragraphs. Include EVERY paragraph of the biography in full. If the page lists multiple people, extract only the biography belonging to "${personName}". If no biography text is found for this person, return an empty string.

Then, from that biography, extract the person's education and prior professional experience.

EDUCATION: every school, college, or university mentioned, with:
- institution: the school/university name (e.g. "University of Pennsylvania")
- degree: the degree earned, if stated (e.g. "BS", "BA", "MBA", "PhD")
- area_of_specialization: the field/major area, if stated (e.g. "Economics", "Finance")
- majors: array of major subjects, if stated
- graduation_year: the graduation year as a string, if stated (e.g. "1998")
Only include institutions the person actually attended as a student. Do NOT include firms where they worked.

PROFESSIONAL EXPERIENCE: every employer/company mentioned in the biography, INCLUDING their current firm (the one whose site this is), with:
- company_name: the company/firm name (e.g. the current firm name, and prior employers like "Wayne Management")
- title: the role/title held there (e.g. "Director of Research")
- start_year: start year as a string, if stated
- end_year: end year as a string, if stated (LEAVE EMPTY if this is the person's current employer / they are still there)
Include each distinct company as a separate entry. Order entries from most recent to oldest.

Return an object with "biography" (the verbatim text), "education" (array), and "professional_experience" (array). If a section has no data, return an empty array.

--- PAGE CONTENT ---
${pageText.substring(0, 20000)}
--- END PAGE CONTENT ---`,
      response_json_schema: {
        type: 'object',
        properties: {
          biography: { type: 'string' },
          education: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                institution: { type: 'string' },
                degree: { type: 'string' },
                area_of_specialization: { type: 'string' },
                majors: { type: 'array', items: { type: 'string' } },
                graduation_year: { type: 'string' },
              },
            },
          },
          professional_experience: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                company_name: { type: 'string' },
                title: { type: 'string' },
                start_year: { type: 'string' },
                end_year: { type: 'string' },
              },
            },
          },
        },
      },
    });
    return {
      biography: (res?.biography || '').trim(),
      education: Array.isArray(res?.education) ? res.education : [],
      professional_experience: Array.isArray(res?.professional_experience) ? res.professional_experience : [],
    };
  } catch {
    return { biography: '', education: [], professional_experience: [] };
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

// Construct candidate individual-bio-page URLs from the team/people page
// base URL + the person's name slug (e.g. /about-xponance/people/cesar-gonzales/).
// Many sites (Divi, WordPress) use this predictable pattern. Probe each
// candidate with a lightweight HEAD-like fetch; if the page exists and has
// substantial content, return it. This avoids slow web search entirely for
// sites that use standard slug patterns.
const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v', 'esq', 'cfa', 'cpa', 'mba', 'phd', 'md', 'cmfc', 'apfi', 'cipm', 'aicp', 'chfc', 'clu', 'cfp', 'frm']);

function slugifyName(name: string): string {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[.'’]/g, '')
    .split(/\s+/)
    .filter((t) => t && !NAME_SUFFIXES.has(t))
    .join(' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function discoverBioUrlByPattern(
  pageContents: { url: string; text: string }[],
  firstName: string,
  lastName: string,
  middleName?: string,
): Promise<{ url: string; text: string }> {
  if (!firstName || !lastName) return { url: '', text: '' };
  // Find the team/people page base URL from fetched pages.
  const baseCandidates: string[] = [];
  for (const page of pageContents) {
    if (/\/(people|our-people|team|our-team|leadership|staff)\b/i.test(page.url)) {
      let base = page.url;
      if (!base.endsWith('/')) base = base + '/';
      const kwMatch = base.match(/(.*?\/(?:people|our-people|team|our-team|leadership|staff|personnel|professionals)\/)/i);
      if (kwMatch) {
        baseCandidates.push(kwMatch[1]);
      } else {
        baseCandidates.push(base);
      }
    }
  }
  if (baseCandidates.length === 0) return { url: '', text: '' };

  const first = slugifyName(firstName);
  const last = slugifyName(lastName);
  const middle = slugifyName(middleName || '');
  // Candidate slug patterns (most common first). Keep it to 2 to minimize fetches.
  const slugPatterns = [
    `${first}-${last}`,
    `${first}-${middle}-${last}`,
  ].filter((s) => s.replace(/-+/g, '-').length > 2 && !s.includes('--'));

  const tried = new Set<string>();
  for (const base of baseCandidates) {
    for (const slug of slugPatterns) {
      const url = base + slug + '/';
      if (tried.has(url)) continue;
      tried.add(url);
      const text = await fetchPage(url);
      if (text && text.length > 200) {
        const lower = text.toLowerCase();
        if (lower.includes(last) && (lower.includes(first) || lower.includes(firstName.toLowerCase().substring(0, 3)))) {
          return { url, text };
        }
      }
    }
  }
  return { url: '', text: '' };
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
  const CONCURRENCY = 10;
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

  // Phase A: pattern probe + link discovery for all missing-bio people.
  // This resolves bio URLs and fetches page text in one step; the text is
  // reused for LLM extraction so we avoid a second fetch per person.
  let cursor = 0;
  const resolved: Map<number, { url: string; text: string }> = new Map();
  const unresolvedIdx: number[] = [];

  const phaseAWorker = async () => {
    while (cursor < queue.length) {
      const i = cursor++;
      const person = queue[i];
      // (1) LLM-provided bio_url from the listing page.
      if (person.bio_url) {
        resolved.set(i, { url: person.bio_url, text: '' });
        continue;
      }
      // (2) Internal [LINK: ...] marker near the person's name.
      const linkUrl = discoverBioUrl(pageContents, person.first_name, person.last_name);
      if (linkUrl) {
        resolved.set(i, { url: linkUrl, text: '' });
        continue;
      }
      // (3) URL pattern probe (slug-based) — returns fetched text too.
      const probed = await discoverBioUrlByPattern(pageContents, person.first_name, person.last_name, person.middle_name);
      if (probed.url) {
        resolved.set(i, probed);
        continue;
      }
      unresolvedIdx.push(i);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length), }, () => phaseAWorker()),
  );

  // Phase B: batched web search ONLY for people the pattern probe couldn't
  // resolve (keeps the expensive LLM web-search calls to a minimum).
  let searchResults = new Map<string, string>();
  if (unresolvedIdx.length > 0) {
    const unresolvedPeople = unresolvedIdx.map((i) => queue[i]);
    searchResults = await discoverBioUrlsViaSearch(base44, unresolvedPeople, website);
  }

  // Phase C: extract biographies. People resolved in Phase A reuse their
  // already-fetched text; people resolved in Phase B fetch their bio page now.
  let cCursor = 0;
  const phaseCWorker = async () => {
    while (cCursor < queue.length) {
      const i = cCursor++;
      const person = queue[i];
      const fullName = [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
      const cached = resolved.get(i);
      let bioUrl = '';
      let pageText: string | undefined;
      if (cached) {
        bioUrl = cached.url;
        pageText = cached.text || undefined;
      } else {
        bioUrl = searchResults.get(fullName.toLowerCase()) || '';
      }
      if (!bioUrl) continue;
      const result = await extractBiographyFromPage(base44, fullName, bioUrl, pageText);
      if (result.biography) {
        person.biography = result.biography;
      }
      if (result.education?.length) person.education = result.education;
      if (result.professional_experience?.length) person.professional_experience = result.professional_experience;
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length), }, () => phaseCWorker()),
  );
}

// Extract education + professional experience from a biography paragraph using
// a focused LLM pass. Used for people whose biography was already present on
// the team listing page (so they didn't go through extractBiographyFromPage).
async function extractEducationExperienceFromBio(
  base44: any,
  personName: string,
  biography: string,
): Promise<{ education: any[]; professional_experience: any[] }> {
  if (!biography || biography.trim().length < 60) return { education: [], professional_experience: [] };
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are extracting structured education and professional-experience data from the biography of a person named "${personName}".

Biography:
"""
${biography.substring(0, 8000)}
"""

Extract:

EDUCATION: every school, college, or university the person attended as a student, with:
- institution: the school/university name (e.g. "University of Pennsylvania")
- degree: the degree earned, if stated (e.g. "BS", "BA", "MBA", "PhD")
- area_of_specialization: the field/major area, if stated (e.g. "Economics", "Finance")
- majors: array of major subjects, if stated
- graduation_year: graduation year as a string, if stated

PROFESSIONAL EXPERIENCE: every prior employer/company mentioned (other than the firm whose biography this is), with:
- company_name: the company/firm name (e.g. "Wayne Management")
- title: the role/title held there (e.g. "Director of Research")
- start_year: start year as a string, if stated
- end_year: end year as a string, if stated (empty if unknown)

Only include what is actually stated in the biography. Do not fabricate. Return an object with "education" and "professional_experience" arrays (empty arrays if none found).`,
      response_json_schema: {
        type: 'object',
        properties: {
          education: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                institution: { type: 'string' },
                degree: { type: 'string' },
                area_of_specialization: { type: 'string' },
                majors: { type: 'array', items: { type: 'string' } },
                graduation_year: { type: 'string' },
              },
            },
          },
          professional_experience: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                company_name: { type: 'string' },
                title: { type: 'string' },
                start_year: { type: 'string' },
                end_year: { type: 'string' },
              },
            },
          },
        },
      },
    });
    return {
      education: Array.isArray(res?.education) ? res.education : [],
      professional_experience: Array.isArray(res?.professional_experience) ? res.professional_experience : [],
    };
  } catch {
    return { education: [], professional_experience: [] };
  }
}

// For people whose biography was already present on the listing page (so they
// were not in the stub-bio queue), extract education + professional experience
// from their existing biography. Bounded concurrency + cap to stay in limits.
async function enrichEducationExperienceFromBios(base44: any, people: any[]): Promise<void> {
  const MAX = 30;
  const CONCURRENCY = 10;
  const isStubBio = (p: any): boolean => {
    const bio = (p.biography || '').trim();
    if (!bio) return true;
    if (bio.length < 60) {
      const first = (p.first_name || '').trim().toLowerCase();
      if (first && bio.toLowerCase().startsWith(first)) return true;
    }
    return false;
  };
  const queue = people.filter((p) => !isStubBio(p) && p.education === undefined && p.professional_experience === undefined).slice(0, MAX);
  if (queue.length === 0) return;
  let cursor = 0;
  const worker = async () => {
    while (cursor < queue.length) {
      const i = cursor++;
      const person = queue[i];
      const fullName = [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
      const { education, professional_experience } = await extractEducationExperienceFromBio(base44, fullName, person.biography || '');
      person.education = education;
      person.professional_experience = professional_experience;
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker()),
  );
}

// Fallback for captcha / anti-bot-blocked sites: gather the firm's public
// information via the LLM's web-search capability (which fetches through
// Google's index, whose crawler IPs are typically not challenged) instead of
// scraping the blocked site directly. Returns the same structure as the normal
// HTML-scraping extraction, or null on failure.
//
// IMPORTANT: InvokeLLM with response_json_schema + add_context_from_internet
// simultaneously returns inconsistent/empty results. So we use a two-step
// approach: (1) web search to gather raw text about the firm, (2) structured
// extraction from the raw text WITHOUT web search.
async function enrichFirmViaWebSearch(
  base44: any,
  firmName: string,
  website: string,
): Promise<any> {
  try {
    // Step 1: Use web search to gather raw information about the firm
    const rawContent = await base44.integrations.Core.InvokeLLM({
      prompt: `Search the web for the investment firm "${firmName}" (official website: ${website}).
Find their team/leadership page and list ALL team members visible on that page. Also find their firm's description, LinkedIn URL, year founded, address, and phone.

For EACH team member, include:
- Their full name
- Their title/role (e.g. CEO, COO, Director of Partnerships)
- Their LinkedIn profile URL if visible on the page
- The FULL URL of their profile photo — this typically looks like ${website}/wp-content/uploads/... Search the page source for image URLs on the ${website} domain.
- Their biography if available

Also include:
- The firm's logo URL
- A 2-3 sentence description of the firm
- Year founded
- LinkedIn company page URL
- Contact email and phone
- Office address

Return ALL information you find. Be very thorough about photos — every team member card on a Divi/WordPress site has a photo, and the URL is in the page HTML.`,
      model: 'gemini_3_1_pro',
      add_context_from_internet: true,
    });

    const rawText = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent || '');
    console.log('enrichFirmViaWebSearch: raw content length =', rawText?.length || 0);
    if (!rawText || rawText.length < 50) {
      console.log('enrichFirmViaWebSearch: empty raw content from web search');
      return null;
    }
    console.log('enrichFirmViaWebSearch: raw content preview =', rawText.substring(0, 300));

    // Step 2: Structured extraction from the raw text (no web search)
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Extract structured information about the investment firm "${firmName}" from the web research below.

Web research:
---
${rawText.substring(0, 50000)}
---

Extract and return as JSON:
- name: official firm name
- description: 2-3 sentence description
- website: website URL
- email: general contact email
- linkedin_url: LinkedIn company page URL
- year_founded: integer year founded (0 if unknown)
- firm_types: array of firm types ("Investment Manager", "Allocator", "Investment Consultant", "Manager of Managers", "Securities Brokerage", "Trade Organizations")
- logo_url: firm logo URL (full URL starting with http)
- addresses: array of {is_headquarters, country, state, city, postal_code, address_line1, address_line2}
- phones: array of {phone_type, country_code, area_code, number_mid, number_last}
- people: array of {first_name, last_name, title, email, linkedin_url, photo_url, biography} for EVERY person mentioned

CRITICAL: Include the photo_url for each person if mentioned in the research. Photo URLs contain /wp-content/uploads/ or similar paths.`,
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
                photo_url: { type: 'string' },
              },
            },
          },
        },
      },
    });
    return res;
  } catch (err) {
    console.log('enrichFirmViaWebSearch error:', err?.message || err);
    return null;
  }
}

// Rehost the firm's logo + people photos so images are served from app storage.
// Shared by both the direct-scrape and web-search fallback paths.
async function rehostFirmImages(base44: any, data: any, website: string): Promise<void> {
  try {
    const imageUrls: string[] = [];
    if (data.logo_url) imageUrls.push(data.logo_url);
    for (const person of data.people || []) {
      if (person.photo_url) imageUrls.push(person.photo_url);
    }
    if (imageUrls.length === 0) return;
    const rehostResponse = await base44.functions.invoke('rehostImages', {
      image_urls: imageUrls,
      website: website,
    });
    const results = rehostResponse?.data?.results || [];
    for (const r of results) {
      if (r.rehosted) {
        if (data.logo_url === r.original) data.logo_url = r.rehosted;
        for (const person of data.people || []) {
          if (person.photo_url === r.original) person.photo_url = r.rehosted;
        }
      }
    }
  } catch {
    // keep original URLs if rehosting fails
  }
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
    // Fetch the homepage raw HTML first so we can detect which cookie-consent
    // platform the site uses and send the right "accept all" cookies on all
    // subsequent requests (including a re-fetch of the homepage below).
    const homepageRaw = await fetchRawHtml(website);
    dynamicConsentCookies = detectConsentCookies(homepageRaw);
    const homepageText = homepageRaw ? htmlToText(homepageRaw, website) : '';
    if (homepageText) {
      // Give the homepage a generous budget so the footer (which holds the
      // address/phone/contact block) isn't truncated away before the LLM sees it.
      pageContents.push({ url: website, text: homepageText.substring(0, 20000) });
    }

    // Fetch sub-pages in parallel
    // Team/people pages often contain many staff across tabbed sections — give them a larger
    // content budget so contacts from every tab are captured rather than truncated.
    const subPagePromises = COMMON_PATHS.map(async (path) => {
      const fullUrl = resolveUrl(website, path);
      if (!fullUrl || fullUrl === website) return null;
      const text = await fetchPage(fullUrl);
      if (text && text.length > 100) {
        const isPeoplePage = /\/(people|our-people|team|our-team|leadership|staff|about-us)\b/i.test(path);
        const limit = isPeoplePage ? 80000 : 12000;
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
          if (text && text.length > 100) return { url: teamUrl, text: text.substring(0, 80000) };
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

    // Detect a captcha / anti-bot challenge redirect (e.g. SiteGuard sgcaptcha,
    // Cloudflare "Robot Challenge"), which serves a tiny meta-refresh stub
    // instead of real content. This is an IP-reputation block that no
    // cookie/header change can bypass.
    // IMPORTANT: only fall back to web search if the sub-pages ALSO returned
    // captcha stubs or no content. Some sites block the homepage fetch but
    // still allow direct sub-page access — in that case we have enough
    // content from the sub-pages to proceed with normal extraction.
    const isHomepageCaptcha = !!homepageRaw &&
      /\/\.well-known\/sgcaptcha|sgcaptcha|robot challenge|checking the site connection/i.test(homepageRaw) &&
      homepageRaw.length < 1000;
    const subPageContentLength = subPages.reduce((sum, p) => sum + (p?.text?.length || 0), 0);
    const isCaptchaBlocked = isHomepageCaptcha && subPageContentLength < 500;
    if (isCaptchaBlocked) {
      const fallback = await enrichFirmViaWebSearch(base44, firm_name, website);
      if (fallback && (fallback.name || (Array.isArray(fallback.people) && fallback.people.length > 0))) {
        if (!fallback.name) fallback.name = firm_name;
        const cleanStr = (v: any): any => (v === 'null' || v === 'undefined' ? '' : v);
        fallback.logo_url = cleanStr(fallback.logo_url) || '';
        fallback.email = cleanStr(fallback.email) || '';
        fallback.linkedin_url = cleanStr(fallback.linkedin_url) || '';
        fallback.website = cleanStr(fallback.website) || '';
        fallback.description = cleanStr(fallback.description) || '';
        for (const person of fallback.people || []) {
          person.photo_url = cleanStr(person.photo_url) || '';
          person.email = cleanStr(person.email) || '';
          person.linkedin_url = cleanStr(person.linkedin_url) || '';
          person.biography = cleanStr(person.biography) || '';
          delete person.bio_url;
        }
        // Extract education + professional experience from any bios the web
        // search returned. (Skip individual-bio-page fetching here — those
        // pages are also captcha-blocked for direct scraping.)
        await enrichEducationExperienceFromBios(base44, fallback.people || []);
        await rehostFirmImages(base44, fallback, website);
        return Response.json(fallback);
      }
      return Response.json({ error: `${website} is protected by an anti-bot captcha that blocks automated access, so its content can't be auto-filled. Please enter the firm's details manually.` }, { status: 502 });
    }

    if (!combinedContent || combinedContent.length < 50) {
      return Response.json({ error: `Could not fetch content from ${website}. The site may be blocking automated access.` }, { status: 502 });
    }

    // Now pass the fetched content to the LLM for structured extraction
    const extractionPrompt = `You are extracting information about the investment firm "${firm_name}" from their website content below.

Website content (combined from multiple pages):
---
${combinedContent.substring(0, 150000)}
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

CRITICAL — EXTRACT EVERY PERSON:
- You MUST extract EVERY single person listed on the people/team page. Do NOT stop after the first few.
- The people page is organized in sections (Executive, Investment Team, Portfolio Operations, Corporate, Sales & Client Service, etc.). Go through EVERY section and extract EVERY person in EVERY section.
- Some pages use tabbed or filtered layouts (e.g. "All Teams", "Our Leaders", "Domestic Equities Experts", "Emerging Markets Equities Experts", "Global Equities Experts", "Marketing and Client Service", "Administration and Trading"). ALL of these tabs/sections are included in the content below — you must process EVERY one of them, not just the first.
- If a person appears in multiple sections, extract them once with their most detailed title.
- CRITICAL: Section/tab labels like "Our Leaders", "Domestic Equities Experts", "Emerging Markets Equities Experts", "Global Equities Experts", "Marketing and Client Service", "Administration and Trading", "Company Board of Directors", "Mutual Fund Board of Trustees", "All Teams" are TAB HEADERS, NOT people. Do NOT include them as people entries. Only extract entries that have a real person's first and last name.
- Each person card typically has a photo (shown as [IMAGE: ...]), a name (usually in a heading like "#### Name"), and a title/role below it.
- IMPORTANT: Some sites embed team data as JSON inside <script> tags. This data has been extracted and appears as [PERSON: name="..." title="..." photo_url="..." bio_url="..."] markers in the "Embedded Team Data" section. You MUST extract EVERY [PERSON: ...] marker as a person entry. Each marker provides the person's name, title, photo_url, and bio_url (their individual profile page). Use these fields directly — do NOT skip any [PERSON: ...] marker.
- Do NOT skip anyone. If you see 40+ people on the page, return all 40+ in the people array.
- The people array should contain EVERY person whose name appears on the team/people page.

IMPORTANT:
- Images on the page appear as [IMAGE: alt="..." src="https://..."] markers.
  - The firm logo is typically one of the first images (often in the header/nav section) — look at the alt text and position to identify it. Set logo_url to that image's src URL.
  - For each person, find the [IMAGE: ...] marker that appears closest to that person's name and bio. Set that person's photo_url to the image's src URL.
  - Only use the exact src URL from the [IMAGE: ...] marker — do not modify or construct URLs yourself; the URLs are already absolute.
- Some sites embed team data as JSON in <script> tags. This extracted data appears as [PERSON: name="..." title="..." photo_url="..." bio_url="..."] markers in an "Embedded Team Data" section.
  - For each [PERSON: ...] marker, create a person entry with the provided name, title, photo_url, and bio_url. These URLs are already absolute — use them directly.
  - If a person appears in BOTH a [PERSON: ...] marker AND as a card with an [IMAGE: ...], prefer the [PERSON: ...] marker's photo_url and bio_url (they are more reliably associated).
- Links appear as [LINK: https://...] markers next to their link text.
  - For the firm's linkedin_url, find a LinkedIn link (e.g. linkedin.com/company/...) — usually in the footer or header. Use the exact URL from the [LINK: ...] marker.
  - For each person's linkedin_url, find the [LINK: linkedin.com/in/...] marker that appears closest to that person's name. Set that person's linkedin_url to the exact URL from that marker.
  - For each person's bio_url, if a [PERSON: ...] marker provides it, use that. Otherwise find the internal [LINK: ...] marker whose link text wraps that person's name or card (e.g. a link to /people/<name-slug>/). Set bio_url to the exact URL from that marker.
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

    // Filter out section headers that the LLM sometimes returns as "people"
    // (e.g. "Our Leaders", "Domestic Equities Experts", "Company Board of Directors").
    // These are not real people — they are tab/filter labels on the team page.
    if (Array.isArray(enrichedData.people)) {
      const SECTION_HEADER_RE = /^(all teams|our leaders|domestic equities experts|emerging markets equities experts|global equities experts|marketing and client service|administration and trading|company board of directors|mutual fund board of trustees|our team|our experts|leadership|our people|staff|personnel|professionals)$/i;
      const isSectionHeader = (p: any): boolean => {
        const first = (p.first_name || '').trim();
        const last = (p.last_name || '').trim();
        const full = `${first} ${last}`.trim();
        // A section header has a first_name like "Our" and last_name like "Leaders"
        // or the combined name matches a known section header.
        return SECTION_HEADER_RE.test(full) ||
          (first.length <= 4 && SECTION_HEADER_RE.test(last)) ||
          (last.length <= 4 && SECTION_HEADER_RE.test(first));
      };
      enrichedData.people = enrichedData.people.filter((p: any) => !isSectionHeader(p));
    }

    // Phase 2: gather individual biographies that weren't on the listing page.
    // Many firm "people" pages only show name + title on cards; the full bio lives
    // on a separate profile page linked from each card. For any person missing a
    // biography but with a bio_url, fetch that page and extract the biography.
    await enrichMissingBiographies(base44, enrichedData.people || [], pageContents, website);

    // Extract education + professional experience from biographies (both the
    // ones just fetched and any real bios already on the listing page).
    await enrichEducationExperienceFromBios(base44, enrichedData.people || []);

    // Rehost images
    await rehostFirmImages(base44, enrichedData, website);

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