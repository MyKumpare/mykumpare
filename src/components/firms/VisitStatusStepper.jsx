import React from "react";
import { Clock, Loader2, CheckCircle2, XCircle, UserX, ChevronRight } from "lucide-react";

// Ordered lifecycle stages for the tracker. Cancelled / No-show are off-ramps shown separately.
const STAGES = [
  { key: "Scheduled", label: "Scheduled", icon: Clock, color: "text-blue-600", bg: "bg-blue-100", ring: "ring-blue-300", bar: "bg-blue-500" },
  { key: "In-Progress", label: "In-Progress", icon: Loader2, color: "text-amber-600", bg: "bg-amber-100", ring: "ring-amber-300", bar: "bg-amber-500" },
  { key: "Completed", label: "Completed", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100", ring: "ring-emerald-300", bar: "bg-emerald-500" },
];

const OFF_TRACK = [
  { key: "Cancelled", label: "Cancelled", icon: XCircle, color: "text-gray-500", bg: "bg-gray-100" },
  { key: "No-show", label: "No-show", icon: UserX, color: "text-red-600", bg: "bg-red-100" },
];

export default function VisitStatusStepper({ status, onStatusChange }) {
  const activeIdx = STAGES.findIndex((s) => s.key === status);
  const isOffTrack = activeIdx === -1 && OFF_TRACK.some((s) => s.key === status);

  return (
    <div className="space-y-2">
      {/* Stage progress bar */}
      <div className="flex items-center gap-1">
        {STAGES.map((s, i) => {
          const StageIcon = s.icon;
          const isActive = i === activeIdx;
          const isDone = activeIdx > i;
          const isReachable = activeIdx >= i || status === "Scheduled" || isOffTrack;
          return (
            <React.Fragment key={s.key}>
              <button
                type="button"
                onClick={() => isReachable && onStatusChange(s.key)}
                disabled={!isReachable}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  isActive
                    ? `${s.bg} ${s.color} border-transparent ring-2 ${s.ring} shadow-sm`
                    : isDone
                    ? `${s.bg} ${s.color} border-transparent opacity-80`
                    : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
                } ${!isReachable ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                title={isReachable ? `Set to ${s.label}` : `${s.label} (advance sequentially)`}
              >
                <StageIcon className={`w-3.5 h-3.5 ${isActive ? "animate-pulse" : ""}`} />
                {s.label}
              </button>
              {i < STAGES.length - 1 && (
                <div className={`h-0.5 flex-1 min-w-[16px] rounded-full transition-colors ${activeIdx > i ? "bg-emerald-400" : "bg-gray-200"}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Off-track statuses */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-gray-200/70">
        <span className="text-[11px] text-gray-400 mr-1">Mark as:</span>
        {OFF_TRACK.map((s) => {
          const OffIcon = s.icon;
          const isActive = status === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onStatusChange(s.key)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-all ${
                isActive
                  ? `${s.bg} ${s.color} border-transparent ring-2 ring-gray-300`
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <OffIcon className="w-3 h-3" />
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}