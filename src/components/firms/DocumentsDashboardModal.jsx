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
} from "lucide-react";
import { format, parseISO } from "date-fns";

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

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["all-firm-documents"],
    queryFn: () => base44.entities.FirmDocument.list("-entry_date", 1000),
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-gray-100">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Files className="w-5 h-5 text-teal-600" />
            Documents Dashboard
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
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-100 text-gray-600 z-10">
                <tr className="text-left">
                  <th className="px-4 py-2 font-semibold text-xs uppercase tracking-wide">
                    Document
                  </th>
                  <th className="px-4 py-2 font-semibold text-xs uppercase tracking-wide">
                    Firm
                  </th>
                  <th className="px-4 py-2 font-semibold text-xs uppercase tracking-wide">
                    Category
                  </th>
                  <th className="px-4 py-2 font-semibold text-xs uppercase tracking-wide">
                    Sub-Categories
                  </th>
                  <th className="px-4 py-2 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">
                    Document Date
                  </th>
                  <th className="px-4 py-2 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">
                    Date Stamp
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-teal-50/40 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-teal-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-gray-800 hover:text-teal-600 truncate block max-w-xs"
                            title={doc.file_name}
                          >
                            {doc.file_name}
                          </a>
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}