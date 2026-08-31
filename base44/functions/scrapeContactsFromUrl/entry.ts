import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchPage, cleanStr, parsePhone } from '../../shared/enrichmentUtils.ts';
import { formatBioParagraphs } from '../../shared/contactBioScrape.ts';
import { assertSafePublicUrl } from '../../shared/urlSafety.ts';

/**
 * Scrape contacts from a dedicated URL. Fetches the page, extracts all people
 * using an LLM, discovers and follows sub-page links (multiple layers — e.g.
 * team page linking to "Investment Team", "Research Team" sub-pages), and for
 * each person with a bio_url, drills into their individual profile page to
 * extract full details (biography, email, phone, education, experience,
 * designations). Returns a list of enriched contacts for the frontend to
 * review and import.
 */

const TIME_BUDGET_MS = 50_000; // 50s internal budget — stays well under proxy/SDK timeout
const MAX_SUB_PAGES = 3;
const MAX_BIO_DRILL = 8;
const BIO_CONCURRENCY = 4;

// Designation patterns to strip from name fields (e.g. "Best, CFA" → "Best").
const DESIGNATION_RE = /\s*,?\s*(CFA|CPA|MBA|Ph\.?D|M\.D|J\.D|LL\.M|CFP|FRM|CAIA|CMT|ChFC|PMP|ASA|FSA|EA|CIIA|CISI|FMVA|CBCP)\b\s*$/i;

function stripTrailingDesignations(name: string): string {
  if (!name) return name;
  let cleaned = name;
  for (let i = 0; i < 5; i++) {
    const next = cleaned.replace(DESIGNATION_RE, '');
    if (next === cleaned) break;
    cleaned = next;
  }
  return cleaned.trim();
}

// Discover sub-pages (multiple layers) from the main page's internal links.
// Follows links that look like team/staff/people/profile sub-pages.
function discoverSubPages(pageText: string, baseUrl: string, visited: Set<string>): string[] {
  let baseHost = '';
  try { baseHost = new URL(baseUrl).host.toLowerCase(); } catch { return []; }
  const linkRegex = /\[LINK:\s*(https?:\/\/[^\]]+)\]/gi;
  const subPages: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(pageText)) !== null) {
    const url = m[1];
    if (visited.has(url)) continue;
    let linkHost = '';
    try { linkHost = new URL(url).host.toLowerCase(); } catch { continue; }
    if (linkHost !== baseHost) continue;
    if (/\/(people|our-people|team|our-team|leadership|staff|investment-staff|investment-team|investment-team-tab|investment-professionals|personnel|professionals|members|bio|biography|profile)\b/i.test(url)) {
      visited.add(url);
      subPages.push(url);
    }
  }
  return subPages.slice(0, MAX_SUB_PAGES);
}

