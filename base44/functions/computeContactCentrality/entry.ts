import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { buildContactNetwork, formatName } from '../../shared/contactNetwork.ts';

/**
 * Computes network-centrality metrics and an influence rank for a single
 * contact. Builds the full contact graph (so betweenness is accurate), then
 * returns the requested contact's degree, betweenness, total connection
 * strength, composite importance score, and their rank among all connected
 * contacts.
 *
 * Input:  { contact_id: string }
 * Returns: { contact_id, degree, betweenness, totalStrength, importance,
 *            rank, totalConnected, percentile, tier }
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const contactId = body?.contact_id;
    if (!contactId) {
      return Response.json({ error: 'contact_id is required' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    const contacts = await sr.entities.Contact.list('-created_date', 5000);

    const network = buildContactNetwork(contacts);
    const c = network.contactMap.get(contactId);

    if (!c) {
      return Response.json({ error: 'Contact not found' }, { status: 404 });
    }

    const centrality = network.centrality.get(contactId) || {
      id: contactId, degree: 0, totalStrength: 0, betweenness: 0, importance: 0,
    };

    // Rank: 1-based position in the sorted-by-importance list (connected contacts only)
    const rankIndex = network.sortedByImportance.findIndex((x) => x.id === contactId);
    const rank = rankIndex >= 0 ? rankIndex + 1 : null; // null = not connected to anyone
    const totalConnected = network.sortedByImportance.length;

    // Percentile: top X% among connected contacts (lower rank = higher percentile)
    let percentile = null;
    if (rank && totalConnected > 0) {
      percentile = Math.round((1 - (rank - 1) / totalConnected) * 100);
    }

    // Tier based on importance score
    const imp = centrality.importance;
    let tier = 'Isolated';
    if (imp >= 30) tier = 'Key Stakeholder';
    else if (imp >= 15) tier = 'Influencer';
    else if (imp >= 6) tier = 'Connector';
    else if (imp >= 1) tier = 'Emerging';

    return Response.json({
      contact_id: contactId,
      contact_name: formatName(c),
      degree: centrality.degree,
      betweenness: centrality.betweenness,
      totalStrength: centrality.totalStrength,
      importance: centrality.importance,
      rank,
      totalConnected,
      totalContacts: network.stats.totalContacts,
      percentile,
      tier,
    });
  } catch (error) {
    console.error('[computeContactCentrality] Error:', error);
    return Response.json(
      { error: 'Failed to compute contact centrality', details: error.message || String(error) },
      { status: 500 }
    );
  }
}