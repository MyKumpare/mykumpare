import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { image_urls, website } = await req.json();
    if (!Array.isArray(image_urls) || image_urls.length === 0) {
      return Response.json({ results: [] });
    }

    const results = [];

    for (const rawUrl of image_urls) {
      if (!rawUrl || typeof rawUrl !== 'string') {
        results.push({ original: rawUrl, rehosted: null, error: 'empty or invalid url' });
        continue;
      }

      let absoluteUrl = rawUrl.trim();
      let refererUrl = website || '';

      // Fix relative URLs by resolving against the website base
      if (!absoluteUrl.startsWith('http://') && !absoluteUrl.startsWith('https://')) {
        if (absoluteUrl.startsWith('//')) {
          absoluteUrl = 'https:' + absoluteUrl;
        } else if (website) {
          try {
            absoluteUrl = new URL(absoluteUrl, website).href;
          } catch {
            results.push({ original: rawUrl, rehosted: null, error: 'could not resolve relative url' });
            continue;
          }
        } else {
          // No website base — try prepending https://
          absoluteUrl = 'https://' + absoluteUrl;
        }
      }

      // Extract origin for Referer header to bypass hotlink protection
      try {
        const u = new URL(absoluteUrl);
        refererUrl = u.origin + '/';
      } catch {
        // keep default
      }

      try {
        // Download the image — include Referer header to bypass hotlink protection
        const fetchResponse = await fetch(absoluteUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/*,*/*;q=0.8',
            'Referer': refererUrl,
          },
          redirect: 'follow',
        });

        if (!fetchResponse.ok) {
          results.push({ original: rawUrl, rehosted: null, error: `fetch failed: ${fetchResponse.status}` });
          continue;
        }

        const contentType = fetchResponse.headers.get('content-type') || '';
        // Accept image/* and also application/octet-stream (some servers use this for images)
        const isImage = contentType.startsWith('image/') || contentType === 'application/octet-stream';
        if (!isImage) {
          results.push({ original: rawUrl, rehosted: null, error: `not an image: ${contentType}` });
          continue;
        }

        // For octet-stream, try to infer type from URL extension
        let finalContentType = contentType;
        if (contentType === 'application/octet-stream') {
          const ext = absoluteUrl.split('.').pop()?.toLowerCase().split('?')[0] || '';
          if (ext === 'png') finalContentType = 'image/png';
          else if (ext === 'webp') finalContentType = 'image/webp';
          else if (ext === 'gif') finalContentType = 'image/gif';
          else if (ext === 'svg') finalContentType = 'image/svg+xml';
          else finalContentType = 'image/jpeg';
        }

        const arrayBuffer = await fetchResponse.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: finalContentType });

        // Determine file extension
        const ext = finalContentType.split('/')[1]?.split(';')[0] || 'jpg';
        const filename = `photo_${Date.now()}.${ext}`;
        const file = new File([blob], filename, { type: finalContentType });

        // Upload to Base44 storage
        const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

        results.push({ original: rawUrl, rehosted: file_url, error: null });
      } catch (err) {
        results.push({ original: rawUrl, rehosted: null, error: err.message || 'unknown error' });
      }
    }

    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});