import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import DatePicker from "@/components/ui/date-picker";
import SearchableSelect from "@/components/common/SearchableSelect";
import QuestionnaireFirmPicker from "./QuestionnaireFirmPicker";
import QuestionnaireContactPicker from "./QuestionnaireContactPicker";
import QuestionnaireSubSectionItem from "./QuestionnaireSubSectionItem";
import PushResponsesDialog from "./PushResponsesDialog";
import AddTemplateDialog from "@/components/templates/AddTemplateDialog";
import { ArrowRightToLine } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { format, parseISO } from "date-fns";
import {
  Send, ClipboardList, CheckCircle2, FileText, ChevronDown, ChevronRight,
  User, Calendar, Building2, Clock, AlertCircle, Eye, Mail, Package, Plus,
} from "lucide-react";

const todayISO = () => format(new Date(), "yyyy-MM-dd");
const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return format(parseISO(iso), "MM/dd/yyyy"); } catch { return iso; }
};

const STATUS_CONFIG = {
  Draft: { color: "bg-gray-100 text-gray-600 border-gray-200", label: "Draft" },
  Sent: { color: "bg-blue-50 text-blue-700 border-blue-200", label: "Sent" },
  "In Progress": { color: "bg-amber-50 text-amber-700 border-amber-200", label: "In Progress" },
  Submitted: { color: "bg-purple-50 text-purple-700 border-purple-200", label: "Submitted" },
  "Under Review": { color: "bg-indigo-50 text-indigo-700 border-indigo-200", label: "Under Review" },
  Completed: { color: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Completed" },
};

/**
 * Main dialog for creating, answering, and reviewing questionnaires.
 *
 * Props:
 *   open, onOpenChange
 *   editQuestionnaire: existing record (answer/review mode) or null (create mode)
 *   user, firms, contacts, products — from Home page
 *   onFirmClick, onContactClick, onProductClick — navigation callbacks
 *   onCreated — callback after a new questionnaire is created
 */
export default function QuestionnaireDialog({
  open,
  onOpenChange,
  editQuestionnaire,
  user,
  firms = [],
  contacts = [],
  products = [],
  onFirmClick,
  onContactClick,
  onProductClick,
  onCreated,
  isExternalParty = false,
}) {
  const queryClient = useQueryClient();

  // Fetch questionnaire templates
  const { data: templates = [] } = useQuery({
    queryKey: ["questionnaire-templates"],
    queryFn: () => base44.entities.Template.filter({ deleted_at: { $exists: false }, template_type: "Manager Questionnaire" }, "-created_date", 500),
    enabled: open && !editQuestionnaire,
  });

  // Create mode state
  const [form, setForm] = useState({
    templateId: "",
    name: "",
    requesterName: "",
    requesterId: "",
    requestDate: todayISO(),
    firmId: "",
    firmName: "",
    assigneeContactId: "",
    assigneeContactName: "",
    productId: "",
    productName: "",
    dueDate: "",
  });

  // Answer/review mode state
  const [questionnaire, setQuestionnaire] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completingReview, setCompletingReview] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [showPushResponses, setShowPushResponses] = useState(false);

  // Initialize state when dialog opens
  useEffect(() => {
    if (open) {
      if (editQuestionnaire) {
        setQuestionnaire(editQuestionnaire);
        // Auto-expand all sections
        const expanded = {};
        (editQuestionnaire.sections || []).forEach((s) => { expanded[s.id] = true; });
        setExpandedSections(expanded);
      } else {
        setQuestionnaire(null);
        setForm({
          templateId: "",
          name: "",
          requesterName: user?.full_name || "",
          requesterId: user?.id || "",
          requestDate: todayISO(),
          firmId: "",
          firmName: "",
          assigneeContactId: "",
          assigneeContactName: "",
          productId: "",
          productName: "",
          dueDate: "",
        });
      }
    }
  }, [open, editQuestionnaire, user]);

  // Filtered data based on selected firm
  const firmContacts = useMemo(
    () => contacts.filter((c) => !c.deleted_at && c.firm_ids?.includes(form.firmId)),
    [contacts, form.firmId]
  );
  const firmProducts = useMemo(
    () => products.filter((p) => !p.deleted_at && p.firm_id === form.firmId),
    [products, form.firmId]
  );

  // Template options
  const templateOptions = useMemo(
    () => templates.map((t) => ({ value: t.id, label: t.name })),
    [templates]
  );
  // firmOptions/contactOptions now handled inside the pickers
  const productOptions = useMemo(
    () => firmProducts.map((p) => ({ value: p.id, label: p.name })),
    [firmProducts]
  );

  // Handle firm selection
  const handleFirmChange = (firmId, firmObj) => {
    const firm = firmObj || firms.find((f) => f.id === firmId);
    setForm((prev) => ({
      ...prev,
      firmId,
      firmName: firm?.name || "",
      assigneeContactId: "",
      assigneeContactName: "",
      productId: "",
      productName: "",
    }));
  };

  const handleContactChange = (contactId, contactObj) => {
    const contact = contactObj || firmContacts.find((c) => c.id === contactId);
    const name = contact ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim() : "";
    setForm((prev) => ({ ...prev, assigneeContactId: contactId, assigneeContactName: name }));
  };

  const handleProductChange = (productId) => {
    const product = firmProducts.find((p) => p.id === productId);
    setForm((prev) => ({ ...prev, productId, productName: product?.name || "" }));
  };

  // Send questionnaire
  const handleSend = async () => {
    if (!form.templateId || !form.firmId || !form.assigneeContactId || !form.dueDate) {
      toast({ title: "Missing fields", description: "Please select a template, firm, assignee, and due date.", variant: "destructive" });
      return;
    }
    const template = templates.find((t) => t.id === form.templateId);
    if (!template) return;

    setSending(true);
    try {
      // Build sections from template stages
      const sections = (template.stages || []).map((s) => ({
        id: s.id,
        name: s.name,
        sub_sections: (s.sub_stages || []).map((ss) => ({
          id: ss.id,
          name: ss.name,
          start_date: "",
          end_date: "",
          status: "not_started",
          notes: "",
          attachments: [],
        })),
      }));

      const created = await base44.entities.Questionnaire.create({
        name: form.name || template.name,
        template_id: form.templateId,
        template_name: template.name,
        requester_id: form.requesterId,
        requester_name: form.requesterName,
        requester_contact_id: user?.linked_contact_id,
        request_date: form.requestDate,
        assignee_contact_id: form.assigneeContactId,
        assignee_contact_name: form.assigneeContactName,
        firm_id: form.firmId,
        firm_name: form.firmName,
        product_id: form.productId || undefined,
        product_name: form.productName || undefined,
        due_date: form.dueDate,
        status: "Sent",
        sent_date: todayISO(),
        sections,
        tenant_id: user?.linked_firm_id,
      });

      // Notify assignee
      await base44.entities.DdNotification.create({
        contact_id: form.assigneeContactId,
        contact_name: form.assigneeContactName,
        type: "questionnaire_sent",
        title: "Questionnaire assigned to you",
        message: `"${created.name}" has been sent to you for completion. Due date: ${fmtDate(form.dueDate)}.`,
        questionnaire_id: created.id,
        firm_name: form.firmName,
        product_name: form.productName || undefined,
        status: "unread",
      });

      queryClient.invalidateQueries({ queryKey: ["questionnaires"] });
      queryClient.invalidateQueries({ queryKey: ["picker_count", "Questionnaire"] });
      toast({ title: "Questionnaire sent", description: `"${created.name}" has been sent to ${form.assigneeContactName}.` });
      onOpenChange(false);
      if (onCreated) onCreated(created);
    } catch (err) {
      toast({ title: "Failed to send questionnaire", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // Update sub-section (auto-save)
  const updateSubSection = async (sectionId, subSectionId, updatedSub) => {
    if (!questionnaire) return;
    const newSections = (questionnaire.sections || []).map((s) => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        sub_sections: (s.sub_sections || []).map((ss) => (ss.id === subSectionId ? updatedSub : ss)),
      };
    });
    const updated = { ...questionnaire, sections: newSections };
    setQuestionnaire(updated);
    try {
      await base44.entities.Questionnaire.update(questionnaire.id, { sections: newSections });
      queryClient.invalidateQueries({ queryKey: ["questionnaires"] });

      // ── Completion milestone notification ──
      // When a sub-section transitions to "completed", check if the entire
      // parent section is now fully completed. If so, notify the requester
      // so they know the assignee hit a completion milestone.
      const prevSub = (questionnaire.sections || [])
        .find((s) => s.id === sectionId)?.sub_sections?.find((ss) => ss.id === subSectionId);
      const wasCompleted = prevSub?.status === "completed";
      const isNowCompleted = updatedSub.status === "completed";

      if (!wasCompleted && isNowCompleted) {
        const section = newSections.find((s) => s.id === sectionId);
        const subs = section?.sub_sections || [];
        const allDone = subs.length > 0 && subs.every((ss) => ss.status === "completed");
        if (allDone) {
          const requesterContactId = questionnaire.requester_contact_id;
          if (requesterContactId) {
            try {
              await base44.entities.DdNotification.create({
                contact_id: requesterContactId,
                contact_name: questionnaire.requester_name || "",
                type: "questionnaire_submitted",
                title: "Questionnaire section completed",
                message: `Section "${section.name}" in "${questionnaire.name}" has been fully completed by ${questionnaire.assignee_contact_name || "the assignee"}.`,
                questionnaire_id: questionnaire.id,
                firm_name: questionnaire.firm_name,
                product_name: questionnaire.product_name || undefined,
                status: "unread",
              });
            } catch {}
          }
        }
      }
    } catch (err) {
      toast({ title: "Failed to save", description: err?.message || "Please try again.", variant: "destructive" });
    }
  };

  // Submit questionnaire
  const handleSubmit = async () => {
    if (!questionnaire) return;
    setSubmitting(true);
    try {
      await base44.entities.Questionnaire.update(questionnaire.id, {
        status: "Submitted",
        submitted_date: todayISO(),
      });

      // Notify requester (via their contact_id)
      const requesterContactId = user?.linked_contact_id;
      if (requesterContactId) {
        await base44.entities.DdNotification.create({
          contact_id: requesterContactId,
          contact_name: user?.full_name || "",
          type: "questionnaire_submitted",
          title: "Questionnaire submitted for review",
          message: `"${questionnaire.name}" has been submitted by ${questionnaire.assignee_contact_name}. Please review to complete the process.`,
          questionnaire_id: questionnaire.id,
          firm_name: questionnaire.firm_name,
          product_name: questionnaire.product_name || undefined,
          status: "unread",
        });
      }

      setQuestionnaire({ ...questionnaire, status: "Submitted", submitted_date: todayISO() });
      queryClient.invalidateQueries({ queryKey: ["questionnaires"] });
      toast({ title: "Questionnaire submitted", description: `"${questionnaire.name}" has been submitted for review.` });
    } catch (err) {
      toast({ title: "Failed to submit", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Start review
  const handleStartReview = async () => {
    if (!questionnaire) return;
    try {
      await base44.entities.Questionnaire.update(questionnaire.id, { status: "Under Review" });
      setQuestionnaire({ ...questionnaire, status: "Under Review" });
      queryClient.invalidateQueries({ queryKey: ["questionnaires"] });
    } catch (err) {
      toast({ title: "Failed to start review", description: err?.message, variant: "destructive" });
    }
  };

  // Complete review
  const handleCompleteReview = async () => {
    if (!questionnaire) return;
    setCompletingReview(true);
    try {
      await base44.entities.Questionnaire.update(questionnaire.id, {
        status: "Completed",
        reviewed_date: todayISO(),
        reviewer_id: user?.id,
        reviewer_name: user?.full_name || "",
      });

      // Notify assignee
      await base44.entities.DdNotification.create({
        contact_id: questionnaire.assignee_contact_id,
        contact_name: questionnaire.assignee_contact_name,
        type: "questionnaire_completed",
        title: "Questionnaire review completed",
        message: `Your questionnaire "${questionnaire.name}" has been reviewed and marked as completed.`,
        questionnaire_id: questionnaire.id,
        firm_name: questionnaire.firm_name,
        product_name: questionnaire.product_name || undefined,
        status: "unread",
      });

      setQuestionnaire({
        ...questionnaire,
        status: "Completed",
        reviewed_date: todayISO(),
        reviewer_id: user?.id,
        reviewer_name: user?.full_name || "",
      });
      queryClient.invalidateQueries({ queryKey: ["questionnaires"] });
      toast({ title: "Review completed", description: `"${questionnaire.name}" has been marked as completed.` });
    } catch (err) {
      toast({ title: "Failed to complete review", description: err?.message, variant: "destructive" });
    } finally {
      setCompletingReview(false);
    }
  };

  // Toggle section expansion
  const toggleSection = (id) => setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));

  // Calculate progress
  const progress = useMemo(() => {
    if (!questionnaire?.sections) return { total: 0, completed: 0, inProgress: 0, pct: 0 };
    let total = 0, completed = 0, inProgress = 0;
    questionnaire.sections.forEach((s) => {
      (s.sub_sections || []).forEach((ss) => {
        total++;
        if (ss.status === "completed") completed++;
        if (ss.status === "in_progress") inProgress++;
      });
    });
    return { total, completed, inProgress, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [questionnaire]);

  const isCreateMode = !editQuestionnaire || editQuestionnaire.status === "Draft";
  const isReadOnly = questionnaire?.status === "Completed";
  const isReviewMode = questionnaire?.status === "Under Review";
  const canAnswer = questionnaire?.status === "Sent" || questionnaire?.status === "In Progress";

  // ─── Render: Create Mode ───
  if (isCreateMode && !questionnaire) {
    return (
      <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-indigo-500" />
              Send Questionnaire
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Template */}
            <div className="space-y-1.5">
              <Label>Questionnaire Template *</Label>
              <SearchableSelect
                value={form.templateId}
                onChange={(v) => {
                  const t = templates.find((x) => x.id === v);
                  setForm((prev) => ({ ...prev, templateId: v, name: prev.name || t?.name || "" }));
                }}
                options={templateOptions}
                placeholder="Select a questionnaire template..."
                emptyText="No questionnaire templates found."
              />
              <button
                type="button"
                onClick={() => setShowCreateTemplate(true)}
                className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mt-1"
              >
                <Plus className="w-3 h-3" /> Create a new template
              </button>
            </div>

            {/* Questionnaire Name */}
            <div className="space-y-1.5">
              <Label htmlFor="q-name">Questionnaire Name</Label>
              <Input
                id="q-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Auto-filled from template, or enter a custom name..."
              />
            </div>

            {/* Requester */}
            <div className="space-y-1.5">
              <Label>Requested By *</Label>
              <Input
                value={form.requesterName}
                onChange={(e) => setForm((prev) => ({ ...prev, requesterName: e.target.value }))}
                placeholder="Requester name..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Request Date */}
              <div className="space-y-1.5">
                <Label>Request Date</Label>
                <DatePicker value={form.requestDate} onChange={(v) => setForm((prev) => ({ ...prev, requestDate: v }))} />
              </div>
              {/* Due Date */}
              <div className="space-y-1.5">
                <Label>Due Date *</Label>
                <DatePicker value={form.dueDate} onChange={(v) => setForm((prev) => ({ ...prev, dueDate: v }))} />
              </div>
            </div>

            {/* Firm */}
            <div className="space-y-1.5">
              <Label>Firm *</Label>
              <QuestionnaireFirmPicker
                value={form.firmId}
                onChange={handleFirmChange}
                firms={firms}
                user={user}
                placeholder="Select a firm..."
              />
            </div>

            {/* Assignee */}
            <div className="space-y-1.5">
              <Label>Assign To (Contact) *</Label>
              <QuestionnaireContactPicker
                value={form.assigneeContactId}
                onChange={handleContactChange}
                contacts={contacts}
                firmId={form.firmId}
                user={user}
                placeholder="Select a contact from this firm..."
                emptyText={form.firmId ? "No contacts found for this firm." : "Select a firm first."}
                disabled={!form.firmId}
              />
            </div>

            {/* Product (optional) */}
            <div className="space-y-1.5">
              <Label>Related Product (optional)</Label>
              <SearchableSelect
                value={form.productId}
                onChange={handleProductChange}
                options={productOptions}
                placeholder="Select a product for document tagging..."
                emptyText={form.firmId ? "No products found for this firm." : "Select a firm first."}
                disabled={!form.firmId}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" onClick={handleSend} disabled={sending || !form.templateId || !form.firmId || !form.assigneeContactId || !form.dueDate}>
              <Send className="w-4 h-4" />
              {sending ? "Sending..." : "Send Questionnaire"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AddTemplateDialog
        open={showCreateTemplate}
        onOpenChange={setShowCreateTemplate}
        defaultTemplateType="Manager Questionnaire"
        onCreated={(created) => {
          queryClient.invalidateQueries({ queryKey: ["questionnaire-templates"] });
          if (created?.template_type === "Manager Questionnaire") {
            setForm((prev) => ({ ...prev, templateId: created.id, name: prev.name || created.name || "" }));
          }
        }}
      />
      </>
    );
  }

  // ─── Render: Answer / Review Mode ───
  const statusConfig = questionnaire ? STATUS_CONFIG[questionnaire.status] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-indigo-500" />
              <span className="truncate">{questionnaire?.name || "Questionnaire"}</span>
            </div>
            {statusConfig && (
              <Badge variant="outline" className={`text-xs ${statusConfig.color}`}>
                {statusConfig.label}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {questionnaire && (
          <div className="space-y-4">
            {/* Metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3">
              <div className="space-y-0.5">
                <span className="text-[10px] text-gray-400 font-medium flex items-center gap-0.5">
                  <User className="w-2.5 h-2.5" /> Requested By
                </span>
                <span className="text-xs text-gray-700">{questionnaire.requester_name || "—"}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-gray-400 font-medium flex items-center gap-0.5">
                  <Mail className="w-2.5 h-2.5" /> Assignee
                </span>
                {onContactClick ? (
                  <button onClick={() => onContactClick({ id: questionnaire.assignee_contact_id })} className="text-xs text-indigo-600 hover:underline">
                    {questionnaire.assignee_contact_name || "—"}
                  </button>
                ) : (
                  <span className="text-xs text-gray-700">{questionnaire.assignee_contact_name || "—"}</span>
                )}
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-gray-400 font-medium flex items-center gap-0.5">
                  <Building2 className="w-2.5 h-2.5" /> Firm
                </span>
                {onFirmClick ? (
                  <button onClick={() => onFirmClick(questionnaire.firm_id)} className="text-xs text-indigo-600 hover:underline">
                    {questionnaire.firm_name || "—"}
                  </button>
                ) : (
                  <span className="text-xs text-gray-700">{questionnaire.firm_name || "—"}</span>
                )}
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-gray-400 font-medium flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" /> Due Date
                </span>
                <span className="text-xs text-gray-700">{fmtDate(questionnaire.due_date)}</span>
              </div>
            </div>

            {/* Progress monitor */}
            {progress.total > 0 && (
              <div className="space-y-1.5 rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Progress</span>
                  <span className="text-xs text-gray-500">
                    {progress.completed} / {progress.total} completed
                    {progress.inProgress > 0 && ` · ${progress.inProgress} in progress`}
                  </span>
                </div>
                <Progress value={progress.pct} className="h-2" />
                <div className="text-right text-[10px] text-gray-400">{progress.pct}%</div>
              </div>
            )}

            {/* Status banners */}
            {questionnaire.status === "Submitted" && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium text-purple-800">Submitted for Review</p>
                    <p className="text-xs text-purple-600">Submitted on {fmtDate(questionnaire.submitted_date)}. Review to complete the process.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowPushResponses(true)}>
                    <ArrowRightToLine className="w-3.5 h-3.5" /> Push Responses
                  </Button>
                  <Button type="button" size="sm" onClick={handleStartReview}>
                    <Eye className="w-3.5 h-3.5" /> Start Review
                  </Button>
                </div>
              </div>
            )}

            {questionnaire.status === "Under Review" && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-600" />
                  <div>
                    <p className="text-sm font-medium text-indigo-800">Under Review</p>
                    <p className="text-xs text-indigo-600">Review the answers below and complete the process.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowPushResponses(true)}>
                    <ArrowRightToLine className="w-3.5 h-3.5" /> Push Responses
                  </Button>
                  <Button type="button" size="sm" onClick={handleCompleteReview} disabled={completingReview}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {completingReview ? "Completing..." : "Complete Review"}
                  </Button>
                </div>
              </div>
            )}

            {questionnaire.status === "Completed" && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium text-emerald-800">Completed</p>
                  <p className="text-xs text-emerald-600">
                    Reviewed by {questionnaire.reviewer_name || "—"} on {fmtDate(questionnaire.reviewed_date)}
                  </p>
                </div>
              </div>
            )}

            {/* Sections */}
            <div className="space-y-2">
              {(questionnaire.sections || []).map((section, sIdx) => (
                <div key={section.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Section header */}
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className="flex items-center gap-2 w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    {expandedSections[section.id]
                      ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                      : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                    }
                    <span className="text-sm font-semibold text-gray-700">
                      Section {sIdx + 1}: {section.name}
                    </span>
                    <span className="text-[10px] text-gray-400 ml-auto">
                      {(section.sub_sections || []).filter(ss => ss.status === "completed").length}/{section.sub_sections?.length || 0} done
                    </span>
                  </button>

                  {/* Sub-sections */}
                  {expandedSections[section.id] && (
                    <div className="p-2 space-y-2">
                      {(section.sub_sections || []).map((ss) => (
                        <QuestionnaireSubSectionItem
                          key={ss.id}
                          subSection={ss}
                          sectionName={section.name}
                          questionnaireId={questionnaire.id}
                          firmId={questionnaire.firm_id}
                          firmName={questionnaire.firm_name}
                          products={products.filter(p => !p.deleted_at && p.firm_id === questionnaire.firm_id)}
                          readOnly={isReadOnly || isReviewMode || !canAnswer}
                          createFirmDocuments={!isExternalParty}
                          onChange={(updated) => updateSubSection(section.id, ss.id, updated)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Submit button */}
            {canAnswer && progress.total > 0 && (
              <div className="flex justify-end pt-2 border-t border-gray-100">
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || progress.completed === 0}
                >
                  <Send className="w-4 h-4" />
                  {submitting ? "Submitting..." : "Submit Questionnaire"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Push responses to Firm/Product/Contact records */}
        <PushResponsesDialog
          open={showPushResponses}
          onOpenChange={setShowPushResponses}
          questionnaire={questionnaire}
          firms={firms}
          products={products}
          contacts={contacts}
        />
      </DialogContent>
    </Dialog>
  );
}