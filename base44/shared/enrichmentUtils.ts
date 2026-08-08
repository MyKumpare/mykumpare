// Shared utilities for enrichment backend functions — browser headers,
// HTML-to-text conversion, page fetching, phone parsing, and string cleanup.
// Imported by enrichFirmFromWebsite, enrichFirmContactsBios, and
// scrapeContactProfilePage to avoid duplicated logic.

import { assertSafePublicUrl } from './urlSafety.ts';

export const CONSENT_COOKIES = [
  'CookieConsent={stamp%3D%27-consented%27%2Cnecessary%3Atrue%2Cpreferences%3Atrue%2Cstatistics%3Atrue%2Cmarketing%3Atrue%2Cmethod%3A%27explicit%27%2Cver%3A1}',
  'OptanonConsent=isIABGlobal=false&datestamp=Mon+Jan+01+2024+00%3A00%3A00+GMT-0000&version=6.30.0&consentId=consent&interactionCount=1&landingPath=NotLandingPage&groups=C0001%3A1%2CC0002%3A1%2CC0003%3A1%2CC0004%3A1%2CC0005%3A1',
  'cookieconsent_status=allow',
].join('; ');

export function browserHeaders(cookieHeader: string): Record<string, string> {
  return {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'Cookie': cookieHeader,
  };
}

export function cleanStr(v: any): any {
  if (v == null) return '';
  const s = String(v).trim().toLowerCase();
  if (['null', 'undefined', 'n/a', 'na', 'none', 'not provided', 'not available', 'unknown', '-'].includes(s)) return '';
  return v;
}

export function parsePhone(raw: string): any {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 10) {
    return { country_code: '1', area_code: digits.slice(0, 3), number_mid: digits.slice(3, 6), number_last: digits.slice(6, 10), phone_type: '' };
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return { country_code: '1', area_code: digits.slice(1, 4), number_mid: digits.slice(4, 7), number_last: digits.slice(7, 11), phone_type: '' };
  }
  return null;
}

// Convert HTML to text, preserving images as [IMAGE: ...] markers, internal
// and social links as [LINK: ...] markers, and adding newlines for accordion
// elements (details, summary, dt, dd, button, label, etc.) so collapsible
// section content is not merged into a single block.
export function htmlToText(html: string, baseUrl: string): string {
  let result = html.replace(/<img[^>]*>/gi, (match) => {
    const srcMatch = match.match(/\ssrc\s*=\s*["']([^"']+)["']/i) ||
      match.match(/\sdata-src\s*=\s*["']([^"']+)["']/i);
    const altMatch = match.match(/\salt\s*=\s*["']([^"']*)["']/i);
    let src = srcMatch ? srcMatch[1].trim() : '';
    if (!src || src.startsWith('data:')) return '';
    try { src = new URL(src, baseUrl).href; } catch { return ''; }
    return `\n[IMAGE: alt="${altMatch ? altMatch[1] : ''}" src="${src}"]\n`;
  });
  let baseHost = '';
  try { baseHost = new URL(baseUrl).host.toLowerCase(); } catch { /* ignore */ }
  result = result.replace(/<a\s[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, text) => {
    const cleanText = text.replace(/<[^>]+>/g, '').trim();
    try {
      const url = new URL(href.trim(), baseUrl).href;
      let linkHost = '';
      try { linkHost = new URL(url).host.toLowerCase(); } catch { /* ignore */ }
      const isSocial = /linkedin|twitter|x\.com|facebook|instagram|youtube/i.test(url);
      const isInternal = !!baseHost && !!linkHost && linkHost === baseHost;
      if (isSocial || isInternal) return `${cleanText} [LINK: ${url}]`;
    } catch { /* ignore */ }
    return cleanText;
  });
  result = result
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<\/?(div|p|br|h[1-6]|li|ul|ol|span|a|td|tr|table|section|article|main|dt|dd|dl|details|summary|button|label|figcaption|figure|blockquote)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
  return result;
}

// Basic page fetcher with consent cookies and SSRF guard. For the full
// enrichFirmFromWebsite flow (which needs Wayback Machine fallback and dynamic
// consent cookie detection), use its own fetchPage instead.
export async function fetchPage(url: string): Promise<string> {
  try { await assertSafePublicUrl(url); } catch { return ''; }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      headers: browserHeaders(CONSENT_COOKIES),
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) return '';
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text') && !contentType.includes('html')) return '';
    const html = await response.text();
    return htmlToText(html, url);
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
}