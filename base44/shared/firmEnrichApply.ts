// Server-side application of web enrichment to an existing firm record.
// Ported (lean) from the frontend enrichAndApplyFirm in CsvFirmImport.jsx +
// firmEnrichment.js. Fills only empty firm fields (append-only) and creates
// or links contacts discovered on the website. Designed to run inside a
// backend function under the service role, so it takes a `svc` client.

import { extractBoardMembershipsFromBio, mergeBoardMemberships } from './boardMembershipExtract.ts';

const PLACEHOLDER_VALUES = ['null', 'undefined', 'n/a', 'na', 'none', 'not provided', 'not available', 'unknown', '-'];

function cleanStr(v: any): string {
  if (v == null) return '';
  const s = String(v).trim().toLowerCase().replace(/_/g, ' ');
  return PLACEHOLDER_VALUES.includes(s) ? '' : String(v).trim();
}

// Minimal professional-designation detection (ported from designationDetector.js).
const DESIGNATION_PATTERNS = [
  { label: 'CFA', regex: /\bCFA\b/i },
  { label: 'CPA', regex: /\bCPA\b/i },
  { label: 'MBA', regex: /\bMBA\b/i },
  { label: 'PhD', regex: /\bPh\.?D\b/i },
  { label: 'MD', regex: /\bM\.D\b/i },
  { label: 'JD', regex: /\bJ\.D\b/i },
  { label: 'LLM', regex: /\bLL\.M\b/i },
  { label: 'CFP', regex: /\bCFP\b/i },
  { label: 'FRM', regex: /\bFRM\b/i },
  { label: 'CAIA', regex: /\bCAIA\b/i },
  { label: 'CMT', regex: /\bCMT\b/i },
  { label: 'ChFC', regex: /\bChFC\b/i },
  { label: 'PMP', regex: /\bPMP\b/i },
  { label: 'ASA', regex: /\bASA\b/i },
  { label: 'FSA', regex: /\bFSA\b/i },
  { label: 'EA', regex: /\bEA\b/i },
  { label: 'CIIA', regex: /\bCIIA\b/i },
  { label: 'CISI', regex: /\bCISI\b/i },
  { label: 'FMVA', regex: /\bFMVA\b/i },
  { label: 'CBCP', regex: /\bCBCP\b/i },
];

function detectDesignations(name: string, biography: string): string[] {
  const text = [name, biography].filter(Boolean).join(' ');
  if (!text) return [];
  const found: string[] = [];
  for (const { label, regex } of DESIGNATION_PATTERNS) {
    if (regex.test(text) && !found.includes(label)) found.push(label);
  }
  return found;
}

// Parse a phone string into the structured phone shape used by the Firm/Contact
// entities. Ported from firmEnrichment.js parsePhoneString.
function parsePhoneString(phoneStr: string): any | null {
  if (!phoneStr || typeof phoneStr !== 'string') return null;
  const digits = phoneStr.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) {
    return {
      id: crypto.randomUUID(),
      phone_type: 'Work',
      country_code: '1',
      area_code: digits.slice(0, 3),
      number_mid: digits.slice(3, 6),
      number_last: digits.slice(6, 10),
      is_default: true,
    };
  }
  if (digits.length === 11 && digits[0] === '1') {
    return {
      id: crypto.randomUUID(),
      phone_type: 'Work',
      country_code: '1',
      area_code: digits.slice(1, 4),
      number_mid: digits.slice(4, 7),
      number_last: digits.slice(7, 11),
      is_default: true,
    };
  }
  return {
    id: crypto.randomUUID(),
    phone_type: 'Work',
    country_code: phoneStr.trim(),
    area_code: '',
    number_mid: '',
    number_last: '',
    is_default: true,
  };
}

