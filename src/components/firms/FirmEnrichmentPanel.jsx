import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Globe, Check, X, Sparkles } from "lucide-react";
import { enrichFirmFromWeb } from "../ai/firmEnrichment";

function FieldRow({ label, value, accepted, onToggle }) {
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) return null;
  const display = Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value);
  if (!display.trim()) return null;

  return (
    <div className="flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-gray-50 border border-transparent hover:border-gray-100">
      <Checkbox checked={accepted} onCheckedChange={onToggle} className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-gray-800 break-words">{display.length > 120 ? display.substring(0, 120) + "..." : display}</p>
      </div>
    </div>
  );
}

function AddressRow({ address, index, accepted, onToggle }) {
  if (!address || (!address.address_line1 && !address.city)) return null;
  const parts = [address.address_line1, address.address_line2, address.city, address.state, address.postal_code, address.country].filter(Boolean);

  return (
    <div className="flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-gray-50 border border-transparent hover:border-gray-100">
      <Checkbox checked={accepted} onCheckedChange={onToggle} className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Address {address.is_headquarters ? "(HQ)" : `#${index + 1}`}</p>
        <p className="text-sm text-gray-800 break-words">{parts.join(", ")}</p>
      </div>
    </div>
  );
}

function PhoneRow({ phone, index, accepted, onToggle }) {
  if (!phone) return null;
  const hasParts = phone.area_code && phone.number_mid && phone.number_last;
  const display = hasParts
    ? `+${phone.country_code || "1"} (${phone.area_code}) ${phone.number_mid}-${phone.number_last}`
    : phone.country_code || "";
  if (!display.trim()) return null;

  return (
    <div className="flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-gray-50 border border-transparent hover:border-gray-100">
      <Checkbox checked={accepted} onCheckedChange={onToggle} className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Phone {phone.phone_type ? `(${phone.phone_type})` : `#${index + 1}`}</p>
        <p className="text-sm text-gray-800">{display}</p>
      </div>
    </div>
  );
}

