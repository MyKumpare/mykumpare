import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import DatePicker from "@/components/ui/date-picker";
import TemplateTypePicker from "./TemplateTypePicker";
import TemplateStagesSection from "./TemplateStagesSection";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";

/**
 * Dialog for creating a new Template.
 * Fields: Template Name, Template Type (with add-new + duplicate validation).
 */
export default function AddTemplateDialog({ open, onOpenChange, onCreated, editTemplate }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [templateType, setTemplateType] = useState("");
  const [createDate, setCreateDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [stages, setStages] = useState([]);

  useEffect(() => {
    if (open) {
      if (editTemplate) {
        setName(editTemplate.name || "");
        setTemplateType(editTemplate.template_type || "");
        setCreateDate(editTemplate.create_date || format(new Date(), "yyyy-MM-dd"));
        setStages(Array.isArray(editTemplate.stages) ? editTemplate.stages.map((s) => ({ ...s })) : []);
      } else {
        setName("");
        setTemplateType("");
        setCreateDate(format(new Date(), "yyyy-MM-dd"));
        setStages([]);
      }
    }
  }, [open, editTemplate]);

  // Clear stages when switching away from Manager Due Diligence
  useEffect(() => {
    if (templateType !== "Manager Due Diligence") {
      setStages([]);
    }
  }, [templateType]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Template.create({ ...data, tenant_id: user?.linked_firm_id }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: "Template created", description: `"${created.name}" has been added.` });
      onOpenChange(false);
      if (onCreated) onCreated(created);
    },
    onError: (err) => {
      toast({ title: "Failed to create template", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Template.update(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: "Template updated", description: `"${updated.name}" has been saved.` });
      onOpenChange(false);
    },
    onError: (err) => {
      toast({ title: "Failed to update template", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const isMDD = templateType === "Manager Due Diligence";
    const payloadStages = isMDD ? stages.filter((s) => (s.name || "").trim()).map((s) => ({ id: s.id, name: s.name.trim() })) : undefined;
    if (isMDD && payloadStages && payloadStages.length === 0) {
      toast({ title: "Stages required", description: "Please add at least one stage with a name.", variant: "destructive" });
      return;
    }
    if (editTemplate) {
      updateMutation.mutate({ id: editTemplate.id, data: { name: name.trim(), template_type: templateType || undefined, create_date: createDate, stages: payloadStages } });
    } else {
      createMutation.mutate({ name: name.trim(), template_type: templateType || undefined, create_date: createDate, stages: payloadStages });
    }
  };

  const isEditing = !!editTemplate;
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Template" : "Add Template"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="template-name">Template Name *</Label>
            <Input
              id="template-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter template name..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Template Type</Label>
            <TemplateTypePicker value={templateType} onChange={setTemplateType} />
          </div>
          <div className="space-y-1.5">
            <Label>Create Date</Label>
            <DatePicker value={createDate} onChange={setCreateDate} />
          </div>
          {templateType === "Manager Due Diligence" && (
            <TemplateStagesSection stages={stages} onChange={setStages} />
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isPending}>
              {isEditing ? "Save Changes" : "Add Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}