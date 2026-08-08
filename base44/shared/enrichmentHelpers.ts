// Shared helpers for firm enrichment functions — person validation, embedded
// data extraction, and category-filter URL discovery.

export function resolveUrl(base: string, path: string): string {
  try {
    return new URL(path, base).href;
  } catch {
    return '';
  }
}

// Common document/report keywords that indicate a URL slug is NOT a person
// name. Used to filter out non-person pages (documents, reports, articles,
// etc.) that happen to be under /people/ or /team/ paths.
export const DOC_KEYWORDS = new Set([
  'market', 'markets', 'review', 'outlook', 'quarter', 'report', 'strategy', 'strategies',
  'management', 'indices', 'index', 'transition', 'trend', 'trends', 'following',
  'sustainability', 'sustainable', 'whitepaper', 'paper', 'article', 'blog',
  'newsletter', 'bulletin', 'commentary', 'analysis', 'overview', 'guide',
  'handbook', 'policy', 'webinar', 'conference', 'presentation', 'committee',
  'department', 'division', 'portfolio', 'investment', 'benchmark', 'performance',
  'summary', 'annual', 'quarterly', 'monthly', 'weekly', 'daily',
  'world', 'global', 'macroeconomic', 'macro', 'interest', 'rate', 'rates',
  'environment', 'zero', 'bound', 'low', 'todays', 'today', 'update',
  'insight', 'insights', 'research', 'study', 'survey', 'poll',
  'fund', 'funds', 'product', 'products', 'offering', 'asset', 'class',
  'esg', 'impact', 'responsible', 'green', 'private', 'public', 'alternative',
  'hedge', 'commodity', 'currency', 'yield', 'duration', 'risk', 'return',
  'fixed', 'income', 'bond', 'bonds', 'equity', 'equities',
]);

// Check if a URL slug is likely a person name (not a document, report, or
// other non-person page). Used to filter out non-person URLs from the
// sitemap/link discovery before creating lightweight contact entries.
export function isLikelyPersonSlug(slug: string): boolean {
  if (!slug || slug === '#') return false;
  const lower = slug.toLowerCase();

  // Allow roman numeral / suffix endings: "john-smith-ii", "john-smith-jr"
  const withoutSuffix = lower.replace(/-(?:ii|iii|iv|v|jr|sr|esq)$/, '');

  // Reject slugs with numbers (person name slugs rarely have numbers)
  if (/\d/.test(withoutSuffix)) return false;

  const words = withoutSuffix.split(/-/).filter(Boolean);

  // Reject slugs with too many words (> 4) — person names are typically 2-3 words
  if (words.length > 4) return false;
  // Reject single-word slugs — person names have at least 2 parts
  if (words.length < 2) return false;

  // Reject slugs that contain any document/report keyword
  for (const word of words) {
    if (DOC_KEYWORDS.has(word)) return false;
  }

  return true;
}

// Extract person data from embedded JSON in <script> tags. Many WordPress
// sites render team grids via JavaScript, with the person data embedded as a
// JSON data object inside a <script> tag (often a page-builder data object).
// Without this, the htmlToText() function strips all <script> tags and the
// person data is completely lost — only a few people (found on other pages)
// are extracted instead of the full team.
export function extractPersonDataFromScripts(html: string): string {
  const markers: string[] = [];
  const seen = new Set<string>();

  // Find all <script> tag contents
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    const content = scriptMatch[1];
    if (!content.includes('/person/') || !content.includes('"permalink"')) continue;

    // Find all person permalink URLs and extract surrounding data fields.
    // Each person object typically has: permalink, title, roles[], image{imgSrc}
    const permalinkRegex = /"permalink"\s*:\s*"(https?:\/\/[^"]*\/person\/[^"]+)"/gi;
    let pMatch: RegExpExecArray | null;
    while ((pMatch = permalinkRegex.exec(content)) !== null) {
      const permalink = pMatch[1];
      if (seen.has(permalink)) continue;
      seen.add(permalink);

      // Look for title, roles, and imgSrc within a window AFTER the permalink.
      // IMPORTANT: start at pMatch.index (NOT pMatch.index - 500) so the regex
      // doesn't match the PREVIOUS person's title/roles/imgSrc that appears
      // before the current permalink in the JSON.
      const windowStart = pMatch.index;
      const windowEnd = Math.min(content.length, pMatch.index + 2000);
      const window = content.substring(windowStart, windowEnd);

      // Extract title (person name)
      const titleMatch = window.match(/"title"\s*:\s*"([^"]+)"/);
      const name = titleMatch ? titleMatch[1] : '';
      if (!name) continue;

      // Extract roles
      const rolesMatch = window.match(/"roles"\s*:\s*\[([\s\S]*?)\]/);
      let roles = '';
      if (rolesMatch) {
        roles = rolesMatch[1]
          .split(',')
          .map((r) => r.replace(/"/g, '').trim())
          .filter(Boolean)
          .join('; ');
      }

      // Extract image URL
      const imgMatch = window.match(/"imgSrc"\s*:\s*"([^"]+)"/);
      const photoUrl = imgMatch ? imgMatch[1] : '';

      let marker = `[PERSON: name="${name}"`;
      if (roles) marker += ` title="${roles}"`;
      if (photoUrl) marker += ` photo_url="${photoUrl}"`;
      marker += ` bio_url="${permalink}"]`;
      markers.push(marker);
    }
  }

  return markers.length > 0
    ? '\n--- Embedded Team Data ---\n' + markers.join('\n') + '\n--- End Team Data ---\n'
    : '';
}

