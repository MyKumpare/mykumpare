import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { assertSafePublicUrl } from '../../shared/urlSafety.ts';

const SUB_PAGES = ['/team', '/about', '/about-us', '/people', '/our-team', '/leadership', '/staff', '/investment-team', '/management', '/bio', '/bios'];

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Skip images that are clearly logos / icons / social glyphs, not headshots.
const BAD_IMG_RE = /logo|icon|sprite|favicon|social|facebook|twitter|x-icon|youtube|instagram|wechat|linkedin-icon|arrow|button|banner|hero|background|placeholder/i;
const BAD_IMG_EXT = /\.(svg|gif)$/i;

// Extract LinkedIn personal profile URLs (+context and raw HTML chunk) from a page
function extractLinkedinUrls(text) {
  const found = new Map(); // url -> { context, rawChunk, linkOffsetInChunk }
  const regex = /https?:\/\/(?:www\.)?linkedin\.com\/(?:in|pub)\/[A-Za-z0-9_\-%]+/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const url = match[0];
    if (!found.has(url)) {
      const start = Math.max(0, match.index - 800);
      const end = Math.min(text.length, match.index + url.length + 200);
      const rawChunk = text.slice(start, end);
      const context = rawChunk.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      found.set(url, { context, rawChunk, linkOffsetInChunk: match.index - start });
    }
  }
  return found;
}

// Pull image URLs (with their position in the chunk) out of a raw HTML slice,
// resolving relative URLs against the page base.
function extractImageUrlsWithPos(rawChunk, baseUrl) {
  const imgs = [];
  // <img ... src="...">  (capture src + the position of the src attribute)
  const srcRe = /<img[^>]*\ssrc=["']([^"']+)["']/gi;
  let m;
  while ((m = srcRe.exec(rawChunk)) !== null) {
    imgs.push({ url: m[1], pos: m.index });
  }
  // srcset="url 2x, url 3x" — take the first (base) candidate
  const srcsetRe = /\ssrcset=["']([^"']+)["']/gi;
  let s;
  while ((s = srcsetRe.exec(rawChunk)) !== null) {
    const first = s[1].split(',')[0].trim().split(/\s+/)[0];
    if (first) imgs.push({ url: first, pos: s.index });
  }
  // Resolve relative URLs
  return imgs
    .map(({ url, pos }) => {
      try {
        const abs = new URL(url, baseUrl).href;
        return { url: abs, pos };
      } catch { return null; }
    })
    .filter(Boolean);
}

