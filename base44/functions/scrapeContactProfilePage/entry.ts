import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchPage, cleanStr, parsePhone } from '../../shared/enrichmentUtils.ts';
import { formatBioParagraphs } from '../../shared/contactBioScrape.ts';
import { extractBoardMembershipsFromBio, mergeBoardMemberships } from '../../shared/boardMembershipExtract.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { contact_id, profile_url } = body;
    if (!contact_id) return Response.json({ error: 'contact_id is required' }, { status: 400 });
    if (!profile_url) return Response.json({ error: 'profile_url is required' }, { status: 400 });

    // Fetch the profile page
    const pageText = await fetchPage(profile_url);
    if (!pageText || pageText.length < 50) {
      return Response.json({ error: 'Could not fetch the profile page. The site may be blocking automated access.' }, { status: 502 });
    }

    // Get the contact to know the person's name
    const contact = await base44.entities.Contact.get(contact_id);
    if (!contact) return Response.json({ error: 'Contact not found' }, { status: 404 });
    const personName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();

    // Extract bio, education, experience, designations, phone, email, title, photo
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are extracting information about a specific person from their individual profile page.

Person name: "${personName}"

Below is the text content of their profile/biography page.

FIRST, determine if this page is a person profile/biography page. If it is NOT (e.g. it's a document, report, article, blog post, research paper, strategy overview, market commentary, or any other non-person page), return empty strings for ALL fields and empty arrays — do NOT try to extract a person's name from a document title or heading.

If this IS a person profile page, locate the section describing THIS person (often near their name, under a heading like "Biography", "About", "Profile", or "Overview").
IMPORTANT: Many sites use collapsible/accordion sections for detailed information. Look for sections labeled "PROFESSIONAL EXPERIENCE", "EDUCATION", "CREDENTIALS", "EDUCATION AND CREDENTIALS", "EDUCATION, CREDENTIALS AND MEMBERSHIPS", "SERVICE AREAS", or similar. The content of these sections IS present in the page text even though they appear collapsed on the visual page — extract ALL information from them.

EXTRACT THESE FIELDS:

1. biography: the COMPLETE biography text for this person. Copy VERBATIM — do not summarize, do not paraphrase, do not truncate. Include EVERY paragraph. PRESERVE PARAGRAPH BREAKS: separate each paragraph with a double newline (\\n\\n) — do NOT collapse the entire bio into a single block of text; keep the original paragraph structure.
2. title: their job title/role as it appears on the page.
3. email: any email address listed for this person.
4. phone: any phone number listed for this person (include area code).
5. photo_url: the URL of their profile photo. Images appear as [IMAGE: alt="..." src="https://..."] markers — find the one closest to the person's name.
6. designations: any professional designations/certifications (e.g. "CFA", "CFP", "CPA", "MBA", "PhD", "Chartered Financial Analyst"). Return as an array of strings.
7. education: every school/college/university the person attended as a student, with institution, degree, area_of_specialization, majors (array), graduation_year. Only include institutions they attended as a student, NOT firms where they worked.
8. professional_experience: every employer/company mentioned INCLUDING their current firm, with company_name, title, start_year, end_year (leave end_year empty if current employer). Order from most recent to oldest.
9. board_memberships: every external board, trustee, or governance position mentioned (roles on boards of OUTSIDE organizations, not internal committees at their own firm). Each item: organization_name, role (e.g. "Board Member", "Trustee", "Chairman"), start_year, end_year (empty if current). Look for phrases like "serves on the board of", "trustee of", "board member of".

--- PAGE CONTENT ---
${pageText.substring(0, 20000)}
--- END PAGE CONTENT ---

Return a JSON object with all fields above. Leave fields empty or return empty arrays if not found.`,
      response_json_schema: {
        type: 'object',
        properties: {
          biography: { type: 'string' },
          title: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          photo_url: { type: 'string' },
          designations: { type: 'array', items: { type: 'string' } },
          education: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                institution: { type: 'string' },
                degree: { type: 'string' },
                area_of_specialization: { type: 'string' },
                majors: { type: 'array', items: { type: 'string' } },
                graduation_year: { type: 'string' },
              },
            },
          },
          professional_experience: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                company_name: { type: 'string' },
                title: { type: 'string' },
                start_year: { type: 'string' },
                end_year: { type: 'string' },
              },
            },
          },
          board_memberships: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                organization_name: { type: 'string' },
                role: { type: 'string' },
                start_year: { type: 'string' },
                end_year: { type: 'string' },
              },
            },
          },
        },
      },
    });

    // Build update data — only update fields that were extracted and are richer
    const updateData: any = { bio_url: profile_url };
    const updatedFields: string[] = ['Profile URL'];

    const bio = formatBioParagraphs(cleanStr(res?.biography));
    if (bio && bio.length > (contact.biography || '').length) {
      updateData.biography = bio;
      updatedFields.push('Biography');
    }
    const ttl = cleanStr(res?.title);
    if (ttl && (!contact.title || ttl.length >= contact.title.length)) {
      updateData.title = ttl;
      updatedFields.push('Title');
    }
    const eml = cleanStr(res?.email);
    if (eml && !contact.email) {
      updateData.email = eml;
      updatedFields.push('Email');
    }
    const phn = cleanStr(res?.phone);
    if (phn && (!contact.phones || contact.phones.length === 0)) {
      const parsed = parsePhone(phn);
      if (parsed) {
        updateData.phones = [...(contact.phones || []), { id: crypto.randomUUID(), ...parsed, is_default: false }];
        updatedFields.push('Phone');
      }
    }
    const photo = cleanStr(res?.photo_url);
    if (photo && !contact.photo_url) {
      updateData.photo_url = photo;
      updatedFields.push('Photo');
    }
    if (Array.isArray(res?.designations) && res.designations.length > 0) {
      const existing = new Set((contact.designations || []).map((d: string) => d.toLowerCase()));
      const newOnes = res.designations.filter((d: string) => d && !existing.has(d.toLowerCase()));
      if (newOnes.length > 0) {
        updateData.designations = [...(contact.designations || []), ...newOnes];
        updatedFields.push('Designations');
      }
    }
    if (Array.isArray(res?.education) && res.education.length > 0) {
      const existingEdu = contact.education || [];
      const eduKey = (e: any) => `${(e.institution || '').toLowerCase()}|${(e.degree || '').toLowerCase()}|${(e.graduation_year || '').toLowerCase()}`;
      const existingKeys = new Set(existingEdu.map(eduKey));
      const newEdu = res.education
        .filter((e: any) => e && (e.institution || e.degree))
        .filter((e: any) => { const k = eduKey(e); if (existingKeys.has(k)) return false; existingKeys.add(k); return true; })
        .map((e: any) => ({ ...e, id: crypto.randomUUID(), majors: Array.isArray(e.majors) ? e.majors : [], minors: [] }));
      if (newEdu.length > 0) {
        updateData.education = [...existingEdu, ...newEdu];
        updatedFields.push('Education');
      }
    }
    if (Array.isArray(res?.professional_experience) && res.professional_experience.length > 0) {
      const existingExp = contact.professional_experience || [];
      const expKey = (e: any) => `${(e.company_name || '').toLowerCase()}|${(e.title || '').toLowerCase()}|${(e.start_year || '').toLowerCase()}`;
      const existingKeys = new Set(existingExp.map(expKey));
      const newExp = res.professional_experience
        .filter((e: any) => e && (e.company_name || e.title))
        .filter((e: any) => { const k = expKey(e); if (existingKeys.has(k)) return false; existingKeys.add(k); return true; })
        .map((e: any) => ({ ...e, id: crypto.randomUUID() }));
      if (newExp.length > 0) {
        updateData.professional_experience = [...existingExp, ...newExp];
        updatedFields.push('Experience');
      }
    }
    if (Array.isArray(res?.board_memberships) && res.board_memberships.length > 0) {
      const existingBoards = contact.board_memberships || [];
      const merged = mergeBoardMemberships(existingBoards, res.board_memberships);
      if (merged.length > existingBoards.length) {
        updateData.board_memberships = merged;
        updatedFields.push('Board Memberships');
      }
    }

    // Update the contact
    await base44.entities.Contact.update(contact_id, updateData);

    return Response.json({
      success: true,
      profile_url,
      updated_fields: updatedFields,
      extracted: {
        biography: bio,
        title: ttl,
        email: eml,
        phone: phn,
        photo_url: photo,
        designations: res?.designations || [],
        education: res?.education || [],
        professional_experience: res?.professional_experience || [],
        board_memberships: res?.board_memberships || [],
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}