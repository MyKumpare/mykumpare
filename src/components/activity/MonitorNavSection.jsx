import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Radar, ClipboardList, CalendarDays, LayoutList, Plus, ChevronRight, ChevronDown, ExternalLink, Newspaper,
} from "lucide-react";

/**
 * Monitor navigation section.
 * Renders Monitor as a parent row with Activity, Calendar, Tasks, and News Alerts as
 * indented sub-items (expandable/collapsible), mirroring the Due Diligence
 * nav section pattern and the header "Monitor" icon's submenu.
 */
export default function MonitorNavSection({
  activitiesCount,
  tasksCount,
  newsCount,
  onOpenMonitor,
  onOpenActivity,
  onAddActivity,
  onOpenCalendar,
  onOpenTasks,
  onAddTasks,
  onOpenNews,
  forceExpanded,
}) {
  const [expanded, setExpanded] = useState(false);
  const isExpanded = forceExpanded !== undefined ? forceExpanded : expanded;

  const subItems = [
    {
      label: "Activity",
      icon: ClipboardList,
      iconColor: "text-amber-500",
      count: activitiesCount,
      onOpen: onOpenActivity,
      onAdd: onAddActivity,
      addLabel: "Add Activity",
      addColor: "text-amber-600",
      addHoverColor: "hover:text-amber-700",
      addHoverBg: "hover:bg-amber-50",
    },
    {
      label: "Calendar",
      icon: CalendarDays,
      iconColor: "text-rose-500",
      count: null,
      onOpen: onOpenCalendar,
      onAdd: null,
    },
    {
      label: "Tasks",
      icon: LayoutList,
      iconColor: "text-orange-500",
      count: tasksCount,
      onOpen: onOpenTasks,
      onAdd: onAddTasks,
      addLabel: "Add Task",
      addColor: "text-orange-600",
      addHoverColor: "hover:text-orange-700",
      addHoverBg: "hover:bg-orange-50",
    },
    {
      label: "News Alerts",
      icon: Newspaper,
      iconColor: "text-rose-500",
      count: newsCount,
      onOpen: onOpenNews,
      onAdd: null,
    },
  ];

  return (
    <div className="mb-6">
      {/* Parent row: Monitor */}
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center group"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded
              ? <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
              : <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
            }
          </button>
          <button onClick={onOpenMonitor} className="flex items-center gap-2 group">
            <Radar className="w-4 h-4 text-rose-600" />
            <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">Monitor</span>
            <span className="text-xs text-gray-400 font-normal">({(activitiesCount ?? 0) + (tasksCount ?? 0)})</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1 text-xs"
            onClick={onOpenCalendar}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Calendar
          </Button>
        </div>
      </div>

      {/* Nested sub-items */}
      {isExpanded && (
        <div className="ml-6 mt-1 space-y-1 border-l border-gray-200 pl-3">
          {subItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center justify-between px-1 py-1 rounded-lg hover:bg-gray-50">
                <button onClick={item.onOpen} className="flex items-center gap-2 group flex-1">
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                  <Icon className={`w-4 h-4 ${item.iconColor}`} />
                  <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900">{item.label}</span>
                  {item.count !== null && (
                    <span className="text-xs text-gray-400 font-normal">({item.count ?? 0})</span>
                  )}
                </button>
                {item.onAdd && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 px-2 ${item.addColor} ${item.addHoverColor} ${item.addHoverBg} gap-1 text-xs`}
                    onClick={item.onAdd}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {item.addLabel}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}