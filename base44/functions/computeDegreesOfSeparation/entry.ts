import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

/**
 * Computes degrees of separation between entities (firms or contacts).
 *
 * For contacts: connections are based on shared education institutions,
 *   shared professional experience (employers), and shared board memberships.
 *
 * For firms: connections are based on:
 *   1. Portfolio relationships (advisor ↔ allocator, advisor ↔ sub-managers)
 *   2. Board meeting mentions (firm mentioned in another firm's meeting minutes)
 *   3. Shared contacts (contacts who work at both firms)
 *   4. News co-mentions (firms tagged in the same news article — "what is on the web")
 *   5. Shared board members (a contact sits on a board that matches another firm)
 *
 * Returns: { source, max_degrees, connections[], graph: { nodes, edges }, stats }
 */

// ── Helpers ──

function normalizeName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .replace(
      /\b(inc|llc|corp|corporation|ltd|co|company|lp|llp|plc|sa|ag|gmbh|holdings|group|partners|advisors|capital|management|investments|financial|associates|fund|funds|asset)\b\.?/g,
      ""
    )
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function contactFullName(c: any): string {
  return (
    [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix]
      .filter(Boolean)
      .join(" ")
      .trim() || "Unknown"
  );
}

/**
 * Generic BFS that returns a visited map: id -> { degree, path[], reasons[] }
 * getNeighbors returns a Map<neighborId, reasonString>.
 */
function bfs(
  sourceId: string,
  maxDegrees: number,
  getNeighbors: (id: string) => Map<string, string>
): Map<string, { degree: number; path: string[]; reasons: string[] }> {
  const visited = new Map<string, { degree: number; path: string[]; reasons: string[] }>();
  visited.set(sourceId, { degree: 0, path: [sourceId], reasons: [] });
  const queue: string[] = [sourceId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentInfo = visited.get(current)!;
    if (currentInfo.degree >= maxDegrees) continue;

    const neighbors = getNeighbors(current);
    for (const [neighborId, reason] of neighbors) {
      if (visited.has(neighborId)) continue;
      visited.set(neighborId, {
        degree: currentInfo.degree + 1,
        path: [...currentInfo.path, neighborId],
        reasons: [...currentInfo.reasons, reason],
      });
      queue.push(neighborId);
    }
  }
  return visited;
}

// ── Contact degrees ──

function buildContactDegrees(contacts: any[], sourceId: string, maxDegrees: number) {
  const active = contacts.filter((c) => !c.deleted_at);
  const source = active.find((c) => c.id === sourceId);
  if (!source) return { error: "Source contact not found" };

  // Build lookup maps
  const eduMap = new Map<string, Set<string>>(); // institution -> Set<contactId>
  const expMap = new Map<string, Set<string>>(); // company -> Set<contactId>
  const boardMap = new Map<string, Set<string>>(); // org -> Set<contactId>
  const contactEdus = new Map<string, Set<string>>();
  const contactExps = new Map<string, Set<string>>();
  const contactBoards = new Map<string, Set<string>>();

  for (const c of active) {
    const edus = new Set<string>();
    if (Array.isArray(c.education)) {
      for (const e of c.education) {
        if (e.institution) {
          const key = e.institution.toLowerCase().trim();
          if (key) {
            edus.add(key);
            if (!eduMap.has(key)) eduMap.set(key, new Set());
            eduMap.get(key)!.add(c.id);
          }
        }
      }
    }
    contactEdus.set(c.id, edus);

    const exps = new Set<string>();
    if (Array.isArray(c.professional_experience)) {
      for (const e of c.professional_experience) {
        if (e.company_name) {
          const key = e.company_name.toLowerCase().trim();
          if (key) {
            exps.add(key);
            if (!expMap.has(key)) expMap.set(key, new Set());
            expMap.get(key)!.add(c.id);
          }
        }
      }
    }
    contactExps.set(c.id, exps);

    const boards = new Set<string>();
    if (Array.isArray(c.board_memberships)) {
      for (const m of c.board_memberships) {
        if (m.organization_name) {
          const key = m.organization_name.toLowerCase().trim();
          if (key) {
            boards.add(key);
            if (!boardMap.has(key)) boardMap.set(key, new Set());
            boardMap.get(key)!.add(c.id);
          }
        }
      }
    }
    contactBoards.set(c.id, boards);
  }

  function getNeighbors(contactId: string): Map<string, string> {
    const neighbors = new Map<string, string>();
    function addNeighbor(nid: string, reason: string) {
      if (nid === contactId) return;
      if (neighbors.has(nid)) neighbors.set(nid, neighbors.get(nid) + "; " + reason);
      else neighbors.set(nid, reason);
    }
    for (const inst of contactEdus.get(contactId) || []) {
      for (const otherId of eduMap.get(inst) || []) addNeighbor(otherId, `Shared education: ${inst}`);
    }
    for (const comp of contactExps.get(contactId) || []) {
      for (const otherId of expMap.get(comp) || []) addNeighbor(otherId, `Shared employer: ${comp}`);
    }
    for (const org of contactBoards.get(contactId) || []) {
      for (const otherId of boardMap.get(org) || []) addNeighbor(otherId, `Shared board: ${org}`);
    }
    return neighbors;
  }

  const visited = bfs(sourceId, maxDegrees, getNeighbors);
  const contactMap = new Map(active.map((c) => [c.id, c]));

  const connections: any[] = [];
  for (const [id, info] of visited) {
    if (id === sourceId) continue;
    const c = contactMap.get(id);
    if (!c) continue;
    connections.push({
      entity_id: id,
      entity_name: contactFullName(c),
      degree: info.degree,
      path: info.path.map((pid) => {
        const pc = contactMap.get(pid);
        return { entity_id: pid, entity_name: pc ? contactFullName(pc) : pid };
      }),
      connection_reasons: info.reasons,
    });
  }
  connections.sort((a, b) => a.degree - b.degree);

  // Build graph (limit to first 200 connections for performance)
  const limited = connections.slice(0, 200);
  const nodeIds = new Set<string>([sourceId]);
  for (const c of limited) for (const p of c.path) nodeIds.add(p.entity_id);
  const nodes = Array.from(nodeIds).map((id) => {
    const c = contactMap.get(id);
    const info = visited.get(id);
    return { id, label: c ? contactFullName(c) : id, type: "contact", degree: info?.degree ?? 0 };
  });
  const edgeSet = new Set<string>();
  const edges: any[] = [];
  for (const c of limited) {
    for (let i = 0; i < c.path.length - 1; i++) {
      const key = [c.path[i].entity_id, c.path[i + 1].entity_id].sort().join("|");
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ source: c.path[i].entity_id, target: c.path[i + 1].entity_id, reason: c.connection_reasons[i] || "" });
      }
    }
  }

  return {
    source: { id: sourceId, name: contactFullName(source), type: "contact" },
    max_degrees: maxDegrees,
    connections: limited,
    graph: { nodes, edges },
    stats: {
      total: connections.length,
      by_degree: connections.reduce((acc: Record<number, number>, c) => {
        acc[c.degree] = (acc[c.degree] || 0) + 1;
        return acc;
      }, {}),
    },
  };
}

