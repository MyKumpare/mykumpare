import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { MapContainer, TileLayer, Marker, Popup, Circle, Tooltip, useMap, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin, Search, Building, User, Navigation, Loader2, X,
  Map as MapIcon, List, Columns2, Route as RouteIcon, Plus,
  ArrowUp, ArrowDown, Trash2, ExternalLink, CheckCircle2,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import MapSearchAutocomplete from "@/components/search/MapSearchAutocomplete";

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
  const colors = { firm: "#4f46e5", contact: "#ec4899", center: "#ef4444", stop: "#2563eb" };
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

function makeNumberedIcon(num, highlighted) {
  const size = highlighted ? 34 : 28;
  return L.divIcon({
    className: "map-search-marker",
    html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;${
      highlighted ? "animation:map-bounce 0.5s ease infinite alternate;" : ""
    }"><div style="width:${size}px;height:${size}px;border-radius:50%;background:#2563eb;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:700;">${num}</div></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

// ── Geocode persistence ──────────────────────────────────────────────────
// Saves newly geocoded lat/lng back onto the entity's address record so
// subsequent searches skip the geocode API call for that address.

function matchAddress(addr, target) {
  if (addr.id && target.id && addr.id === target.id) return true;
  return (
    addr.address_line1 === target.address_line1 &&
    addr.city === target.city &&
    addr.state === target.state
  );
}

async function persistGeocodedResults(results, firms, contacts) {
  const firmUpdates = new Map();
  const contactUpdates = new Map();

  for (const r of results) {
    if (r.lat == null || r.lon == null) continue;
    // Skip addresses that already had stored coordinates
    if (r.address && typeof r.address.latitude === "number") continue;

    if (r.type === "firm") {
      if (!firmUpdates.has(r.entityId)) firmUpdates.set(r.entityId, []);
      firmUpdates.get(r.entityId).push({ address: r.address, lat: r.lat, lon: r.lon });
    } else if (r.type === "contact") {
      if (!contactUpdates.has(r.entityId)) contactUpdates.set(r.entityId, []);
      contactUpdates.get(r.entityId).push({ address: r.address, lat: r.lat, lon: r.lon });
    }
  }

  for (const [firmId, updates] of firmUpdates) {
    const firm = firms.find((f) => f.id === firmId);
    if (!firm?.addresses) continue;
    const newAddresses = firm.addresses.map((addr) => {
      const u = updates.find((up) => matchAddress(addr, up.address));
      return u ? { ...addr, latitude: u.lat, longitude: u.lon } : addr;
    });
    try {
      await base44.entities.Firm.update(firmId, { addresses: newAddresses });
    } catch { /* non-critical background save */ }
  }

  for (const [contactId, updates] of contactUpdates) {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact?.addresses) continue;
    const newAddresses = contact.addresses.map((addr) => {
      const u = updates.find((up) => matchAddress(addr, up.address));
      return u ? { ...addr, latitude: u.lat, longitude: u.lon } : addr;
    });
    try {
      await base44.entities.Contact.update(contactId, { addresses: newAddresses });
    } catch { /* non-critical background save */ }
  }
}

// ── Map controllers ─────────────────────────────────────────────────────

function MapBoundsController({ points, center, radius, routeCoords }) {
  const map = useMap();
  useEffect(() => {
    const pts = [];
    if (center) pts.push([center.lat, center.lon]);
    points.forEach((p) => {
      if (p.lat != null && p.lon != null) pts.push([p.lat, p.lon]);
    });
    if (routeCoords) {
      routeCoords.forEach(([lat, lon]) => pts.push([lat, lon]));
    }
    if (pts.length === 0) return;
    if (pts.length === 1) {
      const zoom = radius ? Math.max(4, Math.round(14 - Math.log2(radius / 5))) : 11;
      map.setView(pts[0], zoom);
    } else {
      map.fitBounds(pts, { padding: [50, 50], maxZoom: 14 });
    }
  }, [points, center, radius, routeCoords, map]);
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

// Viewport resizer — invalidates map size when the container becomes visible
function MapResizeOnView({ viewMode, directionsActive }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(timer);
  }, [viewMode, directionsActive, map]);
  return null;
}

// ── Result item component ────────────────────────────────────────────────

function ResultItem({ result, highlighted, onHover, onClick, selectable, selected, onToggleSelect, stopNumber }) {
  const isFirm = result.type === "firm";
  return (
    <div
      onMouseEnter={() => onHover(result.id)}
      onMouseLeave={() => onHover(null)}
      className={`px-3 py-2.5 rounded-lg transition-colors border ${
        highlighted
          ? "bg-indigo-50 border-indigo-300 shadow-sm"
          : "bg-white border-gray-100 hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {selectable && (
          <div className="flex-shrink-0 mt-0.5">
            <Checkbox checked={selected} onCheckedChange={() => onToggleSelect(result)} />
          </div>
        )}
        <div
          className={`flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center ${
            isFirm ? "bg-indigo-100 text-indigo-600" : "bg-pink-100 text-pink-600"
          } cursor-pointer hover:opacity-80 transition-opacity`}
          onClick={() => onClick(result)}
        >
          {isFirm ? <Building className="w-4 h-4" /> : <User className="w-4 h-4" />}
        </div>
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => onClick(result)}
        >
          <div className="text-sm font-medium text-gray-900 truncate">
            {stopNumber != null && <span className="text-blue-600 mr-1">#{stopNumber}</span>}
            {result.name}
          </div>
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

// ── Legend row with hover popover ─────────────────────────────────────────

function LegendRow({ label, count, color, items, onHover, onClick }) {
  const [showList, setShowList] = useState(false);
  if (count === 0) return null;
  return (
    <div
      className="relative"
      onMouseEnter={() => setShowList(true)}
      onMouseLeave={() => setShowList(false)}
    >
      <div className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 transition-colors">
        <span className={`w-2.5 h-2.5 rounded-full ${color} border border-white`} />
        {label} ({count})
      </div>
      {showList && items.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto z-[1001]">
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100 sticky top-0 bg-white">
            {label} ({count})
          </div>
          {items.slice(0, 50).map((r) => (
            <button
              key={r.id}
              onMouseEnter={() => onHover(r.id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => { setShowList(false); onClick(r); }}
              className="w-full text-left px-3 py-1.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
            >
              <div className="text-xs font-medium text-gray-900 truncate">{r.name}</div>
              {r.addressLabel && (
                <div className="text-[10px] text-gray-400 truncate">{r.addressLabel}</div>
              )}
            </button>
          ))}
          {items.length > 50 && (
            <div className="px-3 py-1.5 text-[10px] text-gray-400 text-center">
              Showing 50 of {items.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── View toggle ──────────────────────────────────────────────────────────

function ViewToggle({ viewMode, onChange }) {
  const options = [
    { value: "map", icon: MapIcon, label: "Map" },
    { value: "split", icon: Columns2, label: "Split" },
    { value: "list", icon: List, label: "List" },
  ];
  return (
    <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            viewMode === value
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
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

  // View + Directions state
  const [viewMode, setViewMode] = useState("split");
  const [directionsActive, setDirectionsActive] = useState(false);
  const [stops, setStops] = useState([]); // [{ id, label, subLabel, lat, lon }]
  const [customAddrInput, setCustomAddrInput] = useState("");
  const [geocodingCustom, setGeocodingCustom] = useState(false);
  const [addrInputFocused, setAddrInputFocused] = useState(false);
  const [addrHistory, setAddrHistory] = useState(() => {
    try {
      const stored = localStorage.getItem("mapSearch_customAddrHistory");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [route, setRoute] = useState(null);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState(null);

  const activeFirms = useMemo(() => firms.filter((f) => !f.deleted_at), [firms]);
  const activeContacts = useMemo(() => contacts.filter((c) => !c.deleted_at), [contacts]);

  const radiusMiles = radiusInput ? parseFloat(radiusInput) : null;
  const radiusMeters = radiusMiles ? radiusMiles * 1609.34 : null;

  const selectedStopIds = useMemo(() => new Set(stops.map((s) => s.id)), [stops]);

  // Address history autocomplete — filters previously used custom addresses
  const addrSuggestions = useMemo(() => {
    const q = customAddrInput.toLowerCase().trim();
    if (!q) return [];
    return addrHistory
      .filter((h) => h.query.toLowerCase().includes(q))
      .slice(0, 5);
  }, [customAddrInput, addrHistory]);

  // ── Autocomplete suggestions ──────────────────────────────────────────
  // Firm + contact name suggestions for the firm name field
  const firmNameSuggestions = useMemo(() => {
    const list = [];
    for (const f of activeFirms) {
      list.push({ label: f.name, subLabel: "Firm", type: "firm" });
    }
    for (const c of activeContacts) {
      const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
      if (name) list.push({ label: name, subLabel: c.title || "Contact", type: "contact" });
    }
    return list;
  }, [activeFirms, activeContacts]);

  // Location suggestions from all firm/contact addresses (city, state, country, zip)
  const locationSuggestions = useMemo(() => {
    const seen = new Set();
    const list = [];
    const add = (label, subLabel) => {
      const key = label.toLowerCase();
      if (!label || seen.has(key)) return;
      seen.add(key);
      list.push({ label, subLabel, type: "location" });
    };
    for (const f of activeFirms) {
      for (const addr of f.addresses || []) {
        add([addr.city, addr.state].filter(Boolean).join(", "), addr.country);
        if (addr.state) add(addr.state, addr.country);
        if (addr.city) add(addr.city, addr.state);
        if (addr.postal_code) add(addr.postal_code, [addr.city, addr.state].filter(Boolean).join(", "));
        if (addr.country) add(addr.country, null);
      }
    }
    for (const c of activeContacts) {
      for (const addr of c.addresses || []) {
        add([addr.city, addr.state].filter(Boolean).join(", "), addr.country);
        if (addr.state) add(addr.state, addr.country);
        if (addr.city) add(addr.city, addr.state);
        if (addr.postal_code) add(addr.postal_code, [addr.city, addr.state].filter(Boolean).join(", "));
        if (addr.country) add(addr.country, null);
      }
    }
    return list;
  }, [activeFirms, activeContacts]);

  const handleSearch = useCallback(async () => {
    if (!locationInput.trim() && !firmNameInput.trim()) {
      setError("Enter a location or firm name to search.");
      return;
    }
    setLoading(true);
    setError(null);
    setHasSearched(true);
    setRoute(null);
    setRouteError(null);

    try {
      let centerQuery = null;
      let candidateResults = [];
      let mode = null;

      if (firmNameInput.trim()) {
        mode = "firm";
        const q = firmNameInput.toLowerCase().trim();
        const matchingFirms = activeFirms.filter((f) => f.name.toLowerCase().includes(q));

        // Also match contact names (first + last)
        const matchingContacts = activeContacts.filter((c) => {
          const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ").toLowerCase();
          return fullName.includes(q);
        });

        if (matchingFirms.length === 0 && matchingContacts.length === 0) {
          setResults([]);
          setCenter(null);
          setSearchMode(mode);
          return;
        }

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

        // Add matching contacts (by name) and their addresses
        for (const contact of matchingContacts) {
          for (const addr of contact.addresses || []) {
            const rid = `contact-${contact.id}-${addr.id || addr.address_line1 || JSON.stringify(addr)}`;
            if (candidateResults.some((r) => r.id === rid)) continue;
            candidateResults.push({
              id: rid,
              type: "contact",
              entityId: contact.id,
              name: [contact.first_name, contact.last_name].filter(Boolean).join(" "),
              title: contact.title,
              address: addr,
              addressLabel: formatAddress(addr),
            });
          }
        }

        if (radiusMiles) {
          if (matchingFirms.length > 0) {
            const hqFirm = matchingFirms[0];
            const hqAddr =
              (hqFirm.addresses || []).find((a) => a.is_headquarters) ||
              (hqFirm.addresses || [])[0];
            if (hqAddr) {
              centerQuery = buildAddressString(hqAddr);
            }
          } else if (matchingContacts.length > 0) {
            const firstAddr = (matchingContacts[0].addresses || [])[0];
            if (firstAddr) {
              centerQuery = buildAddressString(firstAddr);
            }
          }
          const existingIds = new Set(candidateResults.map((r) => r.id));
          for (const firm of activeFirms) {
            if (matchingFirms.some((mf) => mf.id === firm.id)) continue;
            for (const addr of firm.addresses || []) {
              const rid = `firm-${firm.id}-${addr.id || addr.address_line1 || JSON.stringify(addr)}`;
              if (!existingIds.has(rid)) {
                candidateResults.push({
                  id: rid, type: "firm", entityId: firm.id, name: firm.name,
                  address: addr, addressLabel: formatAddress(addr),
                  firmId: firm.id, firmName: firm.name,
                });
              }
            }
            const firmContacts = activeContacts.filter((c) => (c.firm_ids || []).includes(firm.id));
            for (const contact of firmContacts) {
              for (const addr of contact.addresses || []) {
                const rid = `contact-${contact.id}-${addr.id || addr.address_line1 || JSON.stringify(addr)}`;
                if (!existingIds.has(rid)) {
                  candidateResults.push({
                    id: rid, type: "contact", entityId: contact.id,
                    name: [contact.first_name, contact.last_name].filter(Boolean).join(" "),
                    title: contact.title, address: addr, addressLabel: formatAddress(addr),
                    firmId: firm.id, firmName: firm.name,
                  });
                }
              }
            }
          }
        }
      } else {
        mode = "location";
        centerQuery = locationInput.trim();
        const locQ = locationInput.toLowerCase().trim();

        if (radiusMiles) {
          for (const firm of activeFirms) {
            for (const addr of firm.addresses || []) {
              candidateResults.push({
                id: `firm-${firm.id}-${addr.id || addr.address_line1 || JSON.stringify(addr)}`,
                type: "firm", entityId: firm.id, name: firm.name,
                address: addr, addressLabel: formatAddress(addr),
                firmId: firm.id, firmName: firm.name,
              });
            }
          }
          for (const contact of activeContacts) {
            for (const addr of contact.addresses || []) {
              candidateResults.push({
                id: `contact-${contact.id}-${addr.id || addr.address_line1 || JSON.stringify(addr)}`,
                type: "contact", entityId: contact.id,
                name: [contact.first_name, contact.last_name].filter(Boolean).join(" "),
                title: contact.title, address: addr, addressLabel: formatAddress(addr),
              });
            }
          }
        } else {
          for (const firm of activeFirms) {
            for (const addr of firm.addresses || []) {
              if (matchesLocationText(addr, locQ)) {
                candidateResults.push({
                  id: `firm-${firm.id}-${addr.id || addr.address_line1 || JSON.stringify(addr)}`,
                  type: "firm", entityId: firm.id, name: firm.name,
                  address: addr, addressLabel: formatAddress(addr),
                  firmId: firm.id, firmName: firm.name,
                });
              }
            }
          }
          for (const contact of activeContacts) {
            for (const addr of contact.addresses || []) {
              if (matchesLocationText(addr, locQ)) {
                candidateResults.push({
                  id: `contact-${contact.id}-${addr.id || addr.address_line1 || JSON.stringify(addr)}`,
                  type: "contact", entityId: contact.id,
                  name: [contact.first_name, contact.last_name].filter(Boolean).join(" "),
                  title: contact.title, address: addr, addressLabel: formatAddress(addr),
                });
              }
            }
          }
        }
      }

      // Use stored geocode where available; only geocode the rest
      const locationsToGeocode = candidateResults
        .filter(
          (r) =>
            r.address &&
            !(typeof r.address.latitude === "number" && typeof r.address.longitude === "number")
        )
        .map((r) => ({
          key: r.id,
          addressLine1: r.address.address_line1,
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

      let finalResults = candidateResults
        .map((r) => {
          // Prefer stored geocode
          if (
            r.address &&
            typeof r.address.latitude === "number" &&
            typeof r.address.longitude === "number"
          ) {
            return { ...r, lat: r.address.latitude, lon: r.address.longitude };
          }
          const geo = geocodedMap[r.id];
          if (!geo) return null;
          return { ...r, lat: geo.lat, lon: geo.lon };
        })
        .filter(Boolean);

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

      // Persist newly geocoded coordinates back to entity records (fire-and-forget)
      // so subsequent searches skip geocoding for those addresses.
      if (finalResults.length > 0) {
        persistGeocodedResults(finalResults, activeFirms, activeContacts);
      }
    } catch (err) {
      setError(err?.message || "Search failed. Please try again.");
      setResults([]);
      setCenter(null);
    } finally {
      setLoading(false);
    }
  }, [locationInput, radiusInput, firmNameInput, activeFirms, activeContacts, radiusMiles]);

  // ── Directions handlers ────────────────────────────────────────────────

  const toggleStopSelection = useCallback((result) => {
    setStops((prev) => {
      if (prev.some((s) => s.id === result.id)) {
        return prev.filter((s) => s.id !== result.id);
      }
      return [
        ...prev,
        {
          id: result.id,
          label: result.name,
          subLabel: result.addressLabel,
          lat: result.lat,
          lon: result.lon,
          type: result.type,
          entityId: result.entityId,
        },
      ];
    });
    setRoute(null);
    setRouteError(null);
  }, []);

  const removeStop = useCallback((id) => {
    setStops((prev) => prev.filter((s) => s.id !== id));
    setRoute(null);
    setRouteError(null);
  }, []);

  const moveStop = useCallback((index, dir) => {
    setStops((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setRoute(null);
    setRouteError(null);
  }, []);

  const addCustomStop = useCallback(async () => {
    const q = customAddrInput.trim();
    if (!q) return;
    setGeocodingCustom(true);
    setRouteError(null);
    try {
      const resp = await base44.functions.invoke("geocodeLocations", {
        centerQuery: q,
        locations: [],
      });
      const data = resp?.data ?? resp ?? {};
      if (!data.center) {
        setRouteError("Could not find that address. Try a more specific address.");
        return;
      }
      const id = `custom-${Date.now()}`;
      setStops((prev) => [
        ...prev,
        {
          id,
          label: q,
          subLabel: data.center.displayName || "",
          lat: data.center.lat,
          lon: data.center.lon,
        },
      ]);
      // Save to address history (deduped by query, most recent first)
      setAddrHistory((prev) => {
        const filtered = prev.filter((h) => h.query.toLowerCase() !== q.toLowerCase());
        const next = [{ query: q, lat: data.center.lat, lon: data.center.lon, displayName: data.center.displayName || "" }, ...filtered].slice(0, 20);
        try { localStorage.setItem("mapSearch_customAddrHistory", JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
      setCustomAddrInput("");
      setRoute(null);
    } catch (err) {
      setRouteError(err?.message || "Failed to geocode address.");
    } finally {
      setGeocodingCustom(false);
    }
  }, [customAddrInput]);

  const addStopFromHistory = useCallback((h) => {
    const id = `custom-${Date.now()}`;
    setStops((prev) => [
      ...prev,
      { id, label: h.query, subLabel: h.displayName, lat: h.lat, lon: h.lon },
    ]);
    setCustomAddrInput("");
    setRoute(null);
    setRouteError(null);
  }, []);

  const getRoute = useCallback(async () => {
    if (stops.length < 2) {
      setRouteError("Select at least 2 stops to get directions.");
      return;
    }
    setRouting(true);
    setRouteError(null);
    try {
      const resp = await base44.functions.invoke("getDrivingRoute", {
        stops: stops.map((s) => ({ lat: s.lat, lon: s.lon })),
      });
      const data = resp?.data ?? resp ?? {};
      if (data.error) {
        setRouteError(data.error);
        return;
      }
      setRoute(data);
    } catch (err) {
      setRouteError(err?.message || "Failed to get driving route.");
    } finally {
      setRouting(false);
    }
  }, [stops]);

  // Build a Google Maps directions URL for the current stops
  const googleMapsUrl = useMemo(() => {
    if (stops.length < 2) return null;
    const origin = `${stops[0].lat},${stops[0].lon}`;
    const dest = `${stops[stops.length - 1].lat},${stops[stops.length - 1].lon}`;
    const waypoints = stops.slice(1, -1).map((s) => `${s.lat},${s.lon}`).join("|");
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`;
    if (waypoints) url += `&waypoints=${waypoints}`;
    return url;
  }, [stops]);

  const handleResultClick = useCallback(
    (result) => {
      if (result.type === "firm") {
        const firm = activeFirms.find((f) => f.id === result.entityId);
        if (firm && onFirmClick) {
          onFirmClick(firm);
        }
      } else {
        const contact = activeContacts.find((c) => c.id === result.entityId);
        if (contact && onContactClick) {
          onContactClick(contact);
        }
      }
    },
    [activeFirms, activeContacts, onFirmClick, onContactClick]
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
    setViewMode("split");
    setDirectionsActive(false);
    setStops([]);
    setCustomAddrInput("");
    setRoute(null);
    setRouteError(null);
    onClose();
  }, [onClose]);

  const mapPoints = results.filter((r) => r.lat != null && r.lon != null);
  const firmResults = results.filter((r) => r.type === "firm");
  const contactResults = results.filter((r) => r.type === "contact");
  const routeLineCoords = route ? route.coordinates.map((c) => [c.lat, c.lon]) : null;

  const showMap = viewMode === "map" || viewMode === "split";
  const showList = viewMode === "list" || viewMode === "split";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[88vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-rose-500" />
              <DialogTitle className="text-lg">Map Search</DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <ViewToggle viewMode={viewMode} onChange={setViewMode} />
              <Button
                variant={directionsActive ? "default" : "outline"}
                size="sm"
                onClick={() => setDirectionsActive((v) => !v)}
                className="h-8"
              >
                <RouteIcon className="w-4 h-4" />
                Directions
                {stops.length > 0 && (
                  <span className="ml-1 bg-white text-blue-600 rounded-full px-1.5 text-xs font-bold">
                    {stops.length}
                  </span>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-8 w-8 text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                aria-label="Close map search"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {/* Search inputs */}
          <div className="flex flex-wrap items-end gap-2 mt-3">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-gray-500 font-medium mb-1 block">
                Location (city, state, country, zip, postal code)
              </label>
              <MapSearchAutocomplete
                value={locationInput}
                onChange={setLocationInput}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                placeholder="e.g. Atlanta, GA or 30303 or London"
                suggestions={locationSuggestions}
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
                Firm or contact name (optional)
              </label>
              <MapSearchAutocomplete
                value={firmNameInput}
                onChange={setFirmNameInput}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                placeholder="e.g. BlackRock or Vanguard"
                suggestions={firmNameSuggestions}
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
          {showMap && (
            <div className={`flex-1 min-h-[200px] relative ${viewMode === "split" ? "" : "flex-1"}`}>
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
                <MapBoundsController points={mapPoints} center={center} radius={radiusMiles} routeCoords={routeLineCoords} />
                <MapResizeOnView viewMode={viewMode} directionsActive={directionsActive} />

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

                {/* Route line */}
                {routeLineCoords && routeLineCoords.length > 1 && (
                  <Polyline
                    positions={routeLineCoords}
                    pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.7 }}
                  />
                )}

                {/* Result markers — hidden when directions route is showing to reduce clutter */}
                {mapPoints
                  .filter((r) => !(route && selectedStopIds.has(r.id)))
                  .map((r) => (
                    <Marker
                      key={r.id}
                      position={[r.lat, r.lon]}
                      icon={makeIcon(r.type, hoveredId === r.id)}
                      zIndexOffset={hoveredId === r.id ? 1000 : 0}
                      eventHandlers={{
                        click: () => handleResultClick(r),
                        mouseover: () => setHoveredId(r.id),
                        mouseout: () => setHoveredId(null),
                      }}
                    >
                      <Tooltip direction="top" offset={[0, -12]} opacity={1}>
                        <div className="text-sm">
                          <div className="font-semibold">{r.name}</div>
                          {r.title && <div className="text-gray-500 text-xs">{r.title}</div>}
                          {r.addressLabel && (
                            <div className="text-gray-400 text-xs mt-0.5">{r.addressLabel}</div>
                          )}
                          {r.distance != null && (
                            <div className="text-indigo-600 font-medium text-xs mt-0.5">
                              {r.distance.toFixed(1)} mi from center
                            </div>
                          )}
                          <div className="text-blue-600 text-xs mt-1 font-medium">
                            Click to open {r.type === "firm" ? "firm" : "contact"}
                          </div>
                        </div>
                      </Tooltip>
                    </Marker>
                  ))}

                {/* Numbered stop markers for directions */}
                {directionsActive && stops.map((s, i) => (
                  <Marker
                    key={s.id}
                    position={[s.lat, s.lon]}
                    icon={makeNumberedIcon(i + 1, hoveredId === s.id)}
                    zIndexOffset={hoveredId === s.id ? 1100 : 100}
                    eventHandlers={{
                      click: () => {
                        if (s.type === "firm" || s.type === "contact") {
                          handleResultClick({ type: s.type, entityId: s.entityId });
                        }
                      },
                      mouseover: () => setHoveredId(s.id),
                      mouseout: () => setHoveredId(null),
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -12]} opacity={1}>
                      <div className="text-sm">
                        <div className="font-semibold text-blue-600">Stop #{i + 1}</div>
                        <div className="font-medium">{s.label}</div>
                        {s.subLabel && <div className="text-gray-400 text-xs mt-1">{s.subLabel}</div>}
                        {(s.type === "firm" || s.type === "contact") && (
                          <div className="text-blue-600 text-xs mt-1 font-medium">
                            Click to open {s.type === "firm" ? "firm" : "contact"}
                          </div>
                        )}
                      </div>
                    </Tooltip>
                  </Marker>
                ))}
              </MapContainer>

              {/* Route summary overlay */}
              {route && (
                <a
                  href={googleMapsUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute top-3 left-3 z-[1000] bg-white/95 rounded-lg shadow-md px-4 py-2.5 text-sm cursor-pointer hover:shadow-lg hover:bg-white transition-all no-underline"
                  title="Open in Google Maps"
                >
                  <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                    <RouteIcon className="w-4 h-4 text-blue-600" />
                    Driving Route
                    <ExternalLink className="w-3 h-3 text-gray-400 ml-0.5" />
                  </div>
                  <div className="text-gray-600 mt-0.5">
                    {stops.length} stops · {route.distance} · {route.duration}
                  </div>
                </a>
              )}

              {/* Legend */}
              {results.length > 0 && !route && (
                <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 rounded-lg shadow-md px-3 py-2 text-xs space-y-1">
                  <LegendRow
                    label="Firm"
                    count={firmResults.length}
                    color="bg-indigo-600"
                    items={firmResults}
                    onHover={setHoveredId}
                    onClick={handleResultClick}
                  />
                  <LegendRow
                    label="Contact"
                    count={contactResults.length}
                    color="bg-pink-500"
                    items={contactResults}
                    onHover={setHoveredId}
                    onClick={handleResultClick}
                  />
                  {center && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white" />
                      Center
                    </div>
                  )}
                  {directionsActive && stops.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-white" />
                      Stop ({stops.length})
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Results list / Directions panel */}
          {showList && (
            <div className={`w-full ${viewMode === "split" ? "sm:w-[340px] sm:border-l" : ""} border-t sm:border-t-0 border-gray-200 flex flex-col min-h-0 ${viewMode === "split" ? "max-h-[40vh] sm:max-h-none" : ""}`}>
              {/* Directions builder */}
              {directionsActive && (
                <div className="border-b border-gray-200 bg-blue-50/40">
                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                      <RouteIcon className="w-4 h-4 text-blue-600" />
                      Directions
                    </div>
                    {stops.length > 0 && (
                      <button
                        onClick={() => { setStops([]); setRoute(null); setRouteError(null); }}
                        className="text-xs text-gray-500 hover:text-gray-700 underline"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  {/* Stop list */}
                  {stops.length > 0 && (
                    <div className="px-3 pb-2 space-y-1 max-h-[200px] overflow-y-auto">
                      {stops.map((s, i) => (
                        <div key={s.id} className="flex items-center gap-1.5 bg-white rounded-md border border-gray-200 px-2 py-1.5"
                          onMouseEnter={() => setHoveredId(s.id)}
                          onMouseLeave={() => setHoveredId(null)}
                        >
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-900 truncate">{s.label}</div>
                            {s.subLabel && <div className="text-xs text-gray-400 truncate">{s.subLabel}</div>}
                          </div>
                          <div className="flex flex-col">
                            <button onClick={() => moveStop(i, -1)} disabled={i === 0}
                              className="text-gray-400 hover:text-gray-700 disabled:opacity-30">
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => moveStop(i, 1)} disabled={i === stops.length - 1}
                              className="text-gray-400 hover:text-gray-700 disabled:opacity-30">
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button onClick={() => removeStop(s.id)}
                            className="text-gray-400 hover:text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Custom address entry */}
                  <div className="px-3 pb-2 flex gap-1.5 relative">
                    <div className="flex-1 relative">
                      <Input
                        placeholder="Add a custom address..."
                        value={customAddrInput}
                        onChange={(e) => setCustomAddrInput(e.target.value)}
                        onFocus={() => setAddrInputFocused(true)}
                        onBlur={() => setTimeout(() => setAddrInputFocused(false), 150)}
                        onKeyDown={(e) => e.key === "Enter" && addCustomStop()}
                        className="h-8 text-xs flex-1"
                      />
                      {addrInputFocused && addrSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-white rounded-md shadow-lg border border-gray-200 z-[1001] max-h-48 overflow-y-auto">
                          {addrSuggestions.map((h, i) => (
                            <button
                              key={i}
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); addStopFromHistory(h); }}
                              className="w-full text-left px-3 py-1.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
                            >
                              <div className="text-xs font-medium text-gray-900 truncate">{h.query}</div>
                              {h.displayName && <div className="text-[10px] text-gray-400 truncate">{h.displayName}</div>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button size="icon" variant="outline" className="h-8 w-8 flex-shrink-0"
                      onClick={addCustomStop} disabled={geocodingCustom || !customAddrInput.trim()}>
                      {geocodingCustom ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                  {/* Action buttons */}
                  <div className="px-3 pb-3 flex gap-1.5">
                    <Button size="sm" className="h-8 flex-1" onClick={getRoute}
                      disabled={routing || stops.length < 2}>
                      {routing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                      Get Route
                    </Button>
                    {googleMapsUrl && (
                      <Button size="sm" variant="outline" className="h-8" asChild>
                        <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3.5 h-3.5" />
                          Google Maps
                        </a>
                      </Button>
                    )}
                  </div>
                  {/* Route summary */}
                  {route && (
                    <div className="mx-3 mb-2 bg-white rounded-md border border-blue-200 px-3 py-2 text-xs">
                      <div className="font-semibold text-gray-900">
                        {route.distance} · {route.duration}
                      </div>
                      <div className="text-gray-500">{stops.length} stops</div>
                    </div>
                  )}
                  {routeError && (
                    <div className="mx-3 mb-2 text-xs text-red-500">{routeError}</div>
                  )}
                  {stops.length < 2 && (
                    <div className="px-3 pb-2 text-xs text-gray-400">
                      Select {2 - stops.length} more stop{2 - stops.length === 1 ? "" : "s"} from the list below, or add a custom address.
                    </div>
                  )}
                </div>
              )}

              {/* Results list header */}
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <span className="text-sm font-semibold text-gray-700">
                  {loading
                    ? "Searching..."
                    : hasSearched
                    ? `${results.length} result${results.length !== 1 ? "s" : ""}`
                    : "Enter search criteria"}
                </span>
                {results.length > 0 && !directionsActive && (
                  <span className="text-xs text-gray-400">
                    {searchMode === "firm" ? "Name search" : "Location search"}
                  </span>
                )}
                {directionsActive && stops.length > 0 && (
                  <span className="text-xs text-blue-600 font-medium">
                    {stops.length} stop{stops.length !== 1 ? "s" : ""} selected
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
                    Search for firms and contacts by location or firm name.
                    {directionsActive && " Select results to build a driving route."}
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
                      selectable={directionsActive}
                      selected={selectedStopIds.has(r.id)}
                      onToggleSelect={toggleStopSelection}
                      stopNumber={directionsActive && selectedStopIds.has(r.id) ? stops.findIndex((s) => s.id === r.id) + 1 : null}
                    />
                  ))}
                {!loading && !error && results.length > 150 && (
                  <div className="text-xs text-gray-400 text-center py-2">
                    Showing 150 of {results.length} results. Refine your search to see more.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}