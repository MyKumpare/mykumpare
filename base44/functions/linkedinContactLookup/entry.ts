import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const SUB_PAGES = ['/team', '/about', '/about-us', '/people', '/our-team', '/leadership', '/staff', '/investment-team', '/management', '/bio', '/bios'];

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Extract LinkedIn personal profile URLs (+context) from a chunk of HTML/text
function extractLinkedinUrls(text) {
  const found = new Map(); // url -> context
  const regex = /https?:\/\/(?:www\.)?linkedin\.com\/(?:in|pub)\/[A-Za-z0-9_\-%]+/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const url = match[0];
    if (!found.has(url)) {
      const start = Math.max(0, match.index - 250);
      const end = Math.min(text.length, match.index + url.length + 250);
      const context = text.slice(start, end).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      found.set(url, context);
    }
  }
  return found;
}

// Score a candidate LinkedIn URL against the target name
function scoreCandidate(url, context, firstNameLower, lastNameLower) {
  const contextLower = (context || '').toLowerCase();
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
  return { url, score, context };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { first_name, last_name, firm_id, website, current_title } = body || {};
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
    let firmName = '';
    if (!websiteUrl && firm_id) {
      try {
        const firm = await base44.asServiceRole.entities.Firm.get(firm_id);
        websiteUrl = firm?.website;
        firmName = firm?.name || '';
      } catch { /* ignore */ }
    }

    // ── Strategy 1: Scrape the firm website for LinkedIn links ──
    let websiteCandidates = new Map();
    if (websiteUrl) {
      if (!websiteUrl.startsWith('http')) websiteUrl = 'https://' + websiteUrl;
      let baseUrl;
      try { baseUrl = new URL(websiteUrl); } catch { baseUrl = null; }
      if (baseUrl) {
        const origin = baseUrl.origin;
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
          for (const [url, ctx] of found.entries()) {
            if (!websiteCandidates.has(url)) websiteCandidates.set(url, ctx);
          }
        }
      }
    }

    // Score website candidates
    let websiteMatches = [];
    for (const [url, ctx] of websiteCandidates.entries()) {
      const c = scoreCandidate(url, ctx, firstNameLower, lastNameLower);
      if (c.score > 0) websiteMatches.push(c);
    }
    websiteMatches.sort((a, b) => b.score - a.score);

    if (websiteMatches.length > 0 && websiteMatches[0].score >= 3) {
      return Response.json({
        linkedin_url: websiteMatches[0].url,
        confidence: websiteMatches[0].score >= 5 ? 'high' : 'medium',
        source: 'firm_website',
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
        for (const [url, ctx] of searchCandidates.entries()) {
          const c = scoreCandidate(url, ctx, firstNameLower, lastNameLower);
          if (c.score > 0) searchMatches.push(c);
        }
        searchMatches.sort((a, b) => b.score - a.score);
      }
    } catch (e) { ddgDiag = 'err=' + (e.message || String(e)); }

    if (searchMatches.length > 0 && searchMatches[0].score >= 3) {
      return Response.json({
        linkedin_url: searchMatches[0].url,
        confidence: searchMatches[0].score >= 5 ? 'high' : 'medium',
        source: 'web_search',
      });
    }

    // Combine best efforts for a low-confidence result
    const allMatches = [...websiteMatches, ...searchMatches].sort((a, b) => b.score - a.score);
    if (allMatches.length > 0) {
      return Response.json({
        linkedin_url: allMatches[0].url,
        confidence: 'low',
        source: websiteMatches.length > 0 ? 'firm_website' : 'web_search',
        message: 'A possible match was found but with low confidence. Please verify before saving.',
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