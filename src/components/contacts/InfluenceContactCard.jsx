import React from "react";
import { Star, Building2, CalendarClock, ExternalLink } from "lucide-react";
import ContactQuickActions from "./ContactQuickActions";

/**
 * InfluenceContactCard — a card-style contact entry used in the influence-level
 * dashboard. Mirrors the reference design: bold name + Active badge, blue
 * underlined organization link, metadata pills (influence tier, firms, boards),
 * and a Quick Actions row for inline role/tag management.
 */
export default function InfluenceContactCard({ contact, firmName, onFirmClick, score, tierLabel, tierClasses, tierStar, firmCount, boardCount }) {
  const fullName = [contact.salutation, contact.first_name, contact.middle_name, contact.last_name, contact.suffix]
    .filter(Boolean)
    .join(" ")
    .trim() || `${contact.first_name || ""} ${contact.last_name || ""}`.trim();

  const isActive = contact.contact_status !== "Inactive";

  return (
    <div className="border border-gray-200 rounded-xl bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Name + Active badge */}
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-lg font-bold text-gray-900 leading-tight">{fullName}</h3>
        {isActive && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200">
            Active
          </span>
        )}
      </div>

      {/* Organization link */}
      {firmName && (
        <button
          type="button"
          onClick={onFirmClick}
          className="inline-flex items-center gap-1 text-sm text-blue-700 hover:text-blue-900 hover:underline font-medium mb-2"
        >
          {firmName}
          <ExternalLink className="w-3 h-3" />
        </button>
      )}

      {/* Metadata pills */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${tierClasses || "bg-gray-50 text-gray-600 border-gray-200"}`}>
          <Star className={`w-3 h-3 ${tierStar || "text-gray-400"}`} />
          {score} · {tierLabel || "Emerging"}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
          <Building2 className="w-3 h-3 text-gray-400" />
          {firmCount}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
          <CalendarClock className="w-3 h-3 text-gray-400" />
          {boardCount}
        </span>
      </div>

      {/* Quick Actions */}
      <ContactQuickActions contact={contact} />
    </div>
  );
}