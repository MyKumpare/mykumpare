// Shared helpers for finding headshot photos associated with a LinkedIn
// profile URL. Used by linkedinContactLookup and linkedinProfilePhoto.

export const SUB_PAGES = ['/team', '/about', '/about-us', '/people', '/our-team', '/leadership', '/staff', '/investment-team', '/management', '/bio', '/bios'];

export const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Skip images that are clearly logos / icons / social glyphs, not headshots.
const BAD_IMG_RE = /logo|icon|sprite|favicon|social|facebook|twitter|x-icon|youtube|instagram|wechat|linkedin-icon|arrow|button|banner|hero|background|placeholder/i;
const BAD_IMG_EXT = /\.(svg|gif)$/i;

// Extract LinkedIn personal profile URLs (+context and raw HTML chunk) from a page
export function extractLinkedinUrls(text) {
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
export function extractImageUrlsWithPos(rawChunk, baseUrl) {
  const imgs = [];
  const srcRe = /<img[^>]*\ssrc=["']([^"']+)["']/gi;
  let m;
  while ((m = srcRe.exec(rawChunk)) !== null) {
    imgs.push({ url: m[1], pos: m.index });
  }
  const srcsetRe = /\ssrcset=["']([^"']+)["']/gi;
  let s;
  while ((s = srcsetRe.exec(rawChunk)) !== null) {
    const first = s[1].split(',')[0].trim().split(/\s+/)[0];
    if (first) imgs.push({ url: first, pos: s.index });
  }
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
export function pickBestImage(rawChunk, linkOffsetInChunk, baseUrl, firstNameLower, lastNameLower) {
  const candidates = extractImageUrlsWithPos(rawChunk, baseUrl);
  if (candidates.length === 0) return null;

  const scored = candidates.map((c) => {
    const u = c.url.toLowerCase();
    let score = 0;
    if (BAD_IMG_RE.test(u) || BAD_IMG_EXT.test(u)) score -= 100;
    if (lastNameLower && u.includes(lastNameLower)) score += 6;
    if (firstNameLower && u.includes(firstNameLower)) score += 3;
    if (/headshot|portrait|photo|team|bio|staff|member|person|profile/i.test(u)) score += 3;
    if (linkOffsetInChunk != null && c.pos <= linkOffsetInChunk) score += 2;
    return { ...c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < 0) return null;
  return best.url;
}

// Download + rehost an image to Base44 storage, returning a permanent file_url.
export async function rehostImage(absoluteUrl, refererUrl, base44) {
  try {
    const { assertSafePublicUrl } = await import('./urlSafety.ts');
    await assertSafePublicUrl(absoluteUrl);
    // Prefer the supplied referer (the page the image lives on) over the image
    // origin — many CDNs hotlink-protect and reject a self-referer.
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

// Fetch a list of candidate pages from a firm website origin and return them.
export async function fetchFirmPages(origin) {
  const candidateUrls = [origin, ...SUB_PAGES.map((p) => origin + p)];
  const pages = await Promise.all(
    candidateUrls.map(async (u) => {
      try {
        const res = await fetch(u, { headers: BROWSER_HEADERS, redirect: 'follow', signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        return await res.text();
      } catch { return null; }
    })
  );
  return pages.filter(Boolean);
}