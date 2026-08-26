import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Zap, Tag, Briefcase, Crown, Check, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { toast } from "@/components/ui/use-toast";
import ContactDecisionRolePicker, { DECISION_ROLES } from "./ContactDecisionRolePicker";
import ContactInvestmentTeamRolePicker from "./ContactInvestmentTeamRolePicker";
import ContactTagsField from "./ContactTagsField";

/**
 * ContactQuickActions — a compact toolbar shown on the contact profile
 * (view mode) that lets the user rapidly tag influence scores or add new
 * role details without opening extra menus. Each action saves directly
 * to the contact via the SDK and invalidates the contacts query.
 */
export default function ContactQuickActions({ contact, onEdited }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(null); // "decision" | "role" | "tag" | null

  if (!contact) return null;

  const patch = async (field, value, label) => {
    setSaving(label);
    try {
      await base44.entities.Contact.update(contact.id, { [field]: value });
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: `✅ ${label} updated` });
      if (onEdited) onEdited({ ...contact, [field]: value });
    } catch (err) {
      toast({ title: `Update failed`, description: err?.message || "Could not save.", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide pr-1">
        <Zap className="w-3 h-3" /> Quick Actions
      </span>

      {/* Decision Role quick-set */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
            title="Set decision role"
          >
            <Crown className="w-3 h-3" />
            {contact.decision_role || "Set Role"}
            {saving === "decision" ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <p className="text-xs font-semibold text-gray-700 mb-1.5 px-1">Decision Role</p>
          <div className="space-y-1">
            {DECISION_ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => patch("decision_role", r.value, "decision")}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                  contact.decision_role === r.value
                    ? "bg-amber-100 text-amber-800 font-medium"
                    : "hover:bg-gray-50 text-gray-700"
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${r.dot}`} />
                {r.label}
                {contact.decision_role === r.value && <Check className="w-3 h-3 ml-auto" />}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Investment Team Role quick-add */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
            title="Add investment team role"
          >
            <Briefcase className="w-3 h-3" />
            {(contact.investment_team_roles || []).length > 0
              ? `${contact.investment_team_roles.length} role${contact.investment_team_roles.length === 1 ? "" : "s"}`
              : "Add Role"}
            {saving === "role" ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          <p className="text-xs font-semibold text-gray-700 mb-2">Investment Team Roles</p>
          <ContactInvestmentTeamRolePicker
            value={contact.investment_team_roles || []}
            onChange={(val) => patch("investment_team_roles", val, "role")}
            viewMode={false}
          />
        </PopoverContent>
      </Popover>

      {/* Tag quick-add */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors"
            title="Add tags"
          >
            <Tag className="w-3 h-3" />
            {(contact.tags || []).length > 0
              ? `${contact.tags.length} tag${contact.tags.length === 1 ? "" : "s"}`
              : "Add Tag"}
            {saving === "tag" ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          <p className="text-xs font-semibold text-gray-700 mb-2">Contact Tags</p>
          <ContactTagsField
            value={contact.tags || []}
            onChange={(val) => patch("tags", val, "tag")}
            viewMode={false}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}