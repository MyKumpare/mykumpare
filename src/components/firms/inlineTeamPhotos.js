import { base44 } from "@/api/base44Client";

const CHUNK_SIZE = 12;

// Photos live on hosts that block the cross-origin image access html2canvas
// needs, so captures came out with empty avatar circles. Swapping each photo for
// an inlined data URL (downloaded server-side) fixes the capture.
async function fetchDataUrls(urls) {
  const byUrl = new Map();
  for (let i = 0; i < urls.length; i += CHUNK_SIZE) {
    const chunk = urls.slice(i, i + CHUNK_SIZE);
    try {
      const response = await base44.functions.invoke("inlineImages", { image_urls: chunk });
      const results = response?.data?.results || [];
      for (const result of results) {
        if (result?.data_url) byUrl.set(result.original, result.data_url);
      }
    } catch {
      /* leave these photos as-is */
    }
  }
  return byUrl;
}

/**
 * Replaces every team photo inside `rootEl` with an inlined data URL.
 * Returns a function that restores the original photo sources.
 */
export async function inlineTeamPhotos(rootEl) {
  const noop = () => {};
  if (!rootEl) return noop;

  const imgs = Array.from(rootEl.querySelectorAll("img[data-photo-key]"));
  if (!imgs.length) return noop;

  const originals = imgs.map((img) => img.getAttribute("src") || "");
  const urls = Array.from(
    new Set(imgs.map((img) => img.getAttribute("data-photo-key")).filter(Boolean))
  );
  if (!urls.length) return noop;

  const dataUrls = await fetchDataUrls(urls);
  if (!dataUrls.size) return noop;

  imgs.forEach((img) => {
    const dataUrl = dataUrls.get(img.getAttribute("data-photo-key"));
    if (dataUrl) img.setAttribute("src", dataUrl);
  });

  await Promise.all(
    imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()))
  );

  return () => {
    imgs.forEach((img, i) => {
      if (img) img.setAttribute("src", originals[i]);
    });
  };
}