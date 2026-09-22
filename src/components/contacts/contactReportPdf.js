import { jsPDF } from "jspdf";
import { format } from "date-fns";

const stripHtml = (html) => {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").trim();
};

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    return format(new Date(iso + "T00:00:00"), "MMM d, yyyy");
  } catch {
    return iso;
  }
};

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "MMM d, yyyy h:mm a");
  } catch {
    return iso;
  }
};

// Convert an image URL to a data URL so jsPDF can embed it without CORS issues.
const toDataUrl = (url) =>
  new Promise((resolve) => {
    fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("fetch failed"))))
      .then((blob) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      })
      .catch(() => resolve(null));
  });

const fmtPhone = (p) => {
  if (!p) return "";
  const cc = p.country_code ? `+${p.country_code} ` : "";
  const main = [p.area_code, p.number_mid, p.number_last].filter(Boolean).join("-");
  return [cc + main, p.phone_type].filter(Boolean).join(" · ");
};

const fmtAddress = (a) => {
  if (!a) return "";
  return [
    a.address_line1,
    a.address_line2,
    [a.city, a.state, a.postal_code].filter(Boolean).join(", "),
    a.country,
  ].filter(Boolean).join(", ");
};

/**
 * Generate a comprehensive contact report PDF with an executive summary header
 * (photo, full name, contact info) followed by all profile sections mirroring
 * the contact profile tabs.
 *
 * @param {object} opts
 * @param {object} opts.contact  - The full contact record (with all fields)
 * @param {array}  opts.firms    - Firms associated with the contact
 * @param {array}  opts.products - Products the contact is on the investment team of
 * @param {array}  opts.dueDiligence - Due diligence records the contact is assigned to
 * @param {array}  opts.activities - Contact activity logs
 */
