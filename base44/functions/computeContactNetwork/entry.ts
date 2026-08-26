import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

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

interface ContactRecord {
  id: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  salutation?: string;
  suffix?: string;
  title?: string;
  photo_url?: string;
  firm_ids?: string[];
  education?: Array<{ institution?: string }>;
  professional_experience?: Array<{ company_name?: string }>;
  board_memberships?: Array<{ organization_name?: string }>;
  decision_role?: string;
  deleted_at?: string;
}

interface EdgeReason {
  type: string;
  detail: string;
  weight: number;
}

function formatName(c: ContactRecord): string {
  return [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix]
    .filter(Boolean)
    .join(" ");
}

function norm(s: string | undefined | null): string {
  return (s || "").toLowerCase().trim();
}

/**
 * Betweenness centrality using Brandes' algorithm — O(n*(n+m)).
 * For each source s: BFS to get distances + path counts (sigma),
 * then backtrack accumulating dependency scores (delta).
 */
function computeBetweenness(
  adjacency: Map<string, Set<string>>,
  nodeIds: string[]
): Map<string, number> {
  const betweenness = new Map<string, number>();
  nodeIds.forEach((n) => betweenness.set(n, 0));

  for (const s of nodeIds) {
    // BFS from s
    const dist = new Map<string, number>();
    const sigma = new Map<string, number>();
    const queue: string[] = [s];
    const stack: string[] = [];
    const predecessors = new Map<string, string[]>();
    nodeIds.forEach((n) => predecessors.set(n, []));
    dist.set(s, 0);
    sigma.set(s, 1);

    while (queue.length > 0) {
      const u = queue.shift()!;
      stack.push(u);
      const du = dist.get(u)!;
      const neighbors = adjacency.get(u) || new Set<string>();
      for (const v of neighbors) {
        if (!dist.has(v)) {
          dist.set(v, du + 1);
          sigma.set(v, sigma.get(u)!);
          predecessors.get(v)!.push(u);
          queue.push(v);
        } else if (dist.get(v) === du + 1) {
          sigma.set(v, sigma.get(v)! + sigma.get(u)!);
          predecessors.get(v)!.push(u);
        }
      }
    }

    // Backtrack: accumulate dependencies
    const delta = new Map<string, number>();
    nodeIds.forEach((n) => delta.set(n, 0));

    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of (predecessors.get(w) || [])) {
        const ratio = (sigma.get(v) || 0) / (sigma.get(w) || 1);
        delta.set(v, delta.get(v)! + ratio * (1 + (delta.get(w) || 0)));
      }
      if (w !== s) {
        betweenness.set(w, betweenness.get(w)! + (delta.get(w) || 0));
      }
    }
  }

  return betweenness;
}

