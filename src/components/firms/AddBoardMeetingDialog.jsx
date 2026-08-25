import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X, FileText, Loader2, CalendarClock } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const FORMAT_OPTS = [
  { value: "unknown", label: "—" },
  { value: "in-person", label: "In-Person" },
  { value: "virtual", label: "Virtual" },
  { value: "hybrid", label: "Hybrid" },
];
const SESSION_OPTS = [
  { value: "unknown", label: "—" },
  { value: "public_meeting", label: "Public Meeting" },
  { value: "closed_session", label: "Closed Session" },
];

// Dialog to manually create a board meeting for a firm, optionally applying
// a board meeting template (agenda sections, notes template, default topics/format).
export default function AddBoardMeetingDialog({ open, onClose, firmId, firmName }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [format, setFormat] = useState("unknown");
  const [sessionType, setSessionType] = useState("unknown");
  const [topics, setTopics] = useState([]);
  const [topicInput, setTopicInput] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ["board-meeting-templates"],
    queryFn: () => base44.entities.BoardMeetingTemplate.list("name", 200),
    enabled: open,
  });

  const templateMap = useMemo(() => {
    const m = {};
    (templates || []).forEach((t) => { m[t.id] = t; });
    return m;
  }, [templates]);

  const applyTemplate = (id) => {
    setTemplateId(id);
    const t = id ? templateMap[id] : null;
    if (!t) {
      return;
    }
    if (t.default_title) setTitle(t.default_title);
    if (t.default_topics?.length) setTopics(t.default_topics);
    if (t.default_meeting_format) setFormat(t.default_meeting_format);
    if (t.default_session_type) setSessionType(t.default_session_type);
  };

  const addTopic = () => {
    const v = topicInput.trim();
    if (!v) return;
    if (!topics.includes(v)) setTopics([...topics, v]);
    setTopicInput("");
  };
  const removeTopic = (idx) => setTopics(topics.filter((_, i) => i !== idx));

  const reset = () => {
    setTemplateId(""); setTitle(""); setMeetingDate(""); setEndDate("");
    setLocation(""); setFormat("unknown"); setSessionType("unknown");
    setTopics([]); setTopicInput("");
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (!meetingDate) {
      toast({ title: "Meeting date is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const tpl = templateId ? templateMap[templateId] : null;
      const record = {
        tenant_id: user?.linked_firm_id,
        firm_id: firmId,
        firm_name: firmName,
        title: title.trim(),
        meeting_date: meetingDate,
        end_date: endDate || undefined,
        location: location.trim() || undefined,
        meeting_format: format,
        session_type: sessionType,
        meeting_topics: topics,
        applied_template_id: tpl?.id || undefined,
        applied_template_name: tpl?.name || undefined,
        agenda_sections: tpl?.agenda_sections?.length
          ? tpl.agenda_sections.map((s) => ({ id: crypto.randomUUID(), title: s.title, description: s.description || "", notes: "" }))
          : [],
        notes_template: tpl?.notes_template || undefined,
        status: "upcoming",
      };
      const created = await base44.entities.BoardMeeting.create(record);
      // Spawn prep checklist action items from the template onto the new meeting
      const checklistItems = (tpl?.prep_checklist || []).filter((c) => c.description?.trim());
      if (checklistItems.length) {
        const taskRecords = checklistItems.map((c) => ({
          originator_contact_id: "board-meeting-template",
          originator_contact_name: "Board Meeting Template",
          due_date: meetingDate,
          task_description: c.description.trim(),
          status: "Not Started",
          is_high_priority: !!c.is_high_priority,
          board_meeting_id: created.id,
          assigned_to_firm_id: firmId,
          assigned_to_firm_name: firmName,
          activity_label: title.trim(),
        }));
        await base44.entities.FollowUpTask.bulkCreate(taskRecords);
      }
      queryClient.invalidateQueries({ queryKey: ["board-meetings", firmId] });
      queryClient.invalidateQueries({ queryKey: ["board-meetings-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["board-meetings-all"] });
      queryClient.invalidateQueries({ queryKey: ["board-meeting-action-tasks"] });
      toast({ title: "Board meeting created", description: tpl ? `Applied template: ${tpl.name}${checklistItems.length ? ` · ${checklistItems.length} prep action item${checklistItems.length === 1 ? "" : "s"} created` : ""}` : undefined });
      reset();
      onClose();
    } catch (err) {
      toast({ title: "Failed to create meeting", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-cyan-600" />
            Add Board Meeting
            <span className="text-xs text-gray-400 font-normal">— {firmName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-3 pr-1">
          {/* Template picker */}
          <div>
            <label className="text-xs font-medium text-gray-600">Apply template (optional)</label>
            <select
              value={templateId}
              onChange={(e) => applyTemplate(e.target.value)}
              className="mt-1 w-full h-9 rounded-md border border-gray-200 px-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
            >
              <option value="">— None —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.agenda_sections?.length ? ` (${t.agenda_sections.length} sections)` : ""}</option>
              ))}
            </select>
            {templateId && templateMap[templateId]?.agenda_sections?.length > 0 && (
              <div className="mt-1.5 rounded-md border border-cyan-200 bg-cyan-50 p-2">
                <div className="text-[10px] font-semibold text-cyan-700 uppercase mb-1">Agenda sections applied</div>
                <ol className="space-y-0.5">
                  {templateMap[templateId].agenda_sections.map((s, i) => (
                    <li key={s.id || i} className="text-[11px] text-cyan-800"><span className="font-semibold">{i + 1}.</span> {s.title}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-gray-600">Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full h-9 rounded-md border border-gray-200 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400" placeholder="Board meeting title" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Meeting date *</label>
              <input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} className="mt-1 w-full h-9 rounded-md border border-gray-200 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">End date (optional)</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full h-9 rounded-md border border-gray-200 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-gray-600">Location</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 w-full h-9 rounded-md border border-gray-200 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400" placeholder="City, address, or venue" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Format</label>
              <select value={format} onChange={(e) => setFormat(e.target.value)} className="mt-1 w-full h-9 rounded-md border border-gray-200 px-2 text-sm bg-white">
                {FORMAT_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Session type</label>
              <select value={sessionType} onChange={(e) => setSessionType(e.target.value)} className="mt-1 w-full h-9 rounded-md border border-gray-200 px-2 text-sm bg-white">
                {SESSION_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">Topics</label>
            <div className="mt-1 flex gap-1">
              <input
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTopic(); } }}
                className="flex-1 h-9 rounded-md border border-gray-200 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400"
                placeholder="Type a topic and press Enter"
              />
              <Button type="button" variant="outline" size="sm" className="h-9" onClick={addTopic}><Plus className="w-3.5 h-3.5" /> Add</Button>
            </div>
            {topics.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {topics.map((tp, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                    {tp}
                    <button type="button" onClick={() => removeTopic(i)} className="text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button type="button" variant="outline" size="sm" onClick={() => { reset(); onClose(); }} disabled={saving}>Cancel</Button>
          <Button type="button" size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white gap-1" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            Create meeting
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}