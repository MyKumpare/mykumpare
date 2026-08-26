import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { fetchPage, cleanStr } from '../../shared/enrichmentUtils.ts';
import {
  normalizeName, isStubBio, discoverPeoplePage, discoverBioUrlByPattern,
  extractPeopleFromPage, extractBiographyFromPage,
} from '../../shared/contactBioScrape.ts';

/**
 * Targeted enrichment: fetches the firm's people page, extracts all personnel,
 * matches them to existing contacts, and fetches individual biography pages
 * ONLY for matched contacts with empty/stub bios. This is faster than the
 * full enrichFirmFromWebsite because it skips firm-level extraction and only
 * fetches bio pages for contacts that actually need them (bounded to existing
 * contacts, not all people on the page).
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { firm_id, website_url } = body;
    if (!firm_id) return Response.json({ error: 'firm_id is required' }, { status: 400 });

    const firm = await base44.asServiceRole.entities.Firm.get(firm_id);
    if (!firm) return Response.json({ error: 'Firm not found' }, { status: 404 });

    const website = website_url || firm.website || '';
    if (!website) return Response.json({ error: 'No website URL available for this firm' }, { status: 400 });

    // Discover the people page.
    const peoplePageUrl = await discoverPeoplePage(website);
    if (!peoplePageUrl) {
      return Response.json({ error: 'Could not find a people/team page on the website' }, { status: 404 });
    }

    // Fetch and extract all people from the people page.
    const peoplePageText = await fetchPage(peoplePageUrl);
    if (!peoplePageText || peoplePageText.length < 100) {
      return Response.json({ error: 'People page has no content' }, { status: 502 });
    }
    const people = await extractPeopleFromPage(base44, peoplePageText);
    if (people.length === 0) {
      return Response.json({ firm: firm.name, peoplePageUrl, updated: [], message: 'No people found on the page' });
    }

    // Load contacts linked to this firm.
    const allContacts = await base44.asServiceRole.entities.Contact.list(null, 500);
    const firmContacts = allContacts.filter((c: any) => !c.deleted_at && (c.firm_ids || []).includes(firm.id));
    const contactsByKey = new Map<string, any>();
    for (const c of firmContacts) {
      const full = `${c.first_name || ''} ${c.last_name || ''}`.trim();
      contactsByKey.set(normalizeName(full), c);
    }

    // Match and identify contacts needing bios.
    const toEnrich: { person: any; contact: any }[] = [];
    for (const person of people) {
      const personFull = `${person.first_name || ''} ${person.last_name || ''}`.trim();
      const key = normalizeName(personFull);
      const match = contactsByKey.get(key);
      if (!match) continue;
      toEnrich.push({ person, contact: match });
    }

    if (toEnrich.length === 0) {
      return Response.json({ firm: firm.name, peoplePageUrl, peopleFound: people.length, updated: [], message: 'No matched contacts needing updates' });
    }

    // For each matched contact, fill empty fields and fetch biography if needed.
    const CONCURRENCY = 5;
    const updates: any[] = [];
    let cursor = 0;

    const worker = async () => {
      while (cursor < toEnrich.length) {
        const i = cursor++;
        const { person, contact } = toEnrich[i];
        const fullName = `${person.first_name || ''} ${person.last_name || ''}`.trim();
        const updateData: any = {};
        const updatedFields: string[] = [];

        // Fill empty scalar fields (append-only, never overwrite).
        if (person.title && !(contact.title || '').trim()) {
          updateData.title = person.title;
          updatedFields.push('Title');
        }
        if (person.photo_url && !(contact.photo_url || '').trim()) {
          updateData.photo_url = person.photo_url;
          updatedFields.push('Photo');
        }

        // Biography: fetch if contact has empty/stub bio.
        if (isStubBio(contact.biography, contact.first_name)) {
          let bioUrl = person.bio_url || '';
          if (!bioUrl) {
            bioUrl = await discoverBioUrlByPattern(peoplePageUrl, person.first_name, person.last_name);
          }
          if (bioUrl) {
            const bio = await extractBiographyFromPage(base44, fullName, bioUrl);
            if (bio && bio.length > 60) {
              updateData.biography = bio;
              updatedFields.push('Biography');
            }
          }
        }

        if (Object.keys(updateData).length > 0) {
          try {
            await base44.asServiceRole.entities.Contact.update(contact.id, updateData);
            updates.push({
              contact_id: contact.id,
              name: fullName,
              updated_fields: updatedFields,
              bio_len: updateData.biography ? updateData.biography.length : 0,
            });
          } catch (e) {
            updates.push({ contact_id: contact.id, name: fullName, error: e.message });
          }
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, toEnrich.length) }, () => worker()));

    return Response.json({
      firm: firm.name,
      peoplePageUrl,
      peopleFound: people.length,
      contactsMatched: toEnrich.length,
      updated: updates,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});