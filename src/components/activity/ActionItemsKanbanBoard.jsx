import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  KanbanSquare, Search, X, Flame, CalendarClock, Building2, AlertTriangle, Filter, List, LayoutGrid,
} from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { toast } from "@/components/ui/use-toast";
import TaskDetailModal from "@/components/activity/TaskDetailModal";
import ActionItemsListView from "@/components/activity/ActionItemsListView";
import { navigateToFirm, navigateToBoardMeeting } from "./actionItemNav";

// Column definitions: key = stored FollowUpTask.status value, label = friendly name.
const COLUMNS = [
  { key: "Not Started", label: "Pending",     accent: "bg-gray-400",  chip: "bg-gray-100 text-gray-600",  dot: "bg-gray-400" },
  { key: "In-process", label: "In Progress",  accent: "bg-blue-500",  chip: "bg-blue-100 text-blue-700",  dot: "bg-blue-500" },
  { key: "Completed",  label: "Completed",    accent: "bg-green-500", chip: "bg-green-100 text-green-700", dot: "bg-green-500" },
  { key: "Cancelled",  label: "Cancelled",     accent: "bg-red-400",   chip: "bg-red-100 text-red-700",   dot: "bg-red-400" },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

function dueColor(dueDate) {
  if (!dueDate) return "text-gray-400";
  const days = differenceInCalendarDays(new Date(dueDate), new Date(todayStr()));
  if (days < 0) return "text-red-600 font-semibold";
  if (days <= 3) return "text-amber-600 font-semibold";
  if (days <= 7) return "text-yellow-600";
  return "text-gray-500";
}

export default function ActionItemsKanbanBoard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [firmFilter, setFirmFilter] = useState("all");
  const [highPriorityOnly, setHighPriorityOnly] = useState(false);
  const [showCancelled, setShowCancelled] = useState(true);
  const [openTaskId, setOpenTaskId] = useState(null);
  const [viewMode, setViewMode] = useState("kanban"); // "kanban" | "list"

  const { data: allTasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["action_items_kanban_tasks"],
    queryFn: () => base44.entities.FollowUpTask.list("-due_date", 2000),
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["action_items_kanban_meetings"],
    queryFn: () => base44.entities.BoardMeeting.list("-meeting_date", 1000),
  });
  const meetingById = useMemo(() => {
    const m = {};
    (meetings || []).forEach(mt => { if (mt.id) m[mt.id] = mt; });
    return m;
  }, [meetings]);

  const { data: firms = [] } = useQuery({
    queryKey: ["action_items_kanban_firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 2000),
  });
  const firmById = useMemo(() => {
    const f = {};
    (firms || []).forEach(fw => { if (fw.id) f[fw.id] = fw; });
    return f;
  }, [firms]);

  // Only FollowUpTask records that came from board meeting extraction.
  const actionItems = useMemo(
    () => (allTasks || []).filter(t => !t.deleted_at && t.board_meeting_id),
    [allTasks]
  );

  const firmsWithItems = useMemo(() => {
    const ids = new Set(actionItems.map(t => t.originator_firm_id || t.assigned_to_firm_id).filter(Boolean));
    return (firms || []).filter(f => ids.has(f.id) && !f.deleted_at);
  }, [actionItems, firms]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return actionItems.filter(t => {
      if (!showCancelled && t.status === "Cancelled") return false;
      if (highPriorityOnly && !t.is_high_priority) return false;
      if (firmFilter !== "all") {
        const tFirm = t.originator_firm_id || t.assigned_to_firm_id;
        if (tFirm !== firmFilter) return false;
      }
      if (q) {
        const hay = `${t.task_description || ""} ${t.activity_label || ""} ${t.originator_firm_name || ""} ${t.assigned_to_firm_name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [actionItems, search, firmFilter, highPriorityOnly, showCancelled]);

  const byStatus = useMemo(() => {
    const map = {};
    COLUMNS.forEach(c => { map[c.key] = []; });
    filtered.forEach(t => {
      const key = (t.status && map[t.status] !== undefined) ? t.status : "Not Started";
      map[key].push(t);
    });
    return map;
  }, [filtered]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const patch = { status, status_date: todayStr() };
      // Keep per-assignment statuses in sync so the aggregate stays consistent.
      const fresh = await base44.entities.FollowUpTask.get(id).catch(() => null);
      if (fresh && Array.isArray(fresh.assignments) && fresh.assignments.length) {
        patch.assignments = fresh.assignments.map(a => ({ ...a, status, status_date: todayStr() }));
      }
      if (status === "Completed") patch.completion_date = todayStr();
      return base44.entities.FollowUpTask.update(id, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["action_items_kanban_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["follow_up_tasks_search"] });
    },
    onError: (err) => toast({ title: "Could not move task", description: err.message, variant: "destructive" }),
  });

  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    const newStatus = destination.droppableId;
    const oldStatus = source.droppableId;
    if (newStatus === oldStatus) return;
    updateMutation.mutate({ id: draggableId, status: newStatus });
  };

  const openTask = openTaskId ? (allTasks.find(t => t.id === openTaskId) || { id: openTaskId }) : null;

  const highPriorityCount = actionItems.filter(t => t.is_high_priority && t.status !== "Completed" && t.status !== "Cancelled").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <KanbanSquare className="w-5 h-5 text-indigo-600" />
        <h1 className="text-lg font-bold text-gray-800">Meeting Action Items Board</h1>
        <span className="text-xs text-gray-400">({actionItems.length} extracted)</span>
        {highPriorityCount > 0 && (
          <span className="inline-flex items-center gap-1 ml-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
            <Flame className="w-3 h-3" /> {highPriorityCount} high-priority open
          </span>
        )}
        <div className="ml-auto inline-flex items-center rounded-md border border-gray-200 bg-white p-0.5">
          <button
            onClick={() => setViewMode("kanban")}
            className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded transition-colors ${
              viewMode === "kanban" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
            }`}
            title="Kanban board view"
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Board
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded transition-colors ${
              viewMode === "list" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
            }`}
            title="Filterable list view"
          >
            <List className="w-3.5 h-3.5" /> List
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        {viewMode === "kanban"
          ? "Drag cards across stages to update status. High-priority follow-ups are highlighted so you can move them first."
          : "Filter action items by status, then click a firm or board meeting to jump straight to it."}
      </p>

      {/* Filters — only shown in kanban view (list view has its own filter bar) */}
      {viewMode === "kanban" && (
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action items…"
            className="pl-8 h-8 text-xs"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Select value={firmFilter} onValueChange={setFirmFilter}>
          <SelectTrigger className="h-8 text-xs w-[200px]">
            <SelectValue placeholder="All firms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All firms</SelectItem>
            {firmsWithItems.map(f => (
              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={highPriorityOnly ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={() => setHighPriorityOnly(v => !v)}
        >
          <Flame className="w-3.5 h-3.5" /> High priority
        </Button>
        <Button
          variant={showCancelled ? "secondary" : "outline"}
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={() => setShowCancelled(v => !v)}
        >
          {showCancelled ? "Hide" : "Show"} cancelled
        </Button>
        {(firmFilter !== "all" || highPriorityOnly || search) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs"
            onClick={() => { setFirmFilter("all"); setHighPriorityOnly(false); setSearch(""); }}>
            <Filter className="w-3.5 h-3.5" /> Clear
          </Button>
        )}
      </div>
      )}

      {/* Board / List */}
      {loadingTasks ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Loading action items…</div>
      ) : actionItems.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <KanbanSquare className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-500">No extracted action items yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Action items appear here after you run "Extract Actions" on a board meeting, or once the nightly extractor runs.
            </p>
          </div>
        </div>
      ) : viewMode === "list" ? (
        <ActionItemsListView
          tasks={filtered}
          meetings={meetings}
          onOpenTask={setOpenTaskId}
        />
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-3 flex-1 min-h-0">
            {COLUMNS.map(col => {
              const items = byStatus[col.key] || [];
              return (
                <div key={col.key} className="flex flex-col w-72 flex-shrink-0">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                    <span className="text-xs text-gray-400">({items.length})</span>
                    <div className="flex-1 h-0.5 rounded-full bg-gray-100 ml-1">
                      <div className={`h-full rounded-full ${col.accent}`} style={{ width: `${Math.min(100, (items.length / Math.max(1, filtered.length)) * 100)}%` }} />
                    </div>
                  </div>
                  <Droppable droppableId={col.key}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 rounded-xl border p-2 space-y-2 overflow-y-auto min-h-[120px] transition-colors ${
                          snapshot.isDraggingOver ? "bg-indigo-50/60 border-indigo-300" : "bg-gray-50/70 border-gray-200"
                        }`}
                      >
                        {items.length === 0 && (
                          <div className="text-[11px] text-gray-300 text-center py-4">Drop here</div>
                        )}
                        {items.map((t, idx) => (
                          <Draggable key={t.id} draggableId={t.id} index={idx}>
                            {(p, s) => (
                              <div
                                ref={p.innerRef}
                                {...p.draggableProps}
                                {...p.dragHandleProps}
                                onClick={() => setOpenTaskId(t.id)}
                                className={`group rounded-lg bg-white border p-2.5 shadow-sm hover:shadow-md cursor-pointer transition-shadow ${
                                  t.is_high_priority
                                    ? "border-red-300 ring-1 ring-red-200"
                                    : "border-gray-200"
                                } ${s.isDragging ? "shadow-lg opacity-90" : ""}`}
                              >
                                <div className="flex items-start gap-1.5">
                                  {t.is_high_priority && (
                                    <Flame className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                                  )}
                                  <p className="text-xs font-medium text-gray-800 line-clamp-3 flex-1">
                                    {t.task_description || "(no description)"}
                                  </p>
                                </div>
                                {t.activity_label && (
                                  <p className="text-[10px] text-gray-400 mt-1 truncate">{t.activity_label}</p>
                                )}
                                <div className="flex items-center justify-between gap-1 mt-2 flex-wrap">
                                  <button
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     const m = t.board_meeting_id ? meetingById[t.board_meeting_id] : null;
                                     navigateToFirm(navigate, t.originator_firm_id || t.assigned_to_firm_id || m?.firm_id);
                                   }}
                                   className="inline-flex items-center gap-1 text-[10px] text-gray-600 hover:text-indigo-600 hover:underline"
                                   title="Open firm profile"
                                  >
                                   <Building2 className="w-3 h-3" />
                                   {(() => {
                                     const m = t.board_meeting_id ? meetingById[t.board_meeting_id] : null;
                                     return t.assigned_to_firm_name || t.originator_firm_name || m?.firm_name || "—";
                                   })()}
                                  </button>
                                  {t.due_date && (
                                    <span className={`inline-flex items-center gap-1 text-[10px] ${dueColor(t.due_date)}`}>
                                      <CalendarClock className="w-3 h-3" />
                                      {format(new Date(t.due_date), "MMM d")}
                                    </span>
                                  )}
                                </div>
                                {t.board_meeting_id && meetingById[t.board_meeting_id] && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigateToBoardMeeting(navigate, meetingById[t.board_meeting_id].firm_id);
                                    }}
                                    className="mt-1 inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-indigo-600 hover:underline"
                                    title="Open board meeting"
                                  >
                                    <KanbanSquare className="w-3 h-3" />
                                    {meetingById[t.board_meeting_id].title}
                                  </button>
                                )}
                                {t.is_high_priority && (
                                  <div className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                                    <AlertTriangle className="w-2.5 h-2.5" /> HIGH PRIORITY
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {openTask && (
        <TaskDetailModal
          open={!!openTask}
          task={openTask}
          onClose={() => setOpenTaskId(null)}
        />
      )}
    </div>
  );
}