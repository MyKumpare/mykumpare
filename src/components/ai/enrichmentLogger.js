import { base44 } from "@/api/base44Client";

/**
 * Persist an enrichment attempt result to the EnrichmentLog entity.
 * Called after the website enrichment completes (success, error, or no data).
 *
 * @param {Object} params
 * @param {string} params.firmName - Name of the firm enriched
 * @param {string} params.websiteUrl - Website URL scraped
 * @param {string} params.status - "success" | "error" | "no_data"
 * @param {string} [params.errorMessage] - Error message if failed
 * @param {Array}  [params.validationItems] - Items from validateEnrichment()
 */
export async function logEnrichmentAttempt({
  firmName,
  websiteUrl,
  status,
  errorMessage = "",
  validationItems = [],
}) {
  try {
    const people = validationItems.filter((it) => it.key?.startsWith("person_"));
    const fields = validationItems.filter((it) => !it.key?.startsWith("person_"));

    const skippedContacts = people
      .filter((p) => p.status === "exact" || p.status === "similar")
      .map((p) => {
        const name = (p.value?.first_name || p.value?.last_name)
          ? `${p.value.first_name || ""} ${p.value.last_name || ""}`.trim()
          : p.label?.replace(/^Person:\s*/, "") || "Unknown";
        return {
          name,
          title: p.value?.title || "",
          reason: p.status === "exact"
            ? `Exact match: ${p.match?.name || name}`
            : `Similar to existing: ${p.match?.name || name} (score ${(p.similarity * 100).toFixed(0)}%)`,
          status: p.status === "exact" ? "skipped" : "similar",
        };
      });

    await base44.entities.EnrichmentLog.create({
      firm_name: firmName || "",
      website_url: websiteUrl || "",
      status,
      error_message: errorMessage,
      total_people_found: people.length,
      people_new: people.filter((p) => p.status === "new").length,
      people_skipped: people.filter((p) => p.status === "exact").length,
      people_similar: people.filter((p) => p.status === "similar").length,
      skipped_contacts: skippedContacts,
      fields_new: fields.filter((f) => f.status === "new").length,
      fields_skipped: fields.filter((f) => f.status === "exact").length,
      fields_similar: fields.filter((f) => f.status === "similar").length,
    });
  } catch {
    // Logging is best-effort — never break the enrichment flow if it fails
  }
}