import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapContainer, TileLayer, Marker, Popup, Circle, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Search, Building, User, Navigation, Loader2, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

// ── Helpers ──────────────────────────────────────────────────────────────

const EARTH_RADIUS_MILES = 3959;

function haversine(lat1, lon1, lat2, lon2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatAddress(addr) {
  if (!addr) return "";
  return [
    addr.address_line1,
    addr.address_line2,
    addr.city,
    [addr.state, addr.postal_code].filter(Boolean).join(" "),
    addr.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function matchesLocationText(addr, q) {
  if (!addr) return false;
  const fields = [addr.city, addr.state, addr.country, addr.postal_code]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return fields.includes(q);
}

function buildAddressString(addr) {
  if (!addr) return "";
  return [addr.city, addr.state, addr.postal_code, addr.country].filter(Boolean).join(", ");
}

// ── Leaflet Icons ────────────────────────────────────────────────────────

function makeIcon(type, highlighted) {
  const colors = { firm: "#4f46e5", contact: "#ec4899", center: "#ef4444" };
  const color = colors[type] || colors.firm;
  const size = highlighted ? 36 : 24;
  const innerSize = highlighted ? 18 : 12;
  return L.divIcon({
    className: "map-search-marker",
    html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;${
      highlighted ? "animation:map-bounce 0.5s ease infinite alternate;" : ""
    }"><div style="width:${innerSize}px;height:${innerSize}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

// ── Map controller: auto-fit bounds ─────────────────────────────────────

function MapBoundsController({ points, center, radius }) {
  const map = useMap();
  useEffect(() => {
    const pts = [];
    if (center) pts.push([center.lat, center.lon]);
    points.forEach((p) => {
      if (p.lat != null && p.lon != null) pts.push([p.lat, p.lon]);
    });
    if (pts.length === 0) return;
    if (pts.length === 1) {
      const zoom = radius ? Math.max(4, Math.round(14 - Math.log2(radius / 5))) : 11;
      map.setView(pts[0], zoom);
    } else {
      map.fitBounds(pts, { padding: [50, 50], maxZoom: 14 });
    }
  }, [points, center, radius, map]);
  return null;
}

function MapInitializer() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

// ── Result item component ────────────────────────────────────────────────

function ResultItem({ result, highlighted, onHover, onClick }) {
  const isFirm = result.type === "firm";
  return (
    <div
      onMouseEnter={() => onHover(result.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(result)}
      className={`px-3 py-2.5 rounded-lg cursor-pointer transition-colors border ${
        highlighted
          ? "bg-indigo-50 border-indigo-300 shadow-sm"
          : "bg-white border-gray-100 hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center ${
            isFirm ? "bg-indigo-100 text-indigo-600" : "bg-pink-100 text-pink-600"
          }`}
        >
          {isFirm ? <Building className="w-4 h-4" /> : <User className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">{result.name}</div>
          {result.title && (
            <div className="text-xs text-gray-500 truncate">{result.title}</div>
          )}
          {result.addressLabel && (
            <div className="text-xs text-gray-400 truncate mt-0.5">{result.addressLabel}</div>
          )}
          {result.distance != null && (
            <div className="text-xs text-indigo-600 font-medium mt-0.5">
              {result.distance.toFixed(1)} mi away
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export default function MapSearchModal({
  open,
  onClose,
  firms = [],
  contacts = [],
  onFirmClick,
  onContactClick,
}) {
  const [locationInput, setLocationInput] = useState("");
  const [radiusInput, setRadiusInput] = useState("");
  const [firmNameInput, setFirmNameInput] = useState("");
  const [results, setResults] = useState([]);
  const [center, setCenter] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchMode, setSearchMode] = useState(null);

  const activeFirms = useMemo(() => firms.filter((f) => !f.deleted_at), [firms]);
  const activeContacts = useMemo(() => contacts.filter((c) => !c.deleted_at), [contacts]);

  const radiusMiles = radiusInput ? parseFloat(radiusInput) : null;
  const radiusMeters = radiusMiles ? radiusMiles * 1609.34 : null;

  const handleSearch = useCallback(async () => {
    if (!locationInput.trim() && !firmNameInput.trim()) {
      setError("Enter a location or firm name to search.");
      return;
    }
    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      let centerQuery = null;
      let candidateResults = [];
      let mode = null;

      if (firmNameInput.trim()) {
        mode = "firm";
        const q = firmNameInput.toLowerCase().trim();
        const matchingFirms = activeFirms.filter((f) => f.name.toLowerCase().includes(q));

        if (matchingFirms.length === 0) {
          setResults([]);
          setCenter(null);
          setSearchMode(mode);
          return;
        }

        // Collect all addresses for matching firms (firm's own + contacts')
        for (const firm of matchingFirms) {
          for (const addr of firm.addresses || []) {
            candidateResults.push({
              id: `firm-${firm.id}-${addr.id || addr.address_line1 || JSON.stringify(addr)}`,
              type: "firm",
              entityId: firm.id,
              name: firm.name,
              address: addr,
              addressLabel: formatAddress(addr),
              firmId: firm.id,
              firmName: firm.name,
            });
          }
          // Contacts at this firm
          const firmContacts = activeContacts.filter(
            (c) => (c.firm_ids || []).includes(firm.id)
          );
          for (const contact of firmContacts) {
            for (const addr of contact.addresses || []) {
              candidateResults.push({
                id: `contact-${contact.id}-${addr.id || addr.address_line1 || JSON.stringify(addr)}`,
                type: "contact",
                entityId: contact.id,
                name: [contact.first_name, contact.last_name].filter(Boolean).join(" "),
                title: contact.title,
                address: addr,
                addressLabel: formatAddress(addr),
                firmId: firm.id,
                firmName: firm.name,
              });
            }
          }
        }

        // If radius is set, use the first matching firm's HQ as center
        if (radiusMiles && matchingFirms.length > 0) {
          const hqFirm = matchingFirms[0];
          const hqAddr =
            (hqFirm.addresses || []).find((a) => a.is_headquarters) ||
            (hqFirm.addresses || [])[0];
          if (hqAddr) {
            centerQuery = buildAddressString(hqAddr);
          }
          // Also add ALL other firms/contacts as candidates for radius filtering
          const existingIds = new Set(candidateResults.map((r) => r.id));
          for (const firm of activeFirms) {
            if (matchingFirms.some((mf) => mf.id === firm.id)) continue;
            for (const addr of firm.addresses || []) {
              const rid = `firm-${firm.id}-${addr.id || addr.address_line1 || JSON.stringify(addr)}`;
              if (!existingIds.has(rid)) {
                candidateResults.push({
                  id: rid,
                  type: "firm",
                  entityId: firm.id,
                  name: firm.name,
                  address: addr,
                  addressLabel: formatAddress(addr),
                  firmId: firm.id,
                  firmName: firm.name,
                });
              }
            }
            const firmContacts = activeContacts.filter(
              (c) => (c.firm_ids || []).includes(firm.id)
            );
            for (const contact of firmContacts) {
              for (const addr of contact.addresses || []) {
                const rid = `contact-${contact.id}-${addr.id || addr.address_line1 || JSON.stringify(addr)}`;
                if (!existingIds.has(rid)) {
                  candidateResults.push({
                    id: rid,
                    type: "contact",
                    entityId: contact.id,
                    name: [contact.first_name, contact.last_name].filter(Boolean).join(" "),
                    title: contact.title,
                    address: addr,
                    addressLabel: formatAddress(addr),
                    firmId: firm.id,
                    firmName: firm.name,
                  });
                }
              }
            }
          }
        }
      } else {
        // Location search mode
        mode = "location";
        centerQuery = locationInput.trim();
        const locQ = locationInput.toLowerCase().trim();

        if (radiusMiles) {
          // Radius search: add all firms and contacts as candidates
          for (const firm of activeFirms) {
            for (const addr of firm.addresses || []) {
              candidateResults.push({
                id: `firm-${firm.id}-${addr.id || addr.address_line1 || JSON.stringify(addr)}`,
                type: "firm",
                entityId: firm.id,
                name: firm.name,
                address: addr,
                addressLabel: formatAddress(addr),
                firmId: firm.id,
                firmName: firm.name,
              });
            }
          }
          for (const contact of activeContacts) {
            for (const addr of contact.addresses || []) {
              candidateResults.push({
                id: `contact-${contact.id}-${addr.id || addr.address_line1 || JSON.stringify(addr)}`,
                type: "contact",
                entityId: contact.id,
                name: [contact.first_name, contact.last_name].filter(Boolean).join(" "),
                title: contact.title,
                address: addr,
                addressLabel: formatAddress(addr),
              });
            }
          }
        } else {
          // Exact text match on address fields
          for (const firm of activeFirms) {
            for (const addr of firm.addresses || []) {
              if (matchesLocationText(addr, locQ)) {
                candidateResults.push({
                  id: `firm-${firm.id}-${addr.id || addr.address_line1 || JSON.stringify(addr)}`,
                  type: "firm",
                  entityId: firm.id,
                  name: firm.name,
                  address: addr,
                  addressLabel: formatAddress(addr),
                  firmId: firm.id,
                  firmName: firm.name,
                });
              }
            }
          }
          for (const contact of activeContacts) {
            for (const addr of contact.addresses || []) {
              if (matchesLocationText(addr, locQ)) {
                candidateResults.push({
                  id: `contact-${contact.id}-${addr.id || addr.address_line1 || JSON.stringify(addr)}`,
                  type: "contact",
                  entityId: contact.id,
                  name: [contact.first_name, contact.last_name].filter(Boolean).join(" "),
                  title: contact.title,
                  address: addr,
                  addressLabel: formatAddress(addr),
                });
              }
            }
          }
        }
      }

      // Geocode all candidate addresses + center
      const locationsToGeocode = candidateResults
        .filter((r) => r.address)
        .map((r) => ({
          key: r.id,
          city: r.address.city,
          state: r.address.state,
          country: r.address.country,
          postalCode: r.address.postal_code,
        }));

      let centerCoords = null;
      let geocodedMap = {};

      if (centerQuery || locationsToGeocode.length > 0) {
        const resp = await base44.functions.invoke("geocodeLocations", {
          centerQuery,
          locations: locationsToGeocode,
        });
        const data = resp?.data ?? resp ?? {};
        centerCoords = data.center || null;
        geocodedMap = data.geocoded || {};
      }

      // Attach coordinates to results and filter out un-geocoded ones
      let finalResults = candidateResults
        .map((r) => {
          const geo = geocodedMap[r.id];
          if (!geo) return null;
          return { ...r, lat: geo.lat, lon: geo.lon };
        })
        .filter(Boolean);

      // If radius is set, filter by distance from center
      if (radiusMiles && centerCoords) {
        finalResults = finalResults
          .map((r) => ({
            ...r,
            distance: haversine(centerCoords.lat, centerCoords.lon, r.lat, r.lon),
          }))
          .filter((r) => r.distance <= radiusMiles)
          .sort((a, b) => a.distance - b.distance);
      }

      setCenter(centerCoords);
      setResults(finalResults);
      setSearchMode(mode);
    } catch (err) {
      setError(err?.message || "Search failed. Please try again.");
      setResults([]);
      setCenter(null);
    } finally {
      setLoading(false);
    }
  }, [locationInput, radiusInput, firmNameInput, activeFirms, activeContacts, radiusMiles]);

  const handleResultClick = useCallback(
    (result) => {
      if (result.type === "firm") {
        const firm = activeFirms.find((f) => f.id === result.entityId);
        if (firm && onFirmClick) {
          onClose();
          onFirmClick(firm);
        }
      } else {
        const contact = activeContacts.find((c) => c.id === result.entityId);
        if (contact && onContactClick) {
          onClose();
          onContactClick(contact);
        }
      }
    },
    [activeFirms, activeContacts, onFirmClick, onContactClick, onClose]
  );

  const handleClose = useCallback(() => {
    setLocationInput("");
    setRadiusInput("");
    setFirmNameInput("");
    setResults([]);
    setCenter(null);
    setHoveredId(null);
    setError(null);
    setHasSearched(false);
    onClose();
  }, [onClose]);

  const mapPoints = results.filter((r) => r.lat != null && r.lon != null);
  const firmResults = results.filter((r) => r.type === "firm");
  const contactResults = results.filter((r) => r.type === "contact");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[88vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-rose-500" />
              <DialogTitle className="text-lg">Map Search</DialogTitle>
            </div>
          </div>
          {/* Search inputs */}
          <div className="flex flex-wrap items-end gap-2 mt-3">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-gray-500 font-medium mb-1 block">
                Location (city, state, country, zip, postal code)
              </label>
              <Input
                placeholder="e.g. Atlanta, GA or 30303 or London"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="h-9 text-sm"
              />
            </div>
            <div className="w-[120px]">
              <label className="text-xs text-gray-500 font-medium mb-1 block">
                Radius (miles)
              </label>
              <Input
                type="number"
                min="0"
                placeholder="e.g. 50"
                value={radiusInput}
                onChange={(e) => setRadiusInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="h-9 text-sm"
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-gray-500 font-medium mb-1 block">
                Firm name (optional)
              </label>
              <Input
                placeholder="e.g. BlackRock or Vanguard"
                value={firmNameInput}
                onChange={(e) => setFirmNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="h-9 text-sm"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading} className="h-9">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Search
            </Button>
          </div>
        </DialogHeader>

        {/* Main content: map + list */}
        <div className="flex-1 flex flex-col sm:flex-row min-h-0">
          {/* Map */}
          <div className="flex-1 min-h-[300px] relative">
            <MapContainer
              center={[39.8283, -98.5795]}
              zoom={4}
              className="w-full h-full"
              style={{ background: "#e5e7eb" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <MapInitializer />
              <MapBoundsController points={mapPoints} center={center} radius={radiusMiles} />

              {/* Center marker */}
              {center && (
                <Marker position={[center.lat, center.lon]} icon={makeIcon("center", false)}>
                  <Tooltip permanent>Search center</Tooltip>
                </Marker>
              )}

              {/* Radius circle */}
              {center && radiusMeters && (
                <Circle
                  center={[center.lat, center.lon]}
                  radius={radiusMeters}
                  pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.08, weight: 1.5 }}
                />
              )}

              {/* Result markers */}
              {mapPoints.map((r) => (
                <Marker
                  key={r.id}
                  position={[r.lat, r.lon]}
                  icon={makeIcon(r.type, hoveredId === r.id)}
                  zIndexOffset={hoveredId === r.id ? 1000 : 0}
                >
                  <Popup>
                    <div className="text-sm">
                      <div className="font-semibold">{r.name}</div>
                      {r.title && <div className="text-gray-500">{r.title}</div>}
                      {r.addressLabel && (
                        <div className="text-gray-400 text-xs mt-1">{r.addressLabel}</div>
                      )}
                      {r.distance != null && (
                        <div className="text-indigo-600 font-medium mt-1">
                          {r.distance.toFixed(1)} mi from center
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            {/* Legend */}
            {results.length > 0 && (
              <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 rounded-lg shadow-md px-3 py-2 text-xs space-y-1 pointer-events-none">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 border border-white" />
                  Firm ({firmResults.length})
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-pink-500 border border-white" />
                  Contact ({contactResults.length})
                </div>
                {center && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white" />
                    Center
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Results list */}
          <div className="w-full sm:w-[320px] sm:border-l border-t sm:border-t-0 border-gray-200 flex flex-col min-h-0 max-h-[40vh] sm:max-h-none">
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <span className="text-sm font-semibold text-gray-700">
                {loading
                  ? "Searching..."
                  : hasSearched
                  ? `${results.length} result${results.length !== 1 ? "s" : ""}`
                  : "Enter search criteria"}
              </span>
              {results.length > 0 && (
                <span className="text-xs text-gray-400">
                  {searchMode === "firm" ? "Firm name search" : "Location search"}
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {loading && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                  <span className="text-sm">Geocoding addresses...</span>
                </div>
              )}
              {!loading && error && (
                <div className="text-sm text-red-500 text-center py-8 px-4">{error}</div>
              )}
              {!loading && !error && hasSearched && results.length === 0 && (
                <div className="text-sm text-gray-400 text-center py-8 px-4">
                  No results found. Try a different location or firm name.
                </div>
              )}
              {!loading && !error && !hasSearched && (
                <div className="text-sm text-gray-400 text-center py-8 px-4">
                  <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  Search for firms and contacts by location or firm name. Hover over a result to
                  see it on the map.
                </div>
              )}
              {!loading &&
                !error &&
                results.slice(0, 150).map((r) => (
                  <ResultItem
                    key={r.id}
                    result={r}
                    highlighted={hoveredId === r.id}
                    onHover={setHoveredId}
                    onClick={handleResultClick}
                  />
                ))}
              {!loading && !error && results.length > 150 && (
                <div className="text-xs text-gray-400 text-center py-2">
                  Showing 150 of {results.length} results. Refine your search to see more.
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}