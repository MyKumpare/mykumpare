import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveUrl, DOC_KEYWORDS, isLikelyPersonSlug, extractPersonDataFromScripts, discoverCategoryUrlsFromHtml } from '../../shared/enrichmentHelpers.ts';

/**
 * Fetches a website's content directly (homepage + common sub-pages like /about, /team)
 * and passes it to the LLM for structured extraction.
 * This is more reliable than relying solely on add_context_from_internet web search.
 */

const COMMON_PATHS = [
  '/about',
  '/about-us',
  '/about/team',
  '/about/our-team',
  '/about/people',
  '/about/leadership',
  '/about/board',
  '/about/board-of-directors',
  '/about/board-of-trustees',
  '/about/governance',
  '/about/executive-leadership',
  '/about/administration',
  '/about/consultants',
  '/team',
  '/our-team',
  '/people',
  '/our-people',
  '/leadership',
  '/board',
  '/board-of-directors',
  '/board-of-trustees',
  '/trustees',
  '/governance',
  '/administration',
  '/consultants',
  '/staff',
  '/about-us/team',
  '/about-us/people',
  '/about-us/leadership',
  '/about-us/board',
  '/about-us/board-of-directors',
  '/about-us/board-of-trustees',
  '/about-us/governance',
  '/about-us/administration',
  '/about-us/executive-leadership',
  '/company',
  '/contact',
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

// Wayback Machine rate-limit tracker: if the Wayback Machine returns too many
// consecutive 429 (rate-limited) responses, stop trying it for the rest of this
// invocation. Each 429 still costs a network round-trip, so skipping after a
// threshold saves significant time when the Wayback Machine is throttling us.
let wayback429Count = 0;
const WAYBACK_429_LIMIT = 3;

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
  const timeout = setTimeout(() => controller.abort(), 10000);
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
    const timeout = setTimeout(() => controller.abort(), 10000);
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
  return doFetch();
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
    .replace(/<\/?(div|p|br|h[1-6]|li|ul|ol|span|a|td|tr|table|section|article|main|dt|dd|dl|details|summary|button|label|figcaption|figure|blockquote)[^>]*>/gi, '\n')
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

// resolveUrl and extractPersonDataFromScripts are imported from shared/enrichmentHelpers.ts

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
      prompt: `You are extracting information about a specific person from their individual profile page.

Person name: "${personName}"

Below is the text content of their profile/biography page.

FIRST, determine if this page is a person profile/biography page. If it is NOT (e.g. it's a document, report, article, blog post, research paper, strategy overview, market commentary, or any other non-person page), return empty strings for ALL fields and empty arrays — do NOT try to extract a person's name from a document title or heading. Only proceed if this is genuinely an individual's profile/biography page.

If this IS a person profile page, locate the section describing THIS person (often near their name, under a heading like "Biography", "About", "Profile", or "Overview").
IMPORTANT: Many sites use collapsible/accordion sections for detailed information. Look for sections labeled "PROFESSIONAL EXPERIENCE", "EDUCATION", "CREDENTIALS", "EDUCATION AND CREDENTIALS", "EDUCATION, CREDENTIALS AND MEMBERSHIPS", "SERVICE AREAS", or similar. The content of these sections IS present in the page text even though they appear collapsed on the visual page — extract ALL information from them.

EXTRACT THESE FIELDS:

1. first_name: the person's first name (given name). If the name includes a professional designation like "CFP", "CFA", "CPA", do NOT include it in the name.
2. last_name: the person's last name (family name/surname). Do NOT include designations.
3. title: their job title/role as it appears on the page (e.g. "Senior Wealth Advisor"). Usually displayed near their name at the top.
4. biography: the COMPLETE biography text for this person.
   CRITICAL INSTRUCTIONS FOR THE BIOGRAPHY FIELD:
   - Copy the biography VERBATIM — do not summarize, do not paraphrase, do not abbreviate, do not truncate.
   - Include EVERY paragraph of the biography in full, from the first sentence to the last sentence.
   - The biography often spans MULTIPLE paragraphs. You MUST include ALL of them — do not stop after the first paragraph.
   - If the page lists multiple people, extract only the biography belonging to "${personName}".
   - If no biography text is found, return an empty string.
   - The biography typically includes: current role, tenure at the firm, prior employers, education, and areas of expertise. Include ALL of this text.
5. phone: any phone number listed for this person (e.g. "872-804-1892"). Include the area code.
6. email: any email address listed for this person.
7. photo_url: the URL of their profile photo. Images appear as [IMAGE: alt="..." src="https://..."] markers — find the one closest to the person's name.
8. designations: any professional designations/certifications (e.g. "CFA", "CFP", "CPA", "MBA", "PhD", "Chartered Financial Analyst"). Return as an array of strings.
9. education: every school/college/university the person attended as a student, with institution, degree, area_of_specialization, majors (array), graduation_year. Only include institutions they attended as a student, NOT firms where they worked.
10. professional_experience: every employer/company mentioned INCLUDING their current firm, with company_name, title, start_year, end_year (leave end_year empty if current employer). Order from most recent to oldest.

--- PAGE CONTENT ---
${pageText.substring(0, 20000)}
--- END PAGE CONTENT ---

Return a JSON object with all fields above. Leave fields empty or return empty arrays if not found.`,
      response_json_schema: {
        type: 'object',
        properties: {
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          biography: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          title: { type: 'string' },
          photo_url: { type: 'string' },
          designations: { type: 'array', items: { type: 'string' } },
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
      first_name: (res?.first_name || '').trim(),
      last_name: (res?.last_name || '').trim(),
      biography: (res?.biography || '').trim(),
      phone: (res?.phone || '').trim(),
      email: (res?.email || '').trim(),
      title: (res?.title || '').trim(),
      photo_url: (res?.photo_url || '').trim(),
      designations: Array.isArray(res?.designations) ? res.designations : [],
      education: Array.isArray(res?.education) ? res.education : [],
      professional_experience: Array.isArray(res?.professional_experience) ? res.professional_experience : [],
    };
  } catch {
    return { first_name: '', last_name: '', biography: '', phone: '', email: '', title: '', photo_url: '', designations: [], education: [], professional_experience: [] };
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
      const kwMatch = base.match(/(.*?\/(?:people|our-people|team|our-team|leadership|staff|personnel|professionals|board|trustees|governance|administration|administrators|executive|executives|consultants|directors)\/)/i);
      if (kwMatch) {
        baseCandidates.push(kwMatch[1]);
      } else {
        baseCandidates.push(base);
      }
    }
  }
  // Also try root-level /<keyword>/ as a base — many sites (e.g. Meketa) use
  // /about-us/people/ for the team listing but /people/<slug>/ for individual
  // profile pages.
  if (baseCandidates.length > 0) {
    try {
      const origin = new URL(baseCandidates[0]).origin;
      for (const kw of ['people', 'our-people', 'team', 'our-team', 'staff', 'leadership']) {
        const rootCandidate = origin + '/' + kw + '/';
        if (!baseCandidates.includes(rootCandidate)) baseCandidates.push(rootCandidate);
      }
    } catch { /* ignore */ }
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
  fnStartTime: number,
  timeBudgetMs: number,
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
    // Treat short bios as stubs — many sites show a short tagline/quote on
    // the team listing while the full bio is on the profile page (e.g.
    // "I enjoy being part of a community that values results and collegiality.").
    if (bio.length < 150) return true;
    // Also treat name-only stubs (e.g. "Jerrod Stoller") as stubs.
    const first = (p.first_name || '').trim().toLowerCase();
    if (first && bio.toLowerCase().startsWith(first) && bio.length < 200) return true;
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
      if (Date.now() - fnStartTime >= timeBudgetMs) return;
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
  if (unresolvedIdx.length > 0 && Date.now() - fnStartTime < timeBudgetMs) {
    const unresolvedPeople = unresolvedIdx.map((i) => queue[i]);
    searchResults = await discoverBioUrlsViaSearch(base44, unresolvedPeople, website);
  }

  // Phase C: extract biographies. People resolved in Phase A reuse their
  // already-fetched text; people resolved in Phase B fetch their bio page now.
  let cCursor = 0;
  const phaseCWorker = async () => {
    while (cCursor < queue.length) {
      if (Date.now() - fnStartTime >= timeBudgetMs) return;
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
      if (result.biography && result.biography.length > (person.biography || '').length) {
        person.biography = result.biography;
      }
      if (result.phone && !person.phone) person.phone = result.phone;
      if (result.email && !person.email) person.email = result.email;
      if (result.title && !person.title) person.title = result.title;
      if (result.photo_url && !person.photo_url) person.photo_url = result.photo_url;
      if (result.designations?.length) person.designations = result.designations;
      if (result.education?.length) person.education = result.education;
      if (result.professional_experience?.length) person.professional_experience = result.professional_experience;
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length), }, () => phaseCWorker()),
  );
}