export async function generateContactReportPdf({ contact, firms = [], products = [], dueDiligence = [], activities = [] }) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text, fontSize, style = "normal", color = [60, 60, 60], indent = 0) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text || "", contentW - indent);
    lines.forEach((line) => {
      ensureSpace(fontSize + 4);
      doc.text(line, margin + indent, y);
      y += fontSize + 4;
    });
  };

  const sectionHeader = (label) => {
    y += 8;
    ensureSpace(28);
    doc.setFillColor(238, 242, 255);
    doc.roundedRect(margin, y - 4, contentW, 22, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(55, 65, 145);
    doc.text(label, margin + 8, y + 11);
    y += 28;
  };

  const divider = () => {
    y += 4;
    ensureSpace(8);
    doc.setDrawColor(225, 225, 225);
    doc.line(margin, y, pageW - margin, y);
    y += 8;
  };

  const keyValue = (key, val, indent = 0) => {
    if (!val || val === "—" || val === "Undetermined") return;
    writeWrapped(`${key}: `, 10, "bold", [100, 100, 100], indent);
    // Write value on same line if short, else wrap
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const valLines = doc.splitTextToSize(String(val), contentW - indent - 60);
    // Back up to write after the key on the first line
    const keyWidth = doc.getTextWidth(`${key}: `) + (indent > 0 ? 0 : 0);
    valLines.forEach((line, i) => {
      if (i === 0) {
        doc.text(line, margin + indent + keyWidth, y - 14);
      } else {
        ensureSpace(14);
        doc.text(line, margin + indent + keyWidth, y - 14);
        y += 14;
      }
    });
    y += 4;
  };

  const simpleRow = (key, val) => {
    if (val === undefined || val === null || val === "" || val === "Undetermined") return;
    ensureSpace(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const keyLabel = `${key}:`;
    doc.text(keyLabel, margin, y);
    const keyWidth = doc.getTextWidth(keyLabel);
    const valX = margin + keyWidth + 6;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    const valStr = String(val);
    const valLines = doc.splitTextToSize(valStr, contentW - keyWidth - 6);
    valLines.forEach((line, i) => {
      if (i > 0) {
        ensureSpace(14);
        y += 14;
      }
      doc.text(line, valX, y);
    });
    y += 14;
  };

  // ─── Executive Summary Header ───
  const fullName = [contact.salutation, contact.first_name, contact.middle_name, contact.last_name]
    .filter(Boolean).join(" ");
  const fullDisplay = contact.suffix ? `${fullName}, ${contact.suffix}` : fullName;
  const designationsStr = (contact.designations || []).join(", ");
  const firmNames = (firms || []).map((f) => f.name).filter(Boolean).join(", ");

  // Photo
  let photoHeight = 0;
  if (contact.photo_url) {
    try {
      const dataUrl = await toDataUrl(contact.photo_url);
      if (dataUrl) {
        const imgSize = 60;
        doc.addImage(dataUrl, "JPEG", margin, y, imgSize, imgSize);
        photoHeight = imgSize + 8;
      }
    } catch { /* skip photo */ }
  }

  // Name and title next to photo
  const textX = contact.photo_url ? margin + 70 : margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 30, 30);
  doc.text(fullDisplay || "Unknown Contact", textX, y + 16);
  if (designationsStr) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(designationsStr, textX, y + 30);
  }
  if (contact.title) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    doc.text(contact.title, textX, y + 44);
  }
  if (firmNames) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(55, 65, 145);
    doc.text(firmNames, textX, y + 58);
  }
  y += Math.max(photoHeight, 68);

  // Contact info bar
  divider();
  const phones = (contact.phones || []).filter((p) => p.area_code || p.number_mid || p.number_last);
  const primaryPhone = phones.find((p) => p.is_default) || phones[0];
  const addresses = (contact.addresses || []).filter((a) => a.address_line1 || a.city);
  const primaryAddr = addresses.find((a) => a.is_primary) || addresses[0];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  if (contact.email) {
    doc.text("EMAIL", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(55, 65, 145);
    doc.text(contact.email, margin + 55, y);
    y += 14;
  }
  if (primaryPhone) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("PHONE", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(fmtPhone(primaryPhone), margin + 55, y);
    y += 14;
  }
  if (contact.linkedin_url) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("LINKEDIN", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(55, 65, 145);
    const liLines = doc.splitTextToSize(contact.linkedin_url, contentW - 55);
    doc.text(liLines[0] || "", margin + 55, y);
    y += 14;
  }
  if (primaryAddr) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("ADDRESS", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    const addrLines = doc.splitTextToSize(fmtAddress(primaryAddr), contentW - 55);
    addrLines.forEach((line, i) => {
      if (i > 0) { y += 12; }
      doc.text(line, margin + 55, y);
    });
    y += 14;
  }
  // Status badges
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  const statusParts = [
    `Status: ${contact.contact_status || "Active"}`,
    `Engagement: ${contact.engagement_status || "New"}`,
    `Employee: ${contact.employee_status || "—"}`,
  ];
  doc.text(statusParts.join("    |    "), margin, y);
  y += 14;

  divider();

  // ─── Biography ───
  const bio = stripHtml(contact.biography);
  const shortBio = contact.short_biography || "";
  if (shortBio || bio) {
    sectionHeader("Biography");
    if (shortBio) {
      writeWrapped(shortBio, 10, "italic", [90, 90, 90]);
      y += 4;
    }
    if (bio) {
      writeWrapped(bio, 10, "normal", [70, 70, 70]);
    }
  }

  // ─── Associated Firms ───
  if (firms.length > 0) {
    sectionHeader("Associated Firms");
    firms.forEach((f, i) => {
      if (i > 0) y += 4;
      simpleRow("Firm", f.name);
      if (f.firm_type) simpleRow("Type", f.firm_type);
      if (f.website) simpleRow("Website", f.website);
      if (f.email) simpleRow("Email", f.email);
      if (f.location) simpleRow("Location", f.location);
    });
  }

  // ─── Products ───
  if (products.length > 0) {
    sectionHeader("Products (Investment Team)");
    products.forEach((p, i) => {
      if (i > 0) divider();
      simpleRow("Product", p.name);
      if (p.firm_name) simpleRow("Firm", p.firm_name);
      if (p.product_type) simpleRow("Type", p.product_type);
      if (p.product_status) simpleRow("Status", p.product_status);
      if (p.funding_status) simpleRow("Funding", p.funding_status);
      if (p.asset_class) simpleRow("Asset Class", p.asset_class);
      if (p.description) writeWrapped(stripHtml(p.description) || "", 9, "normal", [110, 110, 110], 10);
    });
  }

  // ─── Education ───
  const education = contact.education || [];
  if (education.length > 0) {
    sectionHeader("Education");
    education.forEach((e, i) => {
      if (i > 0) y += 4;
      const instLine = [e.institution, e.graduation_year].filter(Boolean).join(" — ");
      simpleRow("Institution", instLine);
      if (e.degree) simpleRow("Degree", e.degree);
      if (e.area_of_specialization) simpleRow("Specialization", e.area_of_specialization);
      if (e.majors?.length) simpleRow("Majors", e.majors.join(", "));
      if (e.minors?.length) simpleRow("Minors", e.minors.join(", "));
    });
  }

  // ─── Professional Experience ───
  const experience = contact.professional_experience || [];
  if (experience.length > 0) {
    sectionHeader("Professional Experience");
    experience.forEach((e, i) => {
      if (i > 0) y += 4;
      const coLine = [e.company_name, e.start_year, e.end_year].filter(Boolean).join(" — ");
      simpleRow("Company", coLine);
      if (e.title) simpleRow("Title", e.title);
    });
  }

  // ─── Board Memberships ───
  const board = contact.board_memberships || [];
  if (board.length > 0) {
    sectionHeader("Board Memberships");
    board.forEach((b, i) => {
      if (i > 0) y += 4;
      if (b.organization_name) simpleRow("Organization", b.organization_name);
      if (b.role) simpleRow("Role", b.role);
      simpleRow("Start Year", b.start_year || "—");
      simpleRow("End Year", b.end_year || "Present");
    });
  }

  // ─── Classifications ───
  sectionHeader("Classifications");
  const contactTypes = Array.isArray(contact.contact_type) ? contact.contact_type.join(", ") : (contact.contact_type || "");
  simpleRow("Contact Type", contactTypes);
  simpleRow("Contact Role", contact.contact_role);
  simpleRow("Employee Status", contact.employee_status);
  simpleRow("Decision Role", contact.decision_role);
  simpleRow("Influence Level", contact.influence_level);
  if (contact.contact_roles?.length) simpleRow("Roles", contact.contact_roles.join(", "));
  if (contact.contact_firm_roles?.length) simpleRow("Department Roles", contact.contact_firm_roles.join(", "));
  if (contact.investment_team_roles?.length) simpleRow("Investment Team Roles", contact.investment_team_roles.join(", "));
  if (contact.tags?.length) simpleRow("Tags", contact.tags.join(", "));

  // ─── Demographics ───
  sectionHeader("Demographics");
  simpleRow("Gender", contact.gender);
  if (contact.ethnicity?.length) simpleRow("Ethnicity", contact.ethnicity.join(", "));
  simpleRow("Disability Status", contact.disability_status);

  // ─── Ownership ───
  sectionHeader("Ownership");
  simpleRow("Veteran Status", contact.veteran_status);

  // ─── Addresses ───
  if (addresses.length > 0) {
    sectionHeader("Addresses");
    addresses.forEach((a, i) => {
      if (i > 0) y += 4;
      const label = a.is_primary ? "Primary Address" : `Address ${i + 1}`;
      simpleRow(label, fmtAddress(a));
    });
  }

  // ─── Phones ───
  if (phones.length > 0) {
    sectionHeader("Phone Numbers");
    phones.forEach((p, i) => {
      if (i > 0) y += 4;
      const label = p.is_default ? "Default Phone" : (p.phone_type || `Phone ${i + 1}`);
      simpleRow(label, fmtPhone(p));
    });
  }

  // ─── Due Diligence ───
  if (dueDiligence.length > 0) {
    sectionHeader("Due Diligence Assignments");
    dueDiligence.forEach((dd, i) => {
      if (i > 0) divider();
      simpleRow("Product", dd.product_name || "—");
      simpleRow("Firm", dd.firm_name || "—");
      simpleRow("Status", dd.status || "—");
      simpleRow("Process Status", dd.process_status || "—");
      if (dd.start_date) simpleRow("Start Date", fmtDate(dd.start_date));
    });
  }

  // ─── Activities ───
  if (activities.length > 0) {
    sectionHeader("Activity Log");
    activities.slice(0, 50).forEach((a, i) => {
      if (i > 0) y += 2;
      const dateStr = fmtDate(a.activity_date || a.created_date);
      const subject = a.subject || a.activity_type || "Activity";
      simpleRow(dateStr, `${subject}${a.notes ? " — " + stripHtml(a.notes).substring(0, 100) : ""}`);
    });
    if (activities.length > 50) {
      writeWrapped(`... and ${activities.length - 50} more activities.`, 9, "italic", [150, 150, 150]);
    }
  }

  // ─── Notes ───
  const notes = stripHtml(contact.notes);
  if (notes) {
    sectionHeader("Notes");
    writeWrapped(notes, 10, "normal", [70, 70, 70]);
  }

  // ─── Footer ───
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text(
      `Contact Report — ${fullDisplay || "Contact"} — Generated ${format(new Date(), "MMM d, yyyy")}`,
      margin,
      pageH - 20,
    );
    doc.text(`Page ${p} of ${pageCount}`, pageW - margin - 50, pageH - 20);
  }

  const fileName = [contact.first_name, contact.last_name].filter(Boolean).join("_") || "contact";
  doc.save(`${fileName}_contact_report.pdf`);
}