import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MapPin, Trash2, Star, ExternalLink, Loader2, LocateFixed } from "lucide-react";
import { COUNTRIES, getStatesForCountry } from "./geoData";
import { useZipCodeLookup } from "./useZipCodeLookup";
import { base44 } from "@/api/base44Client";

function buildMapsUrl(address) {
  const parts = [
    address.address_line1,
    address.address_line2,
    address.city,
    address.state,
    address.postal_code,
    COUNTRIES.find(c => c.code === address.country)?.name,
  ].filter(Boolean);
  if (parts.length < 2) return null;
  const query = encodeURIComponent(parts.join(", "));
  return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
}

function buildAddressString(address) {
  const parts = [
    address.address_line1,
    address.address_line2,
    address.city,
    address.state,
    address.postal_code,
    COUNTRIES.find(c => c.code === address.country)?.name,
  ].filter(Boolean);
  return parts.join(", ");
}

export default function AddressForm({ address, onChange, onDelete, onSetHeadquarters, isHeadquarters, isEditing, isOnly }) {
  const [manualCity, setManualCity] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const { lookupZip, getCitiesForState, saveZipMapping } = useZipCodeLookup();

  const states = getStatesForCountry(address.country || "");
  const hasStates = states.length > 0;
  const cityOptions = getCitiesForState(address.state || "");

  const handleCountryChange = (val) => {
    onChange({ ...address, country: val, state: "", city: "", postal_code: "" });
    setManualCity(false);
  };

  const handleStateChange = (val) => {
    onChange({ ...address, state: val, city: "" });
    setManualCity(false);
  };

  const handlePostalChange = (e) => {
    const zip = e.target.value;
    const updated = { ...address, postal_code: zip };
    if (zip.length >= 3) {
      const lookup = lookupZip(zip, address.country);
      if (lookup) {
        updated.city = lookup.city;
        updated.state = lookup.state;
        setManualCity(false);
      }
    }
    onChange(updated);
  };

  const handleCitySelect = (val) => {
    if (val === "__manual__") {
      setManualCity(true);
      onChange({ ...address, city: "" });
    } else {
      setManualCity(false);
      onChange({ ...address, city: val });
    }
  };

  const handleAutoLocate = async () => {
    const addrStr = buildAddressString(address);
    if (!addrStr) {
      setGeoError("Fill in address fields first.");
      return;
    }
    setGeocoding(true);
    setGeoError(null);
    try {
      const resp = await base44.functions.invoke("geocodeLocations", {
        centerQuery: addrStr,
        locations: [],
      });
      const data = resp?.data ?? resp ?? {};
      if (!data.center) {
        setGeoError("Could not geocode this address. Try a more specific address.");
        return;
      }
      onChange({
        ...address,
        latitude: data.center.lat,
        longitude: data.center.lon,
      });
    } catch (err) {
      setGeoError(err?.message || "Failed to geocode address.");
    } finally {
      setGeocoding(false);
    }
  };

  const handleCityBlur = () => {
    if (address.postal_code && address.city) {
      saveZipMapping(address.postal_code, address.city, address.state, address.country);
    }
  };

  const field = (label, children) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-gray-600">{label}</Label>
      {children}
    </div>
  );

  const viewText = (val) => (
    <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-800">
      {val || <span className="text-gray-400">—</span>}
    </div>
  );

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${isHeadquarters ? "border-indigo-300 bg-indigo-50/40" : "border-gray-200 bg-gray-50/40"}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(() => {
            const mapsUrl = buildMapsUrl(address);
            return mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 group hover:text-indigo-600 transition-colors ${isHeadquarters ? "text-indigo-500" : "text-gray-500"}`}
                title="Open in Google Maps for directions"
              >
                <MapPin className="w-4 h-4 group-hover:text-indigo-600 transition-colors" />
                <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-600 transition-colors underline decoration-dotted underline-offset-2">
                  {isHeadquarters ? "Headquarters" : "Office"}
                </span>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ) : (
              <div className="flex items-center gap-2">
                <MapPin className={`w-4 h-4 ${isHeadquarters ? "text-indigo-500" : "text-gray-400"}`} />
                <span className="text-sm font-medium text-gray-700">
                  {isHeadquarters ? "Headquarters" : "Office"}
                </span>
              </div>
            );
          })()}
        </div>
        {isEditing && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`h-7 px-2 text-xs gap-1 ${isHeadquarters ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50" : "text-gray-400 hover:text-amber-500 hover:bg-amber-50"}`}
              onClick={isHeadquarters ? () => onChange({ ...address, is_headquarters: false }) : onSetHeadquarters}
              title={isHeadquarters ? "Unset as HQ" : "Set as HQ"}
            >
              <Star className={`w-3.5 h-3.5 ${isHeadquarters ? "fill-amber-400 text-amber-500" : ""}`} />
              <span>{isHeadquarters ? "HQ" : "Set HQ"}</span>
            </Button>
            {!isOnly && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                onClick={onDelete}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        )}
        {!isEditing && isHeadquarters && (
          <span className="text-xs bg-indigo-100 text-indigo-600 font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
            <Star className="w-3 h-3" /> HQ
          </span>
        )}
      </div>

      {!isEditing ? (
        /* ── View mode: single formatted address block ── */
        (() => {
          const stateName = hasStates ? states.find(s => s.code === address.state)?.name : address.state;
          const countryName = COUNTRIES.find(c => c.code === address.country)?.name;
          const line1 = address.address_line1;
          const line2 = address.address_line2;
          const city = address.city;
          const state = stateName;
          const zip = address.postal_code;
          const country = countryName;
          const hasAny = line1 || line2 || city || state || zip || country;
          if (!hasAny) return <div className="text-sm text-gray-400 italic px-1">No address on file</div>;
          const mapsUrl = buildMapsUrl(address);
          const addressBlock = (
            <div className="text-sm text-gray-800 space-y-0.5 px-1">
              {line1 && <div>{line1}</div>}
              {line2 && <div>{line2}</div>}
              {(city || state || zip) && (
                <div>{[city, state, zip].filter(Boolean).join(", ")}</div>
              )}
              {country && <div>{country}</div>}
            </div>
          );
          if (mapsUrl) return (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
              className="block text-indigo-600 hover:underline hover:bg-indigo-50 rounded-md -mx-1 px-1 py-0.5 transition-colors">
              {addressBlock}
            </a>
          );
          return addressBlock;
        })()
      ) : (
        <>
          {/* Country */}
          {field("Country",
            <Select value={address.country || ""} onValueChange={handleCountryChange}>
              <SelectTrigger className="h-9 bg-white">
                <SelectValue placeholder="Select country..." />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* State + Postal */}
          <div className="grid grid-cols-2 gap-3">
            {field("State / Province",
              hasStates ? (
                <Select value={address.state || ""} onValueChange={handleStateChange}>
                  <SelectTrigger className="h-9 bg-white">
                    <SelectValue placeholder="Select state..." />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map((s) => (
                      <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-9 bg-white"
                  placeholder="State / Province"
                  value={address.state || ""}
                  onChange={(e) => onChange({ ...address, state: e.target.value })}
                />
              )
            )}
            {field("Postal / Zip Code",
              <Input
                className="h-9 bg-white"
                placeholder={address.country === "US" ? "e.g. 10001" : "Postal code"}
                value={address.postal_code || ""}
                onChange={handlePostalChange}
              />
            )}
          </div>

          {/* City */}
          {field("City",
            cityOptions.length > 0 && !manualCity && (!address.city || cityOptions.includes(address.city)) ? (
              <Select value={address.city || ""} onValueChange={handleCitySelect}>
                <SelectTrigger className="h-9 bg-white">
                  <SelectValue placeholder="Select city..." />
                </SelectTrigger>
                <SelectContent>
                  {cityOptions.map((city) => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                  <SelectItem value="__manual__">✏️ Enter manually...</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex gap-1.5">
                <Input
                  className="h-9 bg-white"
                  placeholder="City"
                  value={address.city || ""}
                  onChange={(e) => onChange({ ...address, city: e.target.value })}
                  onBlur={handleCityBlur}
                />
                {cityOptions.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-2 text-xs shrink-0"
                    onClick={() => setManualCity(false)}
                    title="Choose from list"
                  >
                    List
                  </Button>
                )}
              </div>
            )
          )}

          {/* Address Line 1 */}
          {field("Street Address",
            <Input
              className="h-9 bg-white"
              placeholder="123 Main Street"
              value={address.address_line1 || ""}
              onChange={(e) => onChange({ ...address, address_line1: e.target.value })}
            />
          )}

          {/* Address Line 2 */}
          {field("Suite / Floor / Room",
            <Input
              className="h-9 bg-white"
              placeholder="Suite 100, Floor 3..."
              value={address.address_line2 || ""}
              onChange={(e) => onChange({ ...address, address_line2: e.target.value })}
            />
          )}

          {/* Geocode (Latitude / Longitude) */}
          <div className="rounded-lg border border-gray-200 bg-white/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                Geocode (Latitude, Longitude)
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={handleAutoLocate}
                disabled={geocoding}
              >
                {geocoding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LocateFixed className="w-3.5 h-3.5" />
                )}
                {geocoding ? "Locating..." : "Auto-locate"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field("Latitude",
                <Input
                  className="h-9 bg-white"
                  type="number"
                  step="any"
                  placeholder="e.g. 39.9526"
                  value={address.latitude ?? ""}
                  onChange={(e) => {
                    const val = e.target.value === "" ? undefined : parseFloat(e.target.value);
                    onChange({ ...address, latitude: Number.isNaN(val) ? undefined : val });
                  }}
                />
              )}
              {field("Longitude",
                <Input
                  className="h-9 bg-white"
                  type="number"
                  step="any"
                  placeholder="e.g. -75.1652"
                  value={address.longitude ?? ""}
                  onChange={(e) => {
                    const val = e.target.value === "" ? undefined : parseFloat(e.target.value);
                    onChange({ ...address, longitude: Number.isNaN(val) ? undefined : val });
                  }}
                />
              )}
            </div>
            {geoError && (
              <div className="text-xs text-red-500">{geoError}</div>
            )}
            {address.latitude != null && address.longitude != null && !geoError && (
              <div className="text-xs text-green-600 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Coordinates set — map search will use these directly.
              </div>
            )}
          </div>
        </>
      )}
      {!isEditing && address.latitude != null && address.longitude != null && (
        <div className="text-xs text-gray-400 flex items-center gap-1 px-1">
          <MapPin className="w-3 h-3" />
          {Number(address.latitude).toFixed(6)}, {Number(address.longitude).toFixed(6)}
        </div>
      )}
    </div>
  );
}