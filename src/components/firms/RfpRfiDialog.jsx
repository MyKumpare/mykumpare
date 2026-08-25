import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
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
import { Upload, Loader2, FileText, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const EMPTY = {
  type: "RFP",
  title: "",
  posting_date: "",
  start_date: "",
  questions_start_date: "",
  questions_end_date: "",
  due_date: "",
  summary: "",
  source_url: "",
  file_url: "",
  file_name: "",
};

// Add / edit dialog for a single RFP/RFI record. Supports attaching a
// solicitation document file (uploaded via UploadFile).
export default function RfpRfiDialog({ open, onOpenChange, firmId, firmName, editing, onSaved, user }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(editing ? { ...EMPTY, ...editing } : EMPTY);
    }
  }, [open, editing]);

  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set("file_url", file_url);
      set("file_name", file.name);
    } catch (err) {
      toast({ title: "Upload failed", description: err?.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        firm_id: firmId,
        firm_name: firmName,
        tenant_id: user?.linked_firm_id,
      };
      if (editing) {
        await base44.entities.FirmRfpRfi.update(editing.id, payload);
      } else {
        await base44.entities.FirmRfpRfi.create(payload);
      }
      queryClient.invalidateQueries({ queryKey: ["firm-rfp-rfi", firmId] });
      onSaved?.();
      onOpenChange(false);
      toast({ title: `✅ RFP/RFI ${editing ? "updated" : "added"}` });
    } catch (err) {
      toast({ title: "Save failed", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit RFP/RFI" : "Add RFP/RFI"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Type</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RFP">RFP</SelectItem>
                  <SelectItem value="RFI">RFI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Title *</Label>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} className="h-9" placeholder="Solicitation title" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Posting Date</Label>
              <Input type="date" value={form.posting_date} onChange={(e) => set("posting_date", e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Start Date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} className="h-9" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Questions Start</Label>
              <Input type="date" value={form.questions_start_date} onChange={(e) => set("questions_start_date", e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Questions End</Label>
              <Input type="date" value={form.questions_end_date} onChange={(e) => set("questions_end_date", e.target.value)} className="h-9" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Due Date</Label>
            <Input type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} className="h-9" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Summary</Label>
            <Textarea value={form.summary} onChange={(e) => set("summary", e.target.value)} className="min-h-16 text-sm" placeholder="Short summary of the solicitation" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Source URL</Label>
            <Input value={form.source_url} onChange={(e) => set("source_url", e.target.value)} className="h-9" placeholder="https://…" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Attached File</Label>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer">
                <input type="file" className="hidden" onChange={handleFile} />
                <div className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 rounded-md px-3 py-1.5 hover:bg-indigo-50 transition-colors">
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploading ? "Uploading…" : form.file_url ? "Replace File" : "Attach File"}
                </div>
              </label>
              {form.file_url && (
                <div className="flex items-center gap-1 text-xs text-gray-600 min-w-0">
                  <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                  <a href={form.file_url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline text-indigo-600">
                    {form.file_name || "View file"}
                  </a>
                  <button type="button" onClick={() => { set("file_url", ""); set("file_name", ""); }} className="text-gray-400 hover:text-red-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {editing ? "Save Changes" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}