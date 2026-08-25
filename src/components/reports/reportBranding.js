// Shared "Powered by MyKumpare" branding for all reports.
// - Online / print reports use <ReportBrandingFooter /> (see ReportBrandingFooter.jsx).
// - PDF (jsPDF) reports call drawMyKumpareBranding(doc) before doc.save().
//
// Brand lockup: the MyKumpare mark (rounded square logo) + the "MyKumpare"
// wordmark. The logo is a PNG hosted on the Base44 media CDN; we rasterize it
// once to a data URL at module load so jsPDF can embed it. If the raster is not
// ready yet we fall back to a text-only wordmark.

export const MYKUMPARE_LOGO_SRC =
  "https://media.base44.com/images/public/69b183b0e43025f25a074625/470cd53b5_image.png";
export const MYKUMPARE_BRAND = "MyKumpare";

// Brand ink colors (matched to the supplied wordmark asset).
export const MYKUMPARE_NAVY = "#0E1A29"; // wordmark text
export const MYKUMPARE_NAVY_RGB = [14, 26, 41];
const MUTED_RGB = [120, 128, 140];

let cachedLogoDataUrl = null;
let loadingPromise = null;

function rasterizeLogo() {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 128;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, size, size);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = MYKUMPARE_LOGO_SRC;
  });
}

export function preloadMyKumpareLogo() {
  if (cachedLogoDataUrl || loadingPromise) return loadingPromise;
  loadingPromise = rasterizeLogo()
    .then((url) => { cachedLogoDataUrl = url; })
    .catch(() => { cachedLogoDataUrl = null; });
  return loadingPromise;
}

export function getMyKumpareLogoDataUrl() {
  return cachedLogoDataUrl;
}

// Kick off the preload as soon as this module is imported anywhere in the app.
if (typeof document !== "undefined") preloadMyKumpareLogo();

/**
 * Draws the MyKumpare logo + wordmark at the LOWER-LEFT of every page of a
 * jsPDF document. Synchronous — uses the cached raster if available, otherwise
 * draws a text-only wordmark. Call this right before doc.save().
 *
 * @param {jsPDF} doc
 * @param {object} [opts] - { margin=36, logoHeight=14, gap=5 }
 */
export function drawMyKumpareBranding(doc, opts = {}) {
  const margin = opts.margin ?? 36;
  const logoH = opts.logoHeight ?? 14;
  const gap = opts.gap ?? 5;
  const pageCount = doc.getNumberOfPages();
  const dataUrl = cachedLogoDataUrl;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const baseline = pageH - 12;
    let x = margin;

    if (dataUrl) {
      try {
        doc.addImage(dataUrl, "PNG", x, baseline - logoH, logoH, logoH);
        x += logoH + gap;
      } catch (e) {
        // fall through to text-only wordmark
      }
    }

    // "Powered by" (muted, small) then the "MyKumpare" wordmark (navy, bold).
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
    doc.text("Powered by", x, baseline - 4);
    x += doc.getTextWidth("Powered by") + 3;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(MYKUMPARE_NAVY_RGB[0], MYKUMPARE_NAVY_RGB[1], MYKUMPARE_NAVY_RGB[2]);
    doc.text(MYKUMPARE_BRAND, x, baseline - 4);
  }
}