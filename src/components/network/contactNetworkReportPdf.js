import { jsPDF } from "jspdf";
import { base44 } from "@/api/base44Client";
import {
  drawReportHeader,
  drawMyKumpareBranding,
  preloadMyKumpareLogo,
} from "@/components/reports/reportBranding";

// ── Contact Network Influence Report PDF ──
// Gathers contact influence scores (network centrality metrics) and
// top-connected firms, then produces a professional, branded PDF.

const ROLE_COLORS = {
  "Primary Decision Maker": [245, 158, 11],
  "Board Member": [139, 92, 246],
  "Key Influencer": [99, 102, 241],
  "Secondary Contact": [14, 165, 233],
  "Other": [100, 116, 139],
};

const TIER_LABELS = [
  { min: 16, label: "Key Influencer" },
  { min: 8, label: "Influencer" },
  { min: 3, label: "Connected" },
  { min: 0, label: "Emerging" },
];

function getTierLabel(score) {
  return (TIER_LABELS.find((t) => score >= t.min) || TIER_LABELS[TIER_LABELS.length - 1]).label;
}

function formatTimestamp(d = new Date()) {
  return d.toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

/**
 * Generates and downloads a Contact Network Influence Report PDF.
 *
 * @param {object} networkData - The data returned by computeContactNetwork
 *   (nodes, edges, keyNodes, stats).
 */
export async function generateContactNetworkReportPdf(networkData) {
  // Ensure the MyKumpare logo is rasterized for the branding footer.
  await preloadMyKumpareLogo().catch(() => {});

  const keyNodes = networkData?.keyNodes || [];
  const stats = networkData?.stats || {};
  const allNodes = networkData?.nodes || [];

  // ── Fetch contacts to map node IDs → firm_ids ──
  let contactFirmMap = {}; // contactId -> [firmId, ...]
  let firmMap = {}; // firmId -> { name, firm_types }
  let topFirms = [];

  try {
    // Fetch contacts (limited to active, sorted by most recently updated)
    const contacts = await base44.entities.Contact.list("-updated_date", 1000);
    const nodeIdSet = new Set(allNodes.map((n) => n.id));
    for (const c of contacts) {
      if (nodeIdSet.has(c.id) && Array.isArray(c.firm_ids)) {
        contactFirmMap[c.id] = c.firm_ids;
      }
    }

    // Fetch firms
    const firms = await base44.entities.Firm.list("-updated_date", 500);
    for (const f of firms) {
      firmMap[f.id] = {
        name: f.name || "Unknown",
        firm_types: f.firm_types || (f.firm_type ? [f.firm_type] : []),
      };
    }

    // Aggregate firm influence from network nodes
    const firmAgg = {}; // firmId -> { contactCount, totalDegree, totalStrength }
    for (const node of allNodes) {
      const firmIds = contactFirmMap[node.id] || [];
      for (const fid of firmIds) {
        if (!firmAgg[fid]) {
          firmAgg[fid] = { contactCount: 0, totalDegree: 0, totalStrength: 0 };
        }
        firmAgg[fid].contactCount += 1;
        firmAgg[fid].totalDegree += node.degree || 0;
        firmAgg[fid].totalStrength += node.totalStrength || 0;
      }
    }

    topFirms = Object.entries(firmAgg)
      .map(([fid, agg]) => ({
        firmId: fid,
        name: firmMap[fid]?.name || "Unknown Firm",
        firm_types: firmMap[fid]?.firm_types || [],
        ...agg,
      }))
      .sort((a, b) => b.totalDegree - a.totalDegree)
      .slice(0, 20);
  } catch (err) {
    console.error("[contactNetworkReportPdf] Failed to fetch firm data:", err);
  }

  // ── Build the PDF ──
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed) => {
    if (y + needed > pageH - margin - 20) {
      doc.addPage();
      y = margin + 50; // leave room for header band on continuation pages
      drawReportHeader(doc, { margin, title: "", subtitle: "" });
      y = margin + 56;
    }
  };

  // ── Page 1: Header + title ──
  y = drawReportHeader(doc, {
    margin,
    title: "Contact Network Influence Report",
    subtitle: `Generated ${formatTimestamp()}`,
  });

  // ── Network stats strip ──
  const statCells = [
    { label: "CONNECTED CONTACTS", value: stats.connectedContacts || 0, color: [17, 24, 39] },
    { label: "CONNECTIONS", value: stats.totalEdges || 0, color: [99, 102, 241] },
    { label: "KEY NODES", value: stats.keyNodeCount || 0, color: [245, 158, 11] },
    { label: "AVG STRENGTH", value: stats.avgStrength || 0, color: [14, 165, 233] },
  ];
  const cellW = contentW / statCells.length;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentW, 48, 6, 6, "F");
  statCells.forEach((cell, i) => {
    const cx = margin + cellW * i + cellW / 2;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(107, 114, 128);
    doc.text(cell.label, cx, y + 18, { align: "center" });
    doc.setFontSize(18);
    doc.setTextColor(cell.color[0], cell.color[1], cell.color[2]);
    doc.text(String(cell.value), cx, y + 38, { align: "center" });
  });
  y += 48 + 20;

  // ── Role distribution ──
  if (stats.roleDistribution && Object.keys(stats.roleDistribution).length > 0) {
    ensureSpace(40);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(17, 24, 39);
    doc.text("Decision Role Distribution", margin, y);
    y += 16;

    const roles = Object.entries(stats.roleDistribution).sort((a, b) => b[1] - a[1]);
    for (const [role, count] of roles) {
      const color = ROLE_COLORS[role] || [100, 116, 139];
      ensureSpace(16);
      // Color dot
      doc.setFillColor(color[0], color[1], color[2]);
      doc.circle(margin + 4, y - 3, 3, "F");
      // Role label
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 51, 51);
      doc.text(role, margin + 14, y);
      // Count
      doc.setFont("helvetica", "bold");
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(String(count), margin + contentW - 20, y, { align: "right" });
      y += 16;
    }
    y += 10;
  }

  // ── Top Key Influencers table ──
  doc.addPage();
  y = drawReportHeader(doc, {
    margin,
    title: "Top Key Influencers",
    subtitle: "Contacts ranked by network centrality (betweenness importance)",
  });

  if (keyNodes.length === 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    doc.text("No key influencers found in the current network.", margin, y + 20);
  } else {
    // Table header
    const colWidths = [30, 0, 65, 65, 55, 50];
    const colLabels = ["#", "Contact", "Role", "Connections", "Strength", "Importance"];
    const tableX = margin;
    let tableY = y;

    // Header row
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(tableX, tableY, contentW, 22, 4, 4, "F");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(55, 65, 81);
    let cx = tableX + 8;
    colLabels.forEach((label, i) => {
      doc.text(label, cx, tableY + 14);
      cx += colWidths[i] || (contentW - colWidths.reduce((a, b) => a + b, 0) - 8);
    });
    tableY += 22;

    // Data rows
    doc.setFontSize(9);
    for (const kn of keyNodes) {
      ensureSpace(28);
      const rowH = 26;

      // Alternating row background
      const idx = keyNodes.indexOf(kn);
      if (idx % 2 === 1) {
        doc.setFillColor(250, 250, 252);
        doc.rect(tableX, tableY, contentW, rowH, "F");
      }

      cx = tableX + 8;
      // Rank
      doc.setFont("helvetica", "bold");
      doc.setTextColor(245, 158, 11);
      doc.text(`#${kn.rank}`, cx, tableY + 16);
      cx += colWidths[0];

      // Name + title
      const nameW = contentW - colWidths.reduce((a, b, i) => i === 1 ? 0 : a + b, 0) - 8;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(17, 24, 39);
      const nameLines = doc.splitTextToSize(kn.label || "Unknown", nameW);
      doc.text(nameLines[0], cx, tableY + 13);
      if (kn.title) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(7.5);
        const titleLines = doc.splitTextToSize(kn.title, nameW);
        doc.text(titleLines[0], cx, tableY + 23);
        doc.setFontSize(9);
      }
      cx += nameW;

      // Role
      if (kn.decision_role) {
        const color = ROLE_COLORS[kn.decision_role] || [100, 116, 139];
        doc.setFillColor(color[0], color[1], color[2]);
        doc.circle(cx + 3, tableY + 12, 2.5, "F");
        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 51, 51);
        doc.setFontSize(7.5);
        const roleLines = doc.splitTextToSize(kn.decision_role, colWidths[2] - 8);
        doc.text(roleLines[0], cx + 10, tableY + 14);
        doc.setFontSize(9);
      }
      cx += colWidths[2];

      // Connections
      doc.setFont("helvetica", "bold");
      doc.setTextColor(17, 24, 39);
      doc.text(String(kn.degree || 0), cx, tableY + 16);
      cx += colWidths[3];

      // Strength
      doc.setFont("helvetica", "normal");
      doc.setTextColor(99, 102, 241);
      doc.text(String(kn.totalStrength || 0), cx, tableY + 16);
      cx += colWidths[4];

      // Importance
      doc.setFont("helvetica", "bold");
      doc.setTextColor(245, 158, 11);
      doc.text(String(kn.importance || 0), cx, tableY + 16);

      tableY += rowH;
    }
    y = tableY + 10;
  }

  // ── Top Connected Firms table ──
  if (topFirms.length > 0) {
    doc.addPage();
    y = drawReportHeader(doc, {
      margin,
      title: "Top-Connected Firms",
      subtitle: "Firms ranked by total network connections of their contacts",
    });

    // Table header
    const firmColWidths = [30, 0, 70, 60, 60];
    const firmColLabels = ["#", "Firm", "Type", "Contacts", "Total Connections"];
    let firmTableY = y;

    doc.setFillColor(239, 246, 255);
    doc.roundedRect(margin, firmTableY, contentW, 22, 4, 4, "F");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(55, 65, 81);
    let fcx = margin + 8;
    firmColLabels.forEach((label, i) => {
      doc.text(label, fcx, firmTableY + 14);
      fcx += firmColWidths[i] || (contentW - firmColWidths.reduce((a, b, j) => j === 1 ? 0 : a + b, 0) - 8);
    });
    firmTableY += 22;

    doc.setFontSize(9);
    topFirms.forEach((firm, idx) => {
      ensureSpace(26);

      const rowH = 24;
      if (idx % 2 === 1) {
        doc.setFillColor(250, 250, 252);
        doc.rect(margin, firmTableY, contentW, rowH, "F");
      }

      fcx = margin + 8;
      // Rank
      doc.setFont("helvetica", "bold");
      doc.setTextColor(99, 102, 241);
      doc.text(`#${idx + 1}`, fcx, firmTableY + 15);
      fcx += firmColWidths[0];

      // Firm name
      const firmNameW = contentW - firmColWidths.reduce((a, b, j) => j === 1 ? 0 : a + b, 0) - 8;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(17, 24, 39);
      const firmNameLines = doc.splitTextToSize(firm.name, firmNameW);
      doc.text(firmNameLines[0], fcx, firmTableY + 15);
      fcx += firmNameW;

      // Type
      doc.setFont("helvetica", "normal");
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(7.5);
      const typeText = firm.firm_types?.join(", ") || "—";
      const typeLines = doc.splitTextToSize(typeText, firmColWidths[2] - 8);
      doc.text(typeLines[0], fcx, firmTableY + 15);
      doc.setFontSize(9);
      fcx += firmColWidths[2];

      // Contacts
      doc.setFont("helvetica", "bold");
      doc.setTextColor(17, 24, 39);
      doc.text(String(firm.contactCount), fcx, firmTableY + 15);
      fcx += firmColWidths[3];

      // Total connections
      doc.setFont("helvetica", "bold");
      doc.setTextColor(99, 102, 241);
      doc.text(String(firm.totalDegree), fcx, firmTableY + 15);

      firmTableY += rowH;
    });
    y = firmTableY + 10;
  }

  // ── Footer with page numbers + branding ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(156, 163, 175);
    doc.text(`Contact Network Influence Report`, margin, pageH - 24);
    doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 24, { align: "right" });
  }

  // MyKumpare branding footer on every page
  drawMyKumpareBranding(doc, { margin: 48 });

  const filename = `contact-network-influence-report_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}