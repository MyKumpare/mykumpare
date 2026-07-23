import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  BROWSER_HEADERS, extractLinkedinUrls, pickBestImage, rehostImage, fetchFirmPages,
} from '../../shared/linkedinScrape.ts';

// Normalize a LinkedIn personal-profile URL into a clean canonical form.
function normalizeLinkedinUrl(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let url = raw.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) return '';
    if (!/^\/(in|pub)\//i.test(u.pathname)) return '';
    return u.origin + u.pathname.replace(/\/+$/, '');
  } catch { return ''; }
}

// Extract image URLs from <meta property="og:image"> / twitter:image tags.
function extractMetaImages(html) {
  const imgs = [];
  const metaRe = /<meta[^>]+(?:property|name)=["'](og:image|og:image:url|twitter:image|image)["'][^>]*content=["']([^"']+)["']/gi;
  let m;
  while ((m = metaRe.exec(html)) !== null) { if (m[2]) imgs.push(m[2]); }
  const metaRe2 = /<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](og:image|og:image:url|twitter:image|image)["']/gi;
  let m2;
  while ((m2 = metaRe2.exec(html)) !== null) { if (m2[1]) imgs.push(m2[1]); }
  return imgs;
}

// Score: prefer images hosted on LinkedIn's CDN that look like profile photos.
const BAD_IMG_RE = /logo|icon|sprite|favicon|social|facebook|twitter|x-icon|youtube|instagram|wechat|linkedin-icon|arrow|button|banner|hero|background|placeholder|company|school/i;
const BAD_IMG_EXT = /\.(svg|gif)$/i;
function pickBestMetaImage(urls) {
  if (!urls || urls.length === 0) return null;
  const scored = urls.map((u) => {
    const lower = (u || '').toLowerCase();
    let score = 0;
    if (BAD_IMG_RE.test(lower) || BAD_IMG_EXT.test(lower)) score -= 100;
    if (/displayphoto|profile-photo|profilephoto/i.test(lower)) score += 6;
    if (/media\.licdn\.com|static\.licdn\.com/i.test(lower)) score += 4;
    return { url: u, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < 0) return null;
  return best.url;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { linkedin_url, firm_id, website, first_name, last_name } = await req.json();
    const profileUrl = normalizeLinkedinUrl(linkedin_url);
    if (!profileUrl) {
      return Response.json({ photo_url: '', message: 'Please enter a valid LinkedIn profile URL (linkedin.com/in/...).' });
    }

    const firstNameLower = (first_name || '').toLowerCase();
    const lastNameLower = (last_name || '').toLowerCase();

    // ── Strategy 1: Scrape the contact's firm website for the headshot
    // sitting near this exact LinkedIn profile link. Firm team/bio pages host
    // headshots publicly, so this is the most reliable path. ──
    let websiteUrl = website;
    if (!websiteUrl && firm_id) {
      try {
        const firm = await base44.asServiceRole.entities.Firm.get(firm_id);
        websiteUrl = firm?.website;
      } catch { /* ignore */ }
    }
    if (websiteUrl) {
      if (!websiteUrl.startsWith('http')) websiteUrl = 'https://' + websiteUrl;
      let origin = '';
      try { origin = new URL(websiteUrl).origin; } catch { origin = ''; }
      if (origin) {
        const pages = await fetchFirmPages(origin);
        for (const html of pages) {
          if (!html) continue;
          const found = extractLinkedinUrls(html);
          // Match the exact normalized URL the user entered.
          const info = found.get(profileUrl) || found.get(profileUrl.replace('https://www.linkedin.com', 'https://linkedin.com'));
          if (info?.rawChunk) {
            const imgUrl = pickBestImage(info.rawChunk, info.linkOffsetInChunk, origin, firstNameLower, lastNameLower);
            if (imgUrl) {
              const photo_url = await rehostImage(imgUrl, origin + '/', base44);
              if (photo_url) return Response.json({ photo_url, source: 'firm_website' });
            }
          }
        }
      }
    }

    // ── Strategy 2: Fetch the LinkedIn public profile page for its og:image.
    // Frequently blocked by LinkedIn's anti-bot (status 999), but cheap to try. ──
    try {
      const res = await fetch(profileUrl, {
        headers: BROWSER_HEADERS,
        redirect: 'follow',
        signal: AbortSignal.timeout(9000),
      });
      if (res.ok) {
        const html = await res.text();
        const metaImgs = extractMetaImages(html);
        const best = pickBestMetaImage(metaImgs);
        if (best) {
          const photo_url = await rehostImage(best, 'https://www.linkedin.com/', base44);
          if (photo_url) return Response.json({ photo_url, source: 'linkedin_page' });
        }
      }
    } catch { /* ignore direct fetch failure */ }

    // ── Strategy 3: Ask an LLM with web access to surface the profile photo URL. ──
    try {
      const slug = profileUrl.split('/').pop() || '';
      const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Find the LinkedIn profile photo image URL for the person whose profile is at ${profileUrl} (profile slug: "${slug}"). Return ONLY a direct, currently-valid, publicly accessible image URL of their LinkedIn profile headshot (typically hosted on media.licdn.com). If you cannot find one, return an empty string.`,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: { type: 'object', properties: { photo_url: { type: 'string' } } },
      });
      const llmUrl = llm?.photo_url || '';
      if (llmUrl && /^https?:\/\//i.test(llmUrl)) {
        const photo_url = await rehostImage(llmUrl, 'https://www.linkedin.com/', base44);
        if (photo_url) return Response.json({ photo_url, source: 'llm_web' });
      }
    } catch { /* ignore LLM fallback failure */ }

    const reason = websiteUrl
      ? 'Could not find a profile photo on the firm website near this LinkedIn link, and LinkedIn blocked direct access. You can upload a photo manually.'
      : 'No firm website is on file to search for the headshot, and LinkedIn blocked direct access. Add a firm website or upload a photo manually.';
    return Response.json({ photo_url: '', message: reason });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to extract LinkedIn photo' }, { status: 500 });
  }
});