// Shared "Powered by MyKumpare" branding for all reports.
// - Online / print reports use <ReportBrandingFooter /> (see ReportBrandingFooter.jsx).
// - PDF (jsPDF) reports call drawMyKumpareBranding(doc) before doc.save().
//
// The app logo is an SVG (/icon.svg) which jsPDF cannot embed directly, so we
// rasterize it once to a PNG data URL at module load and cache it. By the time a
// user exports a PDF the logo is ready; if not yet loaded we fall back to text.

export const MYKUMPARE_LOGO_SRC = "/icon.svg";
export const MYKUMPARE_BRAND = "MyKumpare";

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

const INK = [79, 70, 229];   // indigo-600, matches the logo background
const MUTED = [120, 128, 140];

/**
 * Draws the MyKumpare logo + "Powered by MyKumpare" at the LOWER-LEFT of every
 * page of a jsPDF document. Synchronous — uses the cached raster if available,
 * otherwise draws a text-only badge. Call this right before doc.save().
 *
 * @param {jsPDF} doc
 * @param {object} [opts] - { margin=36, logoHeight=15, gap=6 }
 */
export function drawMyKumpareBranding(doc, opts = {}) {
  const margin = opts.margin ?? 36;
  const logoH = opts.logoHeight ?? 15;
  const gap = opts.gap ?? 6;
  const pageCount = doc.getNumberOfPages();
  const dataUrl = cachedLogoDataUrl;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const labelY = pageH - 12;
    let x = margin;
    if (dataUrl) {
      try {
        doc.addImage(dataUrl, "PNG", x, labelY - logoH, logoH, logoH);
        x += logoH + gap;
      } catch (e) {
        // fall through to text badge
      }
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("Powered by", x, labelY - 4);
    x += doc.getTextWidth("Powered by") + 3;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(MYKUMPARE_BRAND, x, labelY - 4);
  }
}