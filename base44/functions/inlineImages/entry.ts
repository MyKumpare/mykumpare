import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { assertSafePublicUrl } from '../../shared/urlSafety.ts';

const MAX_BYTES = 3 * 1024 * 1024;
const BATCH_LIMIT = 25;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(binary);
}

// Downloads images server-side and returns them as data URLs, so clients can
// render them into a canvas or printout without cross-origin restrictions.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { image_urls } = await req.json().catch(() => ({} as any));
    if (!Array.isArray(image_urls) || image_urls.length === 0) {
      return Response.json({ results: [] });
    }

    const targets = image_urls.slice(0, BATCH_LIMIT);

    const results = await Promise.all(
      targets.map(async (rawUrl: unknown) => {
        if (typeof rawUrl !== 'string' || !/^https?:\/\//i.test(rawUrl)) {
          return { original: rawUrl, data_url: null, error: 'invalid url' };
        }
        try {
          await assertSafePublicUrl(rawUrl);
          let referer = '';
          try {
            referer = new URL(rawUrl).origin + '/';
          } catch {
            referer = '';
          }

          const response = await fetch(rawUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'image/*,*/*;q=0.8',
              ...(referer ? { 'Referer': referer } : {}),
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(15000),
          });

          if (!response.ok) {
            return { original: rawUrl, data_url: null, error: `fetch failed: ${response.status}` };
          }

          const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
          if (!contentType.startsWith('image/')) {
            return { original: rawUrl, data_url: null, error: `not an image: ${contentType || 'unknown'}` };
          }
          if (contentType === 'image/svg+xml') {
            return { original: rawUrl, data_url: null, error: 'unsupported image type' };
          }

          const buffer = await response.arrayBuffer();
          if (buffer.byteLength > MAX_BYTES) {
            return { original: rawUrl, data_url: null, error: 'image too large' };
          }

          return { original: rawUrl, data_url: `data:${contentType};base64,${toBase64(buffer)}`, error: null };
        } catch (err) {
          return { original: rawUrl, data_url: null, error: (err as Error)?.message || 'unknown error' };
        }
      })
    );

    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}