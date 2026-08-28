import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitCompare, Plus, Minus, Pencil, CheckCircle2 } from "lucide-react";
import { computeTemplateDiff, summarizeChanges } from "./templateDiff";

const TYPE_META = {
  added: { icon: Plus, color: "text-green-600", bg: "bg-green-50", border: "border-green-200", label: "Added" },
  removed: { icon: Minus, color: "text-red-600", bg: "bg-red-50", border: "border-red-200", label: "Removed" },
  modified: { icon: Pencil, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", label: "Modified" },
};

function ChangeRow({ change }) {
  const meta = TYPE_META[change.type] || TYPE_META.modified;
  const Icon = meta.icon;
  const hasOld = change.oldValue !== "" && change.oldValue != null;
  const hasNew = change.newValue !== "" && change.newValue != null;
  return (
    <div className={`flex items-start gap-2 px-2.5 py-1.5 rounded-md border ${meta.border} ${meta.bg}`}>
      <Icon className={`w-3.5 h-3.5 ${meta.color} shrink-0 mt-0.5`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-gray-700">{change.label}</span>
          {change.context && <span className="text-[11px] text-gray-400">in "{change.context}"</span>}
        </div>
        {change.type === "modified" && (
          <div className="text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap">
            {hasOld && <span className="text-red-600 line-through decoration-red-300 truncate max-w-[40%]">{String(change.oldValue).slice(0, 80) || "(empty)"}</span>}
            <span className="text-gray-400">→</span>
            {hasNew && <span className="text-green-700 truncate max-w-[40%]">{String(change.newValue).slice(0, 80) || "(empty)"}</span>}
          </div>
        )}
        {change.type === "added" && hasNew && (
          <div className="text-[11px] mt-0.5 text-green-700 truncate">{String(change.newValue).slice(0, 80) || "(empty)"}</div>
        )}
        {change.type === "removed" && hasOld && (
          <div className="text-[11px] mt-0.5 text-red-600 line-through decoration-red-300 truncate">{String(change.oldValue).slice(0, 80) || "(empty)"}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Preview dialog showing the diff between a prior template version and the
 * current edited state, so the user can review changes before saving the new
 * version.
 *
 * Props:
 *   open, onOpenChange
 *   original  - the prior template record (v{n})
 *   current    - the current edited state (v{n+1}) being saved
 *   nextVersion, priorVersion
 */
export default function TemplateVersionDiffDialog({ open, onOpenChange, original, current, nextVersion, priorVersion }) {
  const changes = useMemo(() => {
    if (!original || !current) return [];
    return computeTemplateDiff(original, current);
  }, [original, current]);

  const summary = useMemo(() => summarizeChanges(changes), [changes]);

  const grouped = useMemo(() => {
    const map = {};
    changes.forEach((c) => { (map[c.section] = map[c.section] || []).push(c); });
    return map;
  }, [changes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-indigo-600" />
            Preview Changes
            <Badge variant="outline" className="text-xs font-normal">v{priorVersion} → v{nextVersion}</Badge>
          </DialogTitle>
        </DialogHeader>

        {changes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
            <p className="text-sm font-medium text-gray-700">No changes detected</p>
            <p className="text-xs text-gray-400 mt-1">The new version is identical to the prior version.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">+{summary.added} added</Badge>
              <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">−{summary.removed} removed</Badge>
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">{summary.modified} modified</Badge>
            </div>
            <div className="space-y-3">
              {Object.entries(grouped).map(([section, items]) => (
                <div key={section}>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 px-1">{section}</p>
                  <div className="space-y-1.5">
                    {items.map((c, i) => <ChangeRow key={i} change={c} />)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex justify-end pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}