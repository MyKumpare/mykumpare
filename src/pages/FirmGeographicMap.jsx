import React, { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowLeft, Building, ChevronRight, Globe, Loader2, MapPin } from "lucide-react";
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

const UNSPEC = "(Unspecified)";

function regionColor(region) {
  return REGION_META[region]?.color || "#9ca3af";
}

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

// Best map position for a firm at the current drill level: prefer an address
// matching the drill path that has coordinates, else fall back to HQ / region.
function drillPosition(firm, drill) {
  const addrs = (firm.addresses || []).filter((a) => a.latitude != null && a.longitude != null);
  if (drill.country) {
    const m = addrs.find(
      (a) =>
        (a.country || UNSPEC) === drill.country &&
        (!drill.state || (a.state || UNSPEC) === drill.state) &&
        (!drill.city || (a.city || UNSPEC) === drill.city)
    );
    if (m) return [m.latitude, m.longitude];
  }
  const hq = addrs.find((a) => a.is_headquarters);
  if (hq) return [hq.latitude, hq.longitude];
  if (firm.location_lat != null && firm.location_lng != null) {
    return [firm.location_lat, firm.location_lng];
  }
  const region = firm.geographic_region || "Undefined";
  return REGION_META[region]?.center || [0, 0];
}

function firmTypeLabel(firm) {
  const types = firm.firm_types?.length ? firm.firm_types : firm.firm_type ? [firm.firm_type] : [];
  return types.join(", ") || "—";
}

// --- Drill-down hierarchy helpers (derived from firm address data) ---

function firmCountries(firm) {
  const cs = [...new Set((firm.addresses || []).filter((a) => a.country).map((a) => a.country))];
  return cs.length ? cs : [UNSPEC];
}

function firmStatesInCountry(firm, country) {
  const addrs = (firm.addresses || []).filter((a) => (a.country || UNSPEC) === country);
  if (addrs.length === 0) return [];
  const ss = [...new Set(addrs.filter((a) => a.state).map((a) => a.state))];
  return ss.length ? ss : [UNSPEC];
}

function firmCitiesInState(firm, country, state) {
  const addrs = (firm.addresses || []).filter(
    (a) => (a.country || UNSPEC) === country && (a.state || UNSPEC) === state
  );
  if (addrs.length === 0) return [];
  const cs = [...new Set(addrs.filter((a) => a.city).map((a) => a.city))];
  return cs.length ? cs : [UNSPEC];
}

// Recenter the map when the drill path changes.
function MapRecenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom, { duration: 0.7 });
  }, [center, zoom]);
  return null;
}

