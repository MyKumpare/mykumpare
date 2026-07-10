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

      // Fix relative URLs by prepending website base
      if (!absoluteUrl.startsWith('http://') && !absoluteUrl.startsWith('https://')) {
        if (absoluteUrl.startsWith('//')) {
          absoluteUrl = 'https:' + absoluteUrl;
        } else if (absoluteUrl.startsWith('/')) {
          let baseUrl = website || '';
          try {
            const u = new URL(website);
            baseUrl = u.origin;
          } catch {
            // If website is not a valid URL, skip
            results.push({ original: rawUrl, rehosted: null, error: 'relative url without valid website base' });
            continue;
          }
          absoluteUrl = baseUrl + absoluteUrl;
        } else {
          // No protocol and not starting with / — try prepending https://
          absoluteUrl = 'https://' + absoluteUrl;
        }
      }

      try {
        // Download the image
        const fetchResponse = await fetch(absoluteUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/*,*/*;q=0.8',
          },
          redirect: 'follow',
        });

        if (!fetchResponse.ok) {
          results.push({ original: rawUrl, rehosted: null, error: `fetch failed: ${fetchResponse.status}` });
          continue;
        }

        const contentType = fetchResponse.headers.get('content-type') || '';
        if (!contentType.startsWith('image/')) {
          results.push({ original: rawUrl, rehosted: null, error: `not an image: ${contentType}` });
          continue;
        }

        const arrayBuffer = await fetchResponse.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: contentType });

        // Determine file extension
        const ext = contentType.split('/')[1]?.split(';')[0] || 'jpg';
        const filename = `photo_${Date.now()}.${ext}`;
        const file = new File([blob], filename, { type: contentType });

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