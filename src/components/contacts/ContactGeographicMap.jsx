import React, { useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, X, MapPin, User } from "lucide-react";
import { COUNTRIES, getStatesForCountry, getCitiesForState } from "../firms/geoData";

const getFullName = (c) => {
  const name = [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");
  return c.designations?.length ? `${name}, ${c.designations.join(", ")}` : name;
};

function makeContactIcon(highlighted) {
  const size = highlighted ? 32 : 24;
  const inner = highlighted ? 16 : 12;
  return L.divIcon({
    className: "map-search-marker",
    html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;${highlighted ? "animation:map-bounce 0.5s ease infinite alternate;" : ""}"><div style="width:${inner}px;height:${inner}px;border-radius:50%;background:#db2777;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function MapInitializer() {
  const map = useMap();
  React.useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function MapAutoFit({ positions }) {
  const map = useMap();
  React.useEffect(() => {
    if (!positions || positions.length === 0) {
      map.setView([39.8283, -98.5795], 4);
      return;
    }
    if (positions.length === 1) {
      map.setView(positions[0], 8);
      return;
    }
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
  }, [positions, map]);
  return null;
}

function contactPosition(contact) {
  const addrs = contact.addresses || [];
  const primary = addrs.find((a) => a.is_primary && a.latitude != null && a.longitude != null);
  if (primary) return [primary.latitude, primary.longitude];
  const any = addrs.find((a) => a.latitude != null && a.longitude != null);
  if (any) return [any.latitude, any.longitude];
  return null;
}

export default function ContactGeographicMap({ contacts, firms, onContactClick }) {
  const [geoSearch, setGeoSearch] = useState("");
  const [geoCountry, setGeoCountry] = useState("");
  const [geoState, setGeoState] = useState("");
  const [geoCity, setGeoCity] = useState("");
  const [hoveredId, setHoveredId] = useState(null);

  const firmMap = useMemo(() => Object.fromEntries((firms || []).map(f => [f.id, f])), [firms]);

  const activeContacts = useMemo(() => (contacts || []).filter(c => !c.deleted_at), [contacts]);

  const gq = geoSearch.trim().toLowerCase();

  const geoContacts = useMemo(() => {
    return activeContacts.filter((c) => {
      const matchesDrill = (!geoCountry && !geoState && !geoCity) || (c.addresses || []).some((a) => {
        if (geoCountry && a.country !== geoCountry) return false;
        if (geoState && a.state !== geoState) return false;
        if (geoCity && (a.city || "").toLowerCase() !== geoCity.toLowerCase()) return false;
        return true;
      });
      if (!matchesDrill) return false;
      if (!gq) return true;
      if ((getFullName(c) || "").toLowerCase().includes(gq)) return true;
      if ((c.title || "").toLowerCase().includes(gq)) return true;
      const primaryFirmId = (c.firm_ids || [])[0];
      const firmName = primaryFirmId ? (firmMap[primaryFirmId]?.name || "") : "";
      if (firmName.toLowerCase().includes(gq)) return true;
      return (c.addresses || []).some((a) =>
        (a.country || "").toLowerCase().includes(gq) ||
        (a.state || "").toLowerCase().includes(gq) ||
        (a.city || "").toLowerCase().includes(gq)
      );
    });
  }, [activeContacts, geoCountry, geoState, geoCity, gq, firmMap]);

  const geoCityOptions = useMemo(() => {
    const fromData = getCitiesForState(geoState);
    const fromContacts = new Set(
      activeContacts
        .flatMap((c) => c.addresses || [])
        .filter((a) => (!geoCountry || a.country === geoCountry) && (!geoState || a.state === geoState))
        .map((a) => a.city)
        .filter(Boolean)
    );
    const merged = Array.from(new Set([...fromData, ...fromContacts]));
    return merged.sort((a, b) => a.localeCompare(b));
  }, [activeContacts, geoCountry, geoState]);

  const geoMapPoints = useMemo(() =>
    geoContacts.map((c) => ({ contact: c, pos: contactPosition(c) })).filter((p) => p.pos),
    [geoContacts]);

  const statesForGeoCountry = getStatesForCountry(geoCountry);

  const resetGeo = () => {
    setGeoCountry("");
    setGeoState("");
    setGeoCity("");
    setGeoSearch("");
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-gray-100 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={geoSearch}
            onChange={e => setGeoSearch(e.target.value)}
            placeholder="Search by contact, title, firm, country, state/province, or city..."
            className="w-full h-9 pl-9 pr-8 text-sm rounded-lg border border-gray-200 outline-none focus:border-pink-400 bg-gray-50"
          />
          {geoSearch && (
            <button type="button" onClick={() => setGeoSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <MapPin className="w-3.5 h-3.5 text-pink-500" />
          <span className="font-medium">Drill down: Country → State/Province → City</span>
          {(geoCountry || geoState || geoCity || geoSearch) && (
            <button type="button" onClick={resetGeo} className="ml-auto text-pink-600 hover:text-pink-800 font-medium">
              Reset
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <select
            value={geoCountry}
            onChange={(e) => { setGeoCountry(e.target.value); setGeoState(""); setGeoCity(""); }}
            className="h-8 text-xs rounded-lg border border-gray-200 bg-gray-50 px-2 outline-none focus:border-pink-400 cursor-pointer"
          >
            <option value="">All Countries</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
          <select
            value={geoState}
            onChange={(e) => { setGeoState(e.target.value); setGeoCity(""); }}
            disabled={!geoCountry}
            className="h-8 text-xs rounded-lg border border-gray-200 bg-gray-50 px-2 outline-none focus:border-pink-400 cursor-pointer disabled:opacity-50"
          >
            <option value="">All States</option>
            {statesForGeoCountry.map((s) => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </select>
          <select
            value={geoCity}
            onChange={(e) => setGeoCity(e.target.value)}
            disabled={!geoState}
            className="h-8 text-xs rounded-lg border border-gray-200 bg-gray-50 px-2 outline-none focus:border-pink-400 cursor-pointer disabled:opacity-50"
          >
            <option value="">All Cities</option>
            {geoCityOptions.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 flex flex-col sm:flex-row min-h-0">
        <div className="flex-1 min-h-[240px] relative">
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
            <MapAutoFit positions={geoMapPoints.map((p) => p.pos)} />
            {geoMapPoints.map(({ contact, pos }) => {
              const primaryFirmId = (contact.firm_ids || [])[0];
              const firmName = primaryFirmId ? (firmMap[primaryFirmId]?.name || "") : "";
              return (
                <Marker
                  key={contact.id}
                  position={pos}
                  icon={makeContactIcon(hoveredId === contact.id)}
                  zIndexOffset={hoveredId === contact.id ? 1000 : 0}
                  eventHandlers={{
                    click: () => onContactClick(contact),
                    mouseover: () => setHoveredId(contact.id),
                    mouseout: () => setHoveredId(null),
                  }}
                >
                  <Tooltip direction="top" offset={[0, -12]} opacity={1}>
                    <div className="text-sm">
                      <div className="font-semibold">{getFullName(contact)}</div>
                      {contact.title && <div className="text-gray-500 text-xs">{contact.title}</div>}
                      {firmName && <div className="text-gray-500 text-xs">{firmName}</div>}
                      <div className="text-pink-600 text-xs mt-1 font-medium">Click to open</div>
                    </div>
                  </Tooltip>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        <div className="w-full sm:w-[240px] sm:border-l border-t sm:border-t-0 border-gray-200 flex flex-col min-h-0 max-h-[35vh] sm:max-h-none">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <span className="text-xs font-semibold text-gray-700">
              {geoContacts.length} contact{geoContacts.length !== 1 ? "s" : ""}
            </span>
            <span className="text-[10px] text-gray-400">{geoMapPoints.length} on map</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {geoContacts.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-6">
                No contacts match the selected location.
              </p>
            ) : (
              geoContacts
                .slice()
                .sort((a, b) => getFullName(a).localeCompare(getFullName(b)))
                .map((contact) => {
                  const primaryFirmId = (contact.firm_ids || [])[0];
                  const firmName = primaryFirmId ? (firmMap[primaryFirmId]?.name || "") : "";
                  const matchedAddr = (contact.addresses || []).find((a) =>
                    (!geoCountry || a.country === geoCountry) &&
                    (!geoState || a.state === geoState) &&
                    (!geoCity || (a.city || "").toLowerCase() === geoCity.toLowerCase())
                  );
                  return (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => onContactClick(contact)}
                      onMouseEnter={() => setHoveredId(contact.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${hoveredId === contact.id ? "bg-pink-50" : "hover:bg-gray-50"}`}
                    >
                      {contact.photo_url ? (
                        <img src={contact.photo_url} alt={getFullName(contact)} className="w-6 h-6 rounded-full object-cover flex-shrink-0 border border-gray-100" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-pink-50 flex items-center justify-center flex-shrink-0">
                          <User className="w-3 h-3 text-pink-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-800 truncate">{getFullName(contact)}</p>
                        <p className="text-[10px] text-gray-400 truncate">
                          {matchedAddr?.city || firmName || contact.title || ""}
                        </p>
                      </div>
                    </button>
                  );
                })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}