export default function FirmGeographicMap() {
  const { data: firms = [], isLoading } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
    select: (data) => (data || []).filter((f) => !f.deleted_at),
  });

  // Drill path: each level null until selected.
  const [drill, setDrill] = useState({ region: null, country: null, state: null, city: null });
  const [selectedFirmId, setSelectedFirmId] = useState(null);

  const totalFirms = firms.length;

  // Firms matching the deepest selected level (for the map + firm list).
  const visibleFirms = useMemo(() => {
    if (!drill.region) return firms;
    const inRegion = firms.filter((f) => (f.geographic_region || "Undefined") === drill.region);
    if (!drill.country) return inRegion;
    const inCountry = inRegion.filter((f) => firmCountries(f).includes(drill.country));
    if (!drill.state) return inCountry;
    const inState = inCountry.filter((f) => firmStatesInCountry(f, drill.country).includes(drill.state));
    if (!drill.city) return inState;
    return inState.filter((f) => firmCitiesInState(f, drill.country, drill.state).includes(drill.city));
  }, [firms, drill]);

  // Children list for the sidebar at the current level.
  const children = useMemo(() => {
    if (!drill.region) {
      return GEOGRAPHIC_REGIONS.map((r) => {
        const count = firms.filter((f) => (f.geographic_region || "Undefined") === r).length;
        return { key: r, label: r, count, color: regionColor(r) };
      }).filter((c) => c.count > 0);
    }
    const inRegion = firms.filter((f) => (f.geographic_region || "Undefined") === drill.region);
    const regionColorHex = regionColor(drill.region);
    if (!drill.country) {
      const counts = {};
      for (const f of inRegion) for (const c of firmCountries(f)) counts[c] = (counts[c] || 0) + 1;
      return Object.entries(counts)
        .map(([label, count]) => ({ key: label, label, count, color: regionColorHex }))
        .sort((a, b) => (a.label === UNSPEC ? 1 : b.label === UNSPEC ? -1 : a.label.localeCompare(b.label)));
    }
    const inCountry = inRegion.filter((f) => firmCountries(f).includes(drill.country));
    if (!drill.state) {
      const counts = {};
      for (const f of inCountry) for (const s of firmStatesInCountry(f, drill.country)) counts[s] = (counts[s] || 0) + 1;
      return Object.entries(counts)
        .map(([label, count]) => ({ key: label, label, count, color: regionColorHex }))
        .sort((a, b) => (a.label === UNSPEC ? 1 : b.label === UNSPEC ? -1 : a.label.localeCompare(b.label)));
    }
    const inState = inCountry.filter((f) => firmStatesInCountry(f, drill.country).includes(drill.state));
    const counts = {};
    for (const f of inState) for (const c of firmCitiesInState(f, drill.country, drill.state)) counts[c] = (counts[c] || 0) + 1;
    return Object.entries(counts)
      .map(([label, count]) => ({ key: label, label, count, color: regionColorHex }))
      .sort((a, b) => (a.label === UNSPEC ? 1 : b.label === UNSPEC ? -1 : a.label.localeCompare(b.label)));
  }, [firms, drill]);

  // Map center + zoom based on the visible firms at this level.
  const { mapCenter, mapZoom } = useMemo(() => {
    const positions = visibleFirms.map((f) => drillPosition(f, drill)).filter((p) => p[0] != null);
    if (positions.length === 0) {
      const region = drill.region || "Undefined";
      return { mapCenter: REGION_META[region]?.center || [20, 0], mapZoom: drill.region ? 3 : 2 };
    }
    const lat = positions.reduce((s, p) => s + p[0], 0) / positions.length;
    const lng = positions.reduce((s, p) => s + p[1], 0) / positions.length;
    const zoom = !drill.region ? 2 : !drill.country ? 4 : !drill.state ? 6 : !drill.city ? 8 : 11;
    return { mapCenter: [lat, lng], mapZoom: zoom };
  }, [visibleFirms, drill]);

  const atCityLevel = !!drill.city;

  // Breadcrumb segments for the current drill path.
  const crumbs = [
    { label: "All Regions", onClick: () => setDrill({ region: null, country: null, state: null, city: null }) },
    drill.region && { label: drill.region, onClick: () => setDrill({ region: drill.region, country: null, state: null, city: null }) },
    drill.country && { label: drill.country, onClick: () => setDrill({ ...drill, state: null, city: null }) },
    drill.state && { label: drill.state, onClick: () => setDrill({ ...drill, city: null }) },
    drill.city && { label: drill.city, onClick: null },
  ].filter(Boolean);

  const sidebarTitle = !drill.region
    ? "Regions"
    : !drill.country
    ? `Countries in ${drill.region}`
    : !drill.state
    ? `States / Provinces in ${drill.country}`
    : !drill.city
    ? `Cities in ${drill.state}`
    : `Firms in ${drill.city}`;

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
            {totalFirms} firm{totalFirms === 1 ? "" : "s"} · {visibleFirms.length} shown
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
            {/* Drill-down sidebar */}
            <div className="space-y-3">
              <div className="bg-card rounded-xl border border-border shadow-sm p-3">
                {/* Breadcrumb */}
                <div className="flex flex-wrap items-center gap-x-1 gap-y-1 mb-3 text-xs">
                  {crumbs.map((c, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <ChevronRight className="w-3 h-3 text-gray-400 inline" />}
                      {c.onClick ? (
                        <button onClick={c.onClick} className="text-primary hover:underline max-w-[140px] truncate">
                          {c.label}
                        </button>
                      ) : (
                        <span className="font-semibold text-foreground max-w-[140px] truncate">{c.label}</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>

                <h2 className="text-sm font-semibold text-foreground mb-2">{sidebarTitle}</h2>
                <div className="space-y-1">
                  {atCityLevel ? (
                    // Firm list at the deepest level
                    visibleFirms
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
                          <span className="text-sm text-foreground truncate group-hover:text-primary">{f.name}</span>
                        </Link>
                      ))
                  ) : (
                    children.map((c) => {
                      const isActive = false; // children are drill targets, not toggle filters
                      return (
                        <button
                          key={c.key}
                          onClick={() => {
                            if (!drill.region) setDrill({ region: c.key, country: null, state: null, city: null });
                            else if (!drill.country) setDrill({ ...drill, country: c.key, state: null, city: null });
                            else if (!drill.state) setDrill({ ...drill, state: c.key, city: null });
                            else setDrill({ ...drill, city: c.key });
                            setSelectedFirmId(null);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-colors ${
                            isActive ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0 border border-white shadow-sm"
                              style={{ background: c.color }}
                            />
                            <span className="truncate">{c.label}</span>
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                            {c.count}
                            <ChevronRight className="w-3 h-3 text-gray-400" />
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Firm list for the active drill level */}
              {!atCityLevel && (
                <div className="bg-card rounded-xl border border-border shadow-sm p-3 max-h-[300px] lg:max-h-[calc(100vh-280px)] overflow-y-auto">
                  <h2 className="text-sm font-semibold text-foreground mb-2">
                    Firms at this level
                    <span className="ml-1 text-xs text-muted-foreground font-normal">({visibleFirms.length})</span>
                  </h2>
                  <div className="space-y-1">
                    {visibleFirms.slice(0, 200).map((f) => (
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
                        <span className="text-sm text-foreground truncate group-hover:text-primary">{f.name}</span>
                      </Link>
                    ))}
                    {visibleFirms.length > 200 && (
                      <p className="text-xs text-muted-foreground px-2 py-1">
                        Showing 200 of {visibleFirms.length}. Drill down to narrow.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Map */}
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden h-[60vh] lg:h-[calc(100vh-140px)]">
              <MapContainer center={[20, 0]} zoom={2} minZoom={2} worldCopyJump scrollWheelZoom className="w-full h-full">
                <MapRecenter center={mapCenter} zoom={mapZoom} />
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; OpenStreetMap &copy; CARTO'
                />
                {visibleFirms.map((firm) => {
                  const pos = drillPosition(firm, drill);
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
                          <div className="text-xs text-gray-500 mb-1">
                            <span className="font-medium text-gray-700">Region:</span> {region}
                          </div>
                          {(firm.addresses || []).filter((a) => a.city || a.state || a.country).slice(0, 1).map((a, i) => (
                            <div key={i} className="text-xs text-gray-500 mb-2">
                              <span className="font-medium text-gray-700">Location:</span>{" "}
                              {[a.city, a.state, a.country].filter(Boolean).join(", ")}
                            </div>
                          ))}
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