import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const SUB_PAGES = ['/team', '/about', '/about-us', '/people', '/our-team', '/leadership', '/staff', '/investment-team', '/management', '/bio', '/bios'];

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

    // Resolve the firm website URL
    let websiteUrl = website;
    if (!websiteUrl && firm_id) {
      const firm = await base44.asServiceRole.entities.Firm.get(firm_id);
      websiteUrl = firm?.website;
    }
    if (!websiteUrl) {
      return Response.json({ error: 'No website available for this contact\'s firm. Provide a website URL or associate the contact with a firm that has a website.' }, { status: 400 });
    }

    // Normalize the website URL
    if (!websiteUrl.startsWith('http')) websiteUrl = 'https://' + websiteUrl;
    let baseUrl;
    try { baseUrl = new URL(websiteUrl); } catch { return Response.json({ error: 'Invalid website URL' }, { status: 400 }); }
    const origin = baseUrl.origin;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    // Fetch homepage + likely team pages in parallel, collect HTML
    const candidateUrls = [origin, ...SUB_PAGES.map(p => origin + p)];
    const pages = await Promise.all(
      candidateUrls.map(async (u) => {
        try {
          const res = await fetch(u, { headers, redirect: 'follow', signal: AbortSignal.timeout(10000) });
          if (!res.ok) return null;
          const html = await res.text();
          return { url: u, html };
        } catch { return null; }
      })
    );
    const validPages = pages.filter(Boolean);

    if (validPages.length === 0) {
      return Response.json({ linkedin_url: '', message: 'Could not fetch the firm website.' });
    }

    // Extract LinkedIn /in/ URLs with surrounding context from all pages
    const linkedinProfiles = new Map(); // url -> context text
    for (const page of validPages) {
      const html = page.html;
      // Find all LinkedIn personal profile URLs
      const linkedinRegex = /https?:\/\/(?:www\.)?linkedin\.com\/(?:in|pub)\/[A-Za-z0-9_\-%]+/gi;
      let match;
      while ((match = linkedinRegex.exec(html)) !== null) {
        const url = match[0];
        if (!linkedinProfiles.has(url)) {
          // Get surrounding text context (300 chars before and after)
          const start = Math.max(0, match.index - 300);
          const end = Math.min(html.length, match.index + url.length + 300);
          const context = html.slice(start, end).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          linkedinProfiles.set(url, context);
        }
      }
    }

    if (linkedinProfiles.size === 0) {
      return Response.json({ linkedin_url: '', message: 'No LinkedIn profiles found on the firm website.' });
    }

    // Match by name — look for first and last name in the context
    const firstNameLower = first_name.toLowerCase();
    const lastNameLower = last_name.toLowerCase();
    const matches = [];
    for (const [url, context] of linkedinProfiles.entries()) {
      const contextLower = context.toLowerCase();
      const hasLastName = contextLower.includes(lastNameLower);
      const hasFirstName = contextLower.includes(firstNameLower);
      // The LinkedIn URL slug itself often contains the name
      const slugLower = url.toLowerCase();
      const slugHasLastName = slugLower.includes(lastNameLower);
      const slugHasFirstName = slugLower.includes(firstNameLower);

      let score = 0;
      if (slugHasLastName) score += 3;
      if (slugHasFirstName) score += 2;
      if (hasLastName) score += 2;
      if (hasFirstName) score += 1;
      if (score > 0) matches.push({ url, score, context });
    }

    matches.sort((a, b) => b.score - a.score);

    if (matches.length === 0) {
      return Response.json({ linkedin_url: '', message: `No LinkedIn profile found matching ${first_name} ${last_name} on the firm website.` });
    }

    return Response.json({
      linkedin_url: matches[0].url,
      confidence: matches[0].score >= 5 ? 'high' : matches[0].score >= 3 ? 'medium' : 'low',
      headline: '',
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to lookup LinkedIn profile' }, { status: 500 });
  }
});