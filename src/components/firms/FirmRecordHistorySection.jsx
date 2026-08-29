import React, { useMemo, useState } from "react";
import { History, Search, ArrowUpRight, ArrowDownRight, Edit2 } from "lucide-react";

// Friendly labels for audited firm fields so the timeline reads naturally.
const FIELD_LABELS = {
  name: "Firm Name",
  firm_type: "Firm Type",
  firm_types: "Firm Types",
  logo_url: "Logo",
  website: "Website",
  linkedin_url: "LinkedIn URL",
  email: "Email",
  registration_number: "Registration Number",
  registration_source_url: "Registration Source URL",
  year_founded: "Year Founded",
  geographic_region: "Geographic Region",
  location: "Location",
  location_lat: "Location Latitude",
  location_lng: "Location Longitude",
  description: "Description",
  meeting_summary: "Meeting Summary",
  meeting_summary_generated_at: "Meeting Summary Generated At",
  funding_status: "Funding Status",
  addresses: "Addresses",
  phones: "Phones",
  aum_history: "AUM History",
  sourcing_sources: "Sourcing Sources",
  sourcing_date: "Sourcing Date",
  sourcing_contact_name: "Sourcing Contact",
  sourcing_notes: "Sourcing Notes",
};

function fieldLabel(field) {
  return FIELD_LABELS[field] || field;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function renderValue(v) {
  if (v == null || v === "") return <span className="text-gray-400 italic">empty</span>;
  return <span className="break-words">{String(v)}</span>;
}

export default function FirmRecordHistorySection({ firm }) {
  const [search, setSearch] = useState("");

  const sorted = useMemo(() => {
    const history = Array.isArray(firm?.audit_history) ? firm.audit_history : [];
    return [...history].sort(
      (a, b) => new Date(b.changed_date || 0) - new Date(a.changed_date || 0)
    );
  }, [firm?.audit_history]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(
      (e) =>
        fieldLabel(e.field).toLowerCase().includes(q) ||
        (e.changed_by_name || "").toLowerCase().includes(q) ||
        String(e.previous_value || "").toLowerCase().includes(q) ||
        String(e.new_value || "").toLowerCase().includes(q)
    );
  }, [sorted, search]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-gray-500">
          A complete history of edits made to this firm's record by users.
        </p>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search field, user, or value..."
            className="h-7 pl-8 pr-2.5 text-xs rounded-lg border border-gray-200 outline-none focus:border-indigo-400 bg-gray-50 w-56"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl">
          {sorted.length === 0
            ? "No record edits have been logged yet"
            : "No edits match your search"}
        </div>
      ) : (
        <ol className="relative border-l border-gray-200 ml-2 space-y-3 py-2">
          {filtered.map((entry) => (
            <li key={entry.id} className="ml-4">
              <span className="absolute -left-[7px] mt-1.5 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white" />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700">
                  <Edit2 className="w-3 h-3 text-indigo-400" />
                  {entry.changed_by_name || "Unknown user"}
                </span>
                <span className="text-xs text-gray-400">
                  {formatDate(entry.changed_date)}
                </span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-800">
                  {fieldLabel(entry.field)}
                </span>
                <span className="text-gray-400"> updated</span>
              </div>
              <div className="mt-1.5 grid grid-cols-1 gap-1.5 text-xs">
                <div className="rounded-md bg-red-50 border border-red-100 px-2.5 py-1.5 flex items-start gap-1.5">
                  <ArrowUpRight className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-red-600">From: </span>
                    {renderValue(entry.previous_value)}
                  </div>
                </div>
                <div className="rounded-md bg-emerald-50 border border-emerald-100 px-2.5 py-1.5 flex items-start gap-1.5">
                  <ArrowDownRight className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-emerald-600">To: </span>
                    {renderValue(entry.new_value)}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}