// DOC_KEYWORDS and isLikelyPersonSlug are imported from shared/enrichmentHelpers.ts

// Fetch the site's sitemap(s) and extract individual profile page URLs.
// Many WordPress sites have a sitemap at /sitemap.xml or /sitemap_index.xml
// that lists ALL pages including individual team member profile pages. This
// catches people whose profile pages aren't linked from the team listing
// (e.g. JS-rendered team pages with pagination, or people in other sections).
async function discoverProfileUrlsFromSitemap(
  website: string,
): Promise<Set<string>> {
  const result = new Set<string>();
  let baseHost = '';
  try { baseHost = new URL(website).host.toLowerCase(); } catch { /* ignore */ }
  if (!baseHost) return result;

  // Candidate sitemap URLs to try.
  const sitemapCandidates = [
    resolveUrl(website, '/sitemap.xml'),
    resolveUrl(website, '/sitemap_index.xml'),
    resolveUrl(website, '/wp-sitemap.xml'),
    resolveUrl(website, '/sitemap-team.xml'),
    resolveUrl(website, '/our-team-sitemap.xml'),
  ];

  const profilePathRegex = /\/(?:our-team|team|people|our-people|staff|leadership|professionals|personnel)\/[^/]+\/?$/i;

  const fetchSitemap = async (url: string, depth = 0): Promise<void> => {
    if (depth > 2) return; // limit recursion for sitemap indexes
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(url, {
        headers: browserHeaders(CONSENT_COOKIES + ';' + dynamicConsentCookies),
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) return;
      const xml = await resp.text();
      if (!xml || xml.length < 50) return;

      // Check if this is a sitemap index (contains <sitemap> elements)
      if (xml.includes('<sitemapindex') || xml.includes('<sitemap xmlns')) {
        // Extract sub-sitemap URLs and fetch them
        const subRegex = /<loc>\s*([^<]+)\s*<\/loc>/gi;
        let smatch: RegExpExecArray | null;
        const subUrls: string[] = [];
        while ((smatch = subRegex.exec(xml)) !== null) {
          const subUrl = smatch[1].trim();
          // Prioritize sub-sitemaps that might contain team/people URLs
          if (/team|people|staff|our-team|person|profile/i.test(subUrl) || depth === 0) {
            subUrls.push(subUrl);
          }
        }
        // Fetch up to 5 sub-sitemaps (to stay within time limits)
        await Promise.all(subUrls.slice(0, 5).map((su) => fetchSitemap(su, depth + 1)));
        return;
      }

      // Regular sitemap: extract URLs matching the profile page pattern
      const urlRegex = /<loc>\s*([^<]+)\s*<\/loc>/gi;
      let umatch: RegExpExecArray | null;
      while ((umatch = urlRegex.exec(xml)) !== null) {
        const pageUrl = umatch[1].trim();
        let linkHost = '';
        try { linkHost = new URL(pageUrl).host.toLowerCase(); } catch { /* ignore */ }
        if (linkHost !== baseHost) continue;
        if (profilePathRegex.test(pageUrl)) {
          const profileSlug = (pageUrl.match(/\/([^/]+)\/?$/) || ['', ''])[1];
          if (isLikelyPersonSlug(profileSlug)) {
            result.add(pageUrl);
          }
        }
      }
    } catch {
      // non-fatal
    }
  };

  for (const sm of sitemapCandidates) {
    if (result.size > 0) break; // stop if we already found profile URLs
    await fetchSitemap(sm);
  }

  if (result.size > 0) {
    console.log(`discoverProfileUrlsFromSitemap: found ${result.size} profile page URLs from sitemap`);
  }
  return result;
}

