import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

async function geocodeOne(query) {
  if (!query || !query.trim()) return null;
  let q = query.trim();
  // Build the list of Nominatim URLs to try in order. For US zip codes
  // (5 digits, optionally +4), try the structured postalcode search
  // with countrycodes=us first, then fall back to a text search with
  // ", USA" appended. For everything else, just use the text search.
  const zipMatch = q.match(/^(\d{5})(?:-(\d{4}))?$/);
  const urls = zipMatch
    ? [
        `${NOMINATIM_URL}?postalcode=${encodeURIComponent(zipMatch[1])}&countrycodes=us&format=json&limit=1`,
        `${NOMINATIM_URL}?q=${encodeURIComponent(`${q}, USA`)}&format=json&limit=1`,
      ]
    : [`${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=1`];
  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": "MyKumpare/1.0" }
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
          displayName: data[0].display_name
        };
      }
    } catch {
      // try next url
    }
  }
  return null;
}

// Geocode a batch of queries with limited concurrency (2 at a time)
// to respect Nominatim's fair-use policy.
async function geocodeBatch(queries) {
  const results = {};
  const concurrency = 2;
  for (let i = 0; i < queries.length; i += concurrency) {
    const batch = queries.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async ({ addrStr, keys }) => {
        const geo = await geocodeOne(addrStr);
        return { keys, geo };
      })
    );
    for (const { keys, geo } of batchResults) {
      if (geo) {
        for (const key of keys) {
          results[key] = geo;
        }
      }
    }
  }
  return results;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { centerQuery, locations = [] } = body || {};

    const result = { center: null, geocoded: {} };

    // Geocode center query
    if (centerQuery) {
      result.center = await geocodeOne(centerQuery);
    }

    // Deduplicate locations by address string to minimize API calls
    const pending = []; // [{ addrStr, keys }]
    const addrIndex = {}; // addrStr -> index in pending
    for (const loc of locations) {
      const parts = [loc.addressLine1, loc.city, loc.state, loc.postalCode, loc.country].filter(Boolean);
      if (parts.length === 0) continue;
      const addrStr = parts.join(", ");
      if (addrIndex[addrStr] === undefined) {
        addrIndex[addrStr] = pending.length;
        pending.push({ addrStr, keys: [] });
      }
      pending[addrIndex[addrStr]].keys.push(loc.key);
    }

    // Geocode unique addresses (cap at 40 unique locations)
    if (pending.length > 0) {
      const geocoded = await geocodeBatch(pending.slice(0, 40));
      result.geocoded = geocoded;
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}