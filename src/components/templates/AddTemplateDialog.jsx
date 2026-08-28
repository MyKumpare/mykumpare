import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Library } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import DatePicker from "@/components/ui/date-picker";
import TemplateTypePicker from "./TemplateTypePicker";
import TemplateStagesSection from "./TemplateStagesSection";
import DocumentationChecklistSection from "./DocumentationChecklistSection";
import QuestionnaireUploadSection from "./QuestionnaireUploadSection";
import QuestionBankPickerModal from "./QuestionBankPickerModal";
import ScoringMatrixDocumentAnalyzer from "./ScoringMatrixDocumentAnalyzer";
import ScoringMatrixTemplateEditor from "./ScoringMatrixTemplateEditor";
import ScoringMatrixTestModeDialog from "./ScoringMatrixTestModeDialog";
import ProcessTemplateAudit from "./ProcessTemplateAudit";
import TemplateVersionDiffDialog from "./TemplateVersionDiffDialog";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Upload, X, FileText, FlaskConical, GitBranch, GitCompare } from "lucide-react";

let _qbId = 0;
const nextQbId = () => `tstage_${Date.now()}_${++_qbId}`;

function SampleFileUpload({ fileUrl, fileName, onUpload, onClear }) {
  const [uploading, setUploading] = useState(false);
  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onUpload(file_url, file.name);
    } catch (err) {
      toast({ title: "Upload failed", description: err?.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };
  if (fileUrl) {
    return (
      <div className="flex items-center gap-2 border border-gray-200 rounded-md p-2 bg-gray-50">
        <FileText className="w-4 h-4 text-gray-400" />
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 hover:underline truncate flex-1">
          {fileName || "Sample document"}
        </a>
        <button type="button" onClick={onClear} className="p-1 rounded hover:bg-red-100 text-red-500">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }
  return (
    <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-3 cursor-pointer hover:border-cyan-400 hover:bg-cyan-50/50 transition-colors">
      {uploading ? (
        <span className="text-xs text-gray-500">Uploading...</span>
      ) : (
        <>
          <Upload className="w-4 h-4 text-gray-400 mb-1" />
          <span className="text-xs text-gray-500">Upload sample document</span>
        </>
      )}
      <input type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,.xlsx,.xls" onChange={(e) => handleUpload(e.target.files?.[0])} />
    </label>
  );
}

/**
 * Dialog for creating a new Template.
 * Fields: Template Name, Template Type (with add-new + duplicate validation).
 */
export default function AddTemplateDialog({ open, onOpenChange, onCreated, editTemplate, defaultTemplateType, newVersionFrom }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [templateType, setTemplateType] = useState(defaultTemplateType || "");
  const [templateCategory, setTemplateCategory] = useState("Process Template");
  const [createDate, setCreateDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [stages, setStages] = useState([]);
  const [docChecklist, setDocChecklist] = useState([]);
  const [scoringBlocks, setScoringBlocks] = useState([]);
  const [ratingConfig, setRatingConfig] = useState(null);
  const [sampleFileUrl, setSampleFileUrl] = useState("");
  const [sampleFileName, setSampleFileName] = useState("");
  const [questionBankOpen, setQuestionBankOpen] = useState(false);
  const [testModeOpen, setTestModeOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);

  // "New version" mode: creating a new template record by copying a prior version.
  // The dialog is pre-filled from newVersionFrom and saves a NEW record (not an update),
  // carrying version_number + prior_version_id to track the version chain.
  const isNewVersion = !!newVersionFrom && !editTemplate;
  const priorVersion = newVersionFrom?.version_number || 1;
  const nextVersion = priorVersion + 1;
  // The original snapshot used for the "Preview Changes" diff. In new-version mode it's
  // the prior version; in edit mode it's the saved record (editTemplate is not mutated
  // by this dialog, so it stays a valid "before" snapshot).
  const diffOriginal = newVersionFrom || editTemplate;

  useEffect(() => {
    if (open) {
      if (editTemplate) {
        setName(editTemplate.name || "");
        setTemplateType(editTemplate.template_type || "");
        setTemplateCategory(editTemplate.template_category || "Process Template");
        setCreateDate(editTemplate.create_date || format(new Date(), "yyyy-MM-dd"));
        setStages(Array.isArray(editTemplate.stages) ? editTemplate.stages.map((s) => ({ ...s, sub_stages: (s.sub_stages || []).map((ss) => ({ ...ss })) })) : []);
        setDocChecklist(Array.isArray(editTemplate.documentation_checklist) ? editTemplate.documentation_checklist.map((it) => ({ ...it })) : []);
        setScoringBlocks(Array.isArray(editTemplate.scoring_blocks) ? editTemplate.scoring_blocks.map((b) => ({ ...b, criteria: (b.criteria || []).map((c) => ({ ...c, descriptors: (c.descriptors || []).map((d) => ({ ...d })) })) })) : []);
        setRatingConfig(editTemplate.rating_config ? JSON.parse(JSON.stringify(editTemplate.rating_config)) : null);
        setSampleFileUrl(editTemplate.sample_file_url || "");
        setSampleFileName(editTemplate.sample_file_name || "");
      } else if (newVersionFrom) {
        // Pre-fill from the prior version so the user starts from its content and
        // only modifies what needs to change. Keeps the same name (versions are
        // distinguished by version_number); create_date resets to today.
        setName(newVersionFrom.name || "");
        setTemplateType(newVersionFrom.template_type || "");
        setTemplateCategory(newVersionFrom.template_category || "Process Template");
        setCreateDate(format(new Date(), "yyyy-MM-dd"));
        setStages(Array.isArray(newVersionFrom.stages) ? newVersionFrom.stages.map((s) => ({ ...s, sub_stages: (s.sub_stages || []).map((ss) => ({ ...ss })) })) : []);
        setDocChecklist(Array.isArray(newVersionFrom.documentation_checklist) ? newVersionFrom.documentation_checklist.map((it) => ({ ...it })) : []);
        setScoringBlocks(Array.isArray(newVersionFrom.scoring_blocks) ? newVersionFrom.scoring_blocks.map((b) => ({ ...b, criteria: (b.criteria || []).map((c) => ({ ...c, descriptors: (c.descriptors || []).map((d) => ({ ...d })) })) })) : []);
        setRatingConfig(newVersionFrom.rating_config ? JSON.parse(JSON.stringify(newVersionFrom.rating_config)) : null);
        setSampleFileUrl(newVersionFrom.sample_file_url || "");
        setSampleFileName(newVersionFrom.sample_file_name || "");
      } else {
        setName("");
        setTemplateType(defaultTemplateType || "");
        setTemplateCategory("Process Template");
        setCreateDate(format(new Date(), "yyyy-MM-dd"));
        setStages([]);
        setDocChecklist([]);
        setScoringBlocks([]);
        setRatingConfig(null);
        setSampleFileUrl("");
        setSampleFileName("");
      }
    }
  }, [open, editTemplate, newVersionFrom]);

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
      if (isNewVersion) {
        toast({ title: "New version created", description: `"${created.name}" v${created.version_number} created from v${priorVersion}.` });
      } else {
        toast({ title: "Template created", description: `"${created.name}" has been added.` });
      }
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
    const isScoringMatrix = templateCategory === "Scoring Matrix";
    const payloadScoringBlocks = isScoringMatrix ? scoringBlocks.filter((b) => (b.name || "").trim()).map((b) => ({
      id: b.id,
      name: b.name.trim(),
      weight: b.weight || 0,
      criteria: (b.criteria || []).filter((c) => (c.name || "").trim()).map((c) => ({
        id: c.id,
        number: c.number,
        name: c.name.trim(),
        category: c.category || "",
        descriptors: (c.descriptors || []).map((d) => ({ level: d.level, text: d.text }))
      }))
    })) : undefined;
    const payload = {
      name: name.trim(),
      template_type: templateType || undefined,
      template_category: templateCategory,
      create_date: createDate,
      stages: payloadStages,
      documentation_checklist: payloadDocChecklist,
      scoring_blocks: payloadScoringBlocks,
      rating_config: isScoringMatrix ? (ratingConfig || undefined) : undefined,
      sample_file_url: sampleFileUrl || undefined,
      sample_file_name: sampleFileName || undefined,
      approval_process_logic: [], // explicitly clear legacy data
    };
    if (isNewVersion) {
      // Create a new version record: stamp the version chain so the new template
      // links back to the prior version it was copied from.
      payload.version_number = nextVersion;
      payload.prior_version_id = newVersionFrom.id;
      createMutation.mutate(payload);
    } else if (editTemplate) {
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
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {isNewVersion ? (
              <><GitBranch className="w-4 h-4 text-indigo-600" /> Create New Version</>
            ) : isEditing ? "Edit Template" : "Add Template"}
            {isNewVersion && (
              <Badge variant="outline" className="text-xs font-normal">v{priorVersion} → v{nextVersion}</Badge>
            )}
          </DialogTitle>
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
            <Label>Template Category</Label>
            <Select value={templateCategory} onValueChange={setTemplateCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Process Template">Process Template</SelectItem>
                <SelectItem value="Scoring Matrix">Scoring Matrix</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Create Date</Label>
            <DatePicker value={createDate} onChange={setCreateDate} />
          </div>
          {templateCategory === "Scoring Matrix" ? (
            <>
              <ScoringMatrixDocumentAnalyzer
                templateCategory={templateCategory}
                onAnalyzed={(data) => {
                  if (data.blocks) {
                    setScoringBlocks(data.blocks.map((b) => ({
                      id: b.id || `smb_${Date.now()}_${Math.random()}`,
                      name: b.name || "",
                      weight: b.weight || 0,
                      criteria: (b.criteria || []).map((c) => ({
                        id: c.id || `smc_${Date.now()}_${Math.random()}`,
                        number: c.number || 0,
                        name: c.name || "",
                        category: c.category || "",
                        descriptors: (c.descriptors || []).map((d) => ({ level: d.level, text: d.text || "" }))
                      }))
                    })));
                  }
                }}
              />
              <ScoringMatrixTemplateEditor blocks={scoringBlocks} onChange={setScoringBlocks} templateId={editTemplate?.id} templateName={editTemplate?.name} ratingConfig={ratingConfig} onRatingConfigChange={setRatingConfig} />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-cyan-700 border-cyan-300 hover:bg-cyan-50"
                  onClick={() => setTestModeOpen(true)}
                  disabled={scoringBlocks.length === 0}
                >
                  <FlaskConical className="w-3.5 h-3.5" /> Test Matrix
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label>Sample Document (optional)</Label>
                <p className="text-xs text-gray-500">Attach a sample showing how to use this scoring matrix.</p>
                <SampleFileUpload
                  fileUrl={sampleFileUrl}
                  fileName={sampleFileName}
                  onUpload={(url, name) => { setSampleFileUrl(url); setSampleFileName(name); }}
                  onClear={() => { setSampleFileUrl(""); setSampleFileName(""); }}
                />
              </div>
            </>
          ) : (templateType === "Manager Due Diligence" || templateType === "Manager Questionnaire") ? (
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
              <ProcessTemplateAudit
                stages={stages}
                docChecklist={templateType === "Manager Due Diligence" ? docChecklist : []}
                onStagesChange={setStages}
                onDocChecklistChange={setDocChecklist}
                templateId={editTemplate?.id}
                templateName={editTemplate?.name}
              />
            </>
          ) : null}
          <DialogFooter>
            <div className="flex items-center gap-2 mr-auto">
              {diffOriginal && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDiffOpen(true)}
                  className="gap-1.5"
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  Preview Changes
                </Button>
              )}
            </div>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isPending}>
              {isNewVersion ? `Create v${nextVersion}` : isEditing ? "Save Changes" : "Add Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {diffOpen && diffOriginal && (
        <TemplateVersionDiffDialog
          open={diffOpen}
          onOpenChange={setDiffOpen}
          original={diffOriginal}
          current={{
            name,
            template_type: templateType,
            template_category: templateCategory,
            sample_file_name: sampleFileName,
            stages,
            documentation_checklist: docChecklist,
            scoring_blocks: scoringBlocks,
            rating_config: ratingConfig,
          }}
          nextVersion={isNewVersion ? nextVersion : priorVersion}
          priorVersion={isNewVersion ? priorVersion : (editTemplate?.version_number || 1)}
        />
      )}

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

      {testModeOpen && (
        <ScoringMatrixTestModeDialog
          open={testModeOpen}
          onOpenChange={setTestModeOpen}
          template={{ name: name || "Test Template", scoring_blocks: scoringBlocks }}
        />
      )}
    </Dialog>
  );
}