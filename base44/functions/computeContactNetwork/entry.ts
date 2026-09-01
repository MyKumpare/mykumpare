import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { buildContactNetwork, formatName, bfsShortestPath, type ContactRecord } from "../../shared/contactNetwork.ts";

/**
 * Computes the full contact-to-contact network with connection strength,
 * centrality metrics, and key-node identification.
 *
 * Connections between contacts are derived from:
 *   - Shared firms (firm_ids overlap)          → strength 2 per shared firm
 *   - Shared education institution              → strength 1 per shared school
 *   - Shared professional experience company    → strength 1 per shared company
 *   - Shared board membership organization      → strength 1.5 per shared board
 *
 * For each contact we compute:
 *   - degree: number of connected contacts
 *   - totalStrength: sum of edge strengths
 *   - betweenness: approximate betweenness centrality
 *   - importance: composite score = degree * 2 + totalStrength + betweenness * 0.1
 *
 * Key nodes are the top 15 contacts by importance.
 *
 * If sourceId and targetId are provided in the body, also computes the
 * shortest path between those two contacts.
 */

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const sr = base44.asServiceRole;

    const contacts: ContactRecord[] = await sr.entities.Contact.list("-created_date", 5000);
    const network = buildContactNetwork(contacts);

    const { activeContacts, contactMap, edges, adjacency, centrality, sortedByImportance } = network;

    // ── Key nodes: top 15 ──
    const keyNodeIds = new Set(sortedByImportance.slice(0, 15).map((x) => x.id));

    // ── Nodes ──
    const nodes = activeContacts.map((c) => {
      const cent = centrality.get(c.id)!;
      return {
        id: c.id,
        label: formatName(c),
        title: c.title,
        photo_url: c.photo_url,
        decision_role: c.decision_role,
        degree: cent.degree,
        totalStrength: cent.totalStrength,
        betweenness: cent.betweenness,
        importance: cent.importance,
        isKeyNode: keyNodeIds.has(c.id),
      };
    });

    // ── Stats ──
    const connectedContacts = nodes.filter((n) => n.degree > 0).length;
    const avgStrength =
      edges.length > 0
        ? Math.round((edges.reduce((s, e) => s + e.strength, 0) / edges.length) * 10) / 10
        : 0;

    const roleDistribution: Record<string, number> = {};
    nodes.forEach((n) => {
      const role = n.decision_role || "Unassigned";
      roleDistribution[role] = (roleDistribution[role] || 0) + 1;
    });

    // ── Path ──
    let pathResult = null;
    if (body?.sourceId && body?.targetId) {
      const path = bfsShortestPath(adjacency, body.sourceId, body.targetId);
      if (path) {
        const pathEdges: any[] = [];
        for (let i = 0; i < path.length - 1; i++) {
          const edge = edges.find(
            (e) =>
              (e.source === path[i] && e.target === path[i + 1]) ||
              (e.source === path[i + 1] && e.target === path[i])
          );
          if (edge) {
            pathEdges.push({
              from: path[i],
              to: path[i + 1],
              strength: edge.strength,
              reasons: edge.reasons,
            });
          }
        }
        pathResult = {
          path: path.map((id) => ({
            id,
            label: formatName(contactMap.get(id) || ({} as ContactRecord)),
            title: contactMap.get(id)?.title,
          })),
          edges: pathEdges,
          length: path.length - 1,
        };
      }
    }

    return Response.json({
      nodes,
      edges: edges.map((e) => ({
        source: e.source,
        target: e.target,
        strength: Math.round(e.strength * 10) / 10,
        reasons: e.reasons,
      })),
      keyNodes: sortedByImportance.slice(0, 15).map((x, i) => {
        const c = contactMap.get(x.id)!;
        const cent = centrality.get(x.id)!;
        return {
          id: x.id,
          label: formatName(c),
          title: c.title,
          photo_url: c.photo_url,
          decision_role: c.decision_role,
          degree: cent.degree,
          totalStrength: cent.totalStrength,
          betweenness: cent.betweenness,
          importance: x.importance,
          rank: i + 1,
        };
      }),
      stats: {
        totalContacts: nodes.length,
        connectedContacts,
        totalEdges: edges.length,
        keyNodeCount: keyNodeIds.size,
        avgStrength,
        roleDistribution,
      },
      path: pathResult,
    });
  } catch (err: any) {
    console.error("[computeContactNetwork] Error:", err);
    return Response.json(
      { error: "Failed to compute contact network", details: err.message || String(err) },
      { status: 500 }
    );
  }
}