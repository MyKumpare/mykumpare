import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { firm_id, website, firm_name } = await req.json();
    if (!firm_id || !website) {
      return Response.json({ error: 'firm_id and website are required' }, { status: 400 });
    }

    // Re-scrape the firm website to get fresh, rehosted photo URLs
    const enrichResponse = await base44.functions.invoke('enrichFirmFromWebsite', {
      website,
      firm_name: firm_name || '',
    });
    const enrichedData = enrichResponse?.data || enrichResponse;

    if (!enrichedData?.people || enrichedData.people.length === 0) {
      return Response.json({ updated: 0, message: 'No people found on website' });
    }

    // Fetch existing contacts for the firm
    const contacts = await base44.entities.Contact.filter({ firm_ids: firm_id });

    const nameKey = (first, last) =>
      `${(first || '').toLowerCase().trim()}|${(last || '').toLowerCase().trim()}`;

    const contactMap = new Map();
    for (const c of contacts) {
      contactMap.set(nameKey(c.first_name, c.last_name), c);
    }

    let updated = 0;
    const updatedNames = [];

    for (const person of enrichedData.people) {
      if (!person.photo_url) continue;
      const key = nameKey(person.first_name, person.last_name);
      const existing = contactMap.get(key);
      if (existing && person.photo_url !== existing.photo_url) {
        await base44.entities.Contact.update(existing.id, { photo_url: person.photo_url });
        updated++;
        updatedNames.push(`${person.first_name} ${person.last_name}`);
      }
    }

    return Response.json({
      updated,
      total_people: enrichedData.people.length,
      updated_names: updatedNames,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});