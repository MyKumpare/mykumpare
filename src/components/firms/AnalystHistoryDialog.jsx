import React, { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { formatCoverageDate } from "@/lib/analystHistoryClient";
import { User, Clock, Calendar, Pencil, Check, X } from "lucide-react";

/**
 * Displays the analyst coverage history for a single Due Diligence record.
 * Shows each assignment with analyst type, name, start date, end date, and
 * duration of coverage.
 */
export default function AnalystHistoryDialog({ open, onOpenChange, record }) {
  const [roleFilter, setRoleFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [saving, setSaving] = useState(false);

  const history = useMemo(() => {
    if (!record?.analyst_history) return [];
    return [...record.analyst_history]
      .filter((entry) => roleFilter === "all" || entry.analyst_type === roleFilter)
      .sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""));
  }, [record, roleFilter]);

  const productName = record?.product_name || "—";
  const firmName = record?.firm_name || "—";

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditStart(entry.start_date || "");
    setEditEnd(entry.end_date || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditStart("");
    setEditEnd("");
  };

  const saveEdit = async (entry) => {
    setSaving(true);
    try {
      const updatedHistory = (record.analyst_history || []).map((h) =>
        h.id === entry.id
          ? { ...h, start_date: editStart || null, end_date: editEnd || null }
          : h
      );
      await base44.entities.DueDiligence.update(record.id, { analyst_history: updatedHistory });
      if (record.onHistoryUpdated) record.onHistoryUpdated(updatedHistory);
      // Update local record ref so the dialog reflects changes immediately
      record.analyst_history = updatedHistory;
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            Analyst Coverage History
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1 mb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{productName}</p>
              <p className="text-xs text-gray-500 truncate">{firmName}</p>
            </div>
            {record?.analyst_history?.length > 0 && (
              <div className="inline-flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 flex-shrink-0">
                {[
                  { value: "all", label: "All" },
                  { value: "primary", label: "Primary" },
                  { value: "secondary", label: "Secondary" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRoleFilter(opt.value)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      roleFilter === opt.value
                        ? "bg-white text-gray-800 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400 italic border border-dashed border-gray-200 rounded-lg">
            No analyst coverage history recorded yet.
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((entry) => {
              const isActive = !entry.end_date;
              const duration = computeDuration(entry.start_date, entry.end_date);
              return (
                <div
                  key={entry.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                    isActive
                      ? "border-emerald-200 bg-emerald-50/40"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isActive ? "bg-emerald-100" : "bg-gray-100"
                  }`}>
                    <User className={`w-4 h-4 ${isActive ? "text-emerald-600" : "text-gray-400"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {entry.contact_name || "—"}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold ${
                          entry.analyst_type === "primary"
                            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                            : "border-violet-200 bg-violet-50 text-violet-700"
                        }`}
                      >
                        {entry.analyst_type === "primary" ? "Primary" : "Secondary"}
                      </Badge>
                      {isActive ? (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200">
                          Active
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] bg-gray-100 text-gray-500 border border-gray-200">
                          Inactive
                        </Badge>
                      )}
                      {editingId !== entry.id && (
                        <button
                          type="button"
                          onClick={() => startEdit(entry)}
                          className="ml-auto text-gray-400 hover:text-indigo-600 transition-colors"
                          title="Edit dates"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {editingId === entry.id ? (
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Input
                          type="date"
                          value={editStart}
                          onChange={(e) => setEditStart(e.target.value)}
                          className="h-7 w-[140px] text-xs"
                        />
                        <span className="text-xs text-gray-400">–</span>
                        <Input
                          type="date"
                          value={editEnd}
                          onChange={(e) => setEditEnd(e.target.value)}
                          placeholder="Present"
                          className="h-7 w-[140px] text-xs"
                        />
                        <Button
                          type="button"
                          size="icon"
                          className="h-7 w-7"
                          disabled={saving}
                          onClick={() => saveEdit(entry)}
                          title="Save"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          disabled={saving}
                          onClick={cancelEdit}
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatCoverageDate(entry.start_date)}
                          {!entry.end_date
                            ? " – Present"
                            : ` – ${formatCoverageDate(entry.end_date)}`}
                        </span>
                        {duration && (
                          <span className="text-gray-400">{duration}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function computeDuration(startDate, endDate) {
  if (!startDate) return "";
  const start = new Date(startDate + "T00:00:00");
  const end = endDate ? new Date(endDate + "T00:00:00") : new Date();
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "";
  const diffMs = end.getTime() - start.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return "< 1 day";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30);
  const remDays = days % 30;
  if (months < 12) {
    return remDays > 0
      ? `${months} mo, ${remDays} day${remDays === 1 ? "" : "s"}`
      : `${months} month${months === 1 ? "" : "s"}`;
  }
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return remMonths > 0
    ? `${years} yr, ${remMonths} mo`
    : `${years} year${years === 1 ? "" : "s"}`;
}