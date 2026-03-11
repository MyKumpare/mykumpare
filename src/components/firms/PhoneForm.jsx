import React, { useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Phone, Trash2, Star, MapPin } from "lucide-react";
import { COUNTRY_CODES, getAreaCodesForCountry } from "./phoneData";

const PHONE_TYPES = ["Office Main Number", "Toll Free Number", "Fax Number"];

function getAddressLabel(addr) {
  const parts = [addr.city, addr.state, addr.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : (addr.address_line1 || "Unnamed Location");
}

function getCountryCodeFromCountryName(countryName) {
  if (!countryName) return "";
  const match = COUNTRY_CODES.find(c => c.country.toLowerCase() === countryName.toLowerCase());
  return match ? match.code : "";
}

export default function PhoneForm({ phone, onChange, onDelete, onSetDefault, isDefault, isEditing, isOnly, addresses = [] }) {
  const midRef = useRef(null);
  const lastRef = useRef(null);

  const areaCodes = getAreaCodesForCountry(phone.country_code || "");

  const handleAddressChange = (addressId) => {
    const selectedAddr = addresses.find(a => a.id === addressId);
    const countryCode = selectedAddr ? getCountryCodeFromCountryName(selectedAddr.country) : "";
    onChange({ ...phone, address_id: addressId, country_code: countryCode, area_code: "", number_mid: "", number_last: "" });
  };

  const handleCountryCodeChange = (val) => {
    onChange({ ...phone, country_code: val, area_code: "", number_mid: "", number_last: "" });
  };

  const handleMidChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 3);
    onChange({ ...phone, number_mid: val });
    if (val.length === 3) lastRef.current?.focus();
  };

  const handleLastChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
    onChange({ ...phone, number_last: val });
  };

  const handleMidKeyDown = (e) => {
    if (e.key === "Backspace" && !phone.number_mid) {
      // handled naturally
    }
  };

  const displayNumber = () => {
    const parts = [];
    if (phone.country_code) parts.push(`+${phone.country_code}`);
    if (phone.area_code) parts.push(`(${phone.area_code})`);
    if (phone.number_mid || phone.number_last) {
      parts.push(`${phone.number_mid || "___"}-${phone.number_last || "____"}`);
    }
    return parts.join(" ") || "—";
  };

  const viewText = (val) => (
    <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-800">
      {val || <span className="text-gray-400">—</span>}
    </div>
  );

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${isDefault ? "border-indigo-300 bg-indigo-50/40" : "border-gray-200 bg-gray-50/40"}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone className={`w-4 h-4 ${isDefault ? "text-indigo-500" : "text-gray-400"}`} />
          <span className="text-sm font-medium text-gray-700">
            {phone.phone_type || "Phone"}
          </span>
          {isDefault && !isEditing && (
            <span className="text-xs bg-indigo-100 text-indigo-600 font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
              <Star className="w-3 h-3 fill-current" /> Default
            </span>
          )}
        </div>
        {isEditing && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`h-7 px-2 text-xs gap-1 ${isDefault ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50" : "text-gray-400 hover:text-amber-500 hover:bg-amber-50"}`}
              onClick={isDefault ? () => onChange({ ...phone, is_default: false }) : onSetDefault}
              title={isDefault ? "Unset as default" : "Set as default"}
            >
              <Star className={`w-3.5 h-3.5 ${isDefault ? "fill-amber-400 text-amber-500" : ""}`} />
              <span>{isDefault ? "Default" : "Set Default"}</span>
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
      </div>

      {isEditing ? (
        <div className="space-y-3">
          {/* Location Tag (First & Required) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Associated Location *</Label>
            <Select value={phone.address_id || ""} onValueChange={handleAddressChange}>
              <SelectTrigger className={`h-9 bg-white ${!phone.address_id ? "border-red-400" : ""}`}>
                <SelectValue placeholder="Select a location..." />
              </SelectTrigger>
              <SelectContent>
                {addresses.map((addr) => (
                  <SelectItem key={addr.id} value={addr.id}>
                    {addr.is_headquarters ? "🏢 " : "📍 "}{getAddressLabel(addr)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!phone.address_id && <p className="text-xs text-red-500">A location is required</p>}
          </div>

          {/* Phone Type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Phone Type</Label>
            <Select value={phone.phone_type || ""} onValueChange={(val) => onChange({ ...phone, phone_type: val })}>
              <SelectTrigger className="h-9 bg-white">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {PHONE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Country Code */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Country Code</Label>
            <Select value={phone.country_code || ""} onValueChange={handleCountryCodeChange}>
              <SelectTrigger className="h-9 bg-white">
                <SelectValue placeholder="Select country code..." />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_CODES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.flag} +{c.code} — {c.country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Area Code */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Area Code</Label>
            {areaCodes.length > 0 ? (
              <Select
                value={phone.area_code || ""}
                onValueChange={(val) => onChange({ ...phone, area_code: val })}
                disabled={!phone.country_code}
              >
                <SelectTrigger className="h-9 bg-white">
                  <SelectValue placeholder="Select area code..." />
                </SelectTrigger>
                <SelectContent>
                  {areaCodes.map((a) => (
                    <SelectItem key={a.code} value={a.code}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                className="h-9 bg-white"
                placeholder="Area code"
                value={phone.area_code || ""}
                onChange={(e) => onChange({ ...phone, area_code: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                disabled={!phone.country_code}
              />
            )}
          </div>

          {/* Number: first 3 + last 4 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Phone Number</Label>
            <div className="flex items-center gap-2">
              <Input
                ref={midRef}
                className="h-9 bg-white text-center font-mono tracking-widest"
                placeholder="000"
                maxLength={3}
                value={phone.number_mid || ""}
                onChange={handleMidChange}
                onKeyDown={handleMidKeyDown}
                disabled={!phone.area_code}
              />
              <span className="text-gray-400 font-bold">–</span>
              <Input
                ref={lastRef}
                className="h-9 bg-white text-center font-mono tracking-widest"
                placeholder="0000"
                maxLength={4}
                value={phone.number_last || ""}
                onChange={handleLastChange}
                disabled={!phone.number_mid || phone.number_mid.length < 3}
              />
            </div>
          </div>

        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-500">Type</Label>
              {viewText(phone.phone_type)}
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-500">Number</Label>
              {viewText(displayNumber())}
            </div>
          </div>
          {phone.address_id && addresses.length > 0 && (() => {
            const linked = addresses.find((a) => a.id === phone.address_id);
            return linked ? (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                <MapPin className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                <span>{linked.is_headquarters ? "🏢 " : ""}{getAddressLabel(linked)}</span>
              </div>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}