// Discover individual profile pages linked from the team listing that were
// NOT represented in the Phase 1 LLM extraction (the LLM sometimes misses people
// when the listing page is large, JS-rendered, or has tabbed sections that get
// truncated). For each unmatched profile page, fetch it and extract the person
// directly. This catches people like Brett Guendel whose individual profile
// page exists at /our-team/brett-guendel/ but who weren't extracted from the
// team listing. Bounded concurrency + cap to stay within time limits.
async function discoverAndExtractMissingPeople(
  base44: any,
  people: any[],
  pageContents: { url: string; text: string }[],
  website: string,
  fnStartTime: number,
  timeBudgetMs: number,
): Promise<void> {
  const MAX = 30;
  const CONCURRENCY = 8;
  let baseHost = '';
  try { baseHost = new URL(website).host.toLowerCase(); } catch { /* ignore */ }
  if (!baseHost) return;

  // Collect individual profile page URLs from [LINK: ...] markers on all
  // fetched pages. Individual profile pages have a path like
  // /our-team/<name-slug>/, /team/<name-slug>/, /people/<name-slug>/ etc.
  const profileUrls = new Set<string>();
  for (const page of pageContents) {
    if (!page.text) continue;
    const linkRegex = /\[LINK:\s*(https?:\/\/[^\]]+)\]/gi;
    let lmatch: RegExpExecArray | null;
    while ((lmatch = linkRegex.exec(page.text)) !== null) {
      const url = lmatch[1].trim();
      let linkHost = '';
      try { linkHost = new URL(url).host.toLowerCase(); } catch { /* ignore */ }
      if (!linkHost || linkHost !== baseHost) continue;
      // Match individual profile pages: /<team-keyword>/<slug>/ (2+ segments)
      if (/\/(?:our-team|team|people|our-people|staff|leadership|professionals|personnel)\/[^/]+\/?$/i.test(url)) {
        const profileSlug = (url.match(/\/([^/]+)\/?$/) || ['', ''])[1];
        if (isLikelyPersonSlug(profileSlug)) {
          profileUrls.add(url);
        }
      }
    }
  }

  // Also discover profile page URLs from the site's sitemap. This catches
  // people whose profile pages aren't linked from the team listing (e.g.
  // JS-rendered team pages with pagination, or people in other sections).
  // Skip if time budget is nearly exhausted.
  const sitemapUrls = (Date.now() - fnStartTime < timeBudgetMs - 10000)
    ? await discoverProfileUrlsFromSitemap(website)
    : new Set<string>();
  for (const url of sitemapUrls) {
    profileUrls.add(url);
  }

  if (profileUrls.size === 0) return;

  // Build a set of normalized names already extracted, for matching.
  const extractedNames = new Set(
    people
      .map((p) => `${p.first_name || ''} ${p.last_name || ''}`.trim().toLowerCase())
      .filter(Boolean)
  );

  // For each profile page URL, check if it matches an extracted person by
  // comparing the URL slug to the person's name. Unmatched URLs are candidates
  // for direct extraction. Matched URLs for people with SHORT bios are
  // candidates for ENRICHMENT (re-fetch the full bio from their profile page).
  const unmatchedUrls: string[] = [];
  const enrichUrls: { url: string; personIndex: number }[] = [];
  const SHORT_BIO_THRESHOLD = 400; // chars — bios shorter than this are likely summaries
  for (const url of profileUrls) {
    const slugMatch = url.match(/\/([^/]+)\/?$/);
    if (!slugMatch) continue;
    const slug = slugMatch[1];
    // Skip URL fragments (e.g. "/our-team/#")
    if (!slug || slug === '#') continue;
    // Convert slug to a name: "brett-guendel" -> "brett guendel"
    const slugName = slug.replace(/-/g, ' ').toLowerCase();
    // Skip slugs that are clearly not person names (e.g. "all", "leadership")
    if (['all', 'leadership', 'team', 'staff', 'board', 'contact', 'about'].includes(slugName)) continue;
    let matched = false;
    let matchedPersonIndex = -1;
    for (let pi = 0; pi < people.length; pi++) {
      const name = `${people[pi].first_name || ''} ${people[pi].last_name || ''}`.trim().toLowerCase();
      if (!name) continue;
      if (name === slugName || name.includes(slugName) || slugName.includes(name)) {
        matched = true;
        matchedPersonIndex = pi;
        break;
      }
    }
    if (!matched) {
      unmatchedUrls.push(url);
    } else if (matchedPersonIndex >= 0) {
      // Person was already extracted — check if their bio is short/missing.
      // If so, enrich from their individual profile page (which has the full bio).
      const bioLen = (people[matchedPersonIndex].biography || '').trim().length;
      if (bioLen < SHORT_BIO_THRESHOLD) {
        enrichUrls.push({ url, personIndex: matchedPersonIndex });
      }
    }
  }
  if (unmatchedUrls.length === 0 && enrichUrls.length === 0) return;

  // Sort unmatched URLs alphabetically by slug so people are processed in a
  // deterministic order (e.g. "brett-guendel" before "zach-..."). This ensures
  // that when we cap at MAX, we get a reproducible subset spread across the
  // alphabet rather than an arbitrary chunk from the sitemap's insertion order.
  unmatchedUrls.sort((a, b) => {
    const aSlug = (a.match(/\/([^/]+)\/?$/) || ['', ''])[1];
    const bSlug = (b.match(/\/([^/]+)\/?$/) || ['', ''])[1];
    return aSlug.localeCompare(bSlug);
  });

  // Process enrichment URLs first (people already extracted with short bios).
  // Fetch their individual profile page and update their bio, education,
  // experience, phone, email, title, and photo with the full details.
  const enrichSlice = enrichUrls.slice(0, MAX);
  let enrichCursor = 0;
  const enrichWorker = async () => {
    while (enrichCursor < enrichSlice.length) {
      if (Date.now() - fnStartTime >= timeBudgetMs) return;
      const i = enrichCursor++;
      const { url, personIndex } = enrichSlice[i];
      const pageText = await fetchPage(url);
      if (!pageText || pageText.length < 50) continue;
      try {
        const res = await extractBiographyFromPage(base44, `${people[personIndex].first_name} ${people[personIndex].last_name}`, url, pageText);
        if (res && (res.biography || res.phone || res.email || res.title || (res.education && res.education.length > 0) || (res.professional_experience && res.professional_experience.length > 0))) {
          const p = people[personIndex];
          // Only update fields if the profile page provided richer data
          if (res.biography && res.biography.length > (p.biography || '').length) p.biography = res.biography;
          if (res.phone) p.phone = res.phone;
          if (res.email) p.email = res.email;
          if (res.title && res.title.length >= (p.title || '').length) p.title = res.title;
          if (res.photo_url) p.photo_url = res.photo_url;
          if (res.education && res.education.length > 0) p.education = res.education;
          if (res.professional_experience && res.professional_experience.length > 0) p.professional_experience = res.professional_experience;
          if (!p.bio_url) p.bio_url = url;
          // Use designations from the extraction, or fall back to text-based detection
          if (res.designations && res.designations.length > 0) {
            p.designations = res.designations;
          } else if (res.biography) {
            const designations = extractDesignationsFromText(res.biography);
            if (designations.length > 0) p.designations = designations;
          }
          console.log(`discoverAndExtractMissingPeople: enriched ${p.first_name} ${p.last_name} bio from ${url}`);
        }
      } catch {
        // continue on error
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, enrichSlice.length) }, () => enrichWorker()),
  );

  const urls = unmatchedUrls.slice(0, MAX);
  let cursor = 0;
  const worker = async () => {
    while (cursor < urls.length) {
      if (Date.now() - fnStartTime >= timeBudgetMs) return;
      const i = cursor++;
      const url = urls[i];
      const pageText = await fetchPage(url);
      if (!pageText || pageText.length < 50) continue;
      try {
        // Single comprehensive LLM call extracts name, photo, bio, education,
        // experience, designations, phone, email, and title.
        const personName = (url.match(/\/([^/]+)\/?$/) || ['', ''])[1].replace(/-/g, ' ');
        const res = await extractBiographyFromPage(base44, personName, url, pageText);
        const firstName = res?.first_name || '';
        const lastName = res?.last_name || '';
        if (firstName && lastName) {
          // Skip if the extracted name looks like a document/report title
          // (the LLM sometimes extracts a "name" from a document heading)
          const nameWords = `${firstName} ${lastName}`.toLowerCase().split(/\s+/);
          let isDocumentName = false;
          for (const word of nameWords) {
            if (DOC_KEYWORDS.has(word)) { isDocumentName = true; break; }
          }
          if (isDocumentName) continue;
          const fullName = `${firstName} ${lastName}`.trim().toLowerCase();
          // Final duplicate check against ALL people (including ones added by
          // earlier workers in this same phase).
          if (!extractedNames.has(fullName)) {
            people.push({
              first_name: firstName,
              last_name: lastName,
              title: res.title || '',
              biography: res.biography || '',
              phone: res.phone || '',
              email: res.email || '',
              photo_url: res.photo_url || '',
              bio_url: url,
              education: res.education || [],
              professional_experience: res.professional_experience || [],
              designations: res.designations || (res.biography ? extractDesignationsFromText(res.biography) : []),
            });
            extractedNames.add(fullName);
            console.log(`discoverAndExtractMissingPeople: added ${fullName} from ${url}`);
          }
        }
      } catch {
        // continue on error
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, urls.length) }, () => worker()),
  );

  // For remaining unmatched URLs (beyond MAX), create lightweight person
  // entries from the URL slug so they at least appear in the results with their
  // name. The user can enrich their bios later. This ensures people like Brett
  // Guendel are included even if their profile page wasn't fetched in this run.
  const processedUrls = new Set(urls);
  for (const url of unmatchedUrls) {
    if (processedUrls.has(url)) continue;
    const slugMatch = url.match(/\/([^/]+)\/?$/);
    if (!slugMatch) continue;
    const slug = slugMatch[1];
    if (!slug || slug === '#') continue;
    if (!isLikelyPersonSlug(slug)) continue;
    const slugName = slug.replace(/-/g, ' ').trim();
    if (!slugName) continue;
    // Parse name from slug: "brett-guendel" -> first="Brett", last="Guendel"
    const parts = slugName.split(/\s+/);
    if (parts.length < 2) continue;
    const first_name = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    const last_name = parts.slice(1).join(' ').charAt(0).toUpperCase() + parts.slice(1).join(' ').slice(1);
    const fullName = `${first_name} ${last_name}`.trim().toLowerCase();
    if (extractedNames.has(fullName)) continue;
    people.push({
      first_name,
      last_name,
      title: '',
      biography: '',
      phone: '',
      email: '',
      photo_url: '',
      bio_url: url,
    });
    extractedNames.add(fullName);
  }
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
async function enrichEducationExperienceFromBios(base44: any, people: any[], fnStartTime?: number, timeBudgetMs?: number): Promise<void> {
  const MAX = 30;
  const CONCURRENCY = 10;
  const isStubBio = (p: any): boolean => {
    const bio = (p.biography || '').trim();
    if (!bio) return true;
    // Treat short bios as stubs — many sites show a short tagline/quote on
    // the team listing while the full bio is on the profile page (e.g.
    // "I enjoy being part of a community that values results and collegiality.").
    if (bio.length < 150) return true;
    // Also treat name-only stubs (e.g. "Jerrod Stoller") as stubs.
    const first = (p.first_name || '').trim().toLowerCase();
    if (first && bio.toLowerCase().startsWith(first) && bio.length < 200) return true;
    return false;
  };
  const queue = people.filter((p) => !isStubBio(p) && p.education === undefined && p.professional_experience === undefined).slice(0, MAX);
  if (queue.length === 0) return;
  let cursor = 0;
  const worker = async () => {
    while (cursor < queue.length) {
      if (fnStartTime && timeBudgetMs && Date.now() - fnStartTime >= timeBudgetMs) return;
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

// For every person who has a bio_url but is missing education, professional
// experience, or designations, visit their individual profile page and extract
// those fields. This catches people whose biography was already present on the
// listing page (so they were skipped by enrichMissingBiographies) but whose
// education/experience/designations live in accordion sections on their
// individual profile page (e.g. Meketa's collapsible "PROFESSIONAL EXPERIENCE"
// and "EDUCATION, CREDENTIALS AND MEMBERSHIPS" sections). For people without a
// bio_url, try to discover it from internal links or URL patterns first.
async function enrichEducationFromProfilePages(
  base44: any,
  people: any[],
  pageContents: { url: string; text: string }[],
  website: string,
  fnStartTime: number,
  timeBudgetMs: number,
): Promise<void> {
  const MAX = 40;
  const CONCURRENCY = 10;

  // Only process people who are missing at least one of: education,
  // professional_experience, or designations.
  const needsEnrichment = (p: any): boolean => {
    const hasEducation = Array.isArray(p.education) && p.education.length > 0;
    const hasExperience = Array.isArray(p.professional_experience) && p.professional_experience.length > 0;
    const hasDesignations = Array.isArray(p.designations) && p.designations.length > 0;
    return !hasEducation || !hasExperience || !hasDesignations;
  };

  let queue = people.filter(needsEnrichment).slice(0, MAX);
  if (queue.length === 0) return;

  // Phase A: Discover bio_url for people who don't have one.
  const discoveryQueue = queue.filter((p) => !p.bio_url);
  if (discoveryQueue.length > 0) {
    let dCursor = 0;
    const dWorker = async () => {
      while (dCursor < discoveryQueue.length) {
        if (Date.now() - fnStartTime >= timeBudgetMs) return;
        const i = dCursor++;
        const person = discoveryQueue[i];
        // (1) Internal [LINK: ...] marker near the person's name.
        const linkUrl = discoverBioUrl(pageContents, person.first_name, person.last_name);
        if (linkUrl) {
          person.bio_url = linkUrl;
          continue;
        }
        // (2) URL pattern probe (slug-based).
        const probed = await discoverBioUrlByPattern(pageContents, person.first_name, person.last_name, person.middle_name);
        if (probed.url) {
          person.bio_url = probed.url;
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, discoveryQueue.length) }, () => dWorker()),
    );
  }

  // Re-filter: only people with a bio_url and still needing enrichment.
  queue = queue.filter((p) => p.bio_url && needsEnrichment(p));
  if (queue.length === 0) return;

  // Cache fetched page text by URL to avoid re-fetching.
  const pageCache = new Map<string, string>();
  for (const page of pageContents) {
    if (page.url && page.text) pageCache.set(page.url, page.text);
  }

  // Phase B: Fetch each person's profile page and extract education,
  // experience, and designations.
  let cursor = 0;
  const worker = async () => {
    while (cursor < queue.length) {
      if (Date.now() - fnStartTime >= timeBudgetMs) return;
      const i = cursor++;
      const person = queue[i];
      const bioUrl = person.bio_url;
      if (!bioUrl) continue;

      let pageText = pageCache.get(bioUrl);
      if (!pageText) {
        pageText = await fetchPage(bioUrl);
        if (pageText) pageCache.set(bioUrl, pageText);
      }
      if (!pageText || pageText.length < 50) continue;

      const fullName = [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
      try {
        const res = await extractBiographyFromPage(base44, fullName, bioUrl, pageText);
        // Only update fields that are missing — don't overwrite existing data.
        if (res.education?.length && !(Array.isArray(person.education) && person.education.length > 0)) {
          person.education = res.education;
        }
        if (res.professional_experience?.length && !(Array.isArray(person.professional_experience) && person.professional_experience.length > 0)) {
          person.professional_experience = res.professional_experience;
        }
        if (res.designations?.length && !(Array.isArray(person.designations) && person.designations.length > 0)) {
          person.designations = res.designations;
        }
        // Also fill in bio if it's richer than what we have.
        if (res.biography && res.biography.length > (person.biography || '').length) {
          person.biography = res.biography;
        }
        // Fill in other missing fields.
        if (res.phone && !person.phone) person.phone = res.phone;
        if (res.email && !person.email) person.email = res.email;
        if (res.title && (!person.title || res.title.length > person.title.length)) person.title = res.title;
        if (res.photo_url && !person.photo_url) person.photo_url = res.photo_url;
        console.log(`enrichEducationFromProfilePages: enriched ${fullName} from ${bioUrl}`);
      } catch {
        // continue on error
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker()),
  );
}

// ─── Wayback Machine (Internet Archive) fallback ───
//
// When a firm's website is protected by an anti-bot captcha (Cloudflare,
// SiteGuard, etc.) or returns insufficient content, we try the Wayback
// Machine's cached snapshots. The Wayback Machine serves from its own archive,
// so it bypasses the target site's captcha/anti-bot protections entirely —
// and unlike the LLM web-search fallback, it provides the full HTML content
// (with photos, individual bios, and complete team listings).

// Unwrap a Wayback Machine URL to its original form.
// Wayback URLs look like: https://web.archive.org/web/{timestamp}/{original_url}
function unwrapWaybackUrl(url: string): string {
  if (!url) return url;
  const match = url.match(/^https?:\/\/web\.archive\.org\/web\/\d+(?:[a-z_]+)?\/(.+)$/i);
  if (match) return match[1];
  return url;
}

// Fetch a single page from the Wayback Machine. Returns the page text (via
// htmlToText) or '' if no snapshot is available. Uses a direct Wayback URL
// format (/web/{year}/{url}) which the Wayback Machine auto-redirects to the
// closest snapshot — this avoids the rate-limited availability API (which
// returns 429 errors when too many requests are made in rapid succession).
async function fetchViaWayback(url: string): Promise<string> {
  if (!url || !url.startsWith('http')) return '';
  if (wayback429Count >= WAYBACK_429_LIMIT) return '';
  try {
    // Use a direct Wayback URL with a recent year — the Wayback Machine
    // redirects to the closest available snapshot. This avoids the
    // availability API (which is rate-limited and causes 429 errors).
    const waybackUrl = `https://web.archive.org/web/2024/${url}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(waybackUrl, {
      headers: browserHeaders(''),
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      if (resp.status === 429) {
        wayback429Count++;
        console.log(`fetchViaWayback: ${url} returned 429 (count=${wayback429Count}), skipping further Wayback fetches`);
      } else {
        console.log(`fetchViaWayback: ${url} returned status ${resp.status}`);
      }
      try { await resp.body?.cancel(); } catch { /* ignore */ }
      return '';
    }
    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('text') && !contentType.includes('html')) {
      console.log(`fetchViaWayback: ${url} returned content-type ${contentType}`);
      return '';
    }
    const html = await resp.text();
    if (!html || html.length < 100) {
      console.log(`fetchViaWayback: ${url} returned ${html?.length || 0} chars`);
      return '';
    }
    // Rewrite Wayback-wrapped URLs (href/src) to their original form so that
    // htmlToText can use the ORIGINAL url as the base.
    const processedHtml = html.replace(
      /((?:href|src)\s*=\s*["'])(?:https?:\/\/web\.archive\.org)?\/web\/\d+(?:[a-z_]+)?\//gi,
      '$1',
    );
    const result = htmlToText(processedHtml, url);
    console.log(`fetchViaWayback: ${url} -> ${result.length} chars of text`);
    return result;
  } catch (err) {
    console.log(`fetchViaWayback: ${url} error: ${err?.message || err}`);
    return '';
  }
}

// Fetch the homepage + team/people sub-pages from the Wayback Machine.
// Returns an array of {url, text} in the same format as pageContents.
//
// Two-pass discovery: (1) fetch the homepage + common sub-page paths, then
// (2) scan ALL fetched pages for additional team/people links and fetch those.
// The Wayback Machine wraps internal links as
// https://web.archive.org/web/{timestamp}/{original_url}, so we unwrap them
// to recover the original URLs. This catches non-standard paths like
// /about-us/executive-staff/ that are only linked from sub-pages, not the homepage.
async function fetchPagesViaWayback(
  website: string,
): Promise<{ url: string; text: string }[]> {
  const pages: { url: string; text: string }[] = [];
  try {
    let baseHost = '';
    try { baseHost = new URL(website).host.toLowerCase(); } catch { /* ignore */ }

    // Helper: scan text for team/people page URLs (unwrapping Wayback URLs)
    const discoverLinks = (text: string, found: Set<string>) => {
      const linkRegex = /\[LINK:\s*(https?:\/\/[^\]]+)\]/gi;
      let lmatch: RegExpExecArray | null;
      while ((lmatch = linkRegex.exec(text)) !== null) {
        const originalUrl = unwrapWaybackUrl(lmatch[1]);
        let linkHost = '';
        try { linkHost = new URL(originalUrl).host.toLowerCase(); } catch { /* ignore */ }
        if (!linkHost || linkHost !== baseHost) continue;
        if (/\/(people|our-people|team|our-team|leadership|staff|personnel|professionals|board|trustees|governance|administration|administrators|executive|executives|consultants|directors)\b/i.test(originalUrl)) {
          if (originalUrl !== website) found.add(originalUrl);
        }
      }
    };

    // Fetch the homepage first
    const homepageText = await fetchViaWayback(website);
    if (!homepageText || homepageText.length < 100) return pages;
    pages.push({ url: website, text: homepageText.substring(0, 20000) });

    // Pass 1: common paths + links discovered from the homepage
    const pass1Urls = new Set<string>();
    COMMON_PATHS.map((p) => resolveUrl(website, p)).filter((u): u is string => !!u && u !== website).forEach((u) => pass1Urls.add(u));
    discoverLinks(homepageText, pass1Urls);

    const pass1Results = await Promise.all(
      [...pass1Urls].slice(0, 12).map(async (originalUrl) => {
        const text = await fetchViaWayback(originalUrl);
        if (!text || text.length < 100) return null;
        const isPeoplePage = /\/(people|our-people|team|our-team|leadership|board|trustees|governance|administration|administrators|executive|executives|consultants|directors|about-us|about)\b/i.test(originalUrl);
        const limit = isPeoplePage ? 80000 : 12000;
        return { url: originalUrl, text: text.substring(0, limit) };
      }),
    );
    for (const p of pass1Results) {
      if (p) pages.push(p);
    }

    // Pass 2: scan all fetched pages for additional team/people links not yet fetched
    const fetchedUrls = new Set(pages.map((p) => p.url));
    const pass2Urls = new Set<string>();
    for (const page of pages) {
      discoverLinks(page.text, pass2Urls);
    }
    const toFetch2 = [...pass2Urls].filter((u) => !fetchedUrls.has(u)).slice(0, 5);
    if (toFetch2.length > 0) {
      const pass2Results = await Promise.all(
        toFetch2.map(async (originalUrl) => {
          const text = await fetchViaWayback(originalUrl);
          if (!text || text.length < 100) return null;
          return { url: originalUrl, text: text.substring(0, 80000) };
        }),
      );
      for (const p of pass2Results) {
        if (p) pages.push(p);
      }
    }
  } catch {
    // non-fatal — return whatever we have
  }
  return pages;
}

// Use LLM web search to discover sub-page URLs on the firm's domain.
// This handles JS-rendered sites (React/Vue SPAs, WordPress with JS page
// builders) where the initial HTML from both direct fetch and the Wayback
// Machine is just a skeleton with no navigation links. The LLM can find
// staff/team page URLs through Google's index, which crawls the rendered DOM.
async function discoverSubPageUrlsViaSearch(
  base44: any,
  firmName: string,
  website: string,
): Promise<string[]> {
  let domain = '';
  try { domain = new URL(website).host.toLowerCase(); } catch { /* ignore */ }
  if (!domain) return [];
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Search the web for the organization "${firmName}" (website: ${domain}).

Find ALL pages on their website that list staff, team members, leadership, board members, trustees, or key personnel. Common page names include: Staff, Team, Leadership, Board of Trustees, Board of Directors, Our People, Administration, Investment Staff, etc.

For each page you find, return the full URL on ${domain}. Only return URLs that start with https://${domain} or http://${domain}. Do NOT return LinkedIn, Facebook, or other third-party URLs.

Return a JSON object with a "urls" array of full URLs.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          urls: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    });
    const urls = res?.urls || [];
    return urls
      .map((u: string) => u.trim())
      .filter((u: string) => /^https?:\/\/.+/.test(u))
      .filter((u: string) => {
        let host = '';
        try { host = new URL(u).host.toLowerCase(); } catch { /* ignore */ }
        return host === domain || host.endsWith('.' + domain);
      });
  } catch {
    return [];
  }
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
Find their team/leadership page and list ALL team members visible on that page — INCLUDING board members, trustees, executive leadership, administrators, and consultants, not just investment team members. Also find their firm's description, LinkedIn URL, year founded, address, and phone.

For EACH team member, include:
- Their full name
- Their title/role (e.g. CEO, COO, Director of Partnerships, Trustee, Board Member, Administrator, Consultant)
- Their LinkedIn profile URL if visible on the page
- The FULL URL of their profile photo — this typically looks like ${website}/wp-content/uploads/... Search the page source for image URLs on the ${website} domain.
- Their biography if available

Also include:
- The firm's logo URL (do NOT use social media icon URLs like LinkedIn/Twitter/Facebook badges — the firm logo is a unique brand image, usually a stylized wordmark or icon)
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
- logo_url: firm logo URL (full URL starting with http). Do NOT use social media icon URLs (LinkedIn, Twitter, Facebook, Instagram, YouTube icons) — the firm logo is a unique brand image.
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

// Extract a firm logo that is applied via CSS as a background image on an
// element with id/class containing "logo". Many sites (especially older ones)
// use <a id="logo" style="background: url(...)"> or a CSS rule #logo { background: url(...) }
// instead of an <img> tag — so the logo is invisible to the img-only extraction.
// We fetch linked CSS files, find logo-related rules, and return the resolved URL.
async function extractLogoFromCss(html: string, baseUrl: string): Promise<string> {
  try {
    // 1. Collect linked stylesheet URLs from the HTML
    const cssHrefRegex = /<link[^>]+rel\s*=\s*["']stylesheet["'][^>]+href\s*=\s*["']([^"']+)["']/gi;
    const cssUrls: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = cssHrefRegex.exec(html)) !== null) {
      const resolved = resolveUrl(baseUrl, m[1].trim());
      if (resolved) cssUrls.push(resolved);
    }
    // Also check inline style attributes on logo elements
    const inlineLogoRegex = /<(?:a|div|span|header)[^>]*(?:id|class)\s*=\s*["'][^"']*(?:logo|brand)[^"']*["'][^>]*style\s*=\s*["']([^"']*)["']/gi;
    while ((m = inlineLogoRegex.exec(html)) !== null) {
      const bgMatch = m[1].match(/background[^;]*url\(\s*["']?([^"')]+)["']?\s*\)/i);
      if (bgMatch) {
        const resolved = resolveUrl(baseUrl, bgMatch[1].trim());
        if (resolved && !isSocialOrIconUrl(resolved)) return resolved;
      }
    }

    // 2. Fetch each CSS file and look for logo-related selectors
    const logoSelectorRegex = /(?:#logo|\.logo|#header-logo|\.site-logo|#brand|\.brand-logo|#site-logo|\.header-logo)[^{]*\{[^}]*\}/gi;
    for (const cssUrl of cssUrls.slice(0, 3)) {
      try {
        const resp = await fetch(cssUrl, { headers: browserHeaders(CONSENT_COOKIES + ';' + dynamicConsentCookies) });
        if (!resp.ok) continue;
        const css = await resp.text();
        let ruleMatch: RegExpExecArray | null;
        logoSelectorRegex.lastIndex = 0;
        while ((ruleMatch = logoSelectorRegex.exec(css)) !== null) {
          const bgMatch = ruleMatch[0].match(/background[^;]*url\(\s*["']?([^"')]+)["']?\s*\)/i);
          if (bgMatch) {
            const resolved = resolveUrl(cssUrl, bgMatch[1].trim());
            if (resolved && !isSocialOrIconUrl(resolved)) return resolved;
          }
        }
      } catch {
        // skip CSS file that fails to load
      }
    }
  } catch {
    // non-fatal
  }
  return '';
}

// Reject social-media / generic icon URLs that the LLM sometimes picks as the
// firm logo. These appear in headers/footers alongside the real logo and the
// LLM confuses them — especially the LinkedIn "in" badge.
function isSocialOrIconUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return /linkedin|twitter|x-icon|facebook|instagram|youtube|tiktok|favicon|sprite|social-icon|social_icon|icon-linkedin|icon-twitter|icon-facebook|icon-instagram|icon-youtube/i.test(lower);
}

// Rehost the firm's logo + people photos so images are served from app storage.
// Shared by both the direct-scrape and web-search fallback paths.
async function rehostFirmImages(base44: any, data: any, website: string): Promise<void> {
  try {
    // Drop the logo if it's a social media / generic icon URL.
    if (data.logo_url && isSocialOrIconUrl(data.logo_url)) {
      console.log('rehostFirmImages: rejecting social/icon logo_url =', data.logo_url);
      data.logo_url = '';
    }
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
  const fnStartTime = Date.now();
  // 90 seconds — the proxy/CDN cuts the connection at 120 seconds. Individual
  // LLM calls and fetches inside worker loops can take 10-30 seconds each, and
  // the time budget check only prevents STARTING new work (it can't interrupt
  // in-progress work). 90s leaves a 30s buffer so operations that started just
  // before the budget expires still complete before the 120s proxy timeout.
  const TIME_BUDGET_MS = 90000;
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

    // Detect captcha / anti-bot blocking EARLY so we can skip wasteful direct
    // fetches for sub-pages. When the homepage is captcha-blocked, ALL sub-page
    // direct fetches will also fail — each taking 15s (timeout) + 500ms (retry
    // delay) + 15s (retry timeout) = ~30s per path. Skipping them and going
    // straight to the Wayback Machine saves ~30 seconds for captcha-blocked
    // sites, keeping the function within platform timeout limits.
    const isHomepageCaptcha = !!homepageRaw &&
      /\/\.well-known\/sgcaptcha|sgcaptcha|robot challenge|checking the site connection/i.test(homepageRaw) &&
      homepageRaw.length < 1000;
    const isHomepageBlocked = isHomepageCaptcha || (!homepageText || homepageText.length < 50);

    // Extract the firm logo from CSS background images (for sites that use
    // <a id="logo" style="background: url(...)"> instead of <img> tags).
    const cssLogoUrl = homepageRaw ? await extractLogoFromCss(homepageRaw, website) : '';
    if (cssLogoUrl) {
      console.log('extractLogoFromCss: found logo via CSS =', cssLogoUrl);
    }
    // Prepend the CSS-discovered logo as an [IMAGE: ...] marker so the LLM
    // sees it as the first image on the page (matching the "logo is typically
    // one of the first images" prompt instruction).
    const logoMarker = cssLogoUrl ? `\n[IMAGE: alt="firm logo" src="${cssLogoUrl}"]\n` : '';
    if (homepageText) {
      // Give the homepage a generous budget so the footer (which holds the
      // address/phone/contact block) isn't truncated away before the LLM sees it.
      pageContents.push({ url: website, text: logoMarker + homepageText.substring(0, 20000) });
    }

    // Fetch sub-pages in parallel. When the homepage is captcha-blocked, skip
    // the direct fetch entirely and go straight to the Wayback Machine — this
    // avoids wasting ~30 seconds on direct fetches that will all fail.
    // Team/people pages often contain many staff across tabbed sections — give them a larger
    // content budget so contacts from every tab are captured rather than truncated.
    const subPagePromises = COMMON_PATHS.map(async (path) => {
      const fullUrl = resolveUrl(website, path);
      if (!fullUrl || fullUrl === website) return null;
      let text = '';
      if (isHomepageBlocked && fullUrl.startsWith('http')) {
        text = await fetchViaWayback(fullUrl);
      } else {
        text = await fetchPage(fullUrl);
        // Only try Wayback fallback if the homepage was blocked. If the homepage
        // was fetched successfully, an empty sub-page response is almost
        // certainly a 404 (non-existent path), not a blocked page — trying the
        // Wayback Machine for every 404 wastes time and triggers 429 rate limits.
      }
      if (text && text.length > 100) {
        const isPeoplePage = /\/(people|our-people|team|our-team|leadership|staff|about-us|board|trustees|governance|administration|administrators|executive|executives|consultants|directors)\b/i.test(path);
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
          if (/\/(people|our-people|team|our-team|leadership|staff|personnel|professionals|board|trustees|governance|administration|administrators|executive|executives|consultants|directors)\b/i.test(url)) {
            if (url !== website) discovered.add(url);
          }
        }
      }
      // Also try keyword-based path discovery: extract path segments that
      // look like team pages from any internal links (catches /about-xponance/people/
      // even when the full URL doesn't match the keyword regex).
      for (const text of allText) {
        const pathRegex = /\[LINK:\s*https?:\/\/[^^\]]*?\/[^[\]]*?(people|our-people|team|our-team|leadership|board|trustees|governance|administration|administrators|executive|executives|consultants|directors)\b[^\]]*\]/gi;
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
          let text = '';
          if (isHomepageBlocked && teamUrl.startsWith('http')) {
            text = await fetchViaWayback(teamUrl);
          } else {
            text = await fetchPage(teamUrl);
            // Only try Wayback if homepage was blocked (see COMMON_PATHS comment above)
          }
          if (text && text.length > 100) return { url: teamUrl, text: text.substring(0, 80000) };
          return null;
        }),
      )).filter(Boolean) as { url: string; text: string }[];
      subPages = subPages.concat(teamPages);
    }

    // Category filter discovery: many sites organize their team page with
    // category filters (e.g. "Investment Professional", "Management", "Board
    // Member") where each category is a separate page. The [LINK: ...] markers
    // in the text capture <a href> links, but JavaScript-based filters (buttons,
    // data attributes, onclick handlers) are missed. Fetch the raw HTML of
    // team pages and scan for category-filter URLs to fetch as additional pages.
    if (Date.now() - fnStartTime < TIME_BUDGET_MS - 15000) {
      const existingUrls = new Set(pageContents.map((p) => p.url));
      const teamUrls = pageContents
        .filter((p) => /\/(people|our-people|team|our-team|leadership|staff|board|trustees)\b/i.test(p.url))
        .map((p) => p.url)
        .slice(0, 3);
      const catUrls = new Set<string>();
      for (const tu of teamUrls) {
        if (Date.now() - fnStartTime >= TIME_BUDGET_MS) break;
        let raw = await fetchRawHtml(tu);
        if (!raw || raw.length < 100) {
          try {
            const c = new AbortController(), t = setTimeout(() => c.abort(), 15000);
            const r = await fetch(`https://web.archive.org/web/2024/${tu}`, { headers: browserHeaders(''), redirect: 'follow', signal: c.signal });
            clearTimeout(t);
            if (r.ok && (r.headers.get('content-type') || '').includes('text')) {
              const wb = await r.text();
              if (wb?.length > 100) raw = wb.replace(/((?:href|src)\s*=\s*["'])(?:https?:\/\/web\.archive\.org)?\/web\/\d+(?:[a-z_]+)?\//gi, '$1');
            }
          } catch { /* ignore */ }
        }
        if (raw && raw.length > 100) {
          for (const cu of discoverCategoryUrlsFromHtml(raw, tu, website)) {
            if (!existingUrls.has(cu)) { catUrls.add(cu); existingUrls.add(cu); }
          }
        }
      }
      const toFetch = [...catUrls].slice(0, 8);
      if (toFetch.length > 0) {
        console.log(`enrichFirmFromWebsite: discovered ${toFetch.length} category-filter pages`);
        const catPages = (await Promise.all(
          toFetch.map(async (url) => {
            let text = await fetchPage(url);
            if (!text || text.length < 100) text = await fetchViaWayback(url);
            return (text && text.length > 100) ? { url, text: text.substring(0, 80000) } : null;
          }),
        )).filter(Boolean) as { url: string; text: string }[];
        for (const p of catPages) pageContents.push(p);
      }
    }

    // Sort so people/team pages come first (most important for contact extraction),
    // keeping homepage at the front.
    subPages.sort((a, b) => {
      const aPeople = /\/(people|our-people|team|our-team|leadership|staff|board|trustees|governance|administration|administrators|executive|executives|consultants|directors)\b/i.test(a.url) ? 0 : 1;
      const bPeople = /\/(people|our-people|team|our-team|leadership|staff|board|trustees|governance|administration|administrators|executive|executives|consultants|directors)\b/i.test(b.url) ? 0 : 1;
      return aPeople - bPeople;
    });
    for (const page of subPages) {
      pageContents.push(page);
    }

    let combinedContent = pageContents.map((p) => `[Page: ${p.url}]\n${p.text}`).join('\n\n---\n\n');

    const subPageContentLength = subPages.reduce((sum, p) => sum + (p?.text?.length || 0), 0);

    // Wayback Machine fallback: if the direct fetch was captcha-blocked,
    // returned insufficient content, or didn't fetch enough team/people
    // sub-pages, try fetching cached snapshots from the Internet Archive.
    // The Wayback Machine serves from its own archive, so it bypasses the
    // target site's captcha/anti-bot protections entirely — and provides the
    // full HTML (photos, bios, complete team listings) that the LLM
    // web-search fallback can't.
    //
    // We MERGE Wayback pages with the direct-fetch pages (adding only pages
    // not already fetched) rather than replacing them, so we don't lose any
    // content the direct fetch successfully retrieved.
    const peoplePageCount = subPages.filter((p) =>
      /\/(people|our-people|team|our-team|leadership|staff|board|trustees|governance|administration|administrators|executive|executives|consultants|directors)\b/i.test(p.url)
    ).length;

    // LLM-powered sub-page discovery: use the LLM web search to find
    // staff/team/board page URLs on the firm's domain. This handles
    // JS-rendered sites and sites with non-standard paths (e.g.
    // /about-bcers/staff/) that aren't in COMMON_PATHS and can't be
    // discovered from the Wayback homepage skeleton HTML.
    if (website && Date.now() - fnStartTime < TIME_BUDGET_MS - 15000) {
      const discoveredUrls = await discoverSubPageUrlsViaSearch(base44, firm_name, website);
      if (discoveredUrls.length > 0) {
        const existingUrls = new Set(pageContents.map((p) => p.url));
        const toFetch = discoveredUrls.filter((u) => !existingUrls.has(u)).slice(0, 8);
        const discoveredPages = await Promise.all(
          toFetch.map(async (url) => {
            let text = await fetchPage(url);
            if (!text || text.length < 100) {
              text = await fetchViaWayback(url);
            }
            if (text && text.length > 100) {
              const isPeoplePage = /\/(people|our-people|team|our-team|leadership|staff|board|trustees|governance|administration|administrators|executive|executives|consultants|directors)\b/i.test(url);
              const limit = isPeoplePage ? 80000 : 12000;
              return { url, text: text.substring(0, limit) };
            }
            return null;
          }),
        );
        for (const p of discoveredPages) {
          if (p) pageContents.push(p);
        }
        combinedContent = pageContents.map((p) => `[Page: ${p.url}]\n${p.text}`).join('\n\n---\n\n');
      }
    }

    let waybackUsed = false;
    if ((isHomepageCaptcha || combinedContent.length < 5000 || peoplePageCount < 2) && website && Date.now() - fnStartTime < TIME_BUDGET_MS - 15000) {
      const waybackPages = await fetchPagesViaWayback(website);
      if (waybackPages.length > 0) {
        const existingUrls = new Set(pageContents.map((p) => p.url));
        for (const wp of waybackPages) {
          if (!existingUrls.has(wp.url)) {
            pageContents.push(wp);
            existingUrls.add(wp.url);
          }
        }
        combinedContent = pageContents.map((p) => `[Page: ${p.url}]\n${p.text}`).join('\n\n---\n\n');
        waybackUsed = true;
      }
    }

    // Deduplicate and re-sort pageContents so people/team pages come first.
    // Without dedup, many COMMON_PATHS URLs return the same content via
    // different paths (e.g. /about/board and /board are the same page),
    // pushing the actual staff page past the 150K LLM prompt limit.
    if (pageContents.length > 1) {
      const homepageEntry = pageContents[0];
      let rest = pageContents.slice(1);

      // Filter out individual profile pages and blog posts that dilute content
      // and slow down the LLM extraction.
      rest = rest.filter((page) => {
        // Skip individual profile pages (e.g. /staff/helen-holton/) — their info
        // is already on the listing page, and they add ~15K chars of noise.
        if (/\/staff\/[^/]+\/?$/i.test(page.url) && page.text.length < 8000) return false;
        // Skip blog posts (URLs with year/month/date patterns)
        if (/\/\d{4}\/\d{2}\/\d{2}\//.test(page.url)) return false;
        return true;
      });

      // Deduplicate by content: if two pages share the same first 500 chars,
      // keep only the one with the shorter URL (usually the canonical path).
      const seen = new Map<string, { url: string; text: string }>();
      for (const page of rest) {
        const fingerprint = page.text.substring(0, 500).replace(/\s+/g, ' ').trim();
        let matchedKey: string | null = null;
        for (const [key] of seen) {
          if (fingerprint === key) { matchedKey = key; break; }
        }
        if (matchedKey) {
          const existing = seen.get(matchedKey)!;
          if (page.url.length < existing.url.length) seen.set(matchedKey, page);
        } else {
          seen.set(fingerprint, page);
        }
      }
      rest = [...seen.values()];

      // Sort: people/team pages first
      rest.sort((a, b) => {
        const aPeople = /\/(people|our-people|team|our-team|leadership|staff|board|trustees|governance|administration|administrators|executive|executives|consultants|directors)\b/i.test(a.url) ? 0 : 1;
        const bPeople = /\/(people|our-people|team|our-team|leadership|staff|board|trustees|governance|administration|administrators|executive|executives|consultants|directors)\b/i.test(b.url) ? 0 : 1;
        return aPeople - bPeople;
      });
      pageContents.length = 0;
      pageContents.push(homepageEntry, ...rest);
      combinedContent = pageContents.map((p) => `[Page: ${p.url}]\n${p.text}`).join('\n\n---\n\n');
    }

    // Fall back to web search if the combined content is very small after ALL
    // fetch attempts (direct, Wayback, and LLM-discovered). This catches both
    // captcha-blocked sites AND JS-rendered sites where the Wayback Machine
    // only captures skeleton HTML.
    const isInsufficientContent = combinedContent.length < 500;
    if (isInsufficientContent) {
      const fallback = await enrichFirmViaWebSearch(base44, firm_name, website);
      if (fallback && (fallback.name || (Array.isArray(fallback.people) && fallback.people.length > 0))) {
        if (!fallback.name) fallback.name = firm_name;
        const cleanStr = (v: any): any => {
    if (v == null) return '';
    const s = String(v).trim().toLowerCase();
    if (['null', 'undefined', 'n/a', 'na', 'none', 'not provided', 'not available', 'unknown', '-'].includes(s)) return '';
    return v;
  };
        fallback.logo_url = cleanStr(fallback.logo_url) || '';
        if (isSocialOrIconUrl(fallback.logo_url)) {
          console.log('fallback: rejecting social/icon logo_url =', fallback.logo_url);
          fallback.logo_url = '';
        }
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
        await enrichEducationExperienceFromBios(base44, fallback.people || [], fnStartTime, TIME_BUDGET_MS);
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
${combinedContent.substring(0, 100000)}
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
- The people page is organized in sections (Executive Leadership, Investment Team, Portfolio Operations, Corporate, Sales & Client Service, Board of Directors, Board of Trustees, Administrators, Consultants, etc.). Go through EVERY section and extract EVERY person in EVERY section. You MUST include board members, trustees, executive leadership, administrators, and consultants — these are contacts just like investment team members.
- Some pages use tabbed or filtered layouts (e.g. "All Teams", "Our Leaders", "Domestic Equities Experts", "Emerging Markets Equities Experts", "Global Equities Experts", "Marketing and Client Service", "Administration and Trading"). ALL of these tabs/sections are included in the content below — you must process EVERY one of them, not just the first.
- If a person appears in multiple sections, extract them once with their most detailed title.
- CRITICAL: Section/tab labels like "Our Leaders", "Domestic Equities Experts", "Emerging Markets Equities Experts", "Global Equities Experts", "Marketing and Client Service", "Administration and Trading", "Company Board of Directors", "Mutual Fund Board of Trustees", "All Teams" are TAB HEADERS, NOT people. Do NOT include the LABELS themselves as people entries. But DO extract every REAL PERSON listed under those sections — board members, trustees, executive leadership, administrators, and consultants are all contacts that must be included. Only extract entries that have a real person's first and last name.
- CRITICAL: Do NOT include document titles, research reports, market commentary, publications, articles, white papers, blog posts, or any other non-person content as people entries. Entries like "Third Quarter 2019 Market Review", "Global Macroeconomic Outlook", "World Markets", "Trend Following Strategies", "Transition Management", "Today's Low Interest Rate Environment", "Zero Bound" are DOCUMENTS/ARTICLES, NOT people. If the website has an "Insights", "Research", "Publications", "News", "Commentary", or "Perspectives" section, IGNORE all content in those sections — they contain articles, not personnel. A real person has a recognizable first name and last name (e.g. "John Smith", "Mary Johnson", "David Lee", "Sarah Chen"). If an entry does not have a recognizable person name, do NOT include it in the people array.
- Each person card typically has a photo (shown as [IMAGE: ...]), a name (usually in a heading like "#### Name"), and a title/role below it.
- IMPORTANT: Some sites embed team data as JSON inside <script> tags. This data has been extracted and appears as [PERSON: name="..." title="..." photo_url="..." bio_url="..."] markers in the "Embedded Team Data" section. You MUST extract EVERY [PERSON: ...] marker as a person entry. Each marker provides the person's name, title, photo_url, and bio_url (their individual profile page). Use these fields directly — do NOT skip any [PERSON: ...] marker.
- Do NOT skip anyone. If you see 40+ people on the page, return all 40+ in the people array.
- The people array should contain EVERY person whose name appears on the team/people page.

IMPORTANT:
- Images on the page appear as [IMAGE: alt="..." src="https://..."] markers.
  - The firm logo is typically one of the first images (often in the header/nav section) — look at the alt text and position to identify it. Set logo_url to that image's src URL. CRITICAL: Do NOT use social media icons (LinkedIn "in" badge, Twitter/X, Facebook, Instagram, YouTube, TikTok icons) as the firm logo. The firm logo is a unique brand image — usually a stylized wordmark or icon with the firm name in the alt text or near it. If the only image in the header is a social media icon, leave logo_url empty.
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

    // Unwrap any Wayback Machine URLs back to their original form. The Wayback
    // Machine wraps all URLs as https://web.archive.org/web/{timestamp}/{original}.
    // We unwrap linkedin_url, website, and bio_url so they point to the original
    // destinations. photo_url and logo_url are left as Wayback URLs —
    // rehostImages fetches and re-uploads them, and the original site may be
    // captcha-blocked, so the Wayback URL is the reliable source.
    if (waybackUsed) {
      if (enrichedData.linkedin_url) enrichedData.linkedin_url = unwrapWaybackUrl(enrichedData.linkedin_url);
      if (enrichedData.website) enrichedData.website = unwrapWaybackUrl(enrichedData.website);
      for (const person of enrichedData.people || []) {
        if (person.linkedin_url) person.linkedin_url = unwrapWaybackUrl(person.linkedin_url);
        if (person.bio_url) person.bio_url = unwrapWaybackUrl(person.bio_url);
      }
    }

    // Clean up string "null" values that the LLM sometimes returns for missing fields
    const cleanStr = (v: any): any => {
    if (v == null) return '';
    const s = String(v).trim().toLowerCase();
    if (['null', 'undefined', 'n/a', 'na', 'none', 'not provided', 'not available', 'unknown', '-'].includes(s)) return '';
    return v;
  };
    enrichedData.logo_url = cleanStr(enrichedData.logo_url) || '';
    if (isSocialOrIconUrl(enrichedData.logo_url)) {
      console.log('enrichedData: rejecting social/icon logo_url =', enrichedData.logo_url);
      enrichedData.logo_url = '';
    }
    // If the LLM didn't find a logo (or its was rejected as a social icon),
    // use the CSS-discovered logo as a fallback.
    if (!enrichedData.logo_url && cssLogoUrl) {
      console.log('enrichedData: using CSS-discovered logo as fallback =', cssLogoUrl);
      enrichedData.logo_url = cssLogoUrl;
    }
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

      // Filter out document/report/article titles that the LLM sometimes
      // extracts as "people" (e.g. "Third Quarter 2019 Market Review", "Trend
      // Following Strategies", "Transition Management"). These are
      // publications/insights, not personnel.
      const DOC_TITLE_RE = /\b(market review|macroeconomic outlook|world markets|market outlook|quarterly (review|outlook|update|commentary)|q[1-4]\s+\d{4}|third quarter|first quarter|second quarter|fourth quarter|trend following|transition management|interest rate environment|zero bound|white ?paper|research (report|paper|note|brief)|market (commentary|perspective|update|analysis|brief|wrap)|investment (outlook|perspective|strategy|strategies)|economic (outlook|update|commentary)|monthly (report|update|commentary)|annual report|newsletter|bulletin|case study|special report|market (update|brief))\b/i;
      const NAME_PARTICLES = /\b(van|der|de|la|von|di|del|della|le|du|el|al|bin|ibn)\b/i;
      const NAME_SUFFIXES = /\b(jr|sr|ii|iii|iv|esq|cfa|cpa|mba|phd|md)\b/i;
      const isDocumentTitle = (p: any): boolean => {
        const first = (p.first_name || '').trim();
        const last = (p.last_name || '').trim();
        const full = `${first} ${last}`.trim();
        if (!full || full.length < 2) return true;
        if (DOC_TITLE_RE.test(full)) return true;
        // A real person name is typically 2-4 words. If the "name" has 5+
        // words and contains no name particles or suffixes, it's likely a
        // document title, not a person name.
        const words = full.split(/\s+/);
        if (words.length >= 5 && !NAME_PARTICLES.test(full) && !NAME_SUFFIXES.test(full)) return true;
        return false;
      };
      enrichedData.people = enrichedData.people.filter((p: any) => !isDocumentTitle(p));
    }

    // Phase 1.4: Enrich biographies for contacts with NO bio (or stub bios).
    // This runs BEFORE sitemap discovery so it gets priority within the time
    // budget. It uses pattern probing (trying common URL patterns like
    // /{first}-{last}/) to discover each person's individual profile page,
    // then fetches and extracts the full biography, education, experience,
    // designations, phone, email, and photo from that page.
    const elapsedMs1 = Date.now() - fnStartTime;
    if (elapsedMs1 < TIME_BUDGET_MS - 15000) {
      console.log(`enrichFirmFromWebsite: enriching missing biographies (${Math.round(elapsedMs1 / 1000)}s elapsed)`);
      await enrichMissingBiographies(base44, enrichedData.people || [], pageContents, website, fnStartTime, TIME_BUDGET_MS);
    } else {
      console.log(`enrichFirmFromWebsite: skipping biography enrichment — time budget exceeded (${Math.round(elapsedMs1 / 1000)}s)`);
    }

    // Phase 1.5: Discover and extract people from individual profile pages
    // that were linked from the team listing but NOT extracted by the Phase 1
    // LLM pass (the LLM sometimes misses people when the listing is large,
    // JS-rendered, or has tabbed sections that get truncated). Each unmatched
    // profile page is fetched and the person is extracted directly — this
    // captures their full biography, phone, email, and title from their
    // individual profile page, which the team listing often doesn't include.
    if (Date.now() - fnStartTime < TIME_BUDGET_MS - 15000) {
      await discoverAndExtractMissingPeople(base44, enrichedData.people || [], pageContents, website, fnStartTime, TIME_BUDGET_MS);
    }

    // Secondary web search fallback: if the LLM extraction found very few
    // people (< 3), the combined content likely didn't include the staff/team
    // page. Try the web search fallback which uses the LLM with web search
    // to find ALL personnel.
    if ((!Array.isArray(enrichedData.people) || enrichedData.people.length < 3) && Date.now() - fnStartTime < TIME_BUDGET_MS - 15000) {
      console.log(`enrichFirmFromWebsite: LLM extraction found only ${enrichedData.people?.length || 0} people, trying web search fallback...`);
      const fallback = await enrichFirmViaWebSearch(base44, firm_name, website);
      if (fallback && Array.isArray(fallback.people) && fallback.people.length > (enrichedData.people?.length || 0)) {
        console.log(`enrichFirmFromWebsite: web search fallback found ${fallback.people.length} people, merging...`);
        // Merge: keep the main extraction's firm data but use the web search's
        // people array if it found more.
        const cleanStr2 = (v: any): any => {
    if (v == null) return '';
    const s = String(v).trim().toLowerCase();
    if (['null', 'undefined', 'n/a', 'na', 'none', 'not provided', 'not available', 'unknown', '-'].includes(s)) return '';
    return v;
  };
        fallback.logo_url = cleanStr2(fallback.logo_url) || '';
        if (isSocialOrIconUrl(fallback.logo_url)) fallback.logo_url = '';
        fallback.email = cleanStr2(fallback.email) || enrichedData.email || '';
        fallback.linkedin_url = cleanStr2(fallback.linkedin_url) || enrichedData.linkedin_url || '';
        fallback.website = cleanStr2(fallback.website) || enrichedData.website || '';
        fallback.description = cleanStr2(fallback.description) || enrichedData.description || '';
        if (!fallback.name) fallback.name = enrichedData.name;
        for (const person of fallback.people || []) {
          person.photo_url = cleanStr2(person.photo_url) || '';
          person.email = cleanStr2(person.email) || '';
          person.linkedin_url = cleanStr2(person.linkedin_url) || '';
          person.biography = cleanStr2(person.biography) || '';
          delete person.bio_url;
        }
        // Use the web search fallback's people, but keep the main extraction's
        // firm-level data (addresses, phones, logo, etc.) if the fallback
        // didn't provide them.
        if (!fallback.addresses?.length && enrichedData.addresses?.length) {
          fallback.addresses = enrichedData.addresses;
        }
        if (!fallback.phones?.length && enrichedData.phones?.length) {
          fallback.phones = enrichedData.phones;
        }
        if (!fallback.logo_url) fallback.logo_url = enrichedData.logo_url;
        if (!fallback.year_founded) fallback.year_founded = enrichedData.year_founded;
        if (!fallback.firm_types?.length) fallback.firm_types = enrichedData.firm_types;
        await enrichEducationExperienceFromBios(base44, fallback.people || [], fnStartTime, TIME_BUDGET_MS);
        await rehostFirmImages(base44, fallback, website);
        for (const person of fallback.people || []) {
          delete person.bio_url;
        }
        return Response.json(fallback);
      }
    }

    // Phase 2: Visit individual profile pages for ALL contacts to extract
    // education, professional experience, and designations from accordion
    // sections. This runs for every contact — not just those with missing bios —
    // because many sites (e.g. Meketa) put education/experience/designations in
    // collapsible sections on individual profile pages that aren't visible on
    // the team listing page.
    if (Date.now() - fnStartTime < TIME_BUDGET_MS - 15000) {
      console.log(`enrichFirmFromWebsite: enriching education/experience from profile pages (${Math.round((Date.now() - fnStartTime) / 1000)}s elapsed)`);
      await enrichEducationFromProfilePages(base44, enrichedData.people || [], pageContents, website, fnStartTime, TIME_BUDGET_MS);
    }

    // Phase 2b: Extract education + professional experience from biographies
    // that are already present (for people whose individual profile page wasn't
    // found or couldn't be fetched). Skip if time budget is nearly exhausted
    // so the function can still return results before the proxy timeout.
    if (Date.now() - fnStartTime < TIME_BUDGET_MS - 15000) {
      await enrichEducationExperienceFromBios(base44, enrichedData.people || [], fnStartTime, TIME_BUDGET_MS);
    }

    // Rehost images — skip if time budget is nearly exhausted
    if (Date.now() - fnStartTime < TIME_BUDGET_MS - 5000) {
      await rehostFirmImages(base44, enrichedData, website);
    }

    // bio_url is preserved so the frontend can store it on the Contact entity,
    // allowing the user to see and re-scrape the profile page if the initial
    // extraction missed bio/education/experience data.
    // (No deletion — bio_url is intentionally kept in the returned data.)

    console.log(`enrichFirmFromWebsite: returning ${enrichedData.people?.length || 0} people, ${pageContents.length} pages fetched, ${combinedContent.length} chars total content`);
    return Response.json(enrichedData);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});