import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, FileText, Plus, Pencil, Trash2, Star } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const ALL_TYPES = ["Call", "Email", "Meeting", "Note", "Other"];

function TemplateForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [applicableTypes, setApplicableTypes] = useState(initial?.applicable_types || []);
  const [content, setContent] = useState(initial?.template_content || "");
  const [isDefault, setIsDefault] = useState(initial?.is_default || false);

  const toggleType = (t) => {
    setApplicableTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const handleSave = () => {
    if (!name.trim() || !content.trim()) {
      toast({ title: "Name and content are required", variant: "destructive" });
      return;
    }
    onSave({
      name: name.trim(),
      description: description.trim(),
      applicable_types: applicableTypes,
      template_content: content,
      is_default: isDefault,
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-700">Template Name *</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Discovery Call Recap" className="h-8 text-sm" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-700">Description</Label>
        <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="When to use this template" className="h-8 text-sm" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-700">Applicable Activity Types</Label>
        <div className="flex flex-wrap gap-1.5">
          {ALL_TYPES.map(t => {
            const active = applicableTypes.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-gray-400">Leave empty to apply to all activity types.</p>
      </div>
      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-700">Template Content *</Label>
        <Textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={"Recap structure...\n\nAttendees: {{contact_name}} ({{firm_name}})\nDate: {{date}}\n\nKey Discussion Points:\n- \n\nAction Items:\n- \n\nNext Steps:\n- "}
          className="min-h-40 text-sm font-mono"
        />
        <p className="text-[10px] text-gray-400">Use {"{{contact_name}}"}, {"{{firm_name}}"}, {"{{date}}"} as placeholders — they auto-fill when applied.</p>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
        <span className="text-xs font-medium text-gray-700 flex items-center gap-1">
          <Star className="w-3 h-3 text-amber-500" /> Set as default for these activity types
        </span>
      </label>
      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onCancel}>Cancel</Button>
        <Button type="button" size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSave}>Save Template</Button>
      </div>
    </div>
  );
}

// Full dialog for creating, editing, and deleting meeting recap templates.
export default function MeetingRecapTemplateManager({ open, onClose }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // null = list view, "new" = create, object = edit
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["meeting_recap_templates"],
    queryFn: () => base44.entities.MeetingRecapTemplate.list("name", 500),
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, data }) => id
      ? base44.entities.MeetingRecapTemplate.update(id, data)
      : base44.entities.MeetingRecapTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_recap_templates"] });
      setEditing(null);
      toast({ title: "Template saved" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MeetingRecapTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_recap_templates"] });
      setConfirmDelete(null);
      toast({ title: "Template deleted" });
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            {editing ? (editing === "new" ? "New Recap Template" : "Edit Template") : "Meeting Recap Templates"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {editing ? (
            <TemplateForm
              initial={editing === "new" ? null : editing}
              onSave={(data) => saveMutation.mutate({ id: editing === "new" ? null : editing.id, data })}
              onCancel={() => setEditing(null)}
            />
          ) : confirmDelete ? (
            <div className="text-center py-6 space-y-4">
              <p className="text-sm text-gray-600">Delete <span className="font-semibold">"{confirmDelete.name}"</span>?</p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={() => deleteMutation.mutate(confirmDelete.id)}>Delete</Button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing("new")}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-dashed border-indigo-300 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors mb-3"
              >
                <Plus className="w-4 h-4" /> New Template
              </button>
              {isLoading ? (
                <p className="text-sm text-gray-400 text-center py-4">Loading...</p>
              ) : templates.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No templates yet. Create one to standardize your notes.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map(tpl => (
                    <div key={tpl.id} className="rounded-xl border border-gray-100 hover:border-indigo-200 p-3 transition-colors">
                      <div className="flex items-start gap-2">
                        <FileText className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-gray-800">{tpl.name}</span>
                            {tpl.is_default && <span className="text-[9px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded">DEFAULT</span>}
                          </div>
                          {tpl.description && <p className="text-xs text-gray-400 mt-0.5">{tpl.description}</p>}
                          {(tpl.applicable_types || []).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {tpl.applicable_types.map(t => (
                                <span key={t} className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">{t}</span>
                              ))}
                            </div>
                          )}
                          <pre className="text-[11px] text-gray-500 mt-1.5 whitespace-pre-wrap line-clamp-3 font-sans">{tpl.template_content}</pre>
                        </div>
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <button onClick={() => setEditing(tpl)} className="p-1 text-gray-300 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setConfirmDelete(tpl)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}