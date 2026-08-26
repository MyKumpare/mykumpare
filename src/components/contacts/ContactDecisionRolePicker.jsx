import React from "react";
import { Crown, Users, Lightbulb, UserCheck, MoreHorizontal } from "lucide-react";

/**
 * Decision Role — classifies a contact's decision-making role within the firm:
 * Primary Decision Maker, Board Member, Key Influencer, Secondary Contact, Other.
 *
 * Used in the contact form (editable) and on contact cards / the network dashboard
 * (read-only badge) to surface decision makers at a glance.
 */

export const DECISION_ROLES = [
  {
    value: "Primary Decision Maker",
    icon: Crown,
    classes: "bg-amber-100 text-amber-800 border-amber-300",
    dot: "bg-amber-500",
  },
  {
    value: "Board Member",
    icon: Users,
    classes: "bg-violet-100 text-violet-800 border-violet-300",
    dot: "bg-violet-500",
  },
  {
    value: "Key Influencer",
    icon: Lightbulb,
    classes: "bg-indigo-100 text-indigo-800 border-indigo-300",
    dot: "bg-indigo-500",
  },
  {
    value: "Secondary Contact",
    icon: UserCheck,
    classes: "bg-sky-100 text-sky-800 border-sky-300",
    dot: "bg-sky-500",
  },
  {
    value: "Other",
    icon: MoreHorizontal,
    classes: "bg-gray-100 text-gray-700 border-gray-300",
    dot: "bg-gray-400",
  },
];

export function getDecisionRoleStyle(role) {
  return DECISION_ROLES.find((r) => r.value === role) || DECISION_ROLES[4];
}

/** Compact badge for display on cards / lists */
export function DecisionRoleBadge({ role, size = "sm" }) {
  if (!role) return null;
  const style = getDecisionRoleStyle(role);
  const Icon = style.icon;
  const sizeClasses =
    size === "xs"
      ? "text-[10px] px-1.5 py-0.5 gap-0.5"
      : "text-xs px-2 py-0.5 gap-1";
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${style.classes} ${sizeClasses}`}
    >
      <Icon className={size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {role}
    </span>
  );
}

/** Editable picker — pill buttons */
export default function ContactDecisionRolePicker({ value, onChange, viewMode = false }) {
  if (viewMode) {
    return (
      <div className="text-sm px-1">
        {value ? (
          <DecisionRoleBadge role={value} />
        ) : (
          <span className="text-gray-400 italic">—</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {DECISION_ROLES.map((role) => {
        const Icon = role.icon;
        const isSelected = value === role.value;
        return (
          <button
            key={role.value}
            type="button"
            onClick={() => onChange(isSelected ? "" : role.value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              isSelected
                ? `${role.classes} border-current`
                : "bg-white text-gray-600 border-gray-300 hover:border-indigo-300 hover:text-primary"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {role.value}
          </button>
        );
      })}
    </div>
  );
}