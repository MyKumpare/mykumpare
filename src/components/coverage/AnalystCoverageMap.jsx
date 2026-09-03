import React, { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";

function FitBounds({ points }) {
  const map = useMap();
  React.useEffect(() => {
    const valid = points.filter((p) => p.lat != null && p.lng != null);
    if (valid.length === 0) return;
    if (valid.length === 1) {
      map.setView([valid[0].lat, valid[0].lng], 6);
    } else {
      const bounds = L.latLngBounds(valid.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
    }
  }, [points, map]);
  return null;
}

function MapInitializer() {
  const map = useMap();
  React.useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

/**
 * Geographic map that pins firm locations where Xponance analysts have active
 * (primary + secondary) assignments. Pin size and fill intensity scale with the
 * assignment count, so the densest coverage areas stand out at a glance.
 *
 * Props:
 *  - points: [{ id, lat, lng, name, subLabel, count }]
 *  - themeColor: hex color for pins
 *  - title: section heading
 *  - emptyText: shown when no points have coordinates
 */
export default function AnalystCoverageMap({
  points,
  themeColor = "#4f46e5",
  title = "Analyst Coverage Map",
  emptyText = "No assignable locations to map.",
}) {
  const validPoints = useMemo(
    () => points.filter((p) => p.lat != null && p.lng != null && p.count > 0),
    [points]
  );
  const maxCount = useMemo(
    () => validPoints.reduce((m, p) => Math.max(m, p.count || 0), 0),
    [validPoints]
  );
  const totalAssignments = useMemo(
    () => validPoints.reduce((s, p) => s + (p.count || 0), 0),
    [validPoints]
  );

  const radiusFor = (count) => {
    if (maxCount <= 0) return 10;
    return 10 + 18 * (count / maxCount);
  };
  const fillOpacityFor = (count) => {
    if (maxCount <= 0) return 0.4;
    return 0.3 + 0.5 * (count / maxCount);
  };

  return (
    <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <MapPin className="w-4 h-4" style={{ color: themeColor }} />
          {title}
        </h3>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>
            <b className="text-gray-700">{validPoints.length}</b> locations
          </span>
          <span>
            <b className="text-gray-700">{totalAssignments}</b> active assignments
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ background: themeColor, opacity: 0.3 }}
            />
            low
            <span
              className="inline-block w-4 h-4 rounded-full"
              style={{ background: themeColor, opacity: 0.8 }}
            />
            high
          </span>
        </div>
      </div>

      {validPoints.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-6 text-center">{emptyText}</p>
      ) : (
        <div
          className="rounded-lg overflow-hidden border border-gray-200"
          style={{ height: 380 }}
        >
          <MapContainer
            center={[39.8283, -98.5795]}
            zoom={3}
            className="w-full h-full"
            style={{ background: "#e5e7eb" }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <MapInitializer />
            <FitBounds points={validPoints} />
            {validPoints.map((p) => (
              <CircleMarker
                key={p.id}
                center={[p.lat, p.lng]}
                radius={radiusFor(p.count)}
                pathOptions={{
                  color: themeColor,
                  fillColor: themeColor,
                  fillOpacity: fillOpacityFor(p.count),
                  weight: 2,
                }}
              >
                <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                  <div className="text-sm">
                    <div className="font-semibold">{p.name}</div>
                    {p.subLabel && (
                      <div className="text-gray-500 text-xs">{p.subLabel}</div>
                    )}
                    <div className="text-xs mt-0.5" style={{ color: themeColor }}>
                      <b>{p.count}</b> active assignment{p.count !== 1 ? "s" : ""}
                    </div>
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}