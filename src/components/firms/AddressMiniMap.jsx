import React, { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Red pin icon matching the AddressMapPickerDialog style.
function makePinIcon() {
  return L.divIcon({
    className: "map-search-marker",
    html: `<div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;"><div style="width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

// Recenter the map when the pin moves.
function Recenter({ lat, lng, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      map.setView([lat, lng], zoom ?? map.getZoom(), { animate: true });
    }
  }, [lat, lng, zoom]);
  return null;
}

// Fix leaflet size after mount (needed inside flex/hidden containers).
function SizeFixer() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

/**
 * Small inline map preview showing a pin at the given coordinates.
 * Used inside AddressForm to give immediate visual feedback after geocoding.
 *
 * Props:
 *   lat, lng — coordinates to display
 *   zoom     — optional zoom level (default 13)
 */
export default function AddressMiniMap({ lat, lng, zoom = 13 }) {
  const valid = Number.isFinite(lat) && Number.isFinite(lng);
  if (!valid) return null;
  return (
    <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height: 160 }}>
      <MapContainer
        center={[lat, lng]}
        zoom={zoom}
        className="w-full h-full"
        style={{ background: "#e5e7eb" }}
        scrollWheelZoom={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <SizeFixer />
        <Recenter lat={lat} lng={lng} zoom={zoom} />
        <Marker position={[lat, lng]} icon={makePinIcon()} />
      </MapContainer>
    </div>
  );
}