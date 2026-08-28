import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Tooltip as LeafletTooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowLeft, Building, Globe, Loader2, MapPin } from "lucide-react";
import { GEOGRAPHIC_REGIONS } from "@/components/firms/geographicRegions";

// Region display metadata: centroid [lat, lon] and a tailwind-friendly hex color.
const REGION_META = {
  "North America": { center: [45, -100], color: "#4f46e5" },
  "Europe": { center: [50, 10], color: "#ec4899" },
  "Asia-Pacific": { center: [20, 110], color: "#f59e0b" },
  "Latin America": { center: [-15, -60], color: "#10b981" },
  "Middle East & Africa": { center: [5, 25], color: "#ef4444" },
  "Global": { center: [20, 0], color: "#8b5cf6" },
  "Undefined": { center: [0, 0], color: "#9ca3af" },
};

function regionColor(region) {
  return REGION_META[region]?.color || "#9ca3af";
}

// Build a div-icon marker colored by region. `count` shows a small badge when
// multiple firms share a spot (e.g. region-centroid fallbacks).
function makeRegionIcon(color, highlighted) {
  const size = highlighted ? 34 : 26;
  const inner = highlighted ? 16 : 12;
  return L.divIcon({
    className: "map-search-marker",
    html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;"><div style="width:${inner}px;height:${inner}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

// Resolve a firm's best map position: prefer the headquarters address lat/long,
// then any address with coordinates, then the region centroid (with a small
// deterministic jitter so stacked firms don't perfectly overlap).
function firmPosition(firm, index) {
  const addrs = firm.addresses || [];
  const hq = addrs.find((a) => a.is_headquarters && a.latitude != null && a.longitude != null);
  if (hq) return [hq.latitude, hq.longitude];
  const any = addrs.find((a) => a.latitude != null && a.longitude != null);
  if (any) return [any.latitude, any.longitude];
  // Fall back to the geocoded location field (set via the firm profile's
  // Location field + Auto-locate button) before the region centroid.
  if (firm.location_lat != null && firm.location_lng != null) {
    return [firm.location_lat, firm.location_lng];
  }
  const region = firm.geographic_region || "Undefined";
  const center = REGION_META[region]?.center || [0, 0];
  // Deterministic jitter based on index so stacked centroid firms spread out.
  const jitterLat = ((index % 17) - 8) * 0.6;
  const jitterLon = (((index + 5) % 13) - 6) * 0.8;
  return [center[0] + jitterLat, center[1] + jitterLon];
}

function firmTypeLabel(firm) {
  const types = firm.firm_types?.length ? firm.firm_types : firm.firm_type ? [firm.firm_type] : [];
  return types.join(", ") || "—";
}

export default function FirmGeographicMap() {
  const { data: firms = [], isLoading } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
    select: (data) => (data || []).filter((f) => !f.deleted_at),
  });

  // Active region filter: null = show all, otherwise only that region.
  const [activeRegion, setActiveRegion] = useState(null);
  const [selectedFirmId, setSelectedFirmId] = useState(null);

  // Count firms per region (every firm counts once, assigned to its stored region
  // or "Undefined" when missing).
  const regionCounts = useMemo(() => {
    const counts = {};
    for (const r of GEOGRAPHIC_REGIONS) counts[r] = 0;
    for (const f of firms) {
      const r = f.geographic_region || "Undefined";
      counts[r] = (counts[r] || 0) + 1;
    }
    return counts;
  }, [firms]);

  const visibleFirms = useMemo(() => {
    if (!activeRegion) return firms;
    return firms.filter((f) => (f.geographic_region || "Undefined") === activeRegion);
  }, [firms, activeRegion]);

  const totalFirms = firms.length;
  const regionsWithFirms = GEOGRAPHIC_REGIONS.filter((r) => regionCounts[r] > 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md flex-shrink-0 sticky top-0 z-30">
        <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-white/90 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Back</span>
          </Link>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-white" />
            <h1 className="text-base font-bold tracking-tight">Firm Geographic Distribution</h1>
          </div>
          <div className="ml-auto text-xs text-white/80 hidden sm:block">
            {totalFirms} firm{totalFirms === 1 ? "" : "s"} · {regionsWithFirms.length} region{regionsWithFirms.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl xl:max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-[70vh]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : totalFirms === 0 ? (
          <div className="flex flex-col items-center justify-center h-[70vh] text-center">
            <Building className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No firms to display</p>
            <p className="text-sm text-gray-400">Add firms with addresses to see them on the map.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
            {/* Region legend / filter sidebar */}
            <div className="space-y-3">
              <div className="bg-card rounded-xl border border-border shadow-sm p-3">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-foreground">Regions</h2>
                  {activeRegion && (
                    <button
                      onClick={() => setActiveRegion(null)}
                      className="text-xs text-primary hover:underline"
                    >
                      Show all
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => setActiveRegion(null)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-colors ${
                      activeRegion === null ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      All Regions
                    </span>
                    <span className="text-xs text-muted-foreground">{totalFirms}</span>
                  </button>
                  {GEOGRAPHIC_REGIONS.map((region) => {
                    const count = regionCounts[region] || 0;
                    if (count === 0) return null;
                    const isActive = activeRegion === region;
                    return (
                      <button
                        key={region}
                        onClick={() => setActiveRegion(isActive ? null : region)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-colors ${
                          isActive ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0 border border-white shadow-sm"
                            style={{ background: regionColor(region) }}
                          />
                          <span className="truncate">{region}</span>
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Firm list for the active filter */}
              <div className="bg-card rounded-xl border border-border shadow-sm p-3 max-h-[300px] lg:max-h-[calc(100vh-280px)] overflow-y-auto">
                <h2 className="text-sm font-semibold text-foreground mb-2">
                  {activeRegion ? `Firms in ${activeRegion}` : "All Firms"}
                  <span className="ml-1 text-xs text-muted-foreground font-normal">({visibleFirms.length})</span>
                </h2>
                <div className="space-y-1">
                  {visibleFirms
                    .slice()
                    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                    .map((f) => (
                      <Link
                        key={f.id}
                        to="/"
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors group"
                        title={f.name}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white"
                          style={{ background: regionColor(f.geographic_region || "Undefined") }}
                        />
                        <span className="text-sm text-foreground truncate group-hover:text-primary">
                          {f.name}
                        </span>
                      </Link>
                    ))}
                </div>
              </div>
            </div>

            {/* Map */}
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden h-[60vh] lg:h-[calc(100vh-140px)]">
              <MapContainer
                center={[20, 0]}
                zoom={2}
                minZoom={2}
                worldCopyJump
                scrollWheelZoom
                className="w-full h-full"
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; OpenStreetMap &copy; CARTO'
                />
                {visibleFirms.map((firm, i) => {
                  const pos = firmPosition(firm, i);
                  const region = firm.geographic_region || "Undefined";
                  const color = regionColor(region);
                  const isSel = selectedFirmId === firm.id;
                  return (
                    <Marker
                      key={firm.id}
                      position={pos}
                      icon={makeRegionIcon(color, isSel)}
                      eventHandlers={{ click: () => setSelectedFirmId(firm.id) }}
                    >
                      <Popup>
                        <div className="min-w-[180px]">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-white"
                              style={{ background: color }}
                            />
                            <span className="font-semibold text-sm text-gray-900">{firm.name}</span>
                          </div>
                          <div className="text-xs text-gray-500 mb-1">{firmTypeLabel(firm)}</div>
                          <div className="text-xs text-gray-500 mb-2">
                            <span className="font-medium text-gray-700">Region:</span> {region}
                          </div>
                          {firm.website && (
                            <a
                              href={firm.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-600 hover:underline break-all"
                            >
                              {firm.website}
                            </a>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}