// Scan raw HTML of a team page for category-filter URLs that might not be
// captured by htmlToText (e.g., links in <button> tags, data-href/data-url
// attributes, onclick handlers). Returns category-specific URLs to fetch.
// Many sites organize their team page with category filters (e.g.,
// "Investment Professional", "Management", "Board Member") where each
// category is a separate page or has query parameters.
export function discoverCategoryUrlsFromHtml(
  rawHtml: string,
  pageUrl: string,
  website: string,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  let baseHost = '';
  try { baseHost = new URL(website).host.toLowerCase(); } catch { /* ignore */ }

  const teamPathRegex = /\/(people|our-people|team|our-team|leadership|staff|personnel|professionals|board|trustees)\b/i;

  // Extract URLs from href, data-href, data-url, data-target attributes
  const attrRegex = /(?:href|data-href|data-url|data-target|data-link)\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(rawHtml)) !== null) {
    const path = match[1].trim();
    if (!path || path.startsWith('#') || path.startsWith('javascript:') || path.startsWith('mailto:') || path.startsWith('tel:')) continue;
    const url = resolveUrl(pageUrl, path);
    if (!url) continue;
    let linkHost = '';
    let linkPath = '';
    let linkSearch = '';
    try {
      const u = new URL(url);
      linkHost = u.host.toLowerCase();
      linkPath = u.pathname;
      linkSearch = u.search;
    } catch { continue; }
    if (linkHost !== baseHost) continue;
    if (url === pageUrl || url === website) continue;
    if (!teamPathRegex.test(linkPath)) continue;

    // Include sub-paths and query-parameter variants of team pages
    const lastSegment = (linkPath.match(/\/([^/]+)\/?$/) || ['', ''])[1];
    const hasSubPath = lastSegment && !teamPathRegex.test('/' + lastSegment + '/');
    if (hasSubPath || linkSearch) {
      if (!seen.has(url)) {
        seen.add(url);
        result.push(url);
      }
    }
  }

  // Also look for URLs in onclick handlers (e.g., onclick="window.location='/team/...'")
  const onclickRegex = /onclick\s*=\s*["'](?:[^"']*)(?:window\.location|location\.href|location\.assign)\s*=\s*['"]([^'"]+)['"]/gi;
  while ((match = onclickRegex.exec(rawHtml)) !== null) {
    const path = match[1].trim();
    if (!path) continue;
    const url = resolveUrl(pageUrl, path);
    if (!url) continue;
    let linkHost = '';
    let linkPath = '';
    try {
      const u = new URL(url);
      linkHost = u.host.toLowerCase();
      linkPath = u.pathname;
    } catch { continue; }
    if (linkHost !== baseHost) continue;
    if (url === pageUrl || url === website) continue;
    if (!teamPathRegex.test(linkPath)) continue;
    if (!seen.has(url)) {
      seen.add(url);
      result.push(url);
    }
  }

  return result.slice(0, 8);
}