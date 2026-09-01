import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const contactId = body.contact_id;
    if (!contactId) return Response.json({ error: 'contact_id is required' }, { status: 400 });

    // Get Outlook connection (SHARED — builder's account)
    let accessToken;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('outlook');
      accessToken = conn.accessToken;
    } catch (e) {
      return Response.json({
        error: 'Outlook is not connected. Please authorize the Contacts.ReadWrite permission.',
        notConnected: true
      }, { status: 400 });
    }

    // Fetch the full contact record
    const contact = await base44.asServiceRole.entities.Contact.get(contactId);
    if (!contact) return Response.json({ error: 'Contact not found' }, { status: 404 });

    // Fetch associated firms for company name + website
    const firmIds = contact.firm_ids || [];
    let firm = null;
    if (firmIds.length) {
      firm = await base44.asServiceRole.entities.Firm.get(firmIds[0]).catch(() => null);
    }

    // Build Graph contact object
    const graphContact = {
      givenName: contact.first_name || '',
      middleName: contact.middle_name || '',
      surname: contact.last_name || '',
      displayName: [contact.salutation, contact.first_name, contact.last_name].filter(Boolean).join(' ') +
        (contact.suffix ? `, ${contact.suffix}` : ''),
      companyName: firm?.name || '',
      jobTitle: contact.title || '',
      emailAddresses: contact.email
        ? [{ address: contact.email, name: [contact.first_name, contact.last_name].filter(Boolean).join(' ') }]
        : [],
      businessPhones: (contact.phones || []).map((p) =>
        [p.country_code ? `+${p.country_code}` : null,
         p.area_code ? `(${p.area_code})` : null,
         [p.number_mid, p.number_last].filter(Boolean).join('-') || null]
          .filter(Boolean).join(' ')
      ).filter(Boolean),
      businessHomePage: firm?.website || '',
      personalNotes: 'Synced from MyKumpare',
    };

    // Add business address if available
    const primaryAddr = (contact.addresses || []).find((a) => a.is_primary) || (contact.addresses || [])[0];
    if (primaryAddr) {
      graphContact.businessAddress = {
        street: [primaryAddr.address_line1, primaryAddr.address_line2].filter(Boolean).join(', ') || '',
        city: primaryAddr.city || '',
        state: primaryAddr.state || '',
        postalCode: primaryAddr.postal_code || '',
        countryOrRegion: primaryAddr.country || '',
      };
    }

    // Create the contact in Outlook
    const res = await fetch('https://graph.microsoft.com/v1.0/me/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(graphContact)
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 401 || res.status === 403) {
        return Response.json({
          error: 'Outlook Contacts permission is missing. Please authorize the Contacts.ReadWrite permission.',
          notConnected: true,
          scopeError: true
        }, { status: 400 });
      }
      throw new Error(`Outlook API error: ${res.status} ${text.substring(0, 200)}`);
    }

    const data = await res.json();

    return Response.json({
      success: true,
      outlook_contact_id: data.id,
      display_name: graphContact.displayName
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}