import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, X, Loader2, ArrowRightLeft } from "lucide-react";

const DD_STATUSES = ["Pipeline", "Buy List", "Rejected"];

export default function DdBulkActionsBar({ selectedCount, onClear, onSetStatus, onDelete, busy }) {
  const [openMenu, setOpenMenu] = useState(null);
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 shadow-sm">
      <span className="text-sm font-medium text-indigo-800">
        {selectedCount} record{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <div className="h-4 w-px bg-indigo-200" />
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs bg-white text-indigo-700 hover:bg-indigo-100"
          onClick={() => setOpenMenu((v) => (v === "status" ? null : "status"))}
          disabled={!!busy}
        >
          {busy === "status" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
          Set Status
        </Button>
        {openMenu === "status" && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setOpenMenu(null)} />
            <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[170px]">
              {DD_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setOpenMenu(null); onSetStatus(s); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-gray-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
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