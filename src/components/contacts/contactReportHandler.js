import { base44 } from "@/api/base44Client";
import { generateContactReportPdf } from "./contactReportPdf";

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

  // Fetch related products where this contact is on the investment team
  let relatedProducts = [];
  try {
    const productsRes = await base44.functions.invoke("searchAppData", {
      action: "search",
      entity_name: "Product",
      filter: { "investment_team.contact_id": editingContact.id, deleted_at: null },
      limit: 100,
      sort: "-updated_date",
    });
    relatedProducts = productsRes?.records || [];
  } catch (e) { console.warn("Product search failed:", e); }

  // Fetch due diligence records where this contact is assigned as analyst
  let relatedDd = [];
  try {
    const ddRes = await base44.functions.invoke("searchAppData", {
      action: "search",
      entity_name: "DueDiligence",
      filter: {
        $or: [
          { primary_analyst_contact_id: editingContact.id },
          { secondary_analyst_contact_id: editingContact.id },
          { assigned_contact_ids: editingContact.id },
        ],
        deleted_at: null,
      },
      limit: 50,
      sort: "-updated_date",
    });
    relatedDd = ddRes?.records || [];
  } catch (e) { console.warn("DD search failed:", e); }

  // Fetch recent contact activities
  let relatedActivities = [];
  try {
    const activitiesRes = await base44.functions.invoke("searchAppData", {
      action: "search",
      entity_name: "ContactActivity",
      filter: { contact_id: editingContact.id, deleted_at: null },
      limit: 50,
      sort: "-activity_date",
    });
    relatedActivities = activitiesRes?.records || [];
  } catch (e) { console.warn("Activities search failed:", e); }

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

  const relatedFirms = (firms || []).filter((f) => state.firmIds.includes(f.id));

  await generateContactReportPdf({
    contact: fullContact,
    firms: relatedFirms,
    products: relatedProducts,
    dueDiligence: relatedDd,
    activities: relatedActivities,
  });
}