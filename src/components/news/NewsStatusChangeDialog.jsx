import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const ALERT_OPTIONS = ["High", "Medium", "Low"];
const STATUS_OPTIONS = ["Positive", "Negative", "Neutral"];

const ALERT_COLORS = {
  High: "bg-red-50 text-red-700 border-red-300",
  Medium: "bg-amber-50 text-amber-700 border-amber-300",
  Low: "bg-blue-50 text-blue-700 border-blue-300",
};
const STATUS_COLORS = {
  Positive: "bg-green-50 text-green-700 border-green-300",
  Negative: "bg-red-50 text-red-700 border-red-300",
  Neutral: "bg-gray-50 text-gray-600 border-gray-300",
};

// Dialog to change a news article's alert_status or news_status with a
// justification note. The change is appended to status_change_history for
// audit. props: open, onOpenChange, item, field ("alert_status"|"news_status"), onSaved
export default function NewsStatusChangeDialog({ open, onOpenChange, item, field, onSaved }) {
  const queryClient = useQueryClient();
  const [newValue, setNewValue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const currentValue = item ? item[field] : "";
  const isAlert = field === "alert_status";
  const options = isAlert ? ALERT_OPTIONS : STATUS_OPTIONS;
  const colorMap = isAlert ? ALERT_COLORS : STATUS_COLORS;

  useEffect(() => {
    if (open && item) {
      setNewValue(item[field] || "");
      setNote("");
    }
  }, [open, item, field]);

  const handleSave = async () => {
    if (newValue === currentValue) {
      toast({ title: "No change", description: "Select a different value to update." });
      return;
    }
    if (!note.trim()) {
      toast({ title: "Justification required", description: "Please add a note explaining this change.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const me = await base44.auth.me();
      const history = item.status_change_history || [];
      const entry = {
        id: `ch_${Date.now()}`,
        field,
        previous_value: currentValue,
        new_value: newValue,
        changed_by_id: me?.id || "",
        changed_by_name: me?.full_name || me?.email || "Unknown",
        changed_date: new Date().toISOString(),
        note: note.trim(),
      };
      await base44.entities.FirmNews.update(item.id, {
        [field]: newValue,
        status_change_history: [...history, entry],
      });
      toast({ title: "Status updated", description: `${isAlert ? "Alert level" : "Status"} changed to ${newValue}.` });
      queryClient.invalidateQueries({ queryKey: ["firm_news"] });
      queryClient.invalidateQueries({ queryKey: ["pinned_news_alerts"] });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Change {isAlert ? "Alert Level" : "News Status"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Current</Label>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-1 rounded-full border ${colorMap[currentValue] || ""}`}>
                {currentValue || "—"}
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">New {isAlert ? "alert level" : "status"}</Label>
            <div className="flex items-center gap-2 flex-wrap">
              {options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setNewValue(opt)}
                  className={`text-xs font-bold px-2.5 py-1.5 rounded-full border transition-all ${
                    newValue === opt
                      ? `${colorMap[opt]} ring-2 ring-offset-1 ring-indigo-400`
                      : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">
              Justification note <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Explain why this level is being changed..."
              className="text-sm resize-none"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}