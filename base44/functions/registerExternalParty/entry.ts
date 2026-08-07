import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Public endpoint: creates an ExternalPartyRequest without requiring auth.
// Called from the public registration page (/register).
// Also checks for existing/similar firm names to flag for admin review.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));

    // Validate required fields
    const required = ['firm_name', 'first_name', 'last_name', 'email'];
    for (const field of required) {
      if (!body[field] || !String(body[field]).trim()) {
        return Response.json({ error: `${field} is required` }, { status: 400 });
      }
    }

    // Capitalize first letter of names
    const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

    // Check for existing firms with similar/exact names
    const existingFirms = await svc.entities.Firm.list('-created_date', 5000);
    const activeFirms = existingFirms.filter(f => !f.deleted_at);

    const normalizeName = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedNew = normalizeName(body.firm_name);

    const exactMatch = activeFirms.find(f => normalizeName(f.name) === normalizedNew);
    const similarMatches = activeFirms.filter(f => {
      const norm = normalizeName(f.name);
      if (norm === normalizedNew) return false;
      if (norm.length < 4 || normalizedNew.length < 4) return false;
      return norm.includes(normalizedNew) || normalizedNew.includes(norm);
    });

    // Check if this is the first request from this firm (for default admin)
    const existingRequests = await svc.entities.ExternalPartyRequest.filter(
      { firm_name: body.firm_name, status: { $in: ['pending', 'approved'] } }
    );
    const isFirstUser = existingRequests.length === 0;

    // Create the request
    const request = await svc.entities.ExternalPartyRequest.create({
      firm_name: body.firm_name.trim(),
      firm_types: body.firm_types || [],
      salutation: body.salutation || undefined,
      first_name: cap(body.first_name.trim()),
      middle_name: body.middle_name ? cap(body.middle_name.trim()) : undefined,
      last_name: cap(body.last_name.trim()),
      suffix: body.suffix || undefined,
      email: body.email.trim().toLowerCase(),
      phone: body.phone || undefined,
      status: 'pending',
      is_first_user: isFirstUser,
    });

    return Response.json({
      success: true,
      request_id: request.id,
      is_first_user: isFirstUser,
      firm_match: exactMatch ? { id: exactMatch.id, name: exactMatch.name, exact: true } : null,
      similar_firms: similarMatches.slice(0, 5).map(f => ({ id: f.id, name: f.name })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});