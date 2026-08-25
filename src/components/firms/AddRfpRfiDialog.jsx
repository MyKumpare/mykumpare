import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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
import { Loader2, Upload, X, FileDown } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const TYPE_OPTIONS = ["RFP", "RFI", "Unknown"];

function emptyRecord() {
  return {
    title: "",
    rfp_type: "Unknown",
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
}

export default function AddRfpRfiDialog({ open, onClose, firmId, firmName, editingRecord, user }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyRecord());
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEdit = !!editingRecord;

  useEffect(() => {
    if (open) {
      setForm(isEdit ? { ...emptyRecord(), ...editingRecord } : emptyRecord());
    }
  }, [open, editingRecord, isEdit]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = res?.file_url || res?.data?.file_url;
      if (!fileUrl) throw new Error("Upload returned no URL");
      set("file_url", fileUrl);
      set("file_name", file.name);
      toast({ title: "File attached", description: file.name });
    } catch (err) {
      toast({ title: "Upload failed", description: err?.message || "Could not upload file.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    set("file_url", "");
    set("file_name", "");
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      let status = "Unknown";
      if (form.due_date) status = form.due_date < today ? "Closed" : "Open";

      const payload = {
        ...form,
        status,
        rfp_type: TYPE_OPTIONS.includes(form.rfp_type) ? form.rfp_type : "Unknown",
      };

      if (isEdit) {
        await base44.entities.FirmRfpRfi.update(editingRecord.id, payload);
        toast({ title: "RFP/RFI updated" });
      } else {
        await base44.entities.FirmRfpRfi.create({
          ...payload,
          tenant_id: user?.linked_firm_id,
          firm_id: firmId,
          firm_name: firmName,
        });
        toast({ title: "RFP/RFI added" });
      }
      queryClient.invalidateQueries({ queryKey: ["firm-rfp-rfi", firmId] });
      queryClient.invalidateQueries({ queryKey: ["rfp-rfi-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["rfp-rfi-due-this-week"] });
      onClose();
    } catch (err) {
      toast({ title: "Save failed", description: err?.message || "Could not save.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit RFP/RFI" : "Add RFP/RFI"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. 2026 Investment Management RFP" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.rfp_type} onValueChange={(v) => set("rfp_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Progress</Label>
              <Select value={form.progress_status || "Draft"} onValueChange={(v) => set("progress_status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROGRESS_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Posting date</Label>
              <Input type="date" value={form.posting_date} onChange={(e) => set("posting_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Questions start</Label>
              <Input type="date" value={form.questions_start_date} onChange={(e) => set("questions_start_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Questions end</Label>
              <Input type="date" value={form.questions_end_date} onChange={(e) => set("questions_end_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Summary</Label>
            <Textarea value={form.summary} onChange={(e) => set("summary", e.target.value)} placeholder="Short summary of the RFP/RFI…" className="min-h-20" />
          </div>

          <div className="space-y-1.5">
            <Label>Source link (URL)</Label>
            <Input value={form.source_url} onChange={(e) => set("source_url", e.target.value)} placeholder="https://…" />
          </div>

          <div className="space-y-1.5">
            <Label>Attached file</Label>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading ? "Uploading…" : "Upload file"}
                <input type="file" className="hidden" onChange={handleFile} disabled={uploading} />
              </label>
              {form.file_url && (
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-2 py-1">
                  <FileDown className="w-3.5 h-3.5 text-primary" />
                  <a href={form.file_url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-[200px]">
                    {form.file_name || "Attached file"}
                  </a>
                  <button type="button" onClick={removeFile} className="text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || uploading} className="bg-primary hover:bg-primary/90 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isEdit ? "Save Changes" : "Add RFP/RFI"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}