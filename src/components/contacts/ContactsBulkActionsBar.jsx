import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, CheckCircle2, XCircle, X, Loader2, Tag, Crown, Building2 } from "lucide-react";

const INFLUENCE_LEVELS = [
  "Final Decision Maker",
  "Decision Maker",
  "Influencer",
  "Follower",
  "Undetermined",
];

const LEVEL_DOT = {
  "Final Decision Maker": "bg-red-500",
  "Decision Maker": "bg-amber-500",
  "Influencer": "bg-indigo-500",
  "Follower": "bg-sky-500",
  "Undetermined": "bg-gray-400",
};

export default function ContactsBulkActionsBar({
  selectedCount,
  onClear,
  onSetActive,
  onSetInactive,
  onTag,
  onDelete,
  onBulkInfluence,
  onBulkAssignFirm,
  busy,
}) {
  const [showInfluence, setShowInfluence] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 shadow-sm">
      <span className="text-sm font-medium text-indigo-800">
        {selectedCount} selected
      </span>
      <div className="h-4 w-px bg-indigo-200" />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-xs bg-white"
        onClick={onSetActive}
        disabled={!!busy}
      >
        {busy === "active" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
        Set Active
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-xs bg-white"
        onClick={onSetInactive}
        disabled={!!busy}
      >
        {busy === "inactive" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
        Set Inactive
      </Button>

      {onBulkInfluence && (
        <div className="relative">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs bg-white text-amber-600 hover:bg-amber-50 hover:text-amber-700"
            onClick={() => setShowInfluence((s) => !s)}
            disabled={!!busy}
          >
            {busy === "influence" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crown className="w-3.5 h-3.5" />}
            Influence Level
          </Button>
          {showInfluence && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowInfluence(false)} />
              <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[190px]">
                {INFLUENCE_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => {
                      setShowInfluence(false);
                      onBulkInfluence(level);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-amber-50 text-gray-700 flex items-center gap-2"
                  >
                    <span className={`w-2 h-2 rounded-full ${LEVEL_DOT[level]}`} />
                    {level}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {onBulkAssignFirm && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs bg-white text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
          onClick={onBulkAssignFirm}
          disabled={!!busy}
        >
          {busy === "assignFirm" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Building2 className="w-3.5 h-3.5" />}
          Assign to Firm
        </Button>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-xs bg-white text-pink-600 hover:bg-pink-50 hover:text-pink-700"
        onClick={onTag}
        disabled={!!busy}
      >
        {busy === "tag" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
        Add Tags
      </Button>
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