export default function FirmEnrichmentPanel({ firmName, website, onApply, onClose }) {
  const [loading, setLoading] = useState(false);
  const [enrichedData, setEnrichedData] = useState(null);
  const [error, setError] = useState(null);
  const [acceptedFields, setAcceptedFields] = useState({});

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    setEnrichedData(null);
    try {
      const data = await enrichFirmFromWeb(firmName, website);
      setEnrichedData(data);

      const initial = {};
      if (data.description) initial.description = true;
      if (data.website) initial.website = true;
      if (data.linkedin_url) initial.linkedin_url = true;
      if (data.year_founded) initial.year_founded = true;
      if (data.firm_types?.length) initial.firm_types = true;
      (data.addresses || []).forEach((_, i) => (initial[`address_${i}`] = true));
      (data.phones || []).forEach((_, i) => (initial[`phone_${i}`] = true));
      setAcceptedFields(initial);
    } catch (err) {
      setError(err.message || "Failed to fetch data from the web");
    } finally {
      setLoading(false);
    }
  };

  const toggleField = (key) => {
    setAcceptedFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleApply = () => {
    const selected = {};
    if (enrichedData) {
      if (acceptedFields.description && enrichedData.description) selected.description = enrichedData.description;
      if (acceptedFields.website && enrichedData.website) selected.website = enrichedData.website;
      if (acceptedFields.linkedin_url && enrichedData.linkedin_url) selected.linkedin_url = enrichedData.linkedin_url;
      if (acceptedFields.year_founded && enrichedData.year_founded) selected.year_founded = enrichedData.year_founded;
      if (acceptedFields.firm_types && enrichedData.firm_types?.length) selected.firm_types = enrichedData.firm_types;
      const selAddresses = (enrichedData.addresses || [])
        .filter((_, i) => acceptedFields[`address_${i}`])
        .map((a) => ({ ...a, id: crypto.randomUUID() }));
      if (selAddresses.length) selected.addresses = selAddresses;
      const selPhones = (enrichedData.phones || [])
        .filter((_, i) => acceptedFields[`phone_${i}`])
        .map((p) => ({ ...p, id: crypto.randomUUID() }));
      if (selPhones.length) selected.phones = selPhones;
    }
    onApply(selected);
  };

  const hasAccepted = Object.values(acceptedFields).some(Boolean);

  if (!enrichedData && !loading && !error) {
    return (
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-indigo-600" />
          <p className="text-sm font-medium text-indigo-700">Auto-fill from Web</p>
        </div>
        <p className="text-xs text-gray-600">
          Search the web for <strong>{firmName}</strong>'s public website and automatically fill in fields like description, address, phone, LinkedIn, and more.
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleFetch} className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Search Web
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-8 text-xs text-gray-500">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
        <div>
          <p className="text-sm font-medium text-indigo-700">Searching the web...</p>
          <p className="text-xs text-gray-500">Looking up {firmName}'s public information</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <X className="w-4 h-4 text-red-500" />
          <p className="text-sm font-medium text-red-600">Search Failed</p>
        </div>
        <p className="text-xs text-gray-600">{error}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleFetch} className="h-8 text-xs">Retry</Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-8 text-xs text-gray-500">Close</Button>
        </div>
      </div>
    );
  }

  const hasData = enrichedData && (
    enrichedData.description ||
    enrichedData.website ||
    enrichedData.linkedin_url ||
    enrichedData.year_founded ||
    enrichedData.firm_types?.length ||
    enrichedData.addresses?.length ||
    enrichedData.phones?.length
  );

  if (!hasData) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <X className="w-4 h-4 text-amber-500" />
          <p className="text-sm font-medium text-amber-700">No data found</p>
        </div>
        <p className="text-xs text-gray-600">Could not find enough public information for <strong>{firmName}</strong>. Try adding a website URL first.</p>
        <Button size="sm" variant="ghost" onClick={onClose} className="h-8 text-xs text-gray-500">Close</Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-indigo-200 bg-white p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-green-600" />
          <p className="text-sm font-medium text-gray-800">Data found — review & select</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="max-h-60 overflow-y-auto space-y-0.5">
        <FieldRow label="Description" value={enrichedData.description} accepted={acceptedFields.description} onToggle={() => toggleField("description")} />
        <FieldRow label="Website" value={enrichedData.website} accepted={acceptedFields.website} onToggle={() => toggleField("website")} />
        <FieldRow label="LinkedIn" value={enrichedData.linkedin_url} accepted={acceptedFields.linkedin_url} onToggle={() => toggleField("linkedin_url")} />
        <FieldRow label="Year Founded" value={enrichedData.year_founded} accepted={acceptedFields.year_founded} onToggle={() => toggleField("year_founded")} />
        <FieldRow label="Firm Types" value={enrichedData.firm_types} accepted={acceptedFields.firm_types} onToggle={() => toggleField("firm_types")} />
        {(enrichedData.addresses || []).map((addr, i) => (
          <AddressRow key={`addr-${i}`} address={addr} index={i} accepted={acceptedFields[`address_${i}`]} onToggle={() => toggleField(`address_${i}`)} />
        ))}
        {(enrichedData.phones || []).map((phone, i) => (
          <PhoneRow key={`ph-${i}`} phone={phone} index={i} accepted={acceptedFields[`phone_${i}`]} onToggle={() => toggleField(`phone_${i}`)} />
        ))}
      </div>

      <div className="flex items-center justify-between pt-1.5 border-t">
        <p className="text-xs text-gray-400">{Object.values(acceptedFields).filter(Boolean).length} field(s) selected</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setAcceptedFields({})} className="h-8 text-xs gap-1">
            <X className="w-3 h-3" /> Clear
          </Button>
          <Button size="sm" onClick={handleApply} disabled={!hasAccepted} className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1">
            <Check className="w-3.5 h-3.5" /> Apply Selected
          </Button>
        </div>
      </div>
    </div>
  );
}