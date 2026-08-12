import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  FileText,
  Download,
  Files,
  Building,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import AddDocumentDialog from "./AddDocumentDialog";
import EditFirmDocumentDialog from "./EditFirmDocumentDialog";

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "MM/dd/yyyy");
  } catch {
    return iso || "—";
  }
};

// Centralized dashboard showing every uploaded firm document across all firms,
// with columns for firm name, category, and the date stamp (entry date).
export default function DocumentsDashboardModal({ open, onClose }) {
  const [search, setSearch] = useState("");
  const [filterFirm, setFilterFirm] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterSubCategory, setFilterSubCategory] = useState("all");
  const [filterDocDate, setFilterDocDate] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  const [sortKey, setSortKey] = useState("entry_date");
  const [sortDir, setSortDir] = useState("desc");

  const SORT_ACCESSORS = {
    file_name: (d) => (d.file_name || "").toLowerCase(),
    firm_name: (d) => (d.firm_name || "").toLowerCase(),
    categories: (d) => (d.categories || []).join(" ").toLowerCase(),
    sub_categories: (d) => (d.sub_categories || []).join(" ").toLowerCase(),
    document_as_of_date: (d) => d.document_as_of_date || "",
    entry_date: (d) => d.entry_date || "",
  };

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["all-firm-documents"],
    queryFn: () => base44.entities.FirmDocument.filter({ deleted_at: { $exists: false } }, "-entry_date", 1000),
    enabled: open,
  });

  const firms = useMemo(
    () =>
      Array.from(
        new Set(documents.map((d) => d.firm_name).filter(Boolean))
      ).sort(),
    [documents]
  );
  const categories = useMemo(
    () =>
      Array.from(
        new Set(documents.flatMap((d) => d.categories || []))
      ).sort(),
    [documents]
  );
  const subCategories = useMemo(
    () =>
      Array.from(
        new Set(documents.flatMap((d) => d.sub_categories || []))
      ).sort(),
    [documents]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return documents.filter((d) => {
      if (filterFirm !== "all" && d.firm_name !== filterFirm) return false;
      if (filterCategory !== "all" && !(d.categories || []).includes(filterCategory))
        return false;
      if (
        filterSubCategory !== "all" &&
        !(d.sub_categories || []).includes(filterSubCategory)
      )
        return false;
      if (filterDocDate && (d.document_as_of_date || "") !== filterDocDate)
        return false;
      if (q) {
        const hay = `${d.file_name || ""} ${d.firm_name || ""} ${
          d.description || ""
        } ${(d.categories || []).join(" ")} ${(d.sub_categories || []).join(
          " "
        )}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [documents, search, filterFirm, filterCategory, filterSubCategory, filterDocDate]);

  const sorted = useMemo(() => {
    const accessor = SORT_ACCESSORS[sortKey] || SORT_ACCESSORS.entry_date;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const va = accessor(a);
      const vb = accessor(b);
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-gray-100">
          <DialogTitle className="flex items-center gap-2 text-lg justify-between">
            <span className="flex items-center gap-2">
              <Files className="w-5 h-5 text-teal-600" />
              Documents Dashboard
            </span>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs gap-1 bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Document
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Toolbar: search + filters */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search by document, firm, category, description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-xs pl-8"
              />
            </div>
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {filtered.length} of {documents.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="space-y-0.5">
              <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">
                Firm
              </label>
              <Select value={filterFirm} onValueChange={setFilterFirm}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All firms" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="all">All firms</SelectItem>
                  {firms.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-0.5">
              <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">
                Category
              </label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-0.5">
              <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">
                Sub-Category
              </label>
              <Select
                value={filterSubCategory}
                onValueChange={setFilterSubCategory}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All sub-categories" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="all">All sub-categories</SelectItem>
                  {subCategories.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-0.5">
              <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">
                Document Date
              </label>
              <Input
                type="date"
                value={filterDocDate}
                onChange={(e) => setFilterDocDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="text-sm text-gray-400 italic py-10 text-center">
              Loading documents...
            </div>
          ) : documents.length === 0 ? (
            <div className="text-sm text-gray-400 italic py-10 text-center">
              No documents have been uploaded yet. Add documents from a firm's
              Documents tab.
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-gray-400 italic py-10 text-center">
              No documents match the current filters.
            </div>
          ) : (
            <TooltipProvider delayDuration={300}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-100 text-gray-600 z-10">
                <tr className="text-left">
                  {[
                    { key: "file_name", label: "Document" },
                    { key: "firm_name", label: "Firm" },
                    { key: "categories", label: "Category" },
                    { key: "sub_categories", label: "Sub-Categories" },
                    { key: "document_as_of_date", label: "Document Date", nowrap: true },
                    { key: "entry_date", label: "Date Stamp", nowrap: true },
                  ].map((col) => {
                    const active = sortKey === col.key;
                    return (
                      <th
                        key={col.key}
                        className={`px-4 py-2 font-semibold text-xs uppercase tracking-wide ${col.nowrap ? "whitespace-nowrap" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(col.key)}
                          className="inline-flex items-center gap-1 hover:text-teal-700 transition-colors"
                        >
                          {col.label}
                          {active ? (
                            sortDir === "asc" ? (
                              <ArrowUp className="w-3 h-3 text-teal-600" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-teal-600" />
                            )
                          ) : (
                            <ChevronsUpDown className="w-3 h-3 text-gray-300" />
                          )}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-teal-50/40 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {doc.file_url ? (
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex-shrink-0 text-teal-500 hover:text-teal-700"
                            title="Open file"
                          >
                            <FileText className="w-4 h-4" />
                          </a>
                        ) : (
                          <FileText className="w-4 h-4 text-teal-500 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => setEditDoc(doc)}
                                className="text-sm font-medium text-teal-700 hover:text-teal-800 hover:underline truncate block max-w-xs text-left cursor-pointer"
                                title={doc.file_name}
                              >
                                {doc.file_name}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="bottom"
                              align="start"
                              sideOffset={6}
                              className="max-w-sm bg-white text-gray-700 border border-gray-200 shadow-lg px-3 py-2 text-xs leading-relaxed whitespace-normal"
                            >
                              {doc.summary ? (
                                <div>
                                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                                    Summary
                                  </div>
                                  <div>{doc.summary}</div>
                                </div>
                              ) : (
                                <span className="italic text-gray-400">
                                  No summary available for this document.
                                </span>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <Building className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate max-w-[160px]" title={doc.firm_name}>
                          {doc.firm_name || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {doc.categories?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {doc.categories.map((c) => (
                            <span
                              key={c}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {doc.sub_categories?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {doc.sub_categories.map((s) => (
                            <span
                              key={s}
                              className="inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-600 text-xs">
                      {doc.document_as_of_date ? (
                        fmtDate(doc.document_as_of_date)
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-600 text-xs">
                      {fmtDate(doc.entry_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </TooltipProvider>
          )}
        </div>

        <AddDocumentDialog open={addOpen} onOpenChange={setAddOpen} />
        <EditFirmDocumentDialog
          open={!!editDoc}
          onOpenChange={(o) => !o && setEditDoc(null)}
          document={editDoc}
          firmId={editDoc?.firm_id}
        />
      </DialogContent>
    </Dialog>
  );
}