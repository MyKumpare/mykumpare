import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, LocateFixed, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

/**
 * Location field for the firm profile.
 * A single free-text input (e.g. "New York, NY, USA") with an "Auto-locate"
 * button that geocodes the text into lat/lng coordinates via the
 * geocodeLocations backend function. The coordinates power the firm's
 * pin on the Firm Geographic Map.
 *
 * Props:
 *   value       — current location string
 *   lat         — current location_lat (number | undefined)
 *   lng         — current location_lng (number | undefined)
 *   editing     — whether the form is in edit mode
 *   onChange(v) — called with the new location string
 *   onGeocode(lat, lng) — called with geocoded coordinates
 */
export default function FirmLocationField({ value, lat, lng, editing, onChange, onGeocode }) {
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState(null);

  const handleLocate = async () => {
    if (!value || !value.trim()) {
      setError("Enter a location first.");
      return;
    }
    setGeocoding(true);
    setError(null);
    try {
      const resp = await base44.functions.invoke("geocodeLocations", {
        centerQuery: value.trim(),
        locations: [],
      });
      const data = resp?.data ?? resp ?? {};
      if (!data.center) {
        setError("Could not geocode this location. Try being more specific.");
        return;
      }
      onGeocode(data.center.lat, data.center.lon);
    } catch (err) {
      setError(err?.message || "Failed to geocode location.");
    } finally {
      setGeocoding(false);
    }
  };

  if (!editing) {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">Location</Label>
        <div className="h-9 px-3 flex items-center gap-1.5 rounded-md border bg-gray-50 text-sm text-gray-700">
          {value ? (
            <>
              <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span>{value}</span>
            </>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-gray-700">Location</Label>
      <div className="flex gap-1.5">
        <Input
          placeholder="e.g. New York, NY, USA"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 px-2 text-xs gap-1 shrink-0"
          onClick={handleLocate}
          disabled={geocoding}
          title="Geocode this location to place the firm on the map"
        >
          {geocoding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
          {geocoding ? "Locating…" : "Locate"}
        </Button>
      </div>
      {error && <div className="text-xs text-red-500">{error}</div>}
      {!error && lat != null && lng != null && (
        <div className="text-xs text-green-600 flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          Coordinates set — {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}
        </div>
      )}
    </div>
  );
}