import React, { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Upload, FileText, Trash2, Plus, X, Save, Loader2, FileDown,
} from "lucide-react";
import { generateOnsiteVisitPdf } from "./onsiteVisitPdf";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import XponanceContactPicker from "@/components/xponance/XponanceContactPicker";
import AttachmentSummary from "./AttachmentSummary";

const todayISO = () => format(new Date(), "yyyy-MM-dd");
const newId = () => crypto.randomUUID();

export default function OnsiteVisitDialog({ open, onOpenChange, firm, editingVisit, defaultAnalystId, defaultAnalystName, visitRule, onSaved }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [targetDate, setTargetDate] = useState("");
  const [actualDate, setActualDate] = useState("");
  const [analystId, setAnalystId] = useState("");
  const [analystName, setAnalystName] = useState("");
  const [onsiteType, setOnsiteType] = useState("In-person");
  const [status, setStatus] = useState("Scheduled");
  const [agenda, setAgenda] = useState("");
  const [notes, setNotes] = useState("");
  const [followUpItems, setFollowUpItems] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [followUpTasks, setFollowUpTasks] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingVisit) {
      setTargetDate(editingVisit.target_visit_date || "");
      setActualDate(editingVisit.actual_visit_date || "");
      setAnalystId(editingVisit.visiting_analyst_contact_id || "");
      setAnalystName(editingVisit.visiting_analyst_name || "");
      setOnsiteType(editingVisit.onsite_type || "In-person");
      setStatus(editingVisit.status || "Scheduled");
      setAgenda(editingVisit.agenda || "");
      setNotes(editingVisit.notes || "");
      setFollowUpItems(editingVisit.follow_up_items || []);
      setAttachments(editingVisit.attachments || []);
      setFollowUpTasks([]);
    } else {
      setTargetDate(visitRule?.auto_deadline_days ? computeAutoDate(visitRule) : todayISO());
      setActualDate("");
      setAnalystId(defaultAnalystId || visitRule?.visiting_analyst_contact_id || "");
      setAnalystName(defaultAnalystName || visitRule?.visiting_analyst_name || "");
      setOnsiteType(visitRule?.onsite_type || "In-person");
      setStatus("Scheduled");
      setAgenda("");
      setNotes("");
      setFollowUpItems([]);
      setAttachments([]);
      setFollowUpTasks([]);
    }
  }, [open, editingVisit, defaultAnalystId, defaultAnalystName, visitRule]);

  function computeAutoDate(rule) {
    const days = rule.auto_deadline_days || rule.visit_cycle_days || 90;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return format(d, "yyyy-MM-dd");
  }

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const drafts = [];
    for (const file of Array.from(files)) {
      try {
        const res = await base44.integrations.Core.UploadFile({ file });
        const file_url = res?.file_url || "";
        if (!file_url) continue;
        drafts.push({
          id: newId(),
          name: file.name,
          file_url,
          file_type: file.type || file.name.split(".").pop() || "",
          uploaded_at: new Date().toISOString(),
        });
      } catch {
        toast({ title: "Upload failed", description: file.name, variant: "destructive" });
      }
    }
    setAttachments((prev) => [...prev, ...drafts]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id) => setAttachments((prev) => prev.filter((a) => a.id !== id));
  const updateAttachment = (id, patch) => setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const addFollowUpItem = () => setFollowUpItems((prev) => [...prev, { id: newId(), description: "", collected: false }]);
  const updateFollowUpItem = (id, patch) => setFollowUpItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const removeFollowUpItem = (id) => setFollowUpItems((prev) => prev.filter((i) => i.id !== id));

  const addFollowUpTask = () => setFollowUpTasks((prev) => [...prev, { id: newId(), description: "", due_date: "", assignee_id: "", assignee_name: "" }]);
  const updateFollowUpTask = (id, patch) => setFollowUpTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const removeFollowUpTask = (id) => setFollowUpTasks((prev) => prev.filter((t) => t.id !== id));

  const handleSave = async () => {
    if (!targetDate) {
      toast({ title: "Target visit date required", variant: "destructive" });
      return;
    }
    if (!analystId) {
      toast({ title: "Visiting analyst required", description: "Select an Xponance contact as the visiting analyst.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const isComplete = status === "Completed";
      const resolvedActualDate = isComplete ? (actualDate || todayISO()) : (actualDate || "");

      const visitPayload = {
        firm_id: firm.id,
        firm_name: firm.name,
        tenant_id: user?.linked_firm_id,
        target_visit_date: targetDate,
        actual_visit_date: resolvedActualDate || undefined,
        visiting_analyst_contact_id: analystId,
        visiting_analyst_name: analystName,
        onsite_type: onsiteType,
        status,
        agenda: agenda || undefined,
        notes: notes || undefined,
        follow_up_items: followUpItems.filter((i) => i.description?.trim()),
        attachments,
        visit_rule_id: visitRule?.id || editingVisit?.visit_rule_id || undefined,
        created_by_name: user?.full_name || "",
      };

      let savedVisit;
      let existingTaskIds = editingVisit?.follow_up_task_ids || [];

      if (editingVisit) {
        savedVisit = await base44.entities.OnsiteVisit.update(editingVisit.id, visitPayload);
      } else {
        savedVisit = await base44.entities.OnsiteVisit.create(visitPayload);
      }

      // Copy attachments to FirmDocument table so they appear in the Documents tab
      const newAttachments = [];
      for (const att of attachments) {
        if (att.firm_document_id) {
          newAttachments.push(att);
          continue;
        }
        try {
          const doc = await base44.entities.FirmDocument.create({
            firm_id: firm.id,
            firm_name: firm.name,
            tenant_id: user?.linked_firm_id,
            file_url: att.file_url,
            file_name: att.name,
            file_type: att.file_type,
            entry_date: todayISO(),
            categories: ["Onsite Visit"],
            description: `Attached to onsite visit (${targetDate})`,
          });
          newAttachments.push({ ...att, firm_document_id: doc.id });
        } catch {
          newAttachments.push(att);
        }
      }
      if (JSON.stringify(newAttachments) !== JSON.stringify(attachments)) {
        savedVisit = await base44.entities.OnsiteVisit.update(savedVisit.id, { attachments: newAttachments });
      }

      // Create new follow-up tasks (only new ones with descriptions + due dates)
      const newTaskIds = [...existingTaskIds];
      for (const ft of followUpTasks) {
        if (!ft.description?.trim() || !ft.due_date) continue;
        try {
          const task = await base44.entities.FollowUpTask.create({
            originator_contact_id: user?.linked_contact_id || analystId,
            originator_contact_name: user?.full_name || analystName,
            originator_firm_id: user?.linked_firm_id,
            originator_firm_name: user?.linked_firm_name || "",
            due_date: ft.due_date,
            task_description: ft.description,
            status: "Not Started",
            assigned_to_contact_id: ft.assignee_id || analystId,
            assigned_to_contact_name: ft.assignee_name || analystName,
            assigned_to_firm_id: firm.id,
            assigned_to_firm_name: firm.name,
            assignments: [{
              id: newId(),
              contact_id: ft.assignee_id || analystId,
              contact_name: ft.assignee_name || analystName,
              firm_id: firm.id,
              firm_name: firm.name,
              status: "Not Started",
            }],
          });
          newTaskIds.push(task.id);

          // Create deadline notification for the assignee
          const daysAway = Math.ceil((new Date(ft.due_date) - new Date()) / 86400000);
          await base44.entities.DdNotification.create({
            contact_id: ft.assignee_id || analystId,
            contact_name: ft.assignee_name || analystName,
            type: "deadline_approaching",
            title: `Onsite visit follow-up task due`,
            message: `Follow-up task from ${firm.name} onsite visit (${targetDate}): "${ft.description}" is due ${ft.due_date}.`,
            firm_name: firm.name,
            deadline_date: ft.due_date,
            deadline_type: "task_assignment",
            deadline_days_away: daysAway,
            status: "unread",
          });
        } catch (e) {
          console.error("Failed to create follow-up task:", e);
        }
      }

      if (newTaskIds.length !== existingTaskIds.length) {
        await base44.entities.OnsiteVisit.update(savedVisit.id, { follow_up_task_ids: newTaskIds });
      }

      // Create a notification for the visiting analyst (if newly assigned)
      if (!editingVisit || editingVisit.visiting_analyst_contact_id !== analystId) {
        try {
          await base44.entities.DdNotification.create({
            contact_id: analystId,
            contact_name: analystName,
            type: "coverage_assignment",
            title: `Onsite visit assigned: ${firm.name}`,
            message: `You have been assigned as the visiting analyst for ${firm.name}. Target visit date: ${targetDate}. Type: ${onsiteType}.`,
            firm_name: firm.name,
            coverage_role: "primary",
            status: "unread",
          });
        } catch (e) {
          console.error("Failed to create visit notification:", e);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["onsite-visits", firm.id] });
      queryClient.invalidateQueries({ queryKey: ["firm-documents", firm.id] });
      toast({ title: editingVisit ? "Visit updated" : "Visit created" });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Could not save visit", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingVisit ? "Edit Onsite Visit" : "Add Onsite Visit"} — {firm?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Basic info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Target Visit Date *</Label>
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Actual Visit Date</Label>
              <Input type="date" value={actualDate} onChange={(e) => setActualDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Onsite Type</Label>
              <Select value={onsiteType} onValueChange={setOnsiteType}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="In-person">In-person</SelectItem>
                  <SelectItem value="Virtual">Virtual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                  <SelectItem value="No-show">No-show</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Visiting analyst */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Visiting Analyst (Xponance Contact) *</Label>
            <XponanceContactPicker
              label="Visiting Analyst"
              value={analystId ? { contact_id: analystId, contact_name: analystName } : null}
              onChange={(id, name) => { setAnalystId(id); setAnalystName(name); }}
              onClear={() => { setAnalystId(""); setAnalystName(""); }}
              editing={true}
            />
            <p className="text-[11px] text-gray-400">Defaults to the firm's primary Xponance contact. The assigned analyst will see this visit in their tasks and notifications.</p>
          </div>

          {/* Agenda */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Agenda</Label>
            <Textarea
              placeholder="Enter the agenda for this visit..."
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              className="min-h-20 text-sm"
            />
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-700">Attachments</Label>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading ? "Uploading..." : "Attach Documents"}
              </Button>
            </div>
            <p className="text-[11px] text-gray-400">Attached documents are also copied to the firm's Documents tab.</p>
            {attachments.length > 0 && (
              <div className="space-y-1.5">
                {attachments.map((att) => (
                  <div key={att.id} className="px-3 py-2 rounded-lg border border-gray-200 bg-white">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                      <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-700 hover:text-indigo-600 truncate flex-1">{att.name}</a>
                      <button type="button" onClick={() => removeAttachment(att.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                    <AttachmentSummary attachment={att} onUpdate={updateAttachment} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Notes from the Visit</Label>
            <Textarea
              placeholder="Enter notes from the visit..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-24 text-sm"
            />
          </div>

          {/* Follow-up items to collect from firm */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-700">Follow-up Items to Collect from Firm</Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 text-indigo-600" onClick={addFollowUpItem}>
                <Plus className="w-3.5 h-3.5" /> Add Item
              </Button>
            </div>
            {followUpItems.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No follow-up items added yet.</p>
            ) : (
              <div className="space-y-1.5">
                {followUpItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Input
                      placeholder="What needs to be collected from the firm..."
                      value={item.description}
                      onChange={(e) => updateFollowUpItem(item.id, { description: e.target.value })}
                      className="h-8 text-sm flex-1"
                    />
                    <button type="button" onClick={() => removeFollowUpItem(item.id)} className="p-1 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Follow-up tasks with due dates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-700">Follow-up Tasks (with due dates)</Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 text-indigo-600" onClick={addFollowUpTask}>
                <Plus className="w-3.5 h-3.5" /> Add Task
              </Button>
            </div>
            <p className="text-[11px] text-gray-400">Tasks are created in the task system and surface in alerts when due dates approach.</p>
            {followUpTasks.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No follow-up tasks added yet.</p>
            ) : (
              <div className="space-y-2">
                {followUpTasks.map((ft) => (
                  <div key={ft.id} className="rounded-lg border border-gray-200 p-2.5 space-y-2 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Task description..."
                        value={ft.description}
                        onChange={(e) => updateFollowUpTask(ft.id, { description: e.target.value })}
                        className="h-8 text-sm flex-1"
                      />
                      <button type="button" onClick={() => removeFollowUpTask(ft.id)} className="p-1 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-gray-500">Due Date</Label>
                        <Input type="date" value={ft.due_date} onChange={(e) => updateFollowUpTask(ft.id, { due_date: e.target.value })} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-gray-500">Assignee (Xponance contact)</Label>
                        <XponanceContactPicker
                          label="Assignee"
                          value={ft.assignee_id ? { contact_id: ft.assignee_id, contact_name: ft.assignee_name } : null}
                          onChange={(id, name) => updateFollowUpTask(ft.id, { assignee_id: id, assignee_name: name })}
                          onClear={() => updateFollowUpTask(ft.id, { assignee_id: "", assignee_name: "" })}
                          editing={true}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          {editingVisit && (
            <Button
              variant="outline"
              onClick={() => generateOnsiteVisitPdf({
                firm_name: firm?.name,
                target_visit_date: targetDate,
                actual_visit_date: actualDate,
                visiting_analyst_name: analystName || "",
                onsite_type: onsiteType,
                status,
                agenda,
                notes,
                follow_up_items: followUpItems,
                attachments,
              })}
              className="gap-1"
            >
              <FileDown className="w-4 h-4" />
              Download PDF
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-white gap-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : editingVisit ? "Update Visit" : "Create Visit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}