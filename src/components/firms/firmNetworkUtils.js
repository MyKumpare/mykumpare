/**
 * Graph utilities for the Firm Network Map.
 *
 * The adjacency structure built by FirmNetworkMapPage is:
 *   Map<firmId, Map<otherFirmId, Set<relType>>>
 *
 * relMap is:
 *   { "firmAId:firmBId": Set<relType>, "firmBId:firmAId": Set<relType> }
 */

/**
 * BFS shortest path between two firms on the adjacency graph.
 * Only traverses edges whose types are in activeTypes.
 * Returns an array of firm IDs (including start and end) or null if no path.
 */
export function bfsShortestPath(adjacency, startId, endId, activeTypes) {
  if (!startId || !endId) return null;
  if (startId === endId) return [startId];
  if (!adjacency.has(startId) || !adjacency.has(endId)) return null;

  const isActive = (types) => {
    if (!activeTypes) return true;
    for (const t of types) {
      if (activeTypes[t]) return true;
    }
    return false;
  };

  const queue = [startId];
  const visited = new Set([startId]);
  const parent = new Map([[startId, null]]);

  while (queue.length > 0) {
    const u = queue.shift();
    const neighbors = adjacency.get(u);
    if (!neighbors) continue;
    for (const [v, types] of neighbors) {
      if (visited.has(v)) continue;
      if (!isActive(types)) continue;
      visited.add(v);
      parent.set(v, u);
      if (v === endId) {
        const path = [];
        let cur = v;
        while (cur !== null) {
          path.unshift(cur);
          cur = parent.get(cur);
        }
        return path;
      }
      queue.push(v);
    }
  }
  return null;
}

/**
 * Find connected components (clusters) in the firm graph.
 * Only considers edges whose types are in activeTypes.
 * Returns an array of clusters, each: { id, memberIds: string[], centralityMap: Map }
 * Sorted by size (largest first).
 */
export function findClusters(adjacency, firmIds, activeTypes) {
  const isActive = (types) => {
    if (!activeTypes) return true;
    for (const t of types) {
      if (activeTypes[t]) return true;
    }
    return false;
  };

  const visited = new Set();
  const clusters = [];
  let clusterIdx = 0;

  for (const firmId of firmIds) {
    if (visited.has(firmId)) continue;
    // BFS to find the full component
    const component = [];
    const queue = [firmId];
    visited.add(firmId);
    while (queue.length > 0) {
      const u = queue.shift();
      component.push(u);
      const neighbors = adjacency.get(u);
      if (!neighbors) continue;
      for (const [v, types] of neighbors) {
        if (visited.has(v)) continue;
        if (!isActive(types)) continue;
        visited.add(v);
        queue.push(v);
      }
    }
    if (component.length >= 2) {
      clusters.push({
        id: `cluster-${clusterIdx++}`,
        memberIds: component,
      });
    }
  }

  // Sort by size descending
  clusters.sort((a, b) => b.memberIds.length - a.memberIds.length);
  return clusters;
}

/**
 * Get the shared contacts between two firms.
 * Returns an array of contact objects.
 */
export function getSharedContacts(firmIdA, firmIdB, contacts) {
  const result = [];
  for (const c of contacts) {
    if (c.deleted_at) continue;
    const ids = c.firm_ids || [];
    if (ids.includes(firmIdA) && ids.includes(firmIdB)) {
      result.push(c);
    }
  }
  return result;
}

/**
 * Format a contact's full name.
 */
export function formatContactName(c) {
  if (!c) return "";
  return [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix]
    .filter(Boolean)
    .join(" ");
}