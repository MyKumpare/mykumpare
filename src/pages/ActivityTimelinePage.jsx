import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, GitBranch } from "lucide-react";
import ActivityTimeline from "@/components/activity/ActivityTimeline";
import { lazyDialog } from "@/components/common/lazyDialog";

const GlobalActivityLogModal = lazyDialog(() => import("@/components/activity/GlobalActivityLogModal"));
const ActivityDetailModal = lazyDialog(() => import("@/components/activity/ActivityDetailModal"));

// Dedicated full-page centralized activity timeline — every meeting, call,
// email, and interaction across all contacts in one chronological view. Users
// can search, filter by team member / engagement stage, group by date / firm /
// contact, log new activities, and drill into any interaction for the full
// relationship history at a glance.
export default function ActivityTimelinePage() {
  const navigate = useNavigate();
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [viewingActivity, setViewingActivity] = useState(null);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-gray-500 hover:text-gray-700"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Button>
          <div className="h-5 w-px bg-gray-200 hidden sm:block" />
          <div className="flex items-center gap-2 min-w-0">
            <GitBranch className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-gray-800 truncate">Activity Timeline</h1>
              <p className="text-[11px] text-gray-400 hidden sm:block">
                All meetings, calls &amp; interactions across every contact
              </p>
            </div>
          </div>
        </div>
        <Button
          size="sm"
          className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 flex-shrink-0"
          onClick={() => setLogModalOpen(true)}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Log Activity</span>
          <span className="sm:hidden">Log</span>
        </Button>
      </div>

      {/* Timeline */}
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <ActivityTimeline onActivityClick={(activity) => setViewingActivity(activity)} />
      </div>

      {/* Log Activity Modal */}
      <GlobalActivityLogModal
        open={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        onFirmClick={(f) => {
          setLogModalOpen(false);
          navigate("/");
        }}
        onContactClick={(c) => {
          setLogModalOpen(false);
          navigate("/");
        }}
      />

      {/* Activity Detail Modal */}
      <ActivityDetailModal
        open={!!viewingActivity}
        activity={viewingActivity}
        onClose={() => setViewingActivity(null)}
        onDeleted={() => setViewingActivity(null)}
      />
    </div>
  );
}