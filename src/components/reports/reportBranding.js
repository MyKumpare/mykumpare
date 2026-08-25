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
const INK_RGB = [31, 41, 55];
const BORDER_RGB = [226, 232, 240];

/**
 * Rasterizes an arbitrary image URL (e.g. a firm logo) to a PNG data URL so
 * jsPDF can embed it. Returns null if the image cannot be loaded (CORS / 404).
 */
export function rasterizeImage(url, size = 128) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, size, size);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

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

/**
 * Draws the branded HEADER band at the top of the CURRENT page only:
 * MyKumpare mark + wordmark on the left, the generating firm's logo + name on
 * the right, with a thin divider beneath. Returns the y position where page
 * content can begin. Caller is responsible for invoking this on every page.
 *
 * @param {jsPDF} doc
 * @param {object} [opts] - { margin=36, bandH=40, logoHeight=16, gap=5, top=0, firmName, firmLogoDataUrl }
 */
export function drawHeaderBand(doc, opts = {}) {
  const margin = opts.margin ?? 36;
  const bandH = opts.bandH ?? 40;
  const logoH = opts.logoHeight ?? 16;
  const gap = opts.gap ?? 5;
  const top = opts.top ?? 0;
  const pageW = doc.internal.pageSize.getWidth();
  const baseline = top + bandH / 2 + 3;

  // ── Left: MyKumpare mark + "Powered by MyKumpare" wordmark ──
  let x = margin;
  const dataUrl = cachedLogoDataUrl;
  if (dataUrl) {
    try {
      doc.addImage(dataUrl, "PNG", x, baseline - logoH / 2, logoH, logoH);
      x += logoH + gap;
    } catch (e) { /* fall through to text-only */ }
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
  doc.text("Powered by", x, baseline - 3);
  x += doc.getTextWidth("Powered by") + 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(MYKUMPARE_NAVY_RGB[0], MYKUMPARE_NAVY_RGB[1], MYKUMPARE_NAVY_RGB[2]);
  doc.text(MYKUMPARE_BRAND, x, baseline - 3);

  // ── Right: firm logo + firm name ──
  if (opts.firmName || opts.firmLogoDataUrl) {
    let rightX = pageW - margin;
    if (opts.firmName) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
      const nameW = doc.getTextWidth(opts.firmName);
      rightX -= nameW;
      doc.text(opts.firmName, rightX, baseline - 3);
      rightX -= gap;
    }
    if (opts.firmLogoDataUrl) {
      try {
        rightX -= logoH;
        doc.addImage(opts.firmLogoDataUrl, "PNG", rightX, baseline - logoH / 2, logoH, logoH);
      } catch (e) { /* ignore broken firm logo */ }
    }
  }

  // ── Divider under the band ──
  doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, top + bandH, pageW - margin, top + bandH);

  return top + bandH + 10;
}

/**
 * Draws the full branded report header on the FIRST page: header band (logos)
 * + report title + optional subtitle line. Returns the y where content begins.
 */
export function drawReportHeader(doc, opts = {}) {
  const margin = opts.margin ?? 36;
  let y = drawHeaderBand(doc, opts);
  if (opts.title) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
    doc.text(opts.title, margin, y + 6);
    y += 22;
  }
  if (opts.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
    doc.text(opts.subtitle, margin, y);
    y += 12;
  }
  return y + 4;
}