// ── Firm degrees ──

function buildFirmDegrees(
  firms: any[],
  portfolios: any[],
  boardMeetings: any[],
  contacts: any[],
  news: any[],
  sourceId: string,
  maxDegrees: number
) {
  const activeFirms = firms.filter((f) => !f.deleted_at);
  const source = activeFirms.find((f) => f.id === sourceId);
  if (!source) return { error: "Source firm not found" };

  const firmMap = new Map(activeFirms.map((f) => [f.id, f]));
  const firmNameMap = new Map<string, string>(); // normalized name -> firmId
  for (const f of activeFirms) {
    const norm = normalizeName(f.name);
    if (norm && !firmNameMap.has(norm)) firmNameMap.set(norm, f.id);
  }

  // Build adjacency: firmId -> Map<neighborId, Set<reason>>
  const adj = new Map<string, Map<string, Set<string>>>();
  function addEdge(a: string, b: string, reason: string) {
    if (a === b || !a || !b) return;
    if (!adj.has(a)) adj.set(a, new Map());
    if (!adj.has(b)) adj.set(b, new Map());
    if (!adj.get(a)!.has(b)) adj.get(a)!.set(b, new Set());
    if (!adj.get(b)!.has(a)) adj.get(b)!.set(a, new Set());
    adj.get(a)!.get(b)!.add(reason);
    adj.get(b)!.get(a)!.add(reason);
  }

  // 1. Portfolio relationships
  for (const p of portfolios) {
    if (p.deleted_at) continue;
    // Connect allocator firm with advisor firm
    if (p.firm_id && p.advisor_firm_id) {
      addEdge(p.firm_id, p.advisor_firm_id, `Portfolio: ${p.portfolio_name || "portfolio"} (advisor)`);
    }
    // Connect advisor firm with sub-manager firms
    if (p.advisor_firm_id && Array.isArray(p.sub_managers)) {
      for (const sm of p.sub_managers) {
        if (sm.firm_name) {
          const norm = normalizeName(sm.firm_name);
          if (norm && firmNameMap.has(norm)) {
            addEdge(p.advisor_firm_id, firmNameMap.get(norm)!, `Portfolio: ${p.portfolio_name || "portfolio"} (sub-manager: ${sm.firm_name})`);
          }
        }
      }
    }
  }

  // 2. Board meeting mentions
  for (const m of boardMeetings) {
    if (m.deleted_at) continue;
    if (!Array.isArray(m.mentions)) continue;
    for (const mention of m.mentions) {
      if (mention.entity_id && mention.entity_id !== m.firm_id) {
        addEdge(m.firm_id, mention.entity_id, `Board meeting mention: ${m.title || "meeting"}`);
      }
    }
  }

  // 3. Shared contacts
  for (const c of contacts) {
    if (c.deleted_at) continue;
    if (!Array.isArray(c.firm_ids) || c.firm_ids.length < 2) continue;
    const cname = [c.first_name, c.last_name].filter(Boolean).join(" ");
    for (let i = 0; i < c.firm_ids.length; i++) {
      for (let j = i + 1; j < c.firm_ids.length; j++) {
        addEdge(c.firm_ids[i], c.firm_ids[j], `Shared contact: ${cname}`);
      }
    }
  }

  // 4. News co-mentions (web data)
  for (const n of news) {
    if (n.deleted_at) continue;
    if (!Array.isArray(n.tagged_firm_ids) || n.tagged_firm_ids.length < 2) continue;
    for (let i = 0; i < n.tagged_firm_ids.length; i++) {
      for (let j = i + 1; j < n.tagged_firm_ids.length; j++) {
        addEdge(n.tagged_firm_ids[i], n.tagged_firm_ids[j], `News co-mention: ${n.headline || "article"}`);
      }
    }
  }

  // 5. Board memberships: contact's board org matches a firm name
  for (const c of contacts) {
    if (c.deleted_at) continue;
    if (!Array.isArray(c.board_memberships) || !Array.isArray(c.firm_ids)) continue;
    const cname = [c.first_name, c.last_name].filter(Boolean).join(" ");
    for (const m of c.board_memberships) {
      if (!m.organization_name) continue;
      const norm = normalizeName(m.organization_name);
      if (!norm || !firmNameMap.has(norm)) continue;
      const boardFirmId = firmNameMap.get(norm)!;
      for (const fid of c.firm_ids) {
        addEdge(fid, boardFirmId, `Shared board member: ${cname} (${m.role || "board"})`);
      }
    }
  }

  // BFS
  function getNeighbors(firmId: string): Map<string, string> {
    const neighbors = new Map<string, string>();
    const nMap = adj.get(firmId);
    if (!nMap) return neighbors;
    for (const [nid, reasons] of nMap) {
      neighbors.set(nid, Array.from(reasons).join("; "));
    }
    return neighbors;
  }

  const visited = bfs(sourceId, maxDegrees, getNeighbors);

  const connections: any[] = [];
  for (const [id, info] of visited) {
    if (id === sourceId) continue;
    const f = firmMap.get(id);
    if (!f) continue;
    connections.push({
      entity_id: id,
      entity_name: f.name,
      degree: info.degree,
      path: info.path.map((pid) => {
        const pf = firmMap.get(pid);
        return { entity_id: pid, entity_name: pf ? pf.name : pid };
      }),
      connection_reasons: info.reasons,
    });
  }
  connections.sort((a, b) => a.degree - b.degree);

  // Build graph
  const limited = connections.slice(0, 200);
  const nodeIds = new Set<string>([sourceId]);
  for (const c of limited) for (const p of c.path) nodeIds.add(p.entity_id);
  const nodes = Array.from(nodeIds).map((id) => {
    const f = firmMap.get(id);
    const info = visited.get(id);
    return { id, label: f ? f.name : id, type: "firm", degree: info?.degree ?? 0 };
  });
  const edgeSet = new Set<string>();
  const edges: any[] = [];
  for (const c of limited) {
    for (let i = 0; i < c.path.length - 1; i++) {
      const key = [c.path[i].entity_id, c.path[i + 1].entity_id].sort().join("|");
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ source: c.path[i].entity_id, target: c.path[i + 1].entity_id, reason: c.connection_reasons[i] || "" });
      }
    }
  }

  return {
    source: { id: sourceId, name: source.name, type: "firm" },
    max_degrees: maxDegrees,
    connections: limited,
    graph: { nodes, edges },
    stats: {
      total: connections.length,
      by_degree: connections.reduce((acc: Record<number, number>, c) => {
        acc[c.degree] = (acc[c.degree] || 0) + 1;
        return acc;
      }, {}),
    },
  };
}

// ── Main handler ──

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { entity_type, source_id, max_degrees } = body;

    if (!entity_type || !source_id) {
      return Response.json({ error: "entity_type and source_id are required" }, { status: 400 });
    }

    const maxDeg = Math.min(Math.max(parseInt(max_degrees, 10) || 2, 1), 5);
    const sr = base44.asServiceRole;

    if (entity_type === "contact") {
      const contacts = await sr.entities.Contact.list("-created_date", 5000);
      const result = buildContactDegrees(contacts, source_id, maxDeg);
      return Response.json(result);
    } else if (entity_type === "firm") {
      const [firms, portfolios, boardMeetings, contacts, news] = await Promise.all([
        sr.entities.Firm.list("-created_date", 5000),
        sr.entities.Portfolio.list("-created_date", 5000),
        sr.entities.BoardMeeting.list("-meeting_date", 5000),
        sr.entities.Contact.list("-created_date", 5000),
        sr.entities.FirmNews.list("-news_date", 5000),
      ]);
      const result = buildFirmDegrees(firms, portfolios, boardMeetings, contacts, news, source_id, maxDeg);
      return Response.json(result);
    } else {
      return Response.json({ error: 'Invalid entity_type. Use "firm" or "contact".' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}