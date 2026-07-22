import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const SUB_PAGES = ['/about', '/about-us', '/contact', '/contact-us', '/team', '/our-team', '/leadership', '/connect', '/company'];

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Extract LinkedIn company page URLs (+ surrounding context) from a chunk of HTML/text
function extractCompanyLinkedinUrls(text) {
  const found = new Map(); // url -> context
  const regex = /https?:\/\/(?:www\.)?linkedin\.com\/company\/[A-Za-z0-9_\-%./]+/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    // Strip trailing path fragments, query and hash so we keep the bare company URL
    let url = match[0].replace(/[?#].*$/, '');
    const parts = url.split('/company/');
    const slug = parts[1] || '';
    // Keep only the first path segment of the slug (drop extra sub-paths like /posts)
    const firstSeg = slug.split('/')[0];
    url = `https://www.linkedin.com/company/${firstSeg}`;
    if (!found.has(url)) {
      const start = Math.max(0, match.index - 200);
      const end = Math.min(text.length, match.index + url.length + 200);
      const context = text.slice(start, end).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      found.set(url, context);
    }
  }
  return found;
}

function slugify(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 40);
}

function scoreCandidate(url, context, nameSlug, nameTokens) {
  const slugLower = (url.split('/company/')[1] || '').toLowerCase();
  let score = 1;
  if (nameSlug && slugLower.includes(nameSlug)) score += 4;
  for (const t of nameTokens) {
    if (t.length > 2 && slugLower.includes(t)) score += 1;
  }
  return { url, score, context };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    let { firm_id, website, name } = body || {};

    // Resolve missing website / name from the firm record when available
    if ((!website || !name) && firm_id) {
      try {
        const firm = await base44.asServiceRole.entities.Firm.get(firm_id);
        if (!website) website = firm?.website;
        if (!name) name = firm?.name;
      } catch { /* ignore */ }
    }

    if (!name) {
      return Response.json({ error: 'Firm name is required' }, { status: 400 });
    }

    const nameSlug = slugify(name);
    const nameTokens = (name.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2));

    let websiteUrl = website;
    if (websiteUrl && !websiteUrl.startsWith('http')) websiteUrl = 'https://' + websiteUrl;

    // ── Strategy: scrape the firm's own website for LinkedIn company links ──
    // The firm's site (footer / social / about pages) is the most reliable source
    // for its company LinkedIn page. Web search is deliberately avoided here: it
    // is frequently blocked by the host environment and times out.
    let candidates = new Map();
    if (websiteUrl) {
      let baseUrl;
      try { baseUrl = new URL(websiteUrl); } catch { baseUrl = null; }
      if (baseUrl) {
        const origin = baseUrl.origin;
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
        for (const html of pages) {
          if (!html) continue;
          const found = extractCompanyLinkedinUrls(html);
          for (const [url, ctx] of found.entries()) {
            if (!candidates.has(url)) candidates.set(url, ctx);
          }
        }
      }
    }

    let matches = [];
    for (const [url, ctx] of candidates.entries()) {
      matches.push(scoreCandidate(url, ctx, nameSlug, nameTokens));
    }
    matches.sort((a, b) => b.score - a.score);

    if (matches.length > 0) {
      const best = matches[0];
      return Response.json({
        linkedin_url: best.url,
        confidence: best.score >= 4 ? 'high' : best.score >= 2 ? 'medium' : 'low',
        source: 'firm_website',
      });
    }

    // ── Strategy 2: DuckDuckGo Lite search for the LinkedIn company page ──
    // Mirrors the contact lookup: many firm sites render social links via JS
    // (absent from static HTML), so a web search is a reliable fallback.
    const query = encodeURIComponent(`${name} site:linkedin.com/company`).replace(/%20/g, '+');
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
        // DDG lite encodes result URLs inside uddg= params; decode them first
        const decodedHtml = html.replace(/uddg=([^&"']+)/g, (m, p1) => {
          try { return ' ' + decodeURIComponent(p1) + ' '; } catch { return m; }
        });
        const searchCandidates = extractCompanyLinkedinUrls(decodedHtml);
        ddgDiag += ` found=${searchCandidates.size}`;
        for (const [url, ctx] of searchCandidates.entries()) {
          searchMatches.push(scoreCandidate(url, ctx, nameSlug, nameTokens));
        }
        searchMatches.sort((a, b) => b.score - a.score);
      }
    } catch (e) { ddgDiag = 'err=' + (e.message || String(e)); }

    if (searchMatches.length > 0 && searchMatches[0].score >= 2) {
      return Response.json({
        linkedin_url: searchMatches[0].url,
        confidence: searchMatches[0].score >= 4 ? 'high' : 'medium',
        source: 'web_search',
      });
    }

    const reason = !websiteUrl
      ? "The firm has no website on file, so its LinkedIn page could not be found automatically."
      : "No LinkedIn company page was found on the firm's website. You can enter the URL manually.";
    return Response.json({ linkedin_url: '', message: reason });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to lookup LinkedIn company page' }, { status: 500 });
  }
});