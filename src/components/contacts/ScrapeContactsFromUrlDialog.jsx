import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Search, Download, Link2, ChevronDown, ChevronRight, User, ExternalLink } from "lucide-react";

export default function ScrapeContactsFromUrlDialog({ open, onOpenChange, firmId, firmName }) {
  const [url, setUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [expanded, setExpanded] = useState(new Set());

  const queryClient = useQueryClient();

  const reset = () => {
    setUrl("");
    setResults(null);
    setError("");
    setSelected(new Set());
    setExpanded(new Set());
  };

  const handleScrape = async () => {
    if (!url.trim()) return;
    setScraping(true);
    setError("");
    setResults(null);
    setSelected(new Set());
    setExpanded(new Set());
    try {
      const res = await base44.functions.invoke("scrapeContactsFromUrl", { url: url.trim() });
      const data = res?.data || res;
      if (data.error) {
        setError(data.error);
      } else {
        setResults(data);
        // Pre-select all contacts by default
        const allIds = new Set((data.contacts || []).map((_, i) => i));
        setSelected(allIds);
      }
    } catch (e) {
      const msg = e?.message || "";
      if (msg.includes("timeout") || msg.includes("Timeout") || msg.includes("502") || msg.includes("aborted")) {
        setError("The scrape took too long and timed out. Try a more specific page (e.g. a single team page rather than the full site). The site may also be blocking automated access.");
      } else {
        setError(msg || "Failed to scrape the URL. The site may be blocking automated access.");
      }
    } finally {
      setScraping(false);
    }
  };

  const toggleSelect = (idx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      if (prev.size === (results?.contacts || []).length) return new Set();
      return new Set((results?.contacts || []).map((_, i) => i));
    });
  };

  const toggleExpand = (idx) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleImport = async () => {
    const contacts = results?.contacts || [];
    const toImport = contacts.filter((_, i) => selected.has(i));
    if (toImport.length === 0) return;

    setImporting(true);
    let success = 0;
    let failed = 0;
    for (const c of toImport) {
      try {
        const payload = {
          first_name: c.first_name,
          last_name: c.last_name,
          title: c.title || "",
          photo_url: c.photo_url || "",
          bio_url: c.bio_url || "",
          biography: c.biography || "",
          email: c.email || "",
          linkedin_url: c.linkedin_url || "",
          phones: c.phones || [],
          designations: c.designations || [],
          education: c.education || [],
          professional_experience: c.professional_experience || [],
          firm_ids: firmId ? [firmId] : [],
        };
        await base44.entities.Contact.create(payload);
        success++;
      } catch {
        failed++;
      }
    }
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    if (success > 0) {
      toast({
        title: "✅ Contacts imported",
        description: `${success} contact${success > 1 ? "s" : ""} added${firmName ? ` to ${firmName}` : ""}${failed > 0 ? `, ${failed} failed` : ""}.`,
      });
    } else {
      toast({ title: "Import failed", description: "Could not import any contacts. They may already exist.", variant: "destructive" });
    }
    setImporting(false);
    reset();
    onOpenChange(false);
  };

  const handleClose = () => {
    if (!scraping && !importing) {
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-indigo-600" />
            Scrape Contacts from URL
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
          {/* URL input */}
          <div className="flex gap-2">
            <Input
              placeholder="https://example.com/team"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !scraping && handleScrape()}
              disabled={scraping}
            />
            <Button onClick={handleScrape} disabled={scraping || !url.trim()} className="gap-2 flex-shrink-0">
              {scraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {scraping ? "Scraping..." : "Scrape"}
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Paste a team, staff, or people page URL. The system will extract all contacts, follow sub-page links, and drill into individual profiles for full details.
          </p>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Loading state */}
          {scraping && (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                <p className="text-sm text-gray-600">Fetching page, extracting contacts, and drilling into profiles...</p>
                <p className="text-xs text-gray-400">This may take up to a minute for pages with many contacts.</p>
              </div>
            </div>
          )}

          {/* Results */}
          {results && !scraping && (
            <div className="flex-1 overflow-y-auto space-y-2">
              <div className="flex items-center justify-between sticky top-0 bg-background py-1 z-10">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{results.totalPeopleFound || (results.contacts || []).length}</span> contacts found
                  {results.subPagesScraped?.length > 0 && (
                    <span className="text-gray-400"> · {results.subPagesScraped.length} sub-page{results.subPagesScraped.length > 1 ? "s" : ""} followed</span>
                  )}
                  {results.drilledCount > 0 && (
                    <span className="text-gray-400"> · {results.drilledCount} profiles enriched</span>
                  )}
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={toggleAll}>
                  {selected.size === (results.contacts || []).length ? "Deselect all" : "Select all"}
                </Button>
              </div>

              {(results.contacts || []).map((contact, idx) => {
                const isExpanded = expanded.has(idx);
                const isSelected = selected.has(idx);
                const hasDetails = contact.drilled || contact.biography || contact.email || contact.linkedin_url || (contact.education && contact.education.length > 0) || (contact.professional_experience && contact.professional_experience.length > 0);
                return (
                  <div key={idx} className={`rounded-lg border ${isSelected ? "border-indigo-300 bg-indigo-50/30" : "border-gray-200 bg-white"}`}>
                    <div className="flex items-start gap-2 p-2.5">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(idx)}
                        className="mt-1 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {contact.photo_url ? (
                              <img src={contact.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {contact.first_name} {contact.last_name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{contact.title || "—"}</p>
                          </div>
                          {hasDetails && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(idx)}
                              className="flex-shrink-0 text-gray-400 hover:text-gray-600 p-1"
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          )}
                          {contact.bio_url && (
                            <a
                              href={contact.bio_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0 text-gray-400 hover:text-indigo-600 p-1"
                              title="View source profile"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        {hasDetails && isExpanded && (
                          <div className="mt-2 ml-10 space-y-1.5 text-xs">
                            {contact.email && (
                              <p className="text-gray-600"><span className="font-medium">Email:</span> {contact.email}</p>
                            )}
                            {contact.linkedin_url && (
                              <p className="text-gray-600">
                                <span className="font-medium">LinkedIn:</span>{" "}
                                <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate inline-block max-w-[300px] align-bottom">
                                  {contact.linkedin_url}
                                </a>
                              </p>
                            )}
                            {contact.phones?.length > 0 && (
                              <p className="text-gray-600">
                                <span className="font-medium">Phone:</span>{" "}
                                {contact.phones.map((p) => `(${p.area_code}) ${p.number_mid}-${p.number_last}`).join(", ")}
                              </p>
                            )}
                            {contact.designations?.length > 0 && (
                              <p className="text-gray-600"><span className="font-medium">Designations:</span> {contact.designations.join(", ")}</p>
                            )}
                            {contact.biography && (
                              <p className="text-gray-600 line-clamp-4"><span className="font-medium">Bio:</span> {contact.biography}</p>
                            )}
                            {contact.education?.length > 0 && (
                              <div>
                                <p className="font-medium text-gray-600">Education:</p>
                                <ul className="ml-3 list-disc text-gray-500">
                                  {contact.education.map((e, i) => (
                                    <li key={i}>{e.institution}{e.degree ? ` — ${e.degree}` : ""}{e.graduation_year ? ` (${e.graduation_year})` : ""}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {contact.professional_experience?.length > 0 && (
                              <div>
                                <p className="font-medium text-gray-600">Experience:</p>
                                <ul className="ml-3 list-disc text-gray-500">
                                  {contact.professional_experience.map((e, i) => (
                                    <li key={i}>{e.company_name}{e.title ? ` — ${e.title}` : ""}{e.start_year ? ` (${e.start_year}${e.end_year ? `–${e.end_year}` : "–present"})` : ""}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {!contact.drilled && contact.bio_url && (
                              <p className="text-gray-400 italic">Basic info only (profile not drilled — time limit reached)</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {selected.size > 0 && `${selected.size} selected for import`}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={scraping || importing}>
              Cancel
            </Button>
            {results && (
              <Button onClick={handleImport} disabled={importing || selected.size === 0} className="gap-2">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {importing ? "Importing..." : `Import ${selected.size > 0 ? selected.size : ""} Contact${selected.size !== 1 ? "s" : ""}`}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}