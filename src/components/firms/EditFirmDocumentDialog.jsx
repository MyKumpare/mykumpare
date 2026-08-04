import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Save, Sparkles, Loader2 } from "lucide-react";
import DocumentCategoryPicker from "./DocumentCategoryPicker";
import DocumentProductTagSelect from "./DocumentProductTagSelect";
import { toast } from "@/components/ui/use-toast";

export default function EditFirmDocumentDialog({
  open,
  onOpenChange,
  document,
  firmId,
}) {
  const queryClient = useQueryClient();
  const [file_name, setFileName] = useState("");
  const [entry_date, setEntryDate] = useState("");
  const [document_as_of_date, setAsOfDate] = useState("");
  const [categories, setCategories] = useState([]);
  const [sub_categories, setSubCategories] = useState([]);
  const [description, setDescription] = useState("");
  const [summary, setSummary] = useState("");
  const [productIds, setProductIds] = useState([]);
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    if (!document) return;
    setFileName(document.file_name || "");
    setEntryDate(document.entry_date || "");
    setAsOfDate(document.document_as_of_date || "");
    setCategories(document.categories || []);
    setSubCategories(document.sub_categories || []);
    setDescription(document.description || "");
    setSummary(document.summary || "");
    setProductIds(document.product_ids || []);
  }, [document]);

  const handleSummarize = async () => {
    if (!document?.file_url) {
      toast({
        title: "No document file available to summarize.",
        variant: "destructive",
      });
      return;
    }
    setSummarizing(true);
    try {
      const prompt =
        "Summarize the attached document concisely. Capture its purpose, key points, and notable details in 4-6 sentences. Use only information present in the document; do not invent content.";
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: [document.file_url],
        add_context_from_internet: false,
      });
      const text = typeof res === "string" ? res : res?.summary || String(res || "");
      setSummary(text.trim());
      toast({ title: "Summary generated from document." });
    } catch (e) {
      toast({
        title: "Summarization failed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSummarizing(false);
    }
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FirmDocument.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["firm-documents", firmId] });
      queryClient.invalidateQueries({ queryKey: ["all-firm-documents"] });
    },
  });

  const handleSave = async () => {
    if (!document) return;
    try {
      await updateMutation.mutateAsync({
        id: document.id,
        data: {
          file_name: file_name.trim(),
          entry_date: entry_date || undefined,
          document_as_of_date: document_as_of_date || undefined,
          categories,
          sub_categories,
          description: description || undefined,
          summary: summary || undefined,
          product_ids: productIds,
        },
      });
      toast({ title: "Document updated", description: file_name });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Could not update document",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" />
            Edit Document
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label className="text-xs text-gray-600">File Name</Label>
            <Input
              value={file_name}
              onChange={(e) => setFileName(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Entry Date</Label>
              <Input
                type="date"
                value={entry_date}
                onChange={(e) => setEntryDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">
                Document As of Date
              </Label>
              <Input
                type="date"
                value={document_as_of_date}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Category</Label>
              <DocumentCategoryPicker
                value={categories}
                onChange={setCategories}
                entityName="DocumentCategory"
                placeholder="Search or add category..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Sub-Category</Label>
              <DocumentCategoryPicker
                value={sub_categories}
                onChange={setSubCategories}
                entityName="DocumentSubCategory"
                placeholder="Search or add sub-category..."
                accent="amber"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-gray-600">Description</Label>
            <Textarea
              placeholder="Add a description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-16 text-xs"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-gray-600">Summary</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSummarize}
                disabled={summarizing}
                className="gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50 h-7"
              >
                {summarizing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {summarizing ? "Summarizing..." : "Summarize Document"}
              </Button>
            </div>
            <Textarea
              placeholder="Add a summary of this document..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="min-h-20 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-gray-600">Products</Label>
            <DocumentProductTagSelect
              firmId={firmId}
              value={productIds}
              onChange={setProductIds}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!file_name.trim() || updateMutation.isPending}
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Save className="w-3.5 h-3.5" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}