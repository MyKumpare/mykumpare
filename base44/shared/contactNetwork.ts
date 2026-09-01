/**
 * Shared contact-network computation logic.
 *
 * Loads all active contacts, builds the contact-to-contact graph (edges from
 * shared firms, education, professional experience, and board memberships),
 * and computes centrality metrics: degree, totalStrength, betweenness
 * (Brandes' algorithm), and a composite importance score.
 *
 * Used by computeContactNetwork (full graph) and computeContactCentrality
 * (single-contact rank) so both stay in sync.
 */

export interface ContactRecord {
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

export interface EdgeReason {
  type: string;
  detail: string;
  weight: number;
}

export interface NetworkEdge {
  source: string;
  target: string;
  strength: number;
  reasons: EdgeReason[];
}

export interface NodeCentrality {
  id: string;
  degree: number;
  totalStrength: number;
  betweenness: number;
  importance: number;
}

export function formatName(c: Partial<ContactRecord>): string {
  return [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix]
    .filter(Boolean)
    .join(" ");
}

export function norm(s: string | undefined | null): string {
  return (s || "").toLowerCase().trim();
}

/**
 * Betweenness centrality using Brandes' algorithm — O(n*(n+m)).
 */
export function computeBetweenness(
  adjacency: Map<string, Set<string>>,
  nodeIds: string[]
): Map<string, number> {
  const betweenness = new Map<string, number>();
  nodeIds.forEach((n) => betweenness.set(n, 0));

  for (const s of nodeIds) {
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

export function bfsShortestPath(
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

/**
 * Builds the full contact network: edges, adjacency, and centrality metrics
 * for every active contact.
 *
 * @param contacts  All contacts (will be filtered to active internally).
 * @returns edges, adjacency, per-node centrality map, contacts list, and
 *          contacts sorted by importance (descending).
 */
export function buildContactNetwork(contacts: ContactRecord[]) {
  const active = contacts.filter((c) => !c.deleted_at);
  const contactMap = new Map<string, ContactRecord>();
  active.forEach((c) => contactMap.set(c.id, c));

  // ── Build edges ──
  const edgeMap = new Map<string, NetworkEdge>();
  function getEdge(a: string, b: string): NetworkEdge {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (!edgeMap.has(key)) {
      edgeMap.set(key, { source: a, target: b, strength: 0, reasons: [] });
    }
    return edgeMap.get(key)!;
  }

  // Shared firms (strength 2 per shared firm)
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

  // Shared education (strength 1 per shared school)
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

  // Shared professional experience (strength 1 per shared company)
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

  // Shared board memberships (strength 1.5 per shared board)
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

  // Filter: only keep edges with strength >= 2, cap at 3000 by strength
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

  // ── Importance: degree * 2 + strength + betweenness * 0.1 ──
  const importanceMap = new Map<string, number>();
  active.forEach((c) => {
    const degree = degreeMap.get(c.id) || 0;
    const strength = strengthMap.get(c.id) || 0;
    const betweenness = betweennessMap.get(c.id) || 0;
    importanceMap.set(c.id, degree * 2 + strength + betweenness * 0.1);
  });

  // ── Per-node centrality ──
  const centrality: Map<string, NodeCentrality> = new Map();
  active.forEach((c) => {
    centrality.set(c.id, {
      id: c.id,
      degree: degreeMap.get(c.id) || 0,
      totalStrength: Math.round((strengthMap.get(c.id) || 0) * 10) / 10,
      betweenness: Math.round((betweennessMap.get(c.id) || 0) * 10) / 10,
      importance: Math.round((importanceMap.get(c.id) || 0) * 10) / 10,
    });
  });

  // ── Sorted by importance (only connected contacts) ──
  const connectedContactIds = new Set<string>();
  edges.forEach((e) => {
    connectedContactIds.add(e.source);
    connectedContactIds.add(e.target);
  });
  const sortedByImportance = active
    .filter((c) => connectedContactIds.has(c.id))
    .map((c) => ({ id: c.id, importance: importanceMap.get(c.id) || 0 }))
    .sort((a, b) => b.importance - a.importance);

  return {
    activeContacts: active,
    contactMap,
    edges,
    adjacency,
    centrality,
    sortedByImportance,
    stats: {
      totalContacts: active.length,
      connectedContacts: connectedContactIds.size,
      totalEdges: edges.length,
    },
  };
}