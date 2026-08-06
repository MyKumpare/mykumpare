import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import TemplateTypePicker from "./TemplateTypePicker";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";

/**
 * Dialog for creating a new Template.
 * Fields: Template Name, Template Type (with add-new + duplicate validation).
 */
export default function AddTemplateDialog({ open, onOpenChange, onCreated }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [templateType, setTemplateType] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setTemplateType("");
    }
  }, [open]);

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({ name: name.trim(), template_type: templateType || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Template</DialogTitle>
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || createMutation.isPending}>
              Add Template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}