// Extract all people from a page using LLM.
async function extractPeopleFromPage(base44: any, pageText: string): Promise<any[]> {
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Extract EVERY person listed on this page. Return ALL of them — do not stop after the first few.

For each person, provide:
- first_name (given name ONLY — no salutations like "Mr." and no designations like "CFA")
- last_name (family name ONLY — no designations. "Best, CFA" → last_name "Best". Designations go in the designations field, NOT here)
- title (their role/position)
- photo_url (the src URL from the [IMAGE: ...] marker closest to their name)
- bio_url (if their name is a link to an individual profile page, use that [LINK: ...] URL; otherwise leave empty)

IMPORTANT: Never include professional designations (CFA, CPA, MBA, PhD, CFP, FRM, CAIA, etc.) in first_name or last_name. Put them only in the designations field.

The page may be organized in sections (Executive, Investment Team, Research, Operations, etc.). Go through EVERY section and extract EVERY person. If you see 40+ people, return all 40+.

--- PAGE CONTENT ---
${pageText.substring(0, 30000)}
--- END ---`,
      response_json_schema: {
        type: 'object',
        properties: {
          people: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                first_name: { type: 'string' },
                last_name: { type: 'string' },
                title: { type: 'string' },
                photo_url: { type: 'string' },
                bio_url: { type: 'string' },
                designations: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
    });
    const people = res?.people || [];
    for (const p of people) {
      p.photo_url = cleanStr(p.photo_url);
      p.bio_url = cleanStr(p.bio_url);
      p.title = cleanStr(p.title);
      // Strip trailing designations from name fields (defensive — the prompt
      // asks the LLM not to include them, but it sometimes does anyway).
      p.first_name = stripTrailingDesignations(cleanStr(p.first_name));
      p.last_name = stripTrailingDesignations(cleanStr(p.last_name));
      if (!Array.isArray(p.designations)) p.designations = [];
    }
    return people.filter((p: any) => p.first_name || p.last_name);
  } catch {
    return [];
  }
}

// Extract full details from an individual profile/bio page.
async function extractContactDetails(base44: any, personName: string, bioUrl: string): Promise<any | null> {
  const pageText = await fetchPage(bioUrl);
  if (!pageText || pageText.length < 50) return null;
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are extracting information about a specific person from their individual profile/biography page.

Person name: "${personName}"

FIRST, determine if this page is a person profile/biography page. If it is NOT (e.g. it's a document, report, article, blog post, research paper, strategy overview, or market commentary), return empty for ALL fields and empty arrays — do NOT try to extract a person from a document title or heading.

If this IS a person profile page, locate the section describing THIS person (often near their name, under a heading like "Biography", "About", "Profile", or "Overview").
IMPORTANT: Many sites use collapsible/accordion sections for detailed information. Look for sections labeled "PROFESSIONAL EXPERIENCE", "EDUCATION", "CREDENTIALS", "EDUCATION AND CREDENTIALS", "EDUCATION, CREDENTIALS AND MEMBERSHIPS", "SERVICE AREAS", or similar. The content of these sections IS present in the page text even though they appear collapsed on the visual page — extract ALL information from them.

EXTRACT THESE FIELDS:

1. biography: the COMPLETE biography text for this person. Copy VERBATIM — do not summarize, paraphrase, or truncate. Include EVERY paragraph. PRESERVE PARAGRAPH BREAKS: separate each paragraph with a double newline (\\n\\n) — do NOT collapse the entire bio into a single block of text; keep the original paragraph structure.
2. title: their job title/role as it appears on the page.
3. email: any email address listed for this person.
4. phone: any phone number listed for this person (include area code).
5. photo_url: the URL of their profile photo. Images appear as [IMAGE: alt="..." src="https://..."] markers — find the one closest to the person's name.
6. linkedin_url: the person's LinkedIn profile URL. LinkedIn links appear as [LINK: https://www.linkedin.com/in/...] or [LINK: https://linkedin.com/in/...] markers in the page text. Extract the full URL. If none found, leave empty.
7. designations: any professional designations/certifications (e.g. "CFA", "CFP", "CPA", "MBA", "PhD", "Chartered Financial Analyst"). Return as an array of strings.
8. education: every school/college/university the person attended as a student, with institution, degree, area_of_specialization, majors (array), graduation_year. Only include institutions they attended as a student, NOT firms where they worked.
9. professional_experience: every employer/company mentioned INCLUDING their current firm, with company_name, title, start_year, end_year (leave end_year empty if current employer). Order from most recent to oldest.

--- PAGE CONTENT ---
${pageText.substring(0, 12000)}
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
          linkedin_url: { type: 'string' },
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
        },
      },
    });
    return {
      biography: formatBioParagraphs(cleanStr(res?.biography)),
      title: cleanStr(res?.title),
      email: cleanStr(res?.email),
      phone: cleanStr(res?.phone),
      photo_url: cleanStr(res?.photo_url),
      linkedin_url: cleanStr(res?.linkedin_url),
      designations: (Array.isArray(res?.designations) ? res.designations : []).map(cleanStr).filter(Boolean),
      education: (Array.isArray(res?.education) ? res.education : []).filter((e: any) => e && (e.institution || e.degree)),
      professional_experience: (Array.isArray(res?.professional_experience) ? res.professional_experience : []).filter((e: any) => e && (e.company_name || e.title)),
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { url } = body;
    if (!url) return Response.json({ error: 'url is required' }, { status: 400 });

    try { await assertSafePublicUrl(url); } catch {
      return Response.json({ error: 'Invalid or unsafe URL' }, { status: 400 });
    }

    const startTime = Date.now();
    const timeLeft = () => TIME_BUDGET_MS - (Date.now() - startTime);

    // 1. Fetch the main page.
    const mainPageText = await fetchPage(url);
    if (!mainPageText || mainPageText.length < 100) {
      return Response.json({ error: 'Could not fetch the page. The site may be blocking automated access or the page has no content.' }, { status: 502 });
    }

    // 2. Extract people from the main page.
    let allPeople = await extractPeopleFromPage(base44, mainPageText);

    // 3. Discover and scrape sub-pages (multiple layers).
    const visited = new Set<string>([url]);
    const subPagesScraped: string[] = [];
    const subPages = discoverSubPages(mainPageText, url, visited);
    for (const subUrl of subPages) {
      if (timeLeft() < 20000) break;
      try {
        const subText = await fetchPage(subUrl);
        if (subText && subText.length > 200) {
          const subPeople = await extractPeopleFromPage(base44, subText);
          allPeople = [...allPeople, ...subPeople];
          subPagesScraped.push(subUrl);
        }
      } catch { /* continue to next sub-page */ }
    }

    // Deduplicate people by normalized first+last name.
    const seen = new Set<string>();
    const deduped: any[] = [];
    for (const p of allPeople) {
      const key = `${(p.first_name || '').toLowerCase().trim()}|${(p.last_name || '').toLowerCase().trim()}`;
      if (!key || key === '|' || seen.has(key)) continue;
      seen.add(key);
      deduped.push(p);
    }

    if (deduped.length === 0) {
      return Response.json({ url, subPagesScraped, contacts: [], message: 'No people found on the page' });
    }

    // 4. Build the contact list with basic info from the listing page.
    const contacts = deduped.map((p) => ({
      first_name: p.first_name || '',
      last_name: p.last_name || '',
      title: p.title || '',
      photo_url: p.photo_url || '',
      bio_url: p.bio_url || '',
      biography: '',
      email: '',
      linkedin_url: '',
      phones: [] as any[],
      designations: (Array.isArray(p.designations) ? p.designations.map(cleanStr).filter(Boolean) : []),
      education: [] as any[],
      professional_experience: [] as any[],
      drilled: false,
    }));

    // 5. Drill into individual bio pages for full details (bounded by time + count).
    const toDrill = deduped.filter((p) => p.bio_url).slice(0, MAX_BIO_DRILL);
    let drillCursor = 0;

    const drillWorker = async () => {
      while (drillCursor < toDrill.length && timeLeft() > 12000) {
        const i = drillCursor++;
        const person = toDrill[i];
        const fullName = `${person.first_name || ''} ${person.last_name || ''}`.trim();
        const details = await extractContactDetails(base44, fullName, person.bio_url);
        if (!details) continue;
        const idx = contacts.findIndex((c) =>
          c.first_name === person.first_name && c.last_name === person.last_name
        );
        if (idx < 0) continue;
        const c = contacts[idx];
        c.drilled = true;
        if (details.biography) c.biography = details.biography;
        if (details.title) c.title = details.title;
        if (details.email) c.email = details.email;
        if (details.linkedin_url) c.linkedin_url = details.linkedin_url;
        if (details.photo_url && !c.photo_url) c.photo_url = details.photo_url;
        if (details.designations.length > 0) {
          c.designations = [...new Set([...c.designations, ...details.designations])].filter(Boolean);
        }
        if (details.phone) {
          const parsed = parsePhone(details.phone);
          if (parsed) c.phones = [{ id: crypto.randomUUID(), ...parsed, is_default: false }];
        }
        if (details.education.length > 0) {
          c.education = details.education.map((e) => ({
            ...e,
            id: crypto.randomUUID(),
            majors: Array.isArray(e.majors) ? e.majors : [],
            minors: [],
          }));
        }
        if (details.professional_experience.length > 0) {
          c.professional_experience = details.professional_experience.map((e) => ({
            ...e,
            id: crypto.randomUUID(),
          }));
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(BIO_CONCURRENCY, toDrill.length) }, () => drillWorker()));

    return Response.json({
      url,
      subPagesScraped,
      totalPeopleFound: deduped.length,
      drilledCount: toDrill.length,
      contacts,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});