import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Radar, CalendarDays, X, FileDown, Loader2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { generateWeeklyMonitorReportPdf } from "@/components/news/weeklyMonitorReportPdf";
import NewsAlertsModal from "@/components/firms/NewsAlertsModal";
import FollowUpTaskPickerModal from "@/components/activity/FollowUpTaskPickerModal";
import ActivityLogPickerModal from "@/components/activity/ActivityLogPickerModal";
import TaskDetailModal from "@/components/activity/TaskDetailModal";
import ActivityDetailModal from "@/components/activity/ActivityDetailModal";
import ActivityTimeline from "@/components/activity/ActivityTimeline";
import ConferencesTab from "@/components/conferences/ConferencesTab";
import BoardMeetingsModal from "@/components/firms/BoardMeetingsModal";
import BoardMeetingAlertsTab from "@/components/firms/BoardMeetingAlertsTab";
import RfpRfiDashboard from "@/pages/RfpRfiDashboard";
import RfpRfiDueThisWeek from "@/components/firms/RfpRfiDueThisWeek";
import CoverageTracker from "@/pages/CoverageTracker";
import CoverageManagement from "@/pages/CoverageManagement";
import StaleContactRemindersPanel from "@/components/contacts/StaleContactRemindersPanel";
import ScoringAlertsTab from "@/components/templates/ScoringAlertsTab";
import ScoreTrendAnalyticsTab from "@/components/templates/ScoreTrendAnalyticsTab";
import MonitorModuleGrid from "@/components/monitor/MonitorModuleGrid";
import { MODULE_MAP } from "@/components/monitor/monitorModules";

export default function MonitorPage() {
  const navigate = useNavigate();
  const initialModule = new URLSearchParams(window.location.hash.split("?")[1] || "").get("tab") || null;
  const [activeModule, setActiveModule] = useState(initialModule);
  const [viewingTask, setViewingTask] = useState(null);
  const [viewingActivity, setViewingActivity] = useState(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const res = await base44.functions.invoke("generateWeeklyMonitorReport", { days: 7 });
      const report = res.data;
      if (!report || report.error) throw new Error(report?.error || "Failed to generate report");
      generateWeeklyMonitorReportPdf(report);
      toast({
        title: "Report downloaded",
        description: `${report.total_news} news, ${report.total_activities} activities, ${report.total_tasks} completed tasks.`,
      });
    } catch (e) {
      toast({ title: "Report failed", description: e.message, variant: "destructive" });
    }
    setGeneratingReport(false);
  };

  const activeLabel = activeModule ? MODULE_MAP[activeModule]?.label : null;

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* Page header */}
      <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-pink-800 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radar className="w-5 h-5" />
            <h1 className="text-base font-bold">Monitor</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/15"
              onClick={handleGenerateReport}
              disabled={generatingReport}
            >
              {generatingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              <span className="hidden sm:inline">{generatingReport ? "Generating..." : "Weekly Report"}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/15"
              onClick={() => navigate("/ActivityCalendar")}
            >
              <CalendarDays className="w-4 h-4" />
              <span className="hidden sm:inline">Open Calendar</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/15"
              onClick={() => navigate("/")}
              title="Close Monitor"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 pt-4 pb-12">
        {!activeModule && (
          <div className="mb-4">
            <RfpRfiDueThisWeek onOpenAll={() => setActiveModule("rfp-rfi")} />
          </div>
        )}

        {!activeModule ? (
          <MonitorModuleGrid onSelect={setActiveModule} />
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Button variant="outline" size="sm" onClick={() => setActiveModule(null)}>
                <ChevronLeft className="w-4 h-4" /> Back to Monitor
              </Button>
              <h2 className="text-lg font-semibold text-gray-800">{activeLabel}</h2>
            </div>

            {activeModule === "news" && (
              <NewsAlertsModal inline open onClose={() => {}} onFirmClick={() => {}} />
            )}
            {activeModule === "tasks" && (
              <FollowUpTaskPickerModal
                inline
                open
                onClose={() => {}}
                onAddTask={() => {}}
                onTaskClick={(task) => setViewingTask(task)}
              />
            )}
            {activeModule === "activity" && (
              <ActivityLogPickerModal
                inline
                open
                onClose={() => {}}
                onAddActivity={() => {}}
                onActivityClick={(activity) => setViewingActivity(activity)}
              />
            )}
            {activeModule === "stale-contacts" && (
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <StaleContactRemindersPanel onContactClick={() => navigate("/")} />
              </div>
            )}
            {activeModule === "scoring-alerts" && (
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <ScoringAlertsTab onProductClick={() => navigate("/")} />
              </div>
            )}
            {activeModule === "score-trends" && (
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <ScoreTrendAnalyticsTab onFirmClick={() => navigate("/")} />
              </div>
            )}
            {activeModule === "timeline" && (
              <ActivityTimeline onActivityClick={(activity) => setViewingActivity(activity)} />
            )}
            {activeModule === "conferences" && <ConferencesTab />}
            {activeModule === "board-meetings" && (
              <BoardMeetingsModal inline open onClose={() => {}} onFirmClick={() => navigate("/")} />
            )}
            {activeModule === "board-meeting-alerts" && (
              <BoardMeetingAlertsTab onFirmClick={() => navigate("/")} />
            )}
            {activeModule === "coverage" && <CoverageTracker />}
            {activeModule === "coverage-mgmt" && <CoverageManagement />}
            {activeModule === "rfp-rfi" && <RfpRfiDashboard inline />}
          </div>
        )}
      </div>

      {/* Detail modals (item clicks) */}
      <TaskDetailModal
        open={!!viewingTask}
        task={viewingTask}
        onClose={() => setViewingTask(null)}
        onFirmClick={() => setViewingTask(null)}
        onContactClick={() => setViewingTask(null)}
      />
      <ActivityDetailModal
        open={!!viewingActivity}
        activity={viewingActivity}
        onClose={() => setViewingActivity(null)}
        onOpenContact={() => setViewingActivity(null)}
        onFirmClick={() => setViewingActivity(null)}
        onContactClick={() => setViewingActivity(null)}
      />
    </div>
  );
}