import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Pencil, Trash2, FileText, Loader2, X, GripVertical, Library,
} from "lucide-react";
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

function emptyTemplate() {
  return {
    name: "",
    description: "",
    default_title: "",
    default_topics: [],
    default_meeting_format: "unknown",
    default_session_type: "unknown",
    agenda_sections: [],
    prep_checklist: [],
    notes_template: "",
  };
}

function TemplateForm({ initial, onSave, onCancel, saving }) {
  const [t, setT] = useState(() => ({
    ...emptyTemplate(),
    ...initial,
    default_topics: initial?.default_topics || [],
    agenda_sections: initial?.agenda_sections || [],
    prep_checklist: initial?.prep_checklist || [],
  }));
  const [topicInput, setTopicInput] = useState("");

  const set = (k, v) => setT((p) => ({ ...p, [k]: v }));

  const addTopic = () => {
    const v = topicInput.trim();
    if (!v) return;
    if (!t.default_topics.includes(v)) set("default_topics", [...t.default_topics, v]);
    setTopicInput("");
  };
  const removeTopic = (idx) => set("default_topics", t.default_topics.filter((_, i) => i !== idx));

  const addSection = () => set("agenda_sections", [...t.agenda_sections, { id: crypto.randomUUID(), title: "", description: "" }]);
  const updateSection = (id, k, v) => set("agenda_sections", t.agenda_sections.map((s) => (s.id === id ? { ...s, [k]: v } : s)));
  const removeSection = (id) => set("agenda_sections", t.agenda_sections.filter((s) => s.id !== id));

  const addChecklistItem = () => set("prep_checklist", [...t.prep_checklist, { id: crypto.randomUUID(), description: "", is_high_priority: false }]);
  const updateChecklistItem = (id, k, v) => set("prep_checklist", t.prep_checklist.map((c) => (c.id === id ? { ...c, [k]: v } : c)));
  const removeChecklistItem = (id) => set("prep_checklist", t.prep_checklist.filter((c) => c.id !== id));

  const submit = () => {
    if (!t.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    onSave({
      ...t,
      agenda_sections: t.agenda_sections.filter((s) => s.title.trim()),
      prep_checklist: t.prep_checklist.filter((c) => c.description.trim()),
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600">Template name *</label>
          <input value={t.name} onChange={(e) => set("name", e.target.value)} className="mt-1 w-full h-9 rounded-md border border-gray-200 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400" placeholder="e.g. Quarterly Board Review" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Default meeting title</label>
          <input value={t.default_title} onChange={(e) => set("default_title", e.target.value)} className="mt-1 w-full h-9 rounded-md border border-gray-200 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400" placeholder="e.g. Q4 Board Meeting" />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600">Description</label>
        <input value={t.description} onChange={(e) => set("description", e.target.value)} className="mt-1 w-full h-9 rounded-md border border-gray-200 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400" placeholder="When to use this template" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600">Default format</label>
          <select value={t.default_meeting_format} onChange={(e) => set("default_meeting_format", e.target.value)} className="mt-1 w-full h-9 rounded-md border border-gray-200 px-2 text-sm bg-white">
            {FORMAT_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Default session type</label>
          <select value={t.default_session_type} onChange={(e) => set("default_session_type", e.target.value)} className="mt-1 w-full h-9 rounded-md border border-gray-200 px-2 text-sm bg-white">
            {SESSION_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600">Default topics</label>
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
        {t.default_topics.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {t.default_topics.map((tp, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                {tp}
                <button type="button" onClick={() => removeTopic(i)} className="text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-600">Agenda sections</label>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 text-cyan-600" onClick={addSection}><Plus className="w-3.5 h-3.5" /> Add section</Button>
        </div>
        <div className="mt-1 space-y-2">
          {t.agenda_sections.length === 0 && (
            <div className="text-xs text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-md">No agenda sections. Add one to define the agenda structure.</div>
          )}
          {t.agenda_sections.map((s, i) => (
            <div key={s.id} className="rounded-md border border-gray-200 p-2 bg-gray-50">
              <div className="flex items-center gap-2">
                <GripVertical className="w-3.5 h-3.5 text-gray-300" />
                <span className="text-[10px] text-gray-400 font-semibold">{i + 1}</span>
                <input value={s.title} onChange={(e) => updateSection(s.id, "title", e.target.value)} placeholder="Section title" className="flex-1 h-8 rounded border border-gray-200 px-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-cyan-400" />
                <button type="button" onClick={() => removeSection(s.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <input value={s.description || ""} onChange={(e) => updateSection(s.id, "description", e.target.value)} placeholder="Guidance / description (optional)" className="mt-1 w-full h-8 rounded border border-gray-200 px-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-cyan-400" />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-600">Prep checklist (action items)</label>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 text-emerald-600" onClick={addChecklistItem}><Plus className="w-3.5 h-3.5" /> Add item</Button>
        </div>
        <p className="text-[10px] text-gray-400 mt-0.5">These become action items on meetings created from this template, so you don't set up recurring prep tasks manually.</p>
        <div className="mt-1 space-y-2">
          {t.prep_checklist.length === 0 && (
            <div className="text-xs text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-md">No prep items. Add one to auto-create action items on new meetings.</div>
          )}
          {t.prep_checklist.map((c, i) => (
            <div key={c.id} className="rounded-md border border-gray-200 p-2 bg-gray-50">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 font-semibold">{i + 1}</span>
                <input value={c.description} onChange={(e) => updateChecklistItem(c.id, "description", e.target.value)} placeholder="Action item (e.g. Send agenda to board 1 week prior)" className="flex-1 h-8 rounded border border-gray-200 px-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-cyan-400" />
                <label className="flex items-center gap-1 text-[10px] text-gray-500 whitespace-nowrap cursor-pointer">
                  <input type="checkbox" checked={!!c.is_high_priority} onChange={(e) => updateChecklistItem(c.id, "is_high_priority", e.target.checked)} className="w-3.5 h-3.5" />
                  High-pri
                </label>
                <button type="button" onClick={() => removeChecklistItem(c.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600">Notes template (note-taking format)</label>
        <textarea
          value={t.notes_template}
          onChange={(e) => set("notes_template", e.target.value)}
          placeholder="Define the consistent notes structure for meetings using this template…"
          className="mt-1 w-full rounded-md border border-gray-200 p-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-1 focus:ring-cyan-400"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1 border-t">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="button" size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white gap-1" onClick={submit} disabled={saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
          {initial?.id ? "Save changes" : "Create template"}
        </Button>
      </div>
    </div>
  );
}

export default function BoardMeetingTemplateLibrary({ open, onClose }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // null | template object | emptyTemplate()
  const [saving, setSaving] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["board-meeting-templates"],
    queryFn: () => base44.entities.BoardMeetingTemplate.list("name", 200),
    enabled: open,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["board-meeting-templates"] });

  const handleSave = async (data) => {
    setSaving(true);
    try {
      if (editing?.id) {
        await base44.entities.BoardMeetingTemplate.update(editing.id, data);
        toast({ title: "Template updated" });
      } else {
        await base44.entities.BoardMeetingTemplate.create(data);
        toast({ title: "Template created" });
      }
      setEditing(null);
      invalidate();
    } catch (err) {
      toast({ title: "Failed to save", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t) => {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    try {
      await base44.entities.BoardMeetingTemplate.delete(t.id);
      invalidate();
      toast({ title: "Template deleted" });
    } catch (err) {
      toast({ title: "Failed to delete", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setEditing(null); } }}>
      <DialogContent className="sm:max-w-3xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="w-5 h-5 text-cyan-600" />
            Board Meeting Templates
          </DialogTitle>
        </DialogHeader>

        {editing ? (
          <div className="overflow-y-auto flex-1 pr-1">
            <TemplateForm initial={editing} onSave={handleSave} onCancel={() => setEditing(null)} saving={saving} />
          </div>
        ) : (
          <>
            <div className="flex justify-end mb-2">
              <Button type="button" size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white gap-1" onClick={() => setEditing(emptyTemplate())}>
                <Plus className="w-3.5 h-3.5" /> New Template
              </Button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {isLoading ? (
                <div className="text-sm text-gray-400 italic py-6 text-center flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading templates…
                </div>
              ) : templates.length === 0 ? (
                <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl">
                  No templates yet. Create one to standardize agendas and note-taking across meetings.
                </div>
              ) : (
                templates.map((t) => (
                  <div key={t.id} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-800">{t.name}</span>
                          {t.agenda_sections?.length > 0 && (
                            <Badge variant="outline" className="text-[10px] bg-cyan-50 text-cyan-700 border-cyan-200">{t.agenda_sections.length} agenda sections</Badge>
                          )}
                          {t.default_topics?.length > 0 && (
                            <Badge variant="outline" className="text-[10px] bg-gray-50 text-gray-600 border-gray-200">{t.default_topics.length} topics</Badge>
                          )}
                          {t.prep_checklist?.length > 0 && (
                            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">{t.prep_checklist.length} prep items</Badge>
                          )}
                        </div>
                        {t.description && <div className="text-xs text-gray-500 mt-0.5">{t.description}</div>}
                        {t.default_title && <div className="text-[11px] text-gray-400 mt-1">Default title: "{t.default_title}"</div>}
                        {t.agenda_sections?.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5">
                            {t.agenda_sections.map((s, i) => (
                              <li key={s.id || i} className="text-[11px] text-gray-600 flex items-start gap-1">
                                <span className="text-gray-400 font-semibold">{i + 1}.</span>
                                <span><span className="font-medium">{s.title}</span>{s.description ? ` — ${s.description}` : ""}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button type="button" onClick={() => setEditing(t)} className="text-gray-400 hover:text-cyan-600 p-1" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => handleDelete(t)} className="text-gray-300 hover:text-red-500 p-1" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        <div className="flex justify-end pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => { onClose(); setEditing(null); }}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}