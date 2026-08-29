// Shared helper for generating branded summary PDFs from a saved template.
// Extracted so both the SummaryReportTemplateManager (picker flow) and the
// per-record SummaryExportButton (profile-view flow) build the same context.

import { base44 } from "@/api/base44Client";
import { generateSummaryPdf } from "./summaryReportPdf";

/**
 * Fetch related data needed by derived fields for the given entity type.
 * @param {string} entityType  - "Firm" | "Product" | "Portfolio" | "Contact"
 * @param {object} record      - The entity record being summarized
 * @returns {Promise<object>} ctx object passed to generateSummaryPdf
 */
export async function buildSummaryContext(entityType, record) {
  if (!record) return {};
  let ctx = {};
  try {
    if (entityType === "Firm") {
      const [products, contacts] = await Promise.all([
        base44.entities.Product.filter({ firm_id: record.id }, "-updated_date", 50).catch(() => []),
        base44.entities.Contact.filter({ firm_ids: record.id }, "-updated_date", 50).catch(() => []),
      ]);
      ctx = { products: products || [], contacts: contacts || [] };
    } else if (entityType === "Product") {
      ctx = { team: record.investment_team || [] };
    } else if (entityType === "Portfolio") {
      ctx = { constituents: record.constituents || record.lineup || [] };
    } else if (entityType === "Contact") {
      let firmName = "—";
      if (record.firm_ids?.length) {
        const firm = await base44.entities.Firm.get(record.firm_ids[0]).catch(() => null);
        if (firm) firmName = firm.name;
      }
      ctx = { firmName };
    }
  } catch {
    /* ignore — PDF still renders with whatever data is on the record */
  }
  return ctx;
}

/**
 * Build context for the record and generate the branded summary PDF.
 * @param {object} template - Saved SummaryReportTemplate
 * @param {object} record   - The entity record to summarize
 */
export async function exportRecordSummary(template, record) {
  if (!template || !record) return;
  const ctx = await buildSummaryContext(template.entity_type, record);
  await generateSummaryPdf(template, record, ctx);
}