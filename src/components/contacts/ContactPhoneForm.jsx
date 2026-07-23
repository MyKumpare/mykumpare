import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Phone, Trash2, Star } from "lucide-react";
import { COUNTRY_CODES } from "../firms/phoneData";

const PHONE_TYPES = ["Mobile", "Office", "Home", "Fax", "Other"];

export default function ContactPhoneForm({ phone, onChange, onDelete, onSetDefault, isDefault, isEditing, isOnly }) {
  const handleCountryCodeChange = (val) => {
    onChange({ ...phone, country_code: val, area_code: "", number_mid: "", number_last: "" });
  };

  // Auto-format the phone number into the system style: (415) 555-1234.
  // Stored fields stay split (area_code / number_mid / number_last) to preserve
  // the existing data model and downstream tel-link/display logic.
  const combinedDigits = `${phone.area_code || ""}${phone.number_mid || ""}${phone.number_last || ""}`.slice(0, 10);

  const formatPhone = (d) => {
    if (d.length === 0) return "";
    if (d.length <= 3) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };

  const handleNumberChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    onChange({
      ...phone,
      area_code: digits.slice(0, 3),
      number_mid: digits.slice(3, 6),
      number_last: digits.slice(6, 10),
    });
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

  const getTelLink = () => {
    if (phone.country_code && phone.area_code && phone.number_mid && phone.number_last) {
      return `tel:+${phone.country_code}${phone.area_code}${phone.number_mid}${phone.number_last}`;
    }
    return null;
  };

  const viewText = (val) => (
    <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-800">
      {val || <span className="text-gray-400">—</span>}
    </div>
  );

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${isDefault ? "border-indigo-300 bg-indigo-50/40" : "border-gray-200 bg-gray-50/40"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone className={`w-4 h-4 ${isDefault ? "text-indigo-500" : "text-gray-400"}`} />
          <span className="text-sm font-medium text-gray-700">{phone.phone_type || "Phone"}</span>
          {isDefault && !isEditing && (
            <span className="text-xs bg-indigo-100 text-indigo-600 font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
              <Star className="w-3 h-3 fill-current" /> Default
            </span>
          )}
        </div>
        {isEditing && (
          <div className="flex items-center gap-1">
            <Button
              type="button" variant="ghost" size="sm"
              className={`h-7 px-2 text-xs gap-1 ${isDefault ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50" : "text-gray-400 hover:text-amber-500 hover:bg-amber-50"}`}
              onClick={isDefault ? () => onChange({ ...phone, is_default: false }) : onSetDefault}
            >
              <Star className={`w-3.5 h-3.5 ${isDefault ? "fill-amber-400 text-amber-500" : ""}`} />
              <span>{isDefault ? "Default" : "Set Default"}</span>
            </Button>
            {!isOnly && (
              <Button type="button" variant="ghost" size="sm"
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
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Phone Type</Label>
            <Select value={phone.phone_type || ""} onValueChange={(val) => onChange({ ...phone, phone_type: val })}>
              <SelectTrigger className="h-9 bg-white">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {PHONE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Country Code</Label>
            <Select value={phone.country_code || ""} onValueChange={handleCountryCodeChange}>
              <SelectTrigger className="h-9 bg-white">
                <SelectValue placeholder="Select country code..." />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_CODES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.flag} +{c.code} — {c.country}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Phone Number</Label>
            <Input
              className="h-9 bg-white font-mono tracking-wide"
              placeholder="(415) 555-1234"
              inputMode="tel"
              value={formatPhone(combinedDigits)}
              onChange={handleNumberChange}
              disabled={!phone.country_code}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-500">Type</Label>
            {viewText(phone.phone_type)}
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-500">Number</Label>
            {(() => {
              const tel = getTelLink();
              if (tel) return (
                <a href={tel} className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-indigo-600 hover:underline hover:bg-indigo-50 transition-colors">
                  {displayNumber()}
                </a>
              );
              return viewText(displayNumber());
            })()}
          </div>
        </div>
      )}
    </div>
  );
}