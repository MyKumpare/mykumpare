import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, CheckCircle2, XCircle, X, Loader2, DollarSign, ArrowRightLeft, Globe, UserCheck } from "lucide-react";

const FUNDING_STATUSES = ["Funded", "Terminated"];

const FIRM_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

const GEOGRAPHIC_REGIONS = [
  "Undefined",
  "North America",
  "Europe",
  "Asia-Pacific",
  "Latin America",
  "Middle East & Africa",
  "Global",
];

/**
 * Bulk action bar for the firm list. Appears when one or more firms are
 * selected. Lets the user move firms to a different firm type, set the
 * funding status, set the geographic region, or soft-delete the selected
 * firms in one go.
 *
 * Props:
 *   selectedCount  - number of firms currently selected
 *   onClear        - clear the selection
 *   onMoveType     - (type) => Promise   — bulk reassign firm_types/firm_type
 *   onSetStatus    - (status) => Promise — bulk-set funding_status
 *   onSetRegion    - (region) => Promise  — bulk-set geographic_region
 *   onDelete       - () => Promise       — bulk soft-delete selected firms
 *   busy           - string | null       - which action is in flight
 */
export default function FirmsBulkActionsBar({ selectedCount, onClear, onMoveType, onSetStatus, onSetRegion, onAssignXponance, onDelete, busy }) {
  const [openMenu, setOpenMenu] = useState(null); // "type" | "status" | "region" | null

  const toggleMenu = (menu) => setOpenMenu((cur) => (cur === menu ? null : menu));
  const closeMenu = () => setOpenMenu(null);

  if (selectedCount === 0) return null;

  const Menu = ({ id, label, icon: Icon, accent, options, onSelect, renderOption }) => (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`h-7 gap-1 text-xs bg-white ${accent}`}
        onClick={() => toggleMenu(id)}
        disabled={!!busy}
      >
        {busy === id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
        {label}
      </Button>
      {openMenu === id && (
        <>
          <div className="fixed inset-0 z-20" onClick={closeMenu} />
          <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[190px] max-h-[260px] overflow-y-auto">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { closeMenu(); onSelect(opt); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-gray-700 flex items-center gap-2"
              >
                {renderOption ? renderOption(opt) : <span className="truncate">{opt}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 shadow-sm">
      <span className="text-sm font-medium text-indigo-800">
        {selectedCount} firm{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <div className="h-4 w-px bg-indigo-200" />

      <Menu
        id="type"
        label="Move to Type"
        icon={ArrowRightLeft}
        accent="text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800"
        options={FIRM_TYPES}
        onSelect={onMoveType}
      />

      <Menu
        id="status"
        label="Set Funding Status"
        icon={DollarSign}
        accent="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
        options={FUNDING_STATUSES}
        onSelect={onSetStatus}
        renderOption={(status) => (
          <>
            {status === "Funded"
              ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              : <XCircle className="w-3.5 h-3.5 text-red-500" />}
            {status}
          </>
        )}
      />

      <Menu
        id="region"
        label="Set Region"
        icon={Globe}
        accent="text-cyan-700 hover:bg-cyan-50 hover:text-cyan-800"
        options={GEOGRAPHIC_REGIONS}
        onSelect={onSetRegion}
      />

      {onAssignXponance && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs bg-white text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
          onClick={onAssignXponance}
          disabled={!!busy}
        >
          {busy === "xponance" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
          Assign Xponance
        </Button>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-xs bg-white text-red-600 hover:bg-red-50 hover:text-red-700"
        onClick={onDelete}
        disabled={!!busy}
      >
        {busy === "delete" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        Delete
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1 text-xs ml-auto text-gray-500 hover:text-gray-700"
        onClick={onClear}
        disabled={!!busy}
      >
        <X className="w-3.5 h-3.5" />
        Clear
      </Button>
    </div>
  );
}