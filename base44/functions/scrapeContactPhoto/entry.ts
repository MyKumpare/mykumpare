import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { cleanStr } from '../../shared/enrichmentUtils.ts';
import { discoverContactPhoto } from '../../shared/contactPhotoScrape.ts';

/**
 * Scrapes a single contact's headshot/photo. Tries the related firm's website
 * first (people page → photo, or individual profile → photo), then falls back
 * to a general web search via InvokeLLM. Updates the contact's photo_url when
 * a photo is found and the contact has no photo yet (does not overwrite an
 * existing photo unless force=true).
 */

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { contact_id, force } = body;
    if (!contact_id) return Response.json({ error: 'contact_id is required' }, { status: 400 });

    const contact = await base44.entities.Contact.get(contact_id);
    if (!contact) return Response.json({ error: 'Contact not found' }, { status: 404 });

    const firstName = cleanStr(contact.first_name) || '';
    const lastName = cleanStr(contact.last_name) || '';
    const fullName = `${firstName} ${lastName}`.trim();
    if (!fullName) return Response.json({ error: 'Contact has no name to search for' }, { status: 400 });

    // Don't overwrite an existing photo unless the user explicitly forces it.
    if (contact.photo_url && !force) {
      return Response.json({
        success: false,
        message: 'This contact already has a photo. Use "force: true" to overwrite.',
        existing_photo: true,
      });
    }

    const firmIds: string[] = Array.isArray(contact.firm_ids) ? contact.firm_ids : [];
    const { photo_url, source, sources_tried } = await discoverContactPhoto(
      base44, fullName, firstName, lastName, firmIds,
    );

    if (!photo_url) {
      return Response.json({
        success: false,
        message: 'No photo could be found on the firm website(s) or the general web.',
        sources_tried: sources_tried,
      });
    }

    await base44.entities.Contact.update(contact_id, { photo_url });

    return Response.json({
      success: true,
      photo_url,
      source,
      sources_tried,
      updated_fields: ['photo_url'],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}