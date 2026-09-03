// Shared geographic helpers for coverage dashboards.

/**
 * Extract lat/lng from a firm record.
 * Prefers the geocoded location_lat/location_lng, then falls back to the first
 * address with stored coordinates. Returns null when no coordinates are available.
 */
export function getFirmCoords(firm) {
  if (!firm) return null;
  if (typeof firm.location_lat === "number" && typeof firm.location_lng === "number") {
    return { lat: firm.location_lat, lng: firm.location_lng };
  }
  const addr = (firm.addresses || []).find(
    (a) => typeof a.latitude === "number" && typeof a.longitude === "number"
  );
  if (addr) return { lat: addr.latitude, lng: addr.longitude };
  return null;
}

/**
 * Build map points by aggregating active Xponance assignments per firm location.
 * Each firm becomes one pin; the pin's count is the total primary + secondary
 * assignments across the items that roll up to that firm.
 *
 * @param items    records with primary_xponance_contact_id / secondary_xponance_contact_id
 * @param getFirmId (item) => firm id (the firm whose location the pin represents)
 * @param firmMap  { [firmId]: firm }
 * @returns [{ id, lat, lng, name, subLabel, count }]
 */
export function buildCoverageMapPoints(items, getFirmId, firmMap) {
  const byFirm = {};
  for (const item of items) {
    const hasPrimary = !!item.primary_xponance_contact_id;
    const hasSecondary = !!item.secondary_xponance_contact_id;
    if (!hasPrimary && !hasSecondary) continue; // only active coverage
    const fid = getFirmId(item);
    if (!fid) continue;
    if (!byFirm[fid]) byFirm[fid] = { firm: firmMap[fid], count: 0 };
    byFirm[fid].count += (hasPrimary ? 1 : 0) + (hasSecondary ? 1 : 0);
  }

  const points = [];
  for (const [fid, { firm, count }] of Object.entries(byFirm)) {
    if (!firm) continue;
    const coords = getFirmCoords(firm);
    if (!coords) continue;
    points.push({
      id: fid,
      lat: coords.lat,
      lng: coords.lng,
      name: firm.name,
      subLabel: firm.location || "",
      count,
    });
  }
  return points;
}