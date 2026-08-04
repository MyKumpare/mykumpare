import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

// Format duration in seconds to human-readable string
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "0 min";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h} hr ${m} min`;
  return `${m} min`;
}

// Format distance in meters to miles
function formatDistance(meters) {
  if (!meters) return "0 mi";
  const miles = meters / 1609.34;
  if (miles < 0.1) return `${(miles * 5280).toFixed(0)} ft`;
  return `${miles.toFixed(1)} mi`;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { stops = [] } = body || {};

    if (!Array.isArray(stops) || stops.length < 2) {
      return Response.json({ error: 'At least 2 stops are required' }, { status: 400 });
    }

    // Build OSRM coordinates string: lon,lat;lon,lat;...
    const coords = stops
      .filter((s) => s.lat != null && s.lon != null)
      .map((s) => `${s.lon},${s.lat}`)
      .join(";");

    if (!coords) {
      return Response.json({ error: 'No valid coordinates in stops' }, { status: 400 });
    }

    const url = `${OSRM_URL}/${coords}?overview=full&geometries=geojson`;

    const resp = await fetch(url, {
      headers: { "User-Agent": "MyKumpare/1.0" }
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return Response.json(
        { error: `Routing service error (${resp.status}): ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = await resp.json();

    if (!data.routes || data.routes.length === 0) {
      return Response.json({ error: 'No route found between the given stops' }, { status: 404 });
    }

    const route = data.routes[0];
    const coordinates = (route.geometry?.coordinates || []).map(([lon, lat]) => ({ lat, lon }));

    // Leg-level distances/durations for per-stop breakdown
    const legs = (route.legs || []).map((leg) => ({
      distance: formatDistance(leg.distance),
      distanceMeters: leg.distance,
      duration: formatDuration(leg.duration),
      durationSeconds: leg.duration,
    }));

    return Response.json({
      coordinates,
      distance: formatDistance(route.distance),
      distanceMeters: route.distance,
      duration: formatDuration(route.duration),
      durationSeconds: route.duration,
      legs,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}