function bfsShortestPath(
  adjacency: Map<string, Set<string>>,
  start: string,
  end: string
): string[] | null {
  if (start === end) return [start];
  const queue: string[] = [start];
  const visited = new Set<string>([start]);
  const parent = new Map<string, string | null>([[start, null]]);

  while (queue.length > 0) {
    const u = queue.shift()!;
    const neighbors = adjacency.get(u) || new Set<string>();
    for (const v of neighbors) {
      if (visited.has(v)) continue;
      visited.add(v);
      parent.set(v, u);
      if (v === end) {
        const path: string[] = [];
        let cur: string | null = v;
        while (cur !== null) {
          path.unshift(cur);
          cur = parent.get(cur) || null;
        }
        return path;
      }
      queue.push(v);
    }
  }
  return null;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const sr = base44.asServiceRole;

    const contacts: ContactRecord[] = await sr.entities.Contact.list(
      "-created_date",
      5000
    );

    const active = contacts.filter((c) => !c.deleted_at);
    const contactMap = new Map<string, ContactRecord>();
    active.forEach((c) => contactMap.set(c.id, c));

    // ── Build edges ──
    const edgeMap = new Map<string, { source: string; target: string; strength: number; reasons: EdgeReason[] }>();

    function getEdge(a: string, b: string) {
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { source: a, target: b, strength: 0, reasons: [] });
      }
      return edgeMap.get(key)!;
    }

    // Shared firms
    const firmToContacts = new Map<string, string[]>();
    active.forEach((c) => {
      (c.firm_ids || []).forEach((fid) => {
        if (!firmToContacts.has(fid)) firmToContacts.set(fid, []);
        firmToContacts.get(fid)!.push(c.id);
      });
    });
    firmToContacts.forEach((contactIds) => {
      for (let i = 0; i < contactIds.length; i++) {
        for (let j = i + 1; j < contactIds.length; j++) {
          const edge = getEdge(contactIds[i], contactIds[j]);
          edge.strength += 2;
          edge.reasons.push({ type: "shared_firm", detail: "Shared firm", weight: 2 });
        }
      }
    });

    // Shared education
    const eduToContacts = new Map<string, string[]>();
    active.forEach((c) => {
      const seen = new Set<string>();
      (c.education || []).forEach((e) => {
        const inst = norm(e.institution);
        if (!inst || seen.has(inst)) return;
        seen.add(inst);
        if (!eduToContacts.has(inst)) eduToContacts.set(inst, []);
        eduToContacts.get(inst)!.push(c.id);
      });
    });
    eduToContacts.forEach((contactIds) => {
      for (let i = 0; i < contactIds.length; i++) {
        for (let j = i + 1; j < contactIds.length; j++) {
          const edge = getEdge(contactIds[i], contactIds[j]);
          edge.strength += 1;
          edge.reasons.push({ type: "shared_education", detail: "Shared education", weight: 1 });
        }
      }
    });

    // Shared professional experience
    const expToContacts = new Map<string, string[]>();
    active.forEach((c) => {
      const seen = new Set<string>();
      (c.professional_experience || []).forEach((e) => {
        const company = norm(e.company_name);
        if (!company || seen.has(company)) return;
        seen.add(company);
        if (!expToContacts.has(company)) expToContacts.set(company, []);
        expToContacts.get(company)!.push(c.id);
      });
    });
    expToContacts.forEach((contactIds) => {
      for (let i = 0; i < contactIds.length; i++) {
        for (let j = i + 1; j < contactIds.length; j++) {
          const edge = getEdge(contactIds[i], contactIds[j]);
          edge.strength += 1;
          edge.reasons.push({ type: "shared_experience", detail: "Shared employer", weight: 1 });
        }
      }
    });

    // Shared board memberships
    const boardToContacts = new Map<string, string[]>();
    active.forEach((c) => {
      const seen = new Set<string>();
      (c.board_memberships || []).forEach((b) => {
        const org = norm(b.organization_name);
        if (!org || seen.has(org)) return;
        seen.add(org);
        if (!boardToContacts.has(org)) boardToContacts.set(org, []);
        boardToContacts.get(org)!.push(c.id);
      });
    });
    boardToContacts.forEach((contactIds) => {
      for (let i = 0; i < contactIds.length; i++) {
        for (let j = i + 1; j < contactIds.length; j++) {
          const edge = getEdge(contactIds[i], contactIds[j]);
          edge.strength += 1.5;
          edge.reasons.push({ type: "shared_board", detail: "Shared board membership", weight: 1.5 });
        }
      }
    });

    // Filter: only keep edges with strength >= 2 (removes weak single-shared-entity connections)
    // and limit to top 3000 by strength to keep the response manageable for the frontend.
    let edges = Array.from(edgeMap.values()).filter((e) => e.strength >= 2);
    edges.sort((a, b) => b.strength - a.strength);
    if (edges.length > 3000) {
      edges = edges.slice(0, 3000);
    }

    // ── Adjacency ──
    const adjacency = new Map<string, Set<string>>();
    active.forEach((c) => adjacency.set(c.id, new Set()));
    edges.forEach((e) => {
      adjacency.get(e.source)!.add(e.target);
      adjacency.get(e.target)!.add(e.source);
    });

    // ── Degree & strength ──
    const degreeMap = new Map<string, number>();
    const strengthMap = new Map<string, number>();
    active.forEach((c) => {
      degreeMap.set(c.id, 0);
      strengthMap.set(c.id, 0);
    });
    edges.forEach((e) => {
      degreeMap.set(e.source, degreeMap.get(e.source)! + 1);
      degreeMap.set(e.target, degreeMap.get(e.target)! + 1);
      strengthMap.set(e.source, strengthMap.get(e.source)! + e.strength);
      strengthMap.set(e.target, strengthMap.get(e.target)! + e.strength);
    });

    // ── Betweenness ──
    const nodeIds = active.map((c) => c.id);
    const betweennessMap = computeBetweenness(adjacency, nodeIds);

    // ── Importance ──
    const importanceMap = new Map<string, number>();
    active.forEach((c) => {
      const degree = degreeMap.get(c.id) || 0;
      const strength = strengthMap.get(c.id) || 0;
      const betweenness = betweennessMap.get(c.id) || 0;
      importanceMap.set(c.id, degree * 2 + strength + betweenness * 0.1);
    });

    // Only include contacts that have at least one connection
    const connectedContactIds = new Set<string>();
    edges.forEach((e) => {
      connectedContactIds.add(e.source);
      connectedContactIds.add(e.target);
    });
    const connectedContactsList = active.filter((c) => connectedContactIds.has(c.id));

    // ── Key nodes: top 15 ──
    const sorted = [...connectedContactsList]
      .map((c) => ({ id: c.id, importance: importanceMap.get(c.id) || 0 }))
      .sort((a, b) => b.importance - a.importance);

    const keyNodeIds = new Set(sorted.slice(0, 15).map((x) => x.id));

    // ── Nodes ──
    const nodes = active.map((c) => ({
      id: c.id,
      label: formatName(c),
      title: c.title,
      photo_url: c.photo_url,
      decision_role: c.decision_role,
      degree: degreeMap.get(c.id) || 0,
      totalStrength: Math.round((strengthMap.get(c.id) || 0) * 10) / 10,
      betweenness: Math.round((betweennessMap.get(c.id) || 0) * 10) / 10,
      importance: Math.round((importanceMap.get(c.id) || 0) * 10) / 10,
      isKeyNode: keyNodeIds.has(c.id),
    }));

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
          const key = path[i] < path[i + 1] ? `${path[i]}|${path[i + 1]}` : `${path[i + 1]}|${path[i]}`;
          const edge = edgeMap.get(key);
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
      keyNodes: sorted.slice(0, 15).map((x, i) => {
        const c = contactMap.get(x.id)!;
        return {
          id: x.id,
          label: formatName(c),
          title: c.title,
          photo_url: c.photo_url,
          decision_role: c.decision_role,
          degree: degreeMap.get(x.id) || 0,
          totalStrength: Math.round((strengthMap.get(x.id) || 0) * 10) / 10,
          betweenness: Math.round((betweennessMap.get(x.id) || 0) * 10) / 10,
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