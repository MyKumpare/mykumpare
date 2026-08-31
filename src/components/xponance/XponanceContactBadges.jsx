import React from "react";
import { UserCircle2 } from "lucide-react";

/**
 * Compact inline badges showing the primary and secondary Xponance contacts
 * assigned to a firm or contact. Designed to sit next to a firm/contact name
 * in lists, cards, and pickers so the assignment is visible at a glance.
 *
 * Props:
 *  - entity: the Firm or Contact record (must have primary_xponance_contact_name
 *    and secondary_xponance_contact_name fields)
 *  - className: optional extra classes for the wrapper
 *  - onClick: optional handler — receives ("primary"|"secondary", contact_name).
 *    When provided, badges become clickable buttons.
 */
export default function XponanceContactBadges({ entity, className = "", onClick }) {
  if (!entity) return null;
  const primary = entity.primary_xponance_contact_name;
  const secondary = entity.secondary_xponance_contact_name;
  if (!primary && !secondary) return null;

  const Badge = ({ role, name }) => {
    const label = `${role === "primary" ? "P" : "S"}: ${name}`;
    const cls =
      role === "primary"
        ? "bg-indigo-50 text-indigo-700 border-indigo-200"
        : "bg-violet-50 text-violet-700 border-violet-200";
    const inner = (
      <>
        <UserCircle2 className="w-3 h-3 flex-shrink-0" />
        <span className="truncate max-w-[120px]">{name}</span>
      </>
    );
    if (onClick) {
      return (
        <button
          type="button"
          title={`Xponance ${role === "primary" ? "Primary" : "Secondary"}: ${name}`}
          onClick={(e) => { e.stopPropagation(); onClick(role, name); }}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-medium leading-none whitespace-nowrap ${cls}`}
        >
          {inner}
        </button>
      );
    }
    return (
      <span
        title={`Xponance ${role === "primary" ? "Primary" : "Secondary"}: ${name}`}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-medium leading-none whitespace-nowrap ${cls}`}
      >
        {inner}
      </span>
    );
  };

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {primary && <Badge role="primary" name={primary} />}
      {secondary && <Badge role="secondary" name={secondary} />}
    </span>
  );
}