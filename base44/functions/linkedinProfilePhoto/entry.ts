import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  BROWSER_HEADERS, extractLinkedinUrls, pickBestImage, pickBestImageOnPage, pickHeadshotByName,
  rehostImage, fetchFirmPages, fetchPage, linkedinSlug,
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
    const targetSlug = linkedinSlug(profileUrl);

    // ── Strategy 1: Scrape the contact's firm website for the headshot near
    // this LinkedIn profile link. Matches by profile slug (so trailing
    // slashes, www/locale variants still match), extracts lazy-load + CSS
    // background images, and falls back to the best headshot on the whole
    // page or an individual bio page linked nearby. ──
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
        for (const page of pages) {
          if (!page?.html) continue;
          const pageUrl = page.url;
          const found = extractLinkedinUrls(page.html);
          const info = targetSlug ? found.get(targetSlug) : null;
          if (!info?.rawChunk) continue;

          // 1a. Headshot near the LinkedIn link in the raw HTML chunk.
          let imgUrl = pickBestImage(info.rawChunk, info.linkOffsetInChunk, pageUrl, firstNameLower, lastNameLower);
          // 1b. Fall back to the best headshot-like image anywhere on the page.
          if (!imgUrl) imgUrl = pickBestImageOnPage(page.html, pageUrl, firstNameLower, lastNameLower);
          // 1c. Try an individual bio page linked near the LinkedIn link.
          if (!imgUrl) {
            const bioLinks = [...info.rawChunk.matchAll(/<a[^>]*\shref=["'](\/[^"']+)["']/gi)]
              .map((m) => m[1])
              .filter((href) => /bio|profile|team|member|staff|people|leadership/i.test(href))
              .map((href) => { try { return new URL(href, pageUrl).href; } catch { return null; } })
              .filter(Boolean);
            for (const bioUrl of bioLinks.slice(0, 3)) {
              const bio = await fetchPage(bioUrl);
              if (!bio?.html) continue;
              const bioImg = pickBestImageOnPage(bio.html, bio.url, firstNameLower, lastNameLower)
                || pickBestImageOnPage(bio.html, bio.url, '', '');
              if (bioImg) { imgUrl = bioImg; break; }
            }
          }
          if (imgUrl) {
            const photo_url = await rehostImage(imgUrl, pageUrl, base44);
            if (photo_url) return Response.json({ photo_url, source: 'firm_website' });
          }
        }

        // ── 1d. Name-based fallback: some firm "people" pages list headshots
        // but do NOT link individual LinkedIn profiles in static HTML. Find the
        // headshot nearest the contact's name instead. ──
        if (targetSlug && (firstNameLower || lastNameLower)) {
          for (const page of pages) {
            if (!page?.html) continue;
            if (!new RegExp(`${firstNameLower}|${lastNameLower}`, 'i').test(page.html)) continue;
            const byName = pickHeadshotByName(page.html, page.url, firstNameLower, lastNameLower);
            if (byName) {
              const photo_url = await rehostImage(byName, page.url, base44);
              if (photo_url) return Response.json({ photo_url, source: 'firm_website_name' });
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