// Choose the best headshot candidate: prefer an image that appears *before*
// the LinkedIn link (headshots usually sit above the name/link), closest to it.
function pickBestImage(rawChunk, linkOffsetInChunk, baseUrl, firstNameLower, lastNameLower) {
  const candidates = extractImageUrlsWithPos(rawChunk, baseUrl);
  if (candidates.length === 0) return null;

  const scored = candidates.map((c) => {
    const u = c.url.toLowerCase();
    let score = 0;
    if (BAD_IMG_RE.test(u) || BAD_IMG_EXT.test(u)) score -= 100;
    if (u.includes(lastNameLower)) score += 6;
    if (u.includes(firstNameLower)) score += 3;
    if (/headshot|portrait|photo|team|bio|staff|member|person|profile/i.test(u)) score += 3;
    // Prefer images before the link (headshot above name); closeness is a bonus.
    if (c.pos <= linkOffsetInChunk) score += 2;
    return { ...c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < 0) return null;
  return best.url;
}

// Download + rehost an image to Base44 storage, returning a permanent file_url.
async function rehostImage(absoluteUrl, refererUrl, base44) {
  try {
    await assertSafePublicUrl(absoluteUrl);
    let ref = refererUrl || '';
    try { ref = new URL(absoluteUrl).origin + '/'; } catch { /* keep */ }
    const res = await fetch(absoluteUrl, {
      headers: {
        'User-Agent': BROWSER_HEADERS['User-Agent'],
        'Accept': 'image/*,*/*;q=0.8',
        'Referer': ref,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/') && contentType !== 'application/octet-stream') return null;
    let finalType = contentType === 'application/octet-stream'
      ? (/\.(png)/i.test(absoluteUrl) ? 'image/png' : /\.(webp)/i.test(absoluteUrl) ? 'image/webp' : 'image/jpeg')
      : contentType;
    const buf = await res.arrayBuffer();
    const ext = finalType.split('/')[1]?.split(';')[0] || 'jpg';
    const file = new File([new Blob([buf], { type: finalType })], `linkedin_photo_${Date.now()}.${ext}`, { type: finalType });
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    return file_url || null;
  } catch { return null; }
}

// Score a candidate LinkedIn URL against the target name
function scoreCandidate(url, info, firstNameLower, lastNameLower) {
  const contextLower = (info.context || '').toLowerCase();
  const slugLower = url.toLowerCase();
  const slugHasLastName = slugLower.includes(lastNameLower);
  const slugHasFirstName = slugLower.includes(firstNameLower);
  const hasLastName = contextLower.includes(lastNameLower);
  const hasFirstName = contextLower.includes(firstNameLower);
  let score = 0;
  if (slugHasLastName) score += 3;
  if (slugHasFirstName) score += 2;
  if (hasLastName) score += 2;
  if (hasFirstName) score += 1;
  return { url, score, info };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { first_name, last_name, firm_id, website, current_title, firm_name: bodyFirmName } = body || {};
    if (!first_name || !last_name) {
      return Response.json({ error: 'first_name and last_name are required' }, { status: 400 });
    }

    // Allow a special connection-check signal to short-circuit early
    if (first_name === '__connection_check__') {
      return Response.json({ linkedin_url: '', message: 'connection check' });
    }

    const firstNameLower = first_name.toLowerCase();
    const lastNameLower = last_name.toLowerCase();

    // Resolve the firm website + name
    let websiteUrl = website;
    let firmName = bodyFirmName || '';
    if (firm_id) {
      try {
        const firm = await base44.asServiceRole.entities.Firm.get(firm_id);
        websiteUrl = websiteUrl || firm?.website || '';
        if (!firmName) firmName = firm?.name || '';
      } catch { /* ignore */ }
    }

    // ── Strategy 1: Scrape the firm website for LinkedIn links ──
    let websiteCandidates = new Map();
    let scrapedOrigin = '';
    if (websiteUrl) {
      if (!websiteUrl.startsWith('http')) websiteUrl = 'https://' + websiteUrl;
      let baseUrl;
      try { baseUrl = new URL(websiteUrl); } catch { baseUrl = null; }
      if (baseUrl) {
        const origin = baseUrl.origin;
        scrapedOrigin = origin;
        const candidateUrls = [origin, ...SUB_PAGES.map(p => origin + p)];
        const pages = await Promise.all(
          candidateUrls.map(async (u) => {
            try {
              const res = await fetch(u, { headers: BROWSER_HEADERS, redirect: 'follow', signal: AbortSignal.timeout(8000) });
              if (!res.ok) return null;
              const html = await res.text();
              return html;
            } catch { return null; }
          })
        );
        for (const html of pages) {
          if (!html) continue;
          const found = extractLinkedinUrls(html);
          for (const [url, info] of found.entries()) {
            if (!websiteCandidates.has(url)) websiteCandidates.set(url, info);
          }
        }
      }
    }

    // Score website candidates
    let websiteMatches = [];
    for (const [url, info] of websiteCandidates.entries()) {
      const c = scoreCandidate(url, info, firstNameLower, lastNameLower);
      if (c.score > 0) websiteMatches.push(c);
    }
    websiteMatches.sort((a, b) => b.score - a.score);

    if (websiteMatches.length > 0 && websiteMatches[0].score >= 3) {
      const best = websiteMatches[0];
      const photo_url = await tryExtractPhoto(best, scrapedOrigin, base44, firstNameLower, lastNameLower);
      return Response.json({
        linkedin_url: best.url,
        confidence: best.score >= 5 ? 'high' : 'medium',
        source: 'firm_website',
        ...(photo_url ? { photo_url } : {}),
      });
    }

    // ── Strategy 2: DuckDuckGo Lite search for the LinkedIn profile ──
    const firmPart = firmName ? `+${firmName.replace(/\s+/g, '+')}` : '';
    const titlePart = current_title ? `+${current_title.replace(/\s+/g, '+')}` : '';
    const query = `${first_name}+${last_name}${firmPart}${titlePart}+site%3Alinkedin.com%2Fin`;
    let searchMatches = [];
    let ddgDiag = '';
    try {
      const ddgUrl = 'https://lite.duckduckgo.com/lite/?q=' + query + '&kl=us-en';
      const res = await fetch(ddgUrl, {
        headers: { ...BROWSER_HEADERS, 'Referer': 'https://lite.duckduckgo.com/' },
        redirect: 'follow',
        signal: AbortSignal.timeout(9000),
      });
      ddgDiag = `status=${res.status}`;
      if (res.ok) {
        const html = await res.text();
        ddgDiag += ` len=${html.length}`;
        // DDG lite encodes result URLs inside uddg= params; decode them
        const decodedHtml = html.replace(/uddg=([^&"']+)/g, (m, p1) => {
          try { return ' ' + decodeURIComponent(p1) + ' '; } catch { return m; }
        });
        const searchCandidates = extractLinkedinUrls(decodedHtml);
        ddgDiag += ` found=${searchCandidates.size}`;
        for (const [url, info] of searchCandidates.entries()) {
          const c = scoreCandidate(url, info, firstNameLower, lastNameLower);
          if (c.score > 0) searchMatches.push(c);
        }
        searchMatches.sort((a, b) => b.score - a.score);
      }
    } catch (e) { ddgDiag = 'err=' + (e.message || String(e)); }

    if (searchMatches.length > 0 && searchMatches[0].score >= 3) {
      const best = searchMatches[0];
      // DDG result snippets rarely contain the headshot image, but try anyway.
      const photo_url = await tryExtractPhoto(best, scrapedOrigin, base44, firstNameLower, lastNameLower);
      return Response.json({
        linkedin_url: best.url,
        confidence: best.score >= 5 ? 'high' : 'medium',
        source: 'web_search',
        ...(photo_url ? { photo_url } : {}),
      });
    }

    // ── Strategy 3: LLM web search for the LinkedIn profile ──
    // Many firm sites render team LinkedIn links via JavaScript (absent from
    // the static HTML), and DuckDuckGo is frequently blocked by the host
    // environment. The LLM's web-search capability (Gemini, via Google's
    // index) is a reliable fallback for resolving an individual's profile —
    // the same approach the enrichment pass uses for bio-page discovery.
    try {
      const firmPart = firmName ? ` who works at ${firmName}` : '';
      const titlePart = current_title ? `, ${current_title}` : '';
      const llmRes = await base44.integrations.Core.InvokeLLM({
        prompt: `Search the web for the public LinkedIn personal profile URL of ${first_name} ${last_name}${firmPart}${titlePart}. Return ONLY their LinkedIn profile URL in the form https://www.linkedin.com/in/... (or https://www.linkedin.com/pub/...). If you cannot find it, return an empty string. Do not guess or fabricate a URL.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            linkedin_url: { type: 'string' },
          },
        },
      });
      const llmUrl = (llmRes?.linkedin_url || '').trim();
      if (llmUrl && /https?:\/\/(?:www\.)?linkedin\.com\/(?:in|pub)\//i.test(llmUrl)) {
        const slugLower = llmUrl.toLowerCase();
        // Require the last name in the slug to avoid a plausible-but-wrong profile.
        if (lastNameLower && slugLower.includes(lastNameLower)) {
          return Response.json({
            linkedin_url: llmUrl,
            confidence: 'medium',
            source: 'web_search',
            message: 'Found via web search — please verify before saving.',
          });
        }
      }
    } catch { /* keep going — fall through to combined result */ }

    // Combine best efforts for a low-confidence result
    const allMatches = [...websiteMatches, ...searchMatches].sort((a, b) => b.score - a.score);
    if (allMatches.length > 0) {
      const best = allMatches[0];
      const photo_url = await tryExtractPhoto(best, scrapedOrigin, base44, firstNameLower, lastNameLower);
      return Response.json({
        linkedin_url: best.url,
        confidence: 'low',
        source: websiteMatches.length > 0 ? 'firm_website' : 'web_search',
        message: 'A possible match was found but with low confidence. Please verify before saving.',
        ...(photo_url ? { photo_url } : {}),
      });
    }

    const reason = !websiteUrl
      ? "The contact's firm has no website on file, and no LinkedIn match was found via web search."
      : 'No LinkedIn profile matching this contact was found on the firm website or via web search. You can enter the URL manually.';
    return Response.json({ linkedin_url: '', message: reason });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to lookup LinkedIn profile' }, { status: 500 });
  }
});

// Extract + rehost the best nearby headshot for a matched candidate.
async function tryExtractPhoto(match, baseUrl, base44, firstNameLower, lastNameLower) {
  try {
    if (!match?.info?.rawChunk) return null;
    let base = baseUrl;
    if (!base) { try { base = new URL(match.url).origin; } catch { base = ''; } }
    if (!base) return null;
    const imgUrl = pickBestImage(match.info.rawChunk, match.info.linkOffsetInChunk, base, firstNameLower, lastNameLower);
    if (!imgUrl) return null;
    return await rehostImage(imgUrl, base, base44);
  } catch { return null; }
}