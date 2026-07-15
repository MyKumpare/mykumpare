import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const CONNECTOR_ID = "6a57a54557aaca4950831c3f";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { first_name, last_name, firm_name, current_title } = body || {};
    if (!first_name || !last_name) {
      return Response.json({ error: 'first_name and last_name are required' }, { status: 400 });
    }

    // Verify the user has connected their LinkedIn account
    let linkedinConnected = false;
    try {
      const conn = await base44.asServiceRole.connectors.getCurrentAppUserConnection(CONNECTOR_ID);
      if (conn?.accessToken) linkedinConnected = true;
    } catch (e) {
      // Not connected yet
    }

    if (!linkedinConnected) {
      return Response.json({
        error: 'LinkedIn not connected',
        message: 'Please connect your LinkedIn account first.',
        needs_connection: true,
      }, { status: 403 });
    }

    // Use LLM with web search to find the LinkedIn profile URL
    // The LinkedIn API doesn't support arbitrary people search, so we use web search
    // to find the profile URL by name + company, which is the practical approach.
    const searchContext = [
      `Person name: ${first_name} ${last_name}`,
      firm_name ? `Company/Firm: ${firm_name}` : '',
      current_title ? `Title: ${current_title}` : '',
    ].filter(Boolean).join('\n');

    const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Find the LinkedIn profile URL for this person. Search the web for their LinkedIn profile.\n\n${searchContext}\n\nReturn ONLY a valid LinkedIn profile URL in the format https://www.linkedin.com/in/username or https://www.linkedin.com/pub/... \nIf you find multiple possible profiles, return the one that best matches based on company and title.\nIf you cannot find a matching LinkedIn profile, return empty string for linkedin_url.\n\nDo not return company LinkedIn pages (linkedin.com/company/...) — only personal profiles (linkedin.com/in/...).`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          linkedin_url: { type: "string", description: "The LinkedIn profile URL, or empty string if not found" },
          confidence: { type: "string", enum: ["high", "medium", "low"], description: "Confidence that this is the correct person" },
          headline: { type: "string", description: "The person's LinkedIn headline if visible, or empty string" },
        },
        required: ["linkedin_url"],
      },
      model: "gemini_3_flash",
    });

    const result = llmResponse?.linkedin_url ? {
      linkedin_url: llmResponse.linkedin_url.trim(),
      confidence: llmResponse.confidence || "unknown",
      headline: llmResponse.headline || "",
    } : { linkedin_url: "", message: "No LinkedIn profile found for this person." };

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to lookup LinkedIn profile' }, { status: 500 });
  }
});