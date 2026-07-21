import React, { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileText,
  Trash2,
  X,
  Search,
  Download,
  Plus,
  Save,
  Pencil,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import DocumentCategoryPicker from "./DocumentCategoryPicker";
import SimilarDocumentDialog from "./SimilarDocumentDialog";
import EditFirmDocumentDialog from "./EditFirmDocumentDialog";
import { toast } from "@/components/ui/use-toast";

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "MM/dd/yyyy");
  } catch {
    return iso || "—";
  }
};
const fmtMonth = (iso) => {
  if (!iso) return "(No date)";
  try {
    return format(parseISO(iso), "MM/yyyy");
  } catch {
    return "(No date)";
  }
};
const todayISO = () => format(new Date(), "yyyy-MM-dd");
const normalizeName = (s) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s]/g, "");

export default function FirmDocumentsTab({ firmId, firmName }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [pending, setPending] = useState([]); // uploaded-but-unsaved drafts
  const [uploading, setUploading] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState(null); // { draft, matches }
  const [deleteId, setDeleteId] = useState(null);
  const [editingDoc, setEditingDoc] = useState(null);

  // list controls
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterSub, setFilterSub] = useState("all");
  const [groupBy, setGroupBy] = useState("none");
  const [sortBy, setSortBy] = useState("entry_date_desc");
  const [collapsed, setCollapsed] = useState({});

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["firm-documents", firmId],
    queryFn: () =>
      base44.entities.FirmDocument.filter({ firm_id: firmId }, "-created_date", 500),
    enabled: !!firmId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.FirmDocument.create(data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["firm-documents", firmId] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FirmDocument.delete(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["firm-documents", firmId] }),
  });

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const drafts = [];
    for (const file of Array.from(files)) {
      try {
        const res = await base44.integrations.Core.UploadFile({ file });
        const file_url = res?.file_url || "";
        if (!file_url) continue;
        drafts.push({
          id: crypto.randomUUID(),
          file_url,
          file_name: file.name,
          file_type: file.type || file.name.split(".").pop() || "",
          entry_date: todayISO(), // auto date-stamped
          document_as_of_date: "",
          categories: [],
          sub_categories: [],
          description: "",
          summary: "",
        });
      } catch {
        toast({
          title: "Upload failed",
          description: file.name,
          variant: "destructive",
        });
      }
    }
    setPending((prev) => [...prev, ...drafts]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateDraft = (id, patch) =>
    setPending((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d))
    );
  const removeDraft = (id) => setPending((prev) => prev.filter((d) => d.id !== id));

  // Duplicate detection: a document with the same normalized name already exists.
  const findDuplicates = (draft) =>
    documents.filter(
      (d) => normalizeName(d.file_name) === normalizeName(draft.file_name)
    );

  const saveDraft = (draft) => {
    const matches = findDuplicates(draft);
    if (matches.length > 0) {
      setDuplicateCheck({ draft, matches });
      return;
    }
    doCreate(draft);
  };

  const doCreate = async (draft) => {
    try {
      await createMutation.mutateAsync({
        firm_id: firmId,
        firm_name: firmName,
        file_url: draft.file_url,
        file_name: draft.file_name,
        file_type: draft.file_type,
        entry_date: draft.entry_date,
        document_as_of_date: draft.document_as_of_date || undefined,
        categories: draft.categories,
        sub_categories: draft.sub_categories,
        description: draft.description || undefined,
        summary: draft.summary || undefined,
      });
      removeDraft(draft.id);
      toast({ title: "Document saved", description: draft.file_name });
    } catch (e) {
      toast({
        title: "Could not save document",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = (doc) => {
    if (
      window.confirm(
        `Delete "${doc.file_name}"? This will permanently remove the document record.`
      )
    ) {
      deleteMutation.mutate(doc.id);
    }
  };

  const allCats = useMemo(
    () =>
      Array.from(
        new Set(documents.flatMap((d) => d.categories || []))
      ).sort(),
    [documents]
  );
  const allSubs = useMemo(
    () =>
      Array.from(
        new Set(documents.flatMap((d) => d.sub_categories || []))
      ).sort(),
    [documents]
  );

  const filtered = useMemo(() => {
    const list = documents.filter((d) => {
      if (filterCat !== "all" && !(d.categories || []).includes(filterCat))
        return false;
      if (filterSub !== "all" && !(d.sub_categories || []).includes(filterSub))
        return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${d.file_name} ${d.description || ""} ${
          (d.categories || []).join(" ")
        } ${(d.sub_categories || []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const sortFns = {
      entry_date_desc: (a, b) =>
        (b.entry_date || "").localeCompare(a.entry_date || ""),
      entry_date_asc: (a, b) =>
        (a.entry_date || "").localeCompare(b.entry_date || ""),
      file_name_asc: (a, b) =>
        (a.file_name || "").localeCompare(b.file_name || ""),
      file_name_desc: (a, b) =>
        (b.file_name || "").localeCompare(a.file_name || ""),
      as_of_desc: (a, b) =>
        (b.document_as_of_date || "").localeCompare(
          a.document_as_of_date || ""
        ),
      as_of_asc: (a, b) =>
        (a.document_as_of_date || "").localeCompare(
          b.document_as_of_date || ""
        ),
    };
    return [...list].sort(sortFns[sortBy] || sortFns.entry_date_desc);
  }, [documents, filterCat, filterSub, search, sortBy]);

  const grouped = useMemo(() => {
    if (groupBy === "none") return [{ key: "All Documents", items: filtered }];
    const groups = {};
    for (const d of filtered) {
      let keys;
      if (groupBy === "category")
        keys =
          d.categories && d.categories.length ? d.categories : ["(Uncategorized)"];
      else if (groupBy === "sub_category")
        keys =
          d.sub_categories && d.sub_categories.length
            ? d.sub_categories
            : ["(Uncategorized)"];
      else if (groupBy === "entry_month") keys = [fmtMonth(d.entry_date)];
      else if (groupBy === "as_of_month") keys = [fmtMonth(d.document_as_of_date)];
      else keys = ["All Documents"];
      for (const k of keys) (groups[k] = groups[k] || []).push(d);
    }
    return Object.keys(groups)
      .sort()
      .map((k) => ({ key: k, items: groups[k] }));
  }, [filtered, groupBy]);

  const DocRow = ({ doc }) => (
    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors">
      <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={doc.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-gray-800 hover:text-indigo-600 truncate"
          >
            {doc.file_name}
          </a>
          <span className="text-xs text-gray-400">
            Entry {fmtDate(doc.entry_date)}
          </span>
          {doc.document_as_of_date && (
            <span className="text-xs text-gray-400">
              · As of {fmtDate(doc.document_as_of_date)}
            </span>
          )}
        </div>
        {(doc.categories?.length > 0 || doc.sub_categories?.length > 0) && (
          <div className="flex flex-wrap gap-1 mt-1">
            {(doc.categories || []).map((c) => (
              <span
                key={c}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700"
              >
                {c}
              </span>
            ))}
            {(doc.sub_categories || []).map((c) => (
              <span
                key={c}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"
              >
                {c}
              </span>
            ))}
          </div>
        )}
        {doc.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
            {doc.description}
          </p>
        )}
        {doc.summary && (
          <div className="mt-1.5 rounded-md bg-gray-50 border border-gray-200 px-2 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Summary
            </span>
            <p className="text-xs text-gray-600 mt-0.5 line-clamp-3">
              {doc.summary}
            </p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <a
          href={doc.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 text-gray-400 hover:text-indigo-600"
          title="Download / open"
        >
          <Download className="w-3.5 h-3.5" />
        </a>
        <button
          type="button"
          onClick={() => setEditingDoc(doc)}
          className="p-1.5 text-gray-400 hover:text-indigo-600"
          title="Edit"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => handleDelete(doc)}
          className="p-1.5 text-gray-400 hover:text-red-500"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Upload + pending drafts */}
      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="w-3.5 h-3.5" />
          {uploading ? "Uploading..." : "Upload Documents"}
        </Button>

        {pending.length > 0 && (
          <div className="space-y-3 pt-1">
            {pending.map((draft) => (
              <div
                key={draft.id}
                className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-800 truncate">
                      {draft.file_name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDraft(draft.id)}
                    className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0"
                    title="Discard"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Entry Date</Label>
                    <div className="h-8 px-2 flex items-center rounded-md border bg-white text-xs text-gray-700">
                      {fmtDate(draft.entry_date)}{" "}
                      <span className="text-gray-400 ml-1">(auto)</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">
                      Document As of Date
                    </Label>
                    <Input
                      type="date"
                      value={draft.document_as_of_date}
                      onChange={(e) =>
                        updateDraft(draft.id, {
                          document_as_of_date: e.target.value,
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Category</Label>
                    <DocumentCategoryPicker
                      value={draft.categories}
                      onChange={(v) => updateDraft(draft.id, { categories: v })}
                      entityName="DocumentCategory"
                      placeholder="Search or add category..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Sub-Category</Label>
                    <DocumentCategoryPicker
                      value={draft.sub_categories}
                      onChange={(v) =>
                        updateDraft(draft.id, { sub_categories: v })
                      }
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
                    value={draft.description}
                    onChange={(e) =>
                      updateDraft(draft.id, { description: e.target.value })
                    }
                    className="min-h-16 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Summary</Label>
                  <Textarea
                    placeholder="Add a summary of this document..."
                    value={draft.summary}
                    onChange={(e) =>
                      updateDraft(draft.id, { summary: e.target.value })
                    }
                    className="min-h-20 text-xs"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={() => saveDraft(draft)}
                    disabled={createMutation.isPending}
                  >
                    <Save className="w-3.5 h-3.5" />
                    {createMutation.isPending ? "Saving..." : "Save Document"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toolbar: filter / group / sort / search */}
      <div className="rounded-lg border border-gray-200 p-2.5 space-y-2 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs pl-8"
            />
          </div>
          <span className="text-xs text-gray-400">
            {filtered.length} of {documents.length}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Filter Category</Label>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                <SelectItem value="all">All categories</SelectItem>
                {allCats.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Filter Sub-Category</Label>
            <Select value={filterSub} onValueChange={setFilterSub}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                <SelectItem value="all">All sub-categories</SelectItem>
                {allSubs.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Group By</Label>
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No grouping</SelectItem>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="sub_category">Sub-Category</SelectItem>
                <SelectItem value="entry_month">Entry Date (month)</SelectItem>
                <SelectItem value="as_of_month">As of Date (month)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Sort By</Label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entry_date_desc">Entry date (newest)</SelectItem>
                <SelectItem value="entry_date_asc">Entry date (oldest)</SelectItem>
                <SelectItem value="file_name_asc">Name (A–Z)</SelectItem>
                <SelectItem value="file_name_desc">Name (Z–A)</SelectItem>
                <SelectItem value="as_of_desc">As of date (newest)</SelectItem>
                <SelectItem value="as_of_asc">As of date (oldest)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Document list (grouped) */}
      {isLoading ? (
        <div className="text-sm text-gray-400 italic py-3 text-center">
          Loading documents...
        </div>
      ) : documents.length === 0 && pending.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-3 text-center border border-dashed border-gray-200 rounded-xl">
          No documents yet. Click "Upload Documents" to add one or more files.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-3 text-center border border-dashed border-gray-200 rounded-xl">
          No documents match the current filters.
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((group) => (
            <div key={group.key} className="space-y-1.5">
              {groupBy !== "none" && (
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [group.key]: !c[group.key] }))
                  }
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-800"
                >
                  {collapsed[group.key] ? (
                    <Plus className="w-3.5 h-3.5" />
                  ) : (
                    <X className="w-3.5 h-3.5 rotate-45" />
                  )}
                  {group.key}{" "}
                  <span className="text-gray-400 font-normal">
                    ({group.items.length})
                  </span>
                </button>
              )}
              {!collapsed[group.key] && (
                <div className="space-y-2">
                  {group.items.map((doc) => (
                    <DocRow key={doc.id} doc={doc} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <SimilarDocumentDialog
        open={!!duplicateCheck}
        newDoc={duplicateCheck?.draft}
        matches={duplicateCheck?.matches}
        onAccept={() => {
          const draft = duplicateCheck?.draft;
          setDuplicateCheck(null);
          if (draft) doCreate(draft);
        }}
        onReject={() => {
          const draft = duplicateCheck?.draft;
          setDuplicateCheck(null);
          if (draft) {
            removeDraft(draft.id);
            toast({
              title: "Document rejected",
              description: "The duplicate upload was discarded.",
            });
          }
        }}
      />

      <EditFirmDocumentDialog
        open={!!editingDoc}
        onOpenChange={(o) => !o && setEditingDoc(null)}
        document={editingDoc}
        firmId={firmId}
      />
    </div>
  );
}