function normalizeName(s: string): string {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Clean the enriched payload the same way the frontend wrapper does, so
// placeholder strings are stored as blank.
function cleanEnriched(data: any): any {
  data.logo_url = cleanStr(data.logo_url);
  data.email = cleanStr(data.email);
  data.linkedin_url = cleanStr(data.linkedin_url);
  data.website = cleanStr(data.website);
  data.description = cleanStr(data.description);
  for (const person of data.people || []) {
    person.photo_url = cleanStr(person.photo_url);
    person.email = cleanStr(person.email);
    person.linkedin_url = cleanStr(person.linkedin_url);
    person.biography = cleanStr(person.biography);
    person.bio_url = cleanStr(person.bio_url);
  }
  return data;
}

// Apply enrichment to an existing firm: fill empty firm fields, then create or
// link contacts. `svc` is base44.asServiceRole. Returns a summary.
export async function applyFirmEnrichment(
  firm: any,
  enrichedRaw: any,
  tenantId: string,
  svc: any,
): Promise<{ name: string; fields_updated: number; contacts_created: number; contacts_updated: number; error: string | null }> {
  const summary = { name: firm.name, fields_updated: 0, contacts_created: 0, contacts_updated: 0, error: null as string | null };
  let enriched: any;
  try {
    enriched = cleanEnriched(enrichedRaw || {});
    if (!enriched.name) enriched.name = firm.name;
  } catch (e: any) {
    summary.error = e?.message || 'Enrichment cleanup failed';
    return summary;
  }

  // Firm-level: fill only empty fields (append-only).
  const updates: Record<string, any> = {};
  const fillIfEmpty = (field: string) => {
    if (enriched[field] && !firm[field]) updates[field] = enriched[field];
  };
  fillIfEmpty('logo_url');
  fillIfEmpty('description');
  fillIfEmpty('website');
  fillIfEmpty('email');
  fillIfEmpty('linkedin_url');
  if (enriched.year_founded && !firm.year_founded) updates.year_founded = enriched.year_founded;
  const enrichedType: string = enriched.firm_type || (Array.isArray(enriched.firm_types) && enriched.firm_types.length > 0 ? enriched.firm_types[0] : '');
  if (enrichedType && !firm.firm_type) {
    updates.firm_type = enrichedType;
  }
  if (Array.isArray(enriched.addresses) && enriched.addresses.length > 0 && (!firm.addresses || firm.addresses.length === 0)) {
    const addrs = enriched.addresses.filter((a: any) => a.address_line1 || a.city);
    if (addrs.length > 0) updates.addresses = addrs.map((a: any) => ({ ...a, id: crypto.randomUUID() }));
  }
  if (Array.isArray(enriched.phones) && enriched.phones.length > 0 && (!firm.phones || firm.phones.length === 0)) {
    const phones = enriched.phones.filter((p: any) => p.area_code || p.number_last || p.country_code);
    if (phones.length > 0) updates.phones = phones.map((p: any) => ({ ...p, id: crypto.randomUUID() }));
  }
  try {
    if (Object.keys(updates).length > 0) {
      await svc.entities.Firm.update(firm.id, updates);
      summary.fields_updated = Object.keys(updates).length;
    }
  } catch { /* non-fatal */ }

  // Contacts: dedupe by normalized name (+ email) against existing tenant
  // contacts, linking the firm if matched, otherwise creating a new contact.
  const people = (enriched.people || []).filter((p: any) => p.first_name || p.last_name);
  if (people.length === 0) return summary;

  let existingContacts: any[] = [];
  try {
    existingContacts = await svc.entities.Contact.filter({ tenant_id: tenantId }, null, 5000);
  } catch { /* start empty */ }

  for (const person of people) {
    try {
      const fullName = `${person.first_name || ''} ${person.last_name || ''}`.trim();
      const normFirst = normalizeName(person.first_name);
      const normLast = normalizeName(person.last_name);
      const normEmail = normalizeName(person.email);
      const match = existingContacts.find((c: any) => {
        if (normEmail && normalizeName(c.email) === normEmail && normEmail.length > 3) return true;
        return normalizeName(c.first_name) === normFirst && normalizeName(c.last_name) === normLast && normFirst && normLast;
      });
      if (match) {
        const existingFirmIds = match.firm_ids || [];
        if (!existingFirmIds.includes(firm.id)) {
          await svc.entities.Contact.update(match.id, { firm_ids: [...existingFirmIds, firm.id] });
          summary.contacts_updated++;
        }
        continue;
      }

      const designations = detectDesignations(fullName, person.biography);
      const contactData: any = {
        tenant_id: tenantId,
        first_name: person.first_name || '',
        last_name: person.last_name || '',
        title: person.title || '',
        email: person.email || '',
        linkedin_url: person.linkedin_url || '',
        biography: person.biography || '',
        photo_url: person.photo_url || '',
        bio_url: person.bio_url || '',
        firm_ids: [firm.id],
        employee_status: 'Employee',
      };
      if (designations.length > 0) contactData.designations = designations;
      const parsedPhone = person.phone ? parsePhoneString(person.phone) : null;
      if (parsedPhone) contactData.phones = [parsedPhone];
      if (Array.isArray(person.education) && person.education.length > 0) {
        const edu = person.education
          .filter((e: any) => e && (e.institution || e.degree || e.area_of_specialization))
          .map((e: any) => ({ ...e, id: crypto.randomUUID() }));
        if (edu.length > 0) contactData.education = edu;
      }
      if (Array.isArray(person.professional_experience) && person.professional_experience.length > 0) {
        const exp = person.professional_experience
          .filter((e: any) => e && (e.company_name || e.title))
          .map((e: any) => ({ ...e, id: crypto.randomUUID() }));
        if (exp.length > 0) contactData.professional_experience = exp;
      }
      // Board memberships: use extracted board_memberships if present, otherwise
      // extract from the biography via LLM.
      let boardMemberships = Array.isArray(person.board_memberships) ? person.board_memberships : [];
      if (boardMemberships.length === 0 && person.biography && person.biography.length > 60) {
        try {
          const fullName = `${person.first_name || ''} ${person.last_name || ''}`.trim();
          boardMemberships = await extractBoardMembershipsFromBio(svc, fullName, person.biography);
        } catch { /* non-fatal */ }
      }
      if (boardMemberships.length > 0) {
        contactData.board_memberships = boardMemberships.map((m: any) => ({ ...m, id: crypto.randomUUID() }));
      }
      const created = await svc.entities.Contact.create(contactData);
      existingContacts.push(created);
      summary.contacts_created++;
    } catch { /* non-fatal — continue to next person */ }
  }

  return summary;
}