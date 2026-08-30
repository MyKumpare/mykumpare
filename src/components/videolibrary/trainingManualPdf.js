import { jsPDF } from "jspdf";

/**
 * Generates a training manual PDF from the LLM-generated manual content
 * and the extracted frame screenshots (as data URLs).
 *
 * @param {Object} manual — { title, intro, steps: [{ step_number, title, screenshot_index, instructions }] }
 * @param {string[]} frameDataUrls — array of JPEG data URLs for each extracted frame
 * @param {string} videoTitle — title of the source video (for filename and header)
 */
export function generateTrainingManualPdf(manual, frameDataUrls, videoTitle) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  const brandingY = pageHeight - 12;

  // ── Cover / title area ──
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(manual.title || "Training Manual", margin, 35);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(130);
  doc.text(`Generated from video: ${videoTitle}`, margin, 42);
  doc.setTextColor(0);

  if (manual.intro) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const introLines = doc.splitTextToSize(manual.intro, contentWidth);
    doc.text(introLines, margin, 52);
  }

  let y = 65;

  // ── Steps ──
  for (const step of manual.steps || []) {
    // Step heading — check space
    if (y > brandingY - 50) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    const heading = `Step ${step.step_number}: ${step.title || ""}`;
    const headingLines = doc.splitTextToSize(heading, contentWidth);
    doc.text(headingLines, margin, y);
    y += headingLines.length * 6 + 3;

    // Screenshot
    const idx = Math.max(0, Math.min(frameDataUrls.length - 1, step.screenshot_index ?? 0));
    const dataUrl = frameDataUrls[idx];
    if (dataUrl) {
      try {
        const imgProps = doc.getImageProperties(dataUrl);
        const imgW = contentWidth;
        const imgH = (imgProps.height * imgW) / imgProps.width;
        // Cap image height to keep it reasonable
        const maxImgH = 120;
        const finalH = Math.min(imgH, maxImgH);
        const finalW = imgH > maxImgH ? (imgW * maxImgH) / imgH : imgW;
        const xOffset = margin + (contentWidth - finalW) / 2;

        if (y + finalH > brandingY - 8) {
          doc.addPage();
          y = margin;
        }
        doc.addImage(dataUrl, "JPEG", xOffset, y, finalW, finalH);
        y += finalH + 4;
      } catch {
        // Skip image if it can't be processed
      }
    }

    // Instructions
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(step.instructions || "", contentWidth);
    if (y + lines.length * 5 > brandingY - 8) {
      doc.addPage();
      y = margin;
    }
    doc.text(lines, margin, y);
    y += lines.length * 5 + 10;
  }

  // ── Branding footer on every page ──
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(160);
    doc.text("Powered by MyKumpare", margin, brandingY);
  }

  const safeName = (videoTitle || "training-manual").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
  doc.save(`${safeName}-training-manual.pdf`);
}