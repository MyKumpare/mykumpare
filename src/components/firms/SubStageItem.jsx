import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DatePicker from "@/components/ui/date-picker";
import { Play, CheckCircle2, Circle, Clock, UserPlus, Trash2, ChevronDown, ChevronRight, Paperclip, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const generateId = () => `asg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
const generateAttachmentId = () => `att_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const STATUS_CONFIG = {
  not_started: { label: "Not Started", icon: Circle, badgeClass: "bg-gray-100 text-gray-500", iconClass: "text-gray-300", bgClass: "bg-gray-50 border-gray-200" },
  in_process: { label: "In Process", icon: Clock, badgeClass: "bg-blue-100 text-blue-700", iconClass: "text-blue-600", bgClass: "bg-blue-50 border-blue-200" },
  completed: { label: "Completed", icon: CheckCircle2, badgeClass: "bg-emerald-100 text-emerald-700", iconClass: "text-emerald-600", bgClass: "bg-emerald-50 border-emerald-200" },
};

/**
 * Renders a single sub-stage with status tracking, dates, performer,
 * and team member assignments.
 *
 * Props:
 *   subStage: { id, name, status, start_date, end_date, performed_by_*, assignments }
 *   primaryAnalystId: string
 *   primaryAnalystName: string
 *   teamMembers: [{ value, label }]
 *   onChange: (updatedSubStage) => void
 */
export default function SubStageItem({ subStage, primaryAnalystId, primaryAnalystName, teamMembers = [], onChange }) {
  const [expanded, setExpanded] = useState(false);

  const status = subStage.status || "not_started";
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
  const StatusIcon = statusCfg.icon;
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const assignments = subStage.assignments || [];

  const update = (updates) => onChange({ ...subStage, ...updates });

  const handleStart = () => {
    update({
      status: "in_process",
      start_date: subStage.start_date || todayStr,
      performed_by_contact_id: subStage.performed_by_contact_id || primaryAnalystId,
      performed_by_name: subStage.performed_by_name || primaryAnalystName,
    });
  };

  const handleComplete = () => {
    update({ status: "completed", end_date: todayStr });
  };

  const handleReopen = () => {
    update({ status: "in_process", end_date: null });
  };

  const addAssignment = () => {
    update({
      assignments: [...assignments, {
        id: generateId(),
        contact_id: "",
        contact_name: "",
        assigned_date: todayStr,
        due_date: "",
        status: "not_started",
        status_date: todayStr,
        notes: "",
      }],
    });
  };

  const updateAssignment = (id, changes) => {
    update({ assignments: assignments.map((a) => (a.id === id ? { ...a, ...changes } : a)) });
  };

  const removeAssignment = (id) => {
    update({ assignments: assignments.filter((a) => a.id !== id) });
  };

  // ─── File attachments ───
  const attachments = subStage.attachments || [];
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      update({
        attachments: [...attachments, {
          id: generateAttachmentId(),
          name: file.name,
          file_url,
          file_type: file.type || file.name.split(".").pop() || "",
          uploaded_at: new Date().toISOString(),
        }],
      });
    } catch (err) {
      console.error("File upload failed", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (id) => {
    update({ attachments: attachments.filter((a) => a.id !== id) });
  };

  return (
    <div className={cn("rounded-md border px-2 py-1.5 transition-colors", statusCfg.bgClass)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <StatusIcon className={cn("w-3.5 h-3.5 shrink-0", statusCfg.iconClass)} />

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-gray-600 shrink-0"
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>

        <span className={cn("text-xs font-medium flex-1 truncate", status === "completed" ? "text-emerald-700" : "text-gray-700")}>
          {subStage.name || "Unnamed sub-stage"}
        </span>

        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0", statusCfg.badgeClass)}>
          {statusCfg.label}
        </span>

        {status === "not_started" && (
          <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] px-2 shrink-0" onClick={handleStart}>
            <Play className="w-2.5 h-2.5" /> Start
          </Button>
        )}
        {status === "in_process" && (
          <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] px-2 shrink-0 border-emerald-300 text-emerald-600 hover:bg-emerald-50" onClick={handleComplete}>
            <CheckCircle2 className="w-2.5 h-2.5" /> Complete
          </Button>
        )}
        {status === "completed" && (
          <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px] px-2 shrink-0 text-gray-500" onClick={handleReopen}>
            Reopen
          </Button>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-2 space-y-2 pl-5">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <Label className="text-[10px] text-gray-500">Start Date</Label>
              <DatePicker value={subStage.start_date || ""} onChange={(d) => update({ start_date: d })} allowEmpty className="h-7 text-xs" />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] text-gray-500">End Date</Label>
              <DatePicker value={subStage.end_date || ""} onChange={(d) => update({ end_date: d })} allowEmpty className="h-7 text-xs" />
            </div>
          </div>

          {/* Performed by */}
          <div className="space-y-0.5">
            <Label className="text-[10px] text-gray-500">Performed By</Label>
            <Select
              value={subStage.performed_by_contact_id || undefined}
              onValueChange={(v) => {
                const member = teamMembers.find((m) => m.value === v);
                update({ performed_by_contact_id: v, performed_by_name: member?.label || primaryAnalystName });
              }}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Select performer..." />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Attachments */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-gray-500">Attachments</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-indigo-600" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                {uploading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Paperclip className="w-2.5 h-2.5" />} Upload
              </Button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
            </div>
            {attachments.length === 0 ? (
              <p className="text-[10px] text-gray-400 italic">No attachments</p>
            ) : (
              <div className="space-y-0.5">
                {attachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-1 rounded border border-gray-200 bg-white px-1.5 py-1">
                    <FileText className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                    <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-600 hover:underline truncate flex-1" title={att.name}>
                      {att.name}
                    </a>
                    <button type="button" className="text-gray-300 hover:text-red-500 shrink-0" onClick={() => removeAttachment(att.id)}>
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assignments */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-gray-500">Assignments</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-indigo-600" onClick={addAssignment}>
                <UserPlus className="w-2.5 h-2.5" /> Assign Member
              </Button>
            </div>
            {assignments.length === 0 ? (
              <p className="text-[10px] text-gray-400 italic">No assignments</p>
            ) : (
              <div className="space-y-1">
                {assignments.map((a) => (
                  <div key={a.id} className="rounded border border-gray-200 bg-white p-1.5 space-y-1">
                    <div className="flex items-center gap-1">
                      <Select
                        value={a.contact_id || undefined}
                        onValueChange={(v) => {
                          const member = teamMembers.find((m) => m.value === v);
                          updateAssignment(a.id, { contact_id: v, contact_name: member?.label || "" });
                        }}
                      >
                        <SelectTrigger className="h-6 text-[10px] flex-1">
                          <SelectValue placeholder="Select team member..." />
                        </SelectTrigger>
                        <SelectContent>
                          {teamMembers.map((m) => (
                            <SelectItem key={m.value} value={m.value} className="text-[10px]">{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 shrink-0" onClick={() => removeAssignment(a.id)}>
                        <Trash2 className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <div>
                        <Label className="text-[9px] text-gray-400">Assigned</Label>
                        <DatePicker value={a.assigned_date || ""} onChange={(d) => updateAssignment(a.id, { assigned_date: d, status_date: todayStr })} allowEmpty className="h-6 text-[10px]" />
                      </div>
                      <div>
                        <Label className="text-[9px] text-gray-400">Due Date</Label>
                        <DatePicker value={a.due_date || ""} onChange={(d) => updateAssignment(a.id, { due_date: d })} allowEmpty className="h-6 text-[10px]" />
                      </div>
                      <div>
                        <Label className="text-[9px] text-gray-400">Status</Label>
                        <Select
                          value={a.status || "not_started"}
                          onValueChange={(v) => updateAssignment(a.id, { status: v, status_date: todayStr })}
                        >
                          <SelectTrigger className="h-6 text-[10px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not_started" className="text-[10px]">Not Started</SelectItem>
                            <SelectItem value="in_process" className="text-[10px]">In Process</SelectItem>
                            <SelectItem value="completed" className="text-[10px]">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}