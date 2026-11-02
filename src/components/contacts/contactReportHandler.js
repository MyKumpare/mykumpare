import { base44 } from "@/api/base44Client";
import { generateContactReportPdf } from "./contactReportPdf";

// Run one data fetch; a failure in any single source must never block the report.
const safeFetch = async (fn, fallback) => {
  try {
    return await fn();
  } catch (err) {
    console.warn("Report data fetch failed:", err);
    return fallback;
  }
};

/**
 * Gather all contact data + related records and generate a comprehensive
 * PDF report with an executive summary header and all profile sections.
 *
 * @param {object} editingContact - The saved contact record (must have an id)
 * @param {object} state - Current dialog state (all field values)
 * @param {array}  firms - All firms (for resolving associated firm names)
 * @returns {Promise<void>}
 */
export async function handleGenerateContactReport(editingContact, state, firms) {
  if (!editingContact) return;
  const contactId = editingContact.id;

  // Related records are read directly from the entities, in parallel. Each one
  // is guarded so a slow or rejected query only omits its own section.
  const [relatedProducts, relatedDd, relatedActivities] = await Promise.all([
    safeFetch(async () => {
      const res = await base44.entities.Product.filter(
        { "investment_team.contact_id": contactId, deleted_at: null },
        { sort: "-updated_date", limit: 100 },
      );
      return res.items || [];
    }, []),
    safeFetch(async () => {
      const res = await base44.entities.DueDiligence.filter(
        {
          $or: [
            { primary_analyst_contact_id: contactId },
            { secondary_analyst_contact_id: contactId },
            { assigned_contact_ids: contactId },
          ],
        },
        { sort: "-updated_date", limit: 50 },
      );
      return res.items || [];
    }, []),
    safeFetch(async () => {
      const res = await base44.entities.ContactActivity.filter(
        { contact_id: contactId },
        { sort: "-activity_date", limit: 50 },
      );
      return res.items || [];
    }, []),
  ]);

  // Build the full contact object from current state (so unsaved edits are reflected)
  const fullContact = {
    ...editingContact,
    photo_url: state.photoUrl,
    salutation: state.salutation,
    first_name: state.firstName,
    middle_name: state.middleName,
    last_name: state.lastName,
    suffix: state.suffix,
    title: state.title,
    email: state.email,
    linkedin_url: state.linkedinUrl,
    biography: state.biography,
    short_biography: state.shortBiography,
    designations: state.designations,
    employee_status: state.employeeStatus,
    contact_status: state.contactStatus,
    engagement_status: state.engagementStatus,
    contact_role: state.contactRole,
    decision_role: state.decisionRole,
    influence_level: state.influenceLevel,
    contact_type: state.contactType,
    contact_roles: state.contactRoles,
    contact_firm_roles: state.contactFirmRoles,
    investment_team_roles: state.investmentTeamRoles,
    tags: state.tags,
    gender: state.gender,
    ethnicity: state.ethnicity,
    veteran_status: state.veteranStatus,
    disability_status: state.disabilityStatus,
    notes: state.notes,
    firm_ids: state.firmIds,
    education: state.education,
    professional_experience: state.professionalExperience,
    board_memberships: state.boardMemberships,
    phones: state.phones,
    addresses: state.addresses,
  };

  const linkedFirmIds = Array.isArray(state.firmIds) ? state.firmIds : [];
  const relatedFirms = (firms || []).filter((f) => linkedFirmIds.includes(f.id));

  await generateContactReportPdf({
    contact: fullContact,
    firms: relatedFirms,
    products: relatedProducts,
    dueDiligence: relatedDd,
    activities: relatedActivities,
  });
}