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
    if (!response.ok) return '';
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text') && !contentType.includes('html')) return '';
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

  // Step 2: For nav/footer/header sections, keep only the [IMAGE: ...] markers
  // (logos are commonly in the header; strip the nav link noise)
  result = result.replace(/<(nav|footer|header)[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _tag, inner) => {
    const images = inner.match(/\[IMAGE:[^\]]*\]/g) || [];
    return images.length > 0 ? '\n' + images.join('\n') : '';
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
      prompt: `The following is the content of a biography/profile page for "${personName}". Extract the complete biography text for this person. Copy the full text verbatim — do not summarize. If no biography is found, return an empty string.\n\n---\n${pageText.substring(0, 12000)}\n---`,
      response_json_schema: {
        type: 'object',
        properties: {
          biography: { type: 'string' },
        },
      },
    });
    return res?.biography || '';
  } catch {
    return '';
  }
}

// For every person missing a biography but with a bio_url, fetch their
// individual profile page and fill in the biography. Bounded concurrency +
// capped total to keep the function within time limits.
async function enrichMissingBiographies(base44: any, people: any[]): Promise<void> {
  const needing = people.filter((p) => !p.biography && p.bio_url);
  if (needing.length === 0) return;

  const MAX = 15;
  const CONCURRENCY = 4;
  const queue = needing.slice(0, MAX);

  let cursor = 0;
  const worker = async () => {
    while (cursor < queue.length) {
      const i = cursor++;
      const person = queue[i];
      const fullName = [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
      const bio = await extractBiographyFromPage(base44, fullName, person.bio_url);
      if (bio) person.biography = bio;
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

    // Sort so people/team pages come first (most important for contact extraction),
    // keeping homepage at the front.
    const subPages = (await Promise.all(subPagePromises)).filter(Boolean);
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
    await enrichMissingBiographies(base44, enrichedData.people || []);

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