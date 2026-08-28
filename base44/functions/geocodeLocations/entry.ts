import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

// Reverse-geocode a lat/lon point into address components using Nominatim.
// Returns { lat, lon, displayName, address } where address holds the raw
// Nominatim address fields (country, country_code, state, city/town/village,
// postcode, road, house_number). The client maps these to its own country/state codes.
async function reverseGeocodeOne(lat, lon) {
  if (lat == null || lon == null) return null;
  const url = `${NOMINATIM_REVERSE_URL}?lat=${lat}&lon=${lon}&format=json&zoom=18&addressdetails=1`;
  try {
    const resp = await fetch(url, { headers: { "User-Agent": "MyKumpare/1.0" } });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data || data.error) return null;
    const addr = data.address || {};
    const city = addr.city || addr.town || addr.village || addr.municipality || addr.hamlet || "";
    return {
      lat: parseFloat(data.lat),
      lon: parseFloat(data.lon),
      displayName: data.display_name || "",
      address: {
        country: addr.country || "",
        country_code: (addr.country_code || "").toUpperCase(),
        state: addr.state || addr.state_district || addr.county || "",
        city,
        postcode: addr.postcode || "",
        road: addr.road || addr.pedestrian || addr.footway || "",
        house_number: addr.house_number || "",
      },
    };
  } catch {
    return null;
  }
}

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

// Geocode a batch of queries with limited concurrency (4 at a time)
// to respect Nominatim's fair-use policy while keeping latency reasonable.
async function geocodeBatch(queries) {
  const results = {};
  const concurrency = 4;
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
    const { centerQuery, locations = [], reverse } = body || {};

    const result = { center: null, geocoded: {}, reverseResult: null };

    // Reverse geocode a single lat/lon point into address components
    if (reverse && reverse.lat != null && reverse.lon != null) {
      result.reverseResult = await reverseGeocodeOne(reverse.lat, reverse.lon);
    }

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

    // Geocode unique addresses (cap at 200 unique locations)
    if (pending.length > 0) {
      const geocoded = await geocodeBatch(pending.slice(0, 200));
      result.geocoded = geocoded;
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}