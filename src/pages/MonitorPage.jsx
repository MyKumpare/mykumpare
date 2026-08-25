import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {   Radar, Newspaper, LayoutList, ClipboardList, CalendarDays, X, FileDown, Loader2, Activity as ActivityIcon, Bell } from "lucide-react";
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
import BoardMeetingAlertsTab from "@/components/firms/BoardMeetingAlertsTab";
import RfpRfiDashboard from "@/pages/RfpRfiDashboard";
import { FileSearch } from "lucide-react";

const TABS = [
  { key: "news", label: "News Alerts", icon: Newspaper },
  { key: "activity", label: "Activity", icon: ClipboardList },
  { key: "tasks", label: "Tasks", icon: LayoutList },
  { key: "conferences", label: "Conferences", icon: CalendarDays },
  { key: "board-meeting-alerts", label: "Bd Mtg Alerts", icon: Bell },
  { key: "timeline", label: "Timeline", icon: ActivityIcon },
  { key: "rfp-rfi", label: "RFP/RFI", icon: FileSearch },
];

export default function MonitorPage() {
  const navigate = useNavigate();
  const initialTab = new URLSearchParams(window.location.hash.split("?")[1] || "").get("tab") || "news";
  const [tab, setTab] = useState(initialTab);
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

      {/* Tabs + content */}
      <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 pt-4 pb-12">
        <div className="flex gap-1 border-b border-gray-200 mb-4 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? "border-rose-600 text-rose-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "news" && (
          <NewsAlertsModal inline open onClose={() => {}} onFirmClick={() => {}} />
        )}
        {tab === "tasks" && (
          <FollowUpTaskPickerModal
            inline
            open
            onClose={() => {}}
            onAddTask={() => {}}
            onTaskClick={(task) => setViewingTask(task)}
          />
        )}
        {tab === "activity" && (
          <ActivityLogPickerModal
            inline
            open
            onClose={() => {}}
            onAddActivity={() => {}}
            onActivityClick={(activity) => setViewingActivity(activity)}
          />
        )}
        {tab === "timeline" && (
          <ActivityTimeline
            onActivityClick={(activity) => setViewingActivity(activity)}
          />
        )}
        {tab === "conferences" && (
          <ConferencesTab />
        )}
        {tab === "board-meeting-alerts" && (
          <BoardMeetingAlertsTab onFirmClick={() => navigate("/")} />
        )}
        {tab === "rfp-rfi" && (
          <RfpRfiDashboard inline />
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