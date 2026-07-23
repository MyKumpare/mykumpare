// Shared helpers for finding headshot photos associated with a LinkedIn
// profile URL. Used by linkedinContactLookup and linkedinProfilePhoto.

export const SUB_PAGES = ['/team', '/about', '/about-us', '/people', '/our-team', '/leadership', '/staff', '/investment-team', '/management', '/bio', '/bios'];

export const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Skip images that are clearly logos / icons / social glyphs, not headshots.
const BAD_IMG_RE = /logo|icon|sprite|favicon|social|facebook|twitter|x-icon|youtube|instagram|wechat|linkedin-icon|arrow|button|banner|hero|background|placeholder|company|school/i;
const BAD_IMG_EXT = /\.(svg|gif)$/i;

// Extract the person's slug from a LinkedIn profile URL (the last path segment),
// lowercased, ignoring trailing slashes and query strings.
export function linkedinSlug(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const m = rawUrl.match(/linkedin\.com\/(?:in|pub)\/([^/?#]+)/i);
  return m ? decodeURIComponent(m[1]).toLowerCase().replace(/\/+$/, '') : '';
}

// Extract LinkedIn personal profile URLs (+context, raw HTML chunk, slug) from a page.
export function extractLinkedinUrls(text) {
  const found = new Map(); // slug -> { url, context, rawChunk, linkOffsetInChunk, slug }
  const regex = /https?:\/\/(?:[a-z]{2}-[a-z]{2}\.)?(?:www\.)?linkedin\.com\/(?:in|pub)\/[A-Za-z0-9_\-%]+/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const url = match[0];
    const slug = linkedinSlug(url);
    if (!slug || found.has(slug)) continue;
    const start = Math.max(0, match.index - 1500);
    const end = Math.min(text.length, match.index + url.length + 400);
    const rawChunk = text.slice(start, end);
    const context = rawChunk.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    found.set(slug, { url, context, rawChunk, linkOffsetInChunk: match.index - start, slug });
  }
  return found;
}

// Pull image URLs (with their position in the chunk) out of a raw HTML slice,
// resolving relative URLs against the page base. Captures src, srcset,
// lazy-load attributes (data-src, data-lazy-src, data-original, data-bg),
// and inline CSS background-image:url(...).
export function extractImageUrlsWithPos(rawChunk, baseUrl) {
  const imgs = [];
  const attrRe = /<img[^>]*\s(?:src|data-src|data-lazy-src|data-original|data-bg)=["']([^"']+)["']/gi;
  let m;
  while ((m = attrRe.exec(rawChunk)) !== null) {
    imgs.push({ url: m[1], pos: m.index });
  }
  const srcsetRe = /\ssrcset=["']([^"']+)["']/gi;
  let s;
  while ((s = srcsetRe.exec(rawChunk)) !== null) {
    const first = s[1].split(',')[0].trim().split(/\s+/)[0];
    if (first) imgs.push({ url: first, pos: s.index });
  }
  const bgRe = /background(?:-image)?\s*:\s*url\(["']?([^"')]+)["']?\)/gi;
  let b;
  while ((b = bgRe.exec(rawChunk)) !== null) {
    imgs.push({ url: b[1], pos: b.index });
  }
  const seen = new Set();
  return imgs
    .map(({ url, pos }) => {
      try {
        const abs = new URL(url, baseUrl).href;
        if (seen.has(abs)) return null;
        seen.add(abs);
        return { url: abs, pos };
      } catch { return null; }
    })
    .filter(Boolean);
}

// Score a single image URL for headshot-likelihood.
export function scoreImageUrl(u, firstNameLower, lastNameLower, linkOffsetInChunk, pos) {
  const lower = (u || '').toLowerCase();
  let score = 0;
  if (BAD_IMG_RE.test(lower) || BAD_IMG_EXT.test(lower)) score -= 100;
  if (lastNameLower && lower.includes(lastNameLower)) score += 6;
  if (firstNameLower && lower.includes(firstNameLower)) score += 3;
  if (/headshot|portrait|photo|team|bio|staff|member|person|profile|avatar/i.test(lower)) score += 3;
  if (linkOffsetInChunk != null && pos != null && pos <= linkOffsetInChunk) score += 2;
  return score;
}

// Choose the best headshot candidate: prefer an image that appears *before*
// the LinkedIn link (headshots usually sit above the name/link), closest to it.
export function pickBestImage(rawChunk, linkOffsetInChunk, baseUrl, firstNameLower, lastNameLower) {
  const candidates = extractImageUrlsWithPos(rawChunk, baseUrl);
  if (candidates.length === 0) return null;
  const scored = candidates.map((c) => ({ ...c, score: scoreImageUrl(c.url, firstNameLower, lastNameLower, linkOffsetInChunk, c.pos) }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < 0) return null;
  return best.url;
}

// Find the headshot nearest the contact's NAME in the page HTML. Used when a
// firm's people page lists headshots but does NOT link individual LinkedIn
// profiles (so slug-matching can't work). Looks for "First ... Last" or
// "Last ... First" within ~120 chars, then grabs the best headshot in a window
// around each name occurrence.
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function pickHeadshotByName(html, baseUrl, firstNameLower, lastNameLower) {
  const fi = (firstNameLower || '').trim();
  const li = (lastNameLower || '').trim();
  if (!fi && !li) return null;
  const patterns = [];
  if (fi && li) {
    patterns.push(`${escapeRe(fi)}[\\s\\S]{0,150}${escapeRe(li)}`);
    patterns.push(`${escapeRe(li)}[\\s\\S]{0,150}${escapeRe(fi)}`);
  } else {
    patterns.push(escapeRe(fi || li));
  }
  let bestUrl = null;
  let bestScore = 0;
  for (const p of patterns) {
    const re = new RegExp(p, 'i');
    let m;
    let guard = 0;
    while ((m = re.exec(html)) !== null && guard < 20) {
      guard++;
      const start = Math.max(0, m.index - 1500);
      const end = Math.min(html.length, m.index + m[0].length + 300);
      const chunk = html.slice(start, end);
      const nameOffset = m.index - start;
      const cands = extractImageUrlsWithPos(chunk, baseUrl);
      for (const c of cands) {
        const sc = scoreImageUrl(c.url, fi, li, nameOffset, c.pos);
        if (sc > bestScore) { bestScore = sc; bestUrl = c.url; }
      }
      re.lastIndex = m.index + 1;
    }
  }
  return bestUrl;
}

// Whole-page fallback: pick the single best headshot-like image on the entire
// page, used when the LinkedIn link was found but no image sat near it.
export function pickBestImageOnPage(html, baseUrl, firstNameLower, lastNameLower) {
  const candidates = extractImageUrlsWithPos(html, baseUrl);
  if (candidates.length === 0) return null;
  const scored = candidates.map((c) => ({ ...c, score: scoreImageUrl(c.url, firstNameLower, lastNameLower, null, c.pos) }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < 1) return null;
  return best.url;
}

// Download + rehost an image to Base44 storage, returning a permanent file_url.
export async function rehostImage(absoluteUrl, refererUrl, base44) {
  try {
    const { assertSafePublicUrl } = await import('./urlSafety.ts');
    await assertSafePublicUrl(absoluteUrl);
    let ref = refererUrl || '';
    if (!ref) { try { ref = new URL(absoluteUrl).origin + '/'; } catch { ref = ''; } }
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

// Fetch a list of candidate pages from a firm website origin and return them
// as { url, html } pairs so callers can resolve relative links against the page.
export async function fetchFirmPages(origin) {
  const candidateUrls = [origin, ...SUB_PAGES.map((p) => origin + p)];
  const results = await Promise.all(
    candidateUrls.map(async (u) => {
      try {
        const res = await fetch(u, { headers: BROWSER_HEADERS, redirect: 'follow', signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        return { url: res.url || u, html: await res.text() };
      } catch { return null; }
    })
  );
  return results.filter(Boolean);
}

// Fetch one additional page (e.g. an individual bio page linked from a team page).
export async function fetchPage(url) {
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return { url: res.url || url, html: await res.text() };
  } catch { return null; }
}