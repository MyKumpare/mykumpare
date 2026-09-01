import { jsPDF } from "jspdf";
import { drawMyKumpareBranding, preloadMyKumpareLogo } from "@/components/reports/reportBranding";

const EDGE_COLORS = {
  sub_manager: "#6366f1",
  consultant: "#f59e0b",
  shared_contact: "#ec4899",
};

const EDGE_LABELS = {
  sub_manager: "Sub-manager",
  consultant: "Consultant",
  shared_contact: "Shared contact",
};

// Centrality gradient stops (low → high): blue → green → amber → red
const STRENGTH_STOPS = [
  { t: 0,    rgb: [59, 130, 246] },
  { t: 0.33, rgb: [16, 185, 129] },
  { t: 0.66, rgb: [245, 158, 11] },
  { t: 1,    rgb: [239, 68, 68] },
];

/**
 * Returns an [r, g, b] array for a normalized centrality value (0-1).
 */
export function strengthColorRGB(t) {
  const c = Math.max(0, Math.min(1, t));
  for (let i = 0; i < STRENGTH_STOPS.length - 1; i++) {
    const a = STRENGTH_STOPS[i];
    const b = STRENGTH_STOPS[i + 1];
    if (c >= a.t && c <= b.t) {
      const lt = (c - a.t) / (b.t - a.t);
      return [
        Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * lt),
        Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * lt),
        Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * lt),
      ];
    }
  }
  return STRENGTH_STOPS[STRENGTH_STOPS.length - 1].rgb;
}

/**
 * Returns a hex color string for a normalized centrality value (0-1).
 */
export function strengthColorHex(t) {
  const [r, g, b] = strengthColorRGB(t);
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex) {
  const m = hex.replace("#", "").match(/.{2}/g);
  return m ? m.map(h => parseInt(h, 16)) : [0, 0, 0];
}

/**
 * Serializes an SVG element to a standalone SVG string, inlining Tailwind
 * fill classes so the text renders correctly in isolation.
 */
function serializeSvg(svg) {
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  // Inline fill styles for text (Tailwind classes won't resolve in isolation)
  clone.querySelectorAll("text.fill-gray-700").forEach(el => el.setAttribute("fill", "#374151"));
  clone.querySelectorAll("text.fill-gray-400").forEach(el => el.setAttribute("fill", "#9ca3af"));
  clone.querySelectorAll("text.fill-white").forEach(el => el.setAttribute("fill", "#ffffff"));

  const w = svg.width?.baseVal?.value || svg.clientWidth || 800;
  const h = svg.height?.baseVal?.value || svg.clientHeight || 600;
  clone.setAttribute("width", w);
  clone.setAttribute("height", h);
  // White background so the PNG isn't transparent
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", w);
  bg.setAttribute("height", h);
  bg.setAttribute("fill", "#ffffff");
  clone.insertBefore(bg, clone.firstChild);

  return new XMLSerializer().serializeToString(clone);
}

function svgToCanvas(svg, scale = 2) {
  return new Promise((resolve, reject) => {
    const w = svg.width?.baseVal?.value || svg.clientWidth || 800;
    const h = svg.height?.baseVal?.value || svg.clientHeight || 600;
    const svgStr = serializeSvg(svg);
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

/**
 * Exports the current firm network graph (from the container's <svg>) as a
 * high-quality landscape PDF with title, legend, and MyKumpare branding.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.container - The graph container div (must contain an <svg>)
 * @param {string} opts.vizMode - "type" or "strength"
 * @param {object} opts.stats - Relationship counts { sub_manager, consultant, shared_contact }
 * @param {number} opts.nodeCount - Number of visible firms
 * @param {object} opts.activeTypes - Which relationship types are active
 */
export async function exportFirmNetworkMapPdf({ container, vizMode, stats, nodeCount, activeTypes }) {
  await preloadMyKumpareLogo().catch(() => {});

  const svg = container?.querySelector("svg");
  if (!svg) throw new Error("Graph not found");

  const canvas = await svgToCanvas(svg, 2);
  const imgData = canvas.toDataURL("image/png");

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(14, 26, 41);
  doc.text("Firm Network Map", margin, margin + 12);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 128, 140);
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const modeLabel = vizMode === "strength" ? "Connection strength view" : "Firm type view";
  doc.text(`Generated ${dateStr}  ·  ${nodeCount} firms  ·  ${modeLabel}`, margin, margin + 26);

  // Graph image — fit within remaining space
  const legendH = 46;
  const imgY = margin + 34;
  const availW = pageW - margin * 2;
  const availH = pageH - imgY - legendH - margin;
  const imgRatio = canvas.width / canvas.height;
  let drawW = availW;
  let drawH = drawW / imgRatio;
  if (drawH > availH) {
    drawH = availH;
    drawW = drawH * imgRatio;
  }
  const imgX = margin + (availW - drawW) / 2;
  doc.addImage(imgData, "PNG", imgX, imgY, drawW, drawH);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.rect(imgX, imgY, drawW, drawH);

  // Legend row
  const legendY = imgY + drawH + 20;
  let lx = margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(31, 41, 55);
  doc.text("Relationships:", lx, legendY);
  lx += doc.getTextWidth("Relationships:") + 10;

  const activeRels = Object.keys(EDGE_LABELS).filter(k => activeTypes[k]);
  doc.setFont("helvetica", "normal");
  for (const k of activeRels) {
    const rgb = hexToRgb(EDGE_COLORS[k]);
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.circle(lx + 3, legendY - 2.5, 3, "F");
    doc.text(`${EDGE_LABELS[k]} (${Math.round(stats[k] || 0)})`, lx + 10, legendY);
    lx += 10 + doc.getTextWidth(`${EDGE_LABELS[k]} (${Math.round(stats[k] || 0)})`) + 18;
  }

  // Strength gradient legend
  if (vizMode === "strength") {
    const gradW = 150;
    const gradH = 8;
    const gradX = pageW - margin - gradW;
    const gradY = legendY - 8;
    for (let i = 0; i < gradW; i++) {
      const [r, g, b] = strengthColorRGB(i / gradW);
      doc.setFillColor(r, g, b);
      doc.rect(gradX + i, gradY, 1, gradH, "F");
    }
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.rect(gradX, gradY, gradW, gradH);
    doc.setFontSize(7);
    doc.setTextColor(120, 128, 140);
    doc.text("Less central", gradX, gradY + gradH + 8);
    const moreLabel = "More central";
    doc.text(moreLabel, gradX + gradW - doc.getTextWidth(moreLabel), gradY + gradH + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(31, 41, 55);
    doc.text("Centrality:", gradX - doc.getTextWidth("Centrality:") - 8, legendY);
  }

  // Branding footer
  drawMyKumpareBranding(doc);

  doc.save("Firm-Network-Map.pdf");
}