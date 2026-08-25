import React from "react";
import { Button } from "@/components/ui/button";
import { Trash2, CheckCircle2, XCircle, X, Loader2, Tag } from "lucide-react";

export default function ContactsBulkActionsBar({
  selectedCount,
  onClear,
  onSetActive,
  onSetInactive,
  onTag,
  onDelete,
  busy,
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 shadow-sm">
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
        disabled={busy}
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
        disabled={busy}
      >
        {busy === "inactive" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
        Set Inactive
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-xs bg-white text-pink-600 hover:bg-pink-50 hover:text-pink-700"
        onClick={onTag}
        disabled={busy}
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
        disabled={busy}
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
        disabled={busy}
      >
        <X className="w-3.5 h-3.5" />
        Clear
      </Button>
    </div>
  );
}