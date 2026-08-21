import React, { useState } from "react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Pencil, User } from "lucide-react";
import { format } from "date-fns";
import NewsStatusChangeDialog from "./NewsStatusChangeDialog";
import { ALERT_STYLES, STATUS_STYLES } from "./newsStyles";

// Interactive badge for a news item's alert_status or news_status.
// Click opens a dialog to change the value with a justification note.
// If the value was manually changed (status_change_history has an entry for
// this field), an "edited" pencil indicator appears and a hover card shows
// who made the last change, when, and the justification note.
//
// props: item, field ("alert_status" | "news_status")
export default function NewsStatusBadge({ item, field }) {
  const [open, setOpen] = useState(false);

  const isAlert = field === "alert_status";
  const value = item[field];
  const styleMap = isAlert ? ALERT_STYLES : STATUS_STYLES;
  const style = styleMap[value] || (isAlert ? ALERT_STYLES.Low : STATUS_STYLES.Neutral);

  // Find the last change entry for this field
  const history = item.status_change_history || [];
  const lastChange = [...history].reverse().find((h) => h.field === field);
  const wasChanged = !!lastChange;

  return (
    <>
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`group inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${style.bg} ${style.color} hover:ring-2 hover:ring-offset-1 hover:ring-indigo-300 transition-all cursor-pointer relative`}
            title={`Click to change ${isAlert ? "alert level" : "status"}`}
          >
            {value}
            {wasChanged && (
              <Pencil className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
            )}
          </button>
        </HoverCardTrigger>
        {wasChanged && (
          <HoverCardContent align="end" className="w-72 p-3">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                <Pencil className="w-3 h-3 text-indigo-500" />
                {isAlert ? "Alert level" : "Status"} changed
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className={`px-1.5 py-0.5 rounded-full font-bold ${styleMap[lastChange.previous_value]?.bg || ""} ${styleMap[lastChange.previous_value]?.color || ""}`}>
                  {lastChange.previous_value}
                </span>
                <span className="text-gray-400">→</span>
                <span className={`px-1.5 py-0.5 rounded-full font-bold ${style.bg} ${style.color}`}>
                  {lastChange.new_value}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <User className="w-3 h-3" />
                <span className="font-medium text-gray-700">{lastChange.changed_by_name || "Unknown"}</span>
                <span>·</span>
                <span>{lastChange.changed_date ? format(new Date(lastChange.changed_date), "MMM d, yyyy h:mm a") : ""}</span>
              </div>
              {lastChange.note && (
                <div className="rounded-md bg-gray-50 border border-gray-200 p-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Justification</p>
                  <p className="text-xs text-gray-700">{lastChange.note}</p>
                </div>
              )}
            </div>
          </HoverCardContent>
        )}
      </HoverCard>
      <NewsStatusChangeDialog
        open={open}
        onOpenChange={setOpen}
        item={item}
        field={field}
      />
    </>
  );
}