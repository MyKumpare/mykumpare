import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MapPin, Trash2, Star, ExternalLink } from "lucide-react";
import { COUNTRIES, getStatesForCountry } from "../firms/geoData";
import { useZipCodeLookup } from "../firms/useZipCodeLookup";

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
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(parts.join(", "))}`;
}

export default function ContactAddressForm({ address, onChange, onDelete, onSetPrimary, isPrimary, isEditing, isOnly }) {
  const [manualCity, setManualCity] = useState(false);
  const { lookupZip, getCitiesForState, saveZipMapping } = useZipCodeLookup();
  const states = getStatesForCountry(address.country || "");
  const hasStates = states.length > 0;
  const cityOptions = getCitiesForState(address.state || "");

  const handleCountryChange = (val) => { onChange({ ...address, country: val, state: "", city: "", postal_code: "" }); setManualCity(false); };
  const handleStateChange = (val) => { onChange({ ...address, state: val, city: "" }); setManualCity(false); };

  const handlePostalChange = (e) => {
    const zip = e.target.value;
    const updated = { ...address, postal_code: zip };
    if (zip.length >= 3) {
      const lookup = lookupZip(zip, address.country);
      if (lookup) { updated.city = lookup.city; updated.state = lookup.state; setManualCity(false); }
    }
    onChange(updated);
  };

  const handleCitySelect = (val) => {
    if (val === "__manual__") { setManualCity(true); onChange({ ...address, city: "" }); }
    else { setManualCity(false); onChange({ ...address, city: val }); }
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

  const mapsUrl = buildMapsUrl(address);

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${isPrimary ? "border-indigo-300 bg-indigo-50/40" : "border-gray-200 bg-gray-50/40"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {mapsUrl ? (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-2 group hover:text-indigo-600 transition-colors ${isPrimary ? "text-indigo-500" : "text-gray-500"}`}>
              <MapPin className="w-4 h-4 group-hover:text-indigo-600 transition-colors" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-600 transition-colors underline decoration-dotted underline-offset-2">
                {isPrimary ? "Primary" : "Address"}
              </span>
              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          ) : (
            <div className="flex items-center gap-2">
              <MapPin className={`w-4 h-4 ${isPrimary ? "text-indigo-500" : "text-gray-400"}`} />
              <span className="text-sm font-medium text-gray-700">{isPrimary ? "Primary" : "Address"}</span>
            </div>
          )}
        </div>
        {isEditing && (
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm"
              className={`h-7 px-2 text-xs gap-1 ${isPrimary ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50" : "text-gray-400 hover:text-amber-500 hover:bg-amber-50"}`}
              onClick={isPrimary ? () => onChange({ ...address, is_primary: false }) : onSetPrimary}>
              <Star className={`w-3.5 h-3.5 ${isPrimary ? "fill-amber-400 text-amber-500" : ""}`} />
              <span>{isPrimary ? "Primary" : "Set Primary"}</span>
            </Button>
            {!isOnly && (
              <Button type="button" variant="ghost" size="sm"
                className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                onClick={onDelete}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        )}
        {!isEditing && isPrimary && (
          <span className="text-xs bg-indigo-100 text-indigo-600 font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
            <Star className="w-3 h-3" /> Primary
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
          const addrMapsUrl = buildMapsUrl(address);
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
          if (addrMapsUrl) return (
            <a href={addrMapsUrl} target="_blank" rel="noopener noreferrer"
              className="block text-indigo-600 hover:underline hover:bg-indigo-50 rounded-md -mx-1 px-1 py-0.5 transition-colors">
              {addressBlock}
            </a>
          );
          return addressBlock;
        })()
      ) : (
        <>
          {field("Country",
            <Select value={address.country || ""} onValueChange={handleCountryChange}>
              <SelectTrigger className="h-9 bg-white"><SelectValue placeholder="Select country..." /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <div className="grid grid-cols-2 gap-3">
            {field("State / Province",
              hasStates ? (
                <Select value={address.state || ""} onValueChange={handleStateChange}>
                  <SelectTrigger className="h-9 bg-white"><SelectValue placeholder="Select state..." /></SelectTrigger>
                  <SelectContent>
                    {states.map((s) => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input className="h-9 bg-white" placeholder="State / Province"
                  value={address.state || ""} onChange={(e) => onChange({ ...address, state: e.target.value })} />
              )
            )}
            {field("Postal / Zip Code",
              <Input className="h-9 bg-white"
                placeholder={address.country === "US" ? "e.g. 10001" : "Postal code"}
                value={address.postal_code || ""} onChange={handlePostalChange} />
            )}
          </div>

          {field("City",
            cityOptions.length > 0 && !manualCity && (!address.city || cityOptions.includes(address.city)) ? (
              <Select value={address.city || ""} onValueChange={handleCitySelect}>
                <SelectTrigger className="h-9 bg-white"><SelectValue placeholder="Select city..." /></SelectTrigger>
                <SelectContent>
                  {cityOptions.map((city) => <SelectItem key={city} value={city}>{city}</SelectItem>)}
                  <SelectItem value="__manual__">✏️ Enter manually...</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex gap-1.5">
                <Input className="h-9 bg-white" placeholder="City"
                  value={address.city || ""} onChange={(e) => onChange({ ...address, city: e.target.value })}
                  onBlur={handleCityBlur} />
                {cityOptions.length > 0 && (
                  <Button type="button" variant="outline" size="sm"
                    className="h-9 px-2 text-xs shrink-0"
                    onClick={() => setManualCity(false)} title="Choose from list">List</Button>
                )}
              </div>
            )
          )}

          {field("Street Address",
            <Input className="h-9 bg-white" placeholder="123 Main Street"
              value={address.address_line1 || ""} onChange={(e) => onChange({ ...address, address_line1: e.target.value })} />
          )}

          {field("Suite / Floor / Room",
            <Input className="h-9 bg-white" placeholder="Suite 100, Floor 3..."
              value={address.address_line2 || ""} onChange={(e) => onChange({ ...address, address_line2: e.target.value })} />
          )}
        </>
      )}
    </div>
  );
}