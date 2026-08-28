import React, { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Search, Loader2, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { COUNTRIES, getStatesForCountry } from "./geoData";

// Build a red pin marker for the clicked location.
function makePinIcon() {
  return L.divIcon({
    className: "map-search-marker",
    html: `<div style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;"><div style="width:18px;height:18px;border-radius:50%;background:#ef4444;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
}

// Map a raw Nominatim reverse-geocode result onto the AddressForm's
// country/state code scheme. State falls back to the raw name when the
// country has no known state list or the name doesn't match.
function mapReverseToAddress(rev) {
  if (!rev) return null;
  const addr = rev.address || {};
  const countryCode = addr.country_code || "";
  const countryMatch = COUNTRIES.find((c) => c.code === countryCode);
  const country = countryMatch ? countryMatch.code : "";
  let stateCode = "";
  let stateName = addr.state || "";
  if (country) {
    const states = getStatesForCountry(country);
    const match = states.find((s) => s.name.toLowerCase() === (addr.state || "").toLowerCase());
    if (match) {
      stateCode = match.code;
    } else {
      // Keep the raw state name so the user can still see / edit it.
      stateCode = stateName;
    }
  }
  const line1 = [addr.house_number, addr.road].filter(Boolean).join(" ");
  return {
    country,
    state: stateCode,
    city: addr.city || "",
    postal_code: addr.postcode || "",
    address_line1: line1,
    latitude: rev.lat,
    longitude: rev.lon,
    displayName: rev.displayName || "",
  };
}

// Click handler component — captures map clicks and reports them upward.
function MapClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      onClick({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
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

export default function AddressMapPickerDialog({ open, onClose, onPick, currentAddress }) {
  const [pin, setPin] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [forwardLoading, setForwardLoading] = useState(false);
  const [error, setError] = useState(null);
  const mapRef = useRef(null);

  const handleMapClick = useCallback(async ({ lat, lon }) => {
    setPin({ lat, lon });
    setParsed(null);
    setError(null);
    setReverseLoading(true);
    try {
      const resp = await base44.functions.invoke("geocodeLocations", { reverse: { lat, lon } });
      const data = resp?.data ?? resp ?? {};
      const mapped = mapReverseToAddress(data.reverseResult);
      setParsed(mapped);
      if (!mapped) setError("Could not identify this location. Try clicking elsewhere.");
    } catch (err) {
      setError(err?.message || "Reverse geocode failed.");
    } finally {
      setReverseLoading(false);
    }
  }, []);

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setForwardLoading(true);
    setError(null);
    try {
      const resp = await base44.functions.invoke("geocodeLocations", { centerQuery: q });
      const data = resp?.data ?? resp ?? {};
      if (data.center) {
        const { lat, lon } = data.center;
        setPin({ lat, lon });
        mapRef.current?.setView([lat, lon], 13);
        // Reverse-geocode the found center to populate the drill-down.
        const revResp = await base44.functions.invoke("geocodeLocations", { reverse: { lat, lon } });
        const revData = revResp?.data ?? revResp ?? {};
        const mapped = mapReverseToAddress(revData.reverseResult);
        setParsed(mapped);
        if (!mapped) setError("Could not identify this location. Try clicking on the map.");
      } else {
        setError("Location not found. Try a different search.");
      }
    } catch (err) {
      setError(err?.message || "Search failed.");
    } finally {
      setForwardLoading(false);
    }
  }, [searchQuery]);

  const handleUse = () => {
    if (!parsed) return;
    onPick(parsed);
    handleClose();
  };

  const handleClose = () => {
    setPin(null);
    setParsed(null);
    setSearchQuery("");
    setError(null);
    onClose();
  };

  const countryName = parsed?.country ? COUNTRIES.find((c) => c.code === parsed.country)?.name : "";
  const stateName = parsed?.country
    ? (getStatesForCountry(parsed.country).find((s) => s.code === parsed.state)?.name || parsed.state)
    : parsed?.state;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl w-[95vw] h-[80vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-rose-500" />
            <DialogTitle className="text-lg">Pick Location on Map</DialogTitle>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Click anywhere on the map or search a place — the country, state/province, and city will be filled in automatically.
          </p>
          <div className="flex gap-2 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                placeholder="Search a place (e.g. Atlanta, GA)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="h-9 pl-9"
              />
            </div>
            <Button onClick={handleSearch} disabled={forwardLoading} className="h-9">
              {forwardLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col sm:flex-row min-h-0">
          {/* Map */}
          <div className="flex-1 min-h-[200px] relative">
            <MapContainer
              center={[currentAddress?.latitude, currentAddress?.longitude].every(Number.isFinite) ? [currentAddress.latitude, currentAddress.longitude] : [39.8283, -98.5795]}
              zoom={currentAddress?.latitude != null ? 13 : 4}
              className="w-full h-full"
              style={{ background: "#e5e7eb" }}
              ref={mapRef}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <MapInitializer />
              <MapClickHandler onClick={handleMapClick} />
              {pin && (
                <Marker position={[pin.lat, pin.lon]} icon={makePinIcon()}>
                  <Popup>
                    <div className="text-sm">
                      <div className="font-semibold">{parsed?.city || "Selected location"}</div>
                      {parsed?.displayName && (
                        <div className="text-gray-500 text-xs mt-0.5">{parsed.displayName}</div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          </div>

          {/* Side panel — drill-down preview */}
          <div className="w-full sm:w-[280px] sm:border-l border-t sm:border-t-0 border-gray-200 flex flex-col min-h-0 overflow-y-auto p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Selected Location</h3>
            {reverseLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Identifying location...
              </div>
            )}
            {error && <div className="text-sm text-red-500">{error}</div>}
            {!reverseLoading && parsed && (
              <div className="space-y-2 text-sm">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1.5">
                  <div>
                    <span className="text-xs text-gray-500 font-medium">Country</span>
                    <p className="text-gray-900">{countryName || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 font-medium">State / Province</span>
                    <p className="text-gray-900">{stateName || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 font-medium">City</span>
                    <p className="text-gray-900">{parsed.city || "—"}</p>
                  </div>
                  {parsed.postal_code && (
                    <div>
                      <span className="text-xs text-gray-500 font-medium">Postal Code</span>
                      <p className="text-gray-900">{parsed.postal_code}</p>
                    </div>
                  )}
                  {parsed.address_line1 && (
                    <div>
                      <span className="text-xs text-gray-500 font-medium">Street</span>
                      <p className="text-gray-900">{parsed.address_line1}</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  These values will fill the address form's Country, State/Province, and City fields.
                </p>
              </div>
            )}
            {!reverseLoading && !parsed && !error && (
              <p className="text-sm text-gray-400 text-center py-6">
                Click on the map or search to pick a location.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t border-gray-200 flex-shrink-0">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleUse} disabled={!parsed || reverseLoading} className="gap-1.5">
            <Check className="w-4 h-4" /> Use This Location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}