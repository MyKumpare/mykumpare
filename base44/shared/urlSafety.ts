/**
 * Shared URL safety validation to prevent Server-Side Request Forgery (SSRF).
 *
 * Blocks requests whose target hostname is (or resolves to) a loopback,
 * private (RFC 1918), link-local, unique-local, multicast, or otherwise
 * reserved address before any outbound fetch is performed.
 *
 * Used by backend functions that accept user-controlled URLs.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "broadcasthost",
  "metadata.google.internal",
]);

/** Returns true when an IPv4 or IPv6 literal is internal/reserved. */
function isBlockedIp(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");

  // IPv4
  const v4 = v.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = parseInt(v4[1], 10);
    const b = parseInt(v4[2], 10);
    if (a === 0) return true; // 0.0.0.0/8 "this" network
    if (a === 10) return true; // 10.0.0.0/8 private
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a >= 224 && a <= 239) return true; // 224.0.0.0/4 multicast
    if (a === 255) return true; // 255.255.255.255 broadcast
    return false;
  }

  // IPv6
  if (v === "::1" || v === "0:0:0:0:0:0:0:1") return true; // loopback
  if (v === "::" || v === "0:0:0:0:0:0:0:0") return true; // unspecified
  if (v.startsWith("fe80")) return true; // link-local fe80::/10
  if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique local fc00::/7
  if (v.startsWith("ff")) return true; // multicast ff00::/8
  if (v.startsWith("64:ff9b")) return true; // NAT64 well-known prefix
  return false;
}

/** Checks a hostname string (without DNS) for obvious internal targets. */
function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) return true;
  // IP literal host
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")) {
    return isBlockedIp(h);
  }
  return false;
}

/** Resolves A + AAAA records; returns [] when resolution is unavailable. */
async function resolveAddresses(hostname: string): Promise<string[]> {
  const out: string[] = [];
  try {
    const a = await Deno.resolveDns(hostname, "A");
    if (Array.isArray(a)) out.push(...a);
  } catch { /* ignore A lookup failures */ }
  try {
    const aaaa = await Deno.resolveDns(hostname, "AAAA");
    if (Array.isArray(aaaa)) out.push(...aaaa);
  } catch { /* ignore AAAA lookup failures */ }
  return out;
}

/**
 * Validates that `rawUrl` is an http(s) URL whose host is not an obvious
 * internal target and does not resolve to a private/reserved address.
 * Throws on rejection; returns the parsed URL on success.
 */
export async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed");
  }
  if (isBlockedHostname(url.hostname)) {
    throw new Error("Requests to internal, private, or reserved hosts are not allowed");
  }
  const addrs = await resolveAddresses(url.hostname);
  for (const a of addrs) {
    if (isBlockedIp(a)) {
      throw new Error("Host resolves to an internal, private, or reserved address");
    }
  }
  return url;
}