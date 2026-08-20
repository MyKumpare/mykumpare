import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, Clock, AlertCircle, Calendar, User, Loader2, ClipboardList,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/components/ui/use-toast";
import { lazyDialog } from "@/components/common/lazyDialog";

const TaskDetailModal = lazyDialog(() => import("@/components/activity/TaskDetailModal"));

const STATUS_STYLES = {
  "Not Started": { color: "text-gray-500", bg: "bg-gray-100", icon: Clock },
  "In-process": { color: "text-blue-600", bg: "bg-blue-50", icon: AlertCircle },
  "Completed": { color: "text-green-600", bg: "bg-green-50", icon: CheckCircle2 },
  "Cancelled": { color: "text-red-500", bg: "bg-red-50", icon: AlertCircle },
};

function fmt(dateStr) {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy"); } catch { return dateStr; }
}

/**
 * Side panel showing all upcoming (non-completed, non-cancelled) follow-up
 * tasks for a contact — both tasks they originated and tasks assigned to them.
 * Each task has an inline "Mark Complete" action.
 */
export default function ContactUpcomingTasksPanel({ contactId, contactName }) {
  const queryClient = useQueryClient();
  const [detailTask, setDetailTask] = useState(null);
  const [completingId, setCompletingId] = useState(null);

  const { data: originatedTasks = [], isLoading: loadingOriginated } = useQuery({
    queryKey: ["follow_up_tasks", contactId],
    queryFn: () => base44.entities.FollowUpTask.filter({ originator_contact_id: contactId }, "due_date"),
    enabled: !!contactId,
  });

  const { data: assignedTasks = [], isLoading: loadingAssigned } = useQuery({
    queryKey: ["follow_up_tasks_assigned", contactId],
    queryFn: async () => {
      const allTasks = await base44.entities.FollowUpTask.list();
      return allTasks.filter(t =>
        (t.assignments || []).some(a => a.contact_id === contactId) &&
        t.originator_contact_id !== contactId
      );
    },
    enabled: !!contactId,
  });

  const allTasks = [...originatedTasks, ...assignedTasks];
  const upcoming = allTasks
    .filter(t => t.status !== "Completed" && t.status !== "Cancelled")
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const isLoading = loadingOriginated || loadingAssigned;

  const handleMarkComplete = async (task) => {
    setCompletingId(task.id);
    try {
      const today = new Date().toISOString().split("T")[0];
      const updatedAssignments = (task.assignments || []).map(a =>
        a.contact_id === contactId
          ? { ...a, status: "Completed", status_date: today }
          : a
      );
      const allComplete = updatedAssignments.length > 0 && updatedAssignments.every(a => a.status === "Completed");
      await base44.entities.FollowUpTask.update(task.id, {
        status: "Completed",
        status_date: today,
        completion_date: today,
        assignments: updatedAssignments,
      });
      queryClient.invalidateQueries({ queryKey: ["follow_up_tasks", contactId] });
      queryClient.invalidateQueries({ queryKey: ["follow_up_tasks_assigned", contactId] });
      queryClient.invalidateQueries({ queryKey: ["follow_up_tasks_search"] });
      toast({ title: "Task completed", description: "Marked as complete." });
    } catch (err) {
      toast({ title: "Failed to complete task", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1.5 px-1 pb-2 border-b border-gray-100">
        <ClipboardList className="w-4 h-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-gray-700">Upcoming Tasks</h3>
        {upcoming.length > 0 && (
          <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">{upcoming.length}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-2 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-4 h-4 text-gray-300 animate-spin" />
          </div>
        ) : upcoming.length === 0 ? (
          <div className="text-xs text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl">
            No upcoming follow-up tasks
          </div>
        ) : (
          upcoming.map(task => {
            const s = STATUS_STYLES[task.status] || STATUS_STYLES["Not Started"];
            const StatusIcon = s.icon;
            const isOverdue = task.due_date && new Date(task.due_date) < new Date(new Date().toDateString());
            return (
              <div key={task.id} className={`rounded-lg border ${s.border} bg-white overflow-hidden`}>
                <button
                  type="button"
                  onClick={() => setDetailTask(task)}
                  className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                      <StatusIcon className={`w-3 h-3 ${s.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.bg} ${s.color}`}>{task.status}</span>
                        <span className={`text-xs flex items-center gap-1 ${isOverdue ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                          <Calendar className="w-3 h-3" /> {fmt(task.due_date)}
                          {isOverdue && <span className="text-[9px]">· Overdue</span>}
                        </span>
                      </div>
                      {task.task_description && (
                        <div className="text-xs text-gray-600 mt-1 line-clamp-2 quill-preview" dangerouslySetInnerHTML={{ __html: task.task_description }} />
                      )}
                      {task.assigned_to_contact_name && (
                        <span className="text-[10px] text-indigo-600 flex items-center gap-1 mt-1">
                          <User className="w-2.5 h-2.5" /> {task.assigned_to_contact_name}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                <div className="px-3 pb-2.5 flex items-center justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 text-green-600 border-green-200 hover:bg-green-50"
                    onClick={() => handleMarkComplete(task)}
                    disabled={completingId === task.id}
                  >
                    {completingId === task.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Mark Complete
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <TaskDetailModal
        open={!!detailTask}
        task={detailTask}
        onClose={() => setDetailTask(null)}
        onFirmClick={() => setDetailTask(null)}
        onContactClick={() => setDetailTask(null)}
      />
    </div>
  );
}