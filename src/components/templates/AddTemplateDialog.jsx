import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Library } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import DatePicker from "@/components/ui/date-picker";
import TemplateTypePicker from "./TemplateTypePicker";
import TemplateStagesSection from "./TemplateStagesSection";
import DocumentationChecklistSection from "./DocumentationChecklistSection";
import QuestionnaireUploadSection from "./QuestionnaireUploadSection";
import QuestionBankPickerModal from "./QuestionBankPickerModal";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";

let _qbId = 0;
const nextQbId = () => `tstage_${Date.now()}_${++_qbId}`;

/**
 * Dialog for creating a new Template.
 * Fields: Template Name, Template Type (with add-new + duplicate validation).
 */
export default function AddTemplateDialog({ open, onOpenChange, onCreated, editTemplate, defaultTemplateType }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [templateType, setTemplateType] = useState(defaultTemplateType || "");
  const [createDate, setCreateDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [stages, setStages] = useState([]);
  const [docChecklist, setDocChecklist] = useState([]);
  const [questionBankOpen, setQuestionBankOpen] = useState(false);

  useEffect(() => {
    if (open) {
      if (editTemplate) {
        setName(editTemplate.name || "");
        setTemplateType(editTemplate.template_type || "");
        setCreateDate(editTemplate.create_date || format(new Date(), "yyyy-MM-dd"));
        setStages(Array.isArray(editTemplate.stages) ? editTemplate.stages.map((s) => ({ ...s })) : []);
        setDocChecklist(Array.isArray(editTemplate.documentation_checklist) ? editTemplate.documentation_checklist.map((it) => ({ ...it })) : []);
      } else {
        setName("");
        setTemplateType(defaultTemplateType || "");
        setCreateDate(format(new Date(), "yyyy-MM-dd"));
        setStages([]);
        setDocChecklist([]);
      }
    }
  }, [open, editTemplate]);

  // Clear stages when switching away from Manager Due Diligence or Manager Questionnaire
  useEffect(() => {
    if (templateType !== "Manager Due Diligence" && templateType !== "Manager Questionnaire") {
      setStages([]);
      setDocChecklist([]);
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
    const isMQ = templateType === "Manager Questionnaire";
    const showStages = isMDD || isMQ;
    const payloadStages = showStages ? stages.filter((s) => (s.name || "").trim()).map((s) => ({
      id: s.id,
      name: s.name.trim(),
      sub_stages: (s.sub_stages || []).filter((ss) => (ss.name || "").trim()).map((ss) => ({ id: ss.id, name: ss.name.trim() }))
    })) : undefined;
    const payloadDocChecklist = isMDD ? docChecklist.filter((it) => (it.name || "").trim()).map((it) => ({ id: it.id, name: it.name.trim() })) : undefined;
    if (showStages && payloadStages && payloadStages.length === 0) {
      toast({ title: "Sections required", description: "Please add at least one section with a name.", variant: "destructive" });
      return;
    }
    const payload = {
      name: name.trim(),
      template_type: templateType || undefined,
      create_date: createDate,
      stages: payloadStages,
      documentation_checklist: payloadDocChecklist,
      approval_process_logic: [], // explicitly clear legacy data
    };
    if (editTemplate) {
      updateMutation.mutate({ id: editTemplate.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isEditing = !!editTemplate;
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
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
          {(templateType === "Manager Due Diligence" || templateType === "Manager Questionnaire") && (
            <>
              <QuestionnaireUploadSection
                onExtracted={(extracted) => setStages(extracted)}
                sectionLabel={templateType === "Manager Questionnaire" ? "Section" : "Stage"}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-cyan-700 border-cyan-300 hover:bg-cyan-50"
                  onClick={() => setQuestionBankOpen(true)}
                >
                  <Library className="w-3.5 h-3.5" /> Question Bank
                </Button>
              </div>
              <TemplateStagesSection
                stages={stages}
                onChange={setStages}
                sectionLabel={templateType === "Manager Questionnaire" ? "Section" : "Stage"}
              />
              {templateType === "Manager Due Diligence" && (
                <DocumentationChecklistSection items={docChecklist} onChange={setDocChecklist} />
              )}
            </>
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

      <QuestionBankPickerModal
        open={questionBankOpen}
        onClose={() => setQuestionBankOpen(false)}
        stages={stages}
        sectionLabel={templateType === "Manager Questionnaire" ? "Section" : "Stage"}
        onInsert={(chosen, insMode, targetStageId) => {
          if (insMode === "sections") {
            const newStages = chosen.map((q) => ({ id: nextQbId(), name: q.question_text, sub_stages: [] }));
            setStages([...stages, ...newStages]);
          } else if (insMode === "questions" && targetStageId) {
            setStages(stages.map((s) => s.id === targetStageId ? {
              ...s,
              sub_stages: [...(s.sub_stages || []), ...chosen.map((q) => ({ id: nextQbId(), name: q.question_text }))]
            } : s));
          }
        }}
      />
    </Dialog>
  );
}