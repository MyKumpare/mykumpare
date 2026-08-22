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
import { findContactDuplicates, findContactsByNormalizedName } from "@/components/contacts/contactDuplicateCheck";
import { cleanContactNameFields } from "@/components/contacts/designationDetector";
import { Loader2, Search, Download, Link2, ChevronDown, ChevronRight, User, ExternalLink, CheckCircle2, ArrowLeft, AlertCircle } from "lucide-react";

export default function ScrapeContactsFromUrlDialog({ open, onOpenChange, firmId, firmName }) {
  const [url, setUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [expanded, setExpanded] = useState(new Set());
  const [step, setStep] = useState("review"); // "review" | "confirm"

  const queryClient = useQueryClient();

  const reset = () => {
    setUrl("");
    setResults(null);
    setError("");
    setSelected(new Set());
    setExpanded(new Set());
    setStep("review");
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

    setStep("confirm");
  };

  const handleConfirmSave = async () => {
    const contacts = results?.contacts || [];
    const toImport = contacts.filter((_, i) => selected.has(i));
    if (toImport.length === 0) return;

    setImporting(true);
    let created = 0;
    let linked = 0;
    let skipped = 0;
    let failed = 0;

    // Honor the duplicate-validation protocol: load existing contacts and
    // check each scraped person against them before creating. A match is
    // linked to this firm instead of duplicated; a near-match is skipped so
    // the user can review it via the Duplicate Contacts tool.
    let existingContacts = [];
    try {
      existingContacts = await base44.entities.Contact.list("-created_date", 5000);
    } catch { /* proceed with empty list — creates will still work */ }

    for (const c of toImport) {
      try {
        // Strip designations from name fields so "Best, CFA" → "Best" and CFA
        // goes into the designations array. Prevents "CFA, CFA" display and
        // ensures the duplicate check compares clean names.
        const cleaned = cleanContactNameFields(c);
        const probeData = {
          first_name: cleaned.first_name,
          last_name: cleaned.last_name,
          email: c.email || "",
          phones: c.phones || [],
          photo_url: c.photo_url || "",
        };
        const dups = findContactDuplicates(probeData, existingContacts);
        const normDups = dups.length > 0 ? [] : findContactsByNormalizedName(probeData, existingContacts);

        if (dups.length > 0 || normDups.length > 0) {
          const best = (dups[0]?.contact) || normDups[0]?.contact;
          if (firmId) {
            const existingFirmIds = best.firm_ids || [];
            if (!existingFirmIds.includes(firmId)) {
              await base44.entities.Contact.update(best.id, { firm_ids: [...existingFirmIds, firmId] });
              linked++;
            } else {
              skipped++;
            }
          } else {
            skipped++;
          }
          continue;
        }

        const payload = {
          first_name: cleaned.first_name,
          last_name: cleaned.last_name,
          title: c.title || "",
          photo_url: c.photo_url || "",
          bio_url: c.bio_url || "",
          biography: c.biography || "",
          email: c.email || "",
          linkedin_url: c.linkedin_url || "",
          phones: c.phones || [],
          designations: cleaned.designations,
          education: c.education || [],
          professional_experience: c.professional_experience || [],
          firm_ids: firmId ? [firmId] : [],
        };
        const createdContact = await base44.entities.Contact.create(payload);
        existingContacts.push(createdContact);
        created++;
      } catch {
        failed++;
      }
    }
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    const parts = [];
    if (created > 0) parts.push(`${created} added`);
    if (linked > 0) parts.push(`${linked} linked to ${firmName || "firm"}`);
    if (skipped > 0) parts.push(`${skipped} already existed`);
    if (failed > 0) parts.push(`${failed} failed`);
    if (created > 0 || linked > 0) {
      toast({
        title: "✅ Contacts imported",
        description: parts.join(", ") + ".",
      });
    } else if (skipped > 0) {
      toast({
        title: "No new contacts",
        description: `All ${skipped} scraped contact${skipped > 1 ? "s" : ""} already exist${skipped > 1 ? "" : "s"}${firmName ? ` and ${skipped > 1 ? "are" : "is"} already linked to ${firmName}` : ""}.`,
      });
    } else {
      toast({ title: "Import failed", description: "Could not import any contacts.", variant: "destructive" });
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

          {/* Results — Review step */}
          {results && !scraping && step === "review" && (
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
                            ) : null}
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

          {/* Confirmation step */}
          {results && !scraping && step === "confirm" && (() => {
            const contacts = results.contacts || [];
            const toImport = contacts.filter((_, i) => selected.has(i));
            const withEmail = toImport.filter((c) => c.email).length;
            const withPhone = toImport.filter((c) => c.phones?.length > 0).length;
            const withLinkedIn = toImport.filter((c) => c.linkedin_url).length;
            const withBio = toImport.filter((c) => c.biography).length;
            const withEducation = toImport.filter((c) => c.education?.length > 0).length;
            const withExperience = toImport.filter((c) => c.professional_experience?.length > 0).length;
            const withDesignations = toImport.filter((c) => c.designations?.length > 0).length;
            const withPhoto = toImport.filter((c) => c.photo_url).length;
            return (
              <div className="flex-1 overflow-y-auto space-y-4">
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                    <p className="text-sm font-medium text-indigo-900">
                      Please review the summary below before saving.
                    </p>
                  </div>
                  <p className="text-sm text-indigo-700">
                    You are about to add <span className="font-semibold">{toImport.length}</span> new contact{toImport.length !== 1 ? "s" : ""}
                    {firmName ? <> to <span className="font-semibold">{firmName}</span></> : ""}.
                    This action cannot be undone.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <p className="text-xs text-gray-500 mb-1">Contacts to add</p>
                    <p className="text-2xl font-semibold text-gray-900">{toImport.length}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <p className="text-xs text-gray-500 mb-1">Source URL</p>
                    <p className="text-xs font-medium text-gray-900 truncate" title={results.url}>{results.url}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Data coverage</p>
                  <div className="space-y-1.5">
                    {[
                      { label: "Email", count: withEmail, total: toImport.length },
                      { label: "Phone", count: withPhone, total: toImport.length },
                      { label: "LinkedIn URL", count: withLinkedIn, total: toImport.length },
                      { label: "Biography", count: withBio, total: toImport.length },
                      { label: "Designations", count: withDesignations, total: toImport.length },
                      { label: "Education", count: withEducation, total: toImport.length },
                      { label: "Experience", count: withExperience, total: toImport.length },
                      { label: "Photo", count: withPhoto, total: toImport.length },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{row.label}</span>
                        <span className={`font-medium ${row.count === row.total ? "text-green-600" : row.count > 0 ? "text-gray-900" : "text-gray-400"}`}>
                          {row.count} / {row.total}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Contacts</p>
                  <div className="space-y-1.5">
                    {toImport.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {c.photo_url ? (
                            <img src={c.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{c.first_name} {c.last_name}</p>
                          <p className="text-xs text-gray-500 truncate">{c.title || "—"}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {c.email && <span className="text-xs text-green-600" title="Has email">✓</span>}
                          {c.linkedin_url && <span className="text-xs text-blue-600" title="Has LinkedIn">in</span>}
                          {c.biography && <span className="text-xs text-gray-400" title="Has bio">bio</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        <DialogFooter className="flex items-center justify-between">
          {step === "review" ? (
            <>
              <div className="text-sm text-gray-500">
                {selected.size > 0 && `${selected.size} selected for import`}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} disabled={scraping || importing}>
                  Cancel
                </Button>
                {results && (
                  <Button onClick={handleImport} disabled={importing || selected.size === 0} className="gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Review & Confirm ({selected.size > 0 ? selected.size : 0})
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm text-gray-500">
                {importing ? "Saving contacts..." : "Ready to save"}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("review")} disabled={importing} className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button onClick={handleConfirmSave} disabled={importing || selected.size === 0} className="gap-2">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {importing ? "Saving..." : `Confirm & Save ${selected.size > 0 ? selected.size : ""} Contact${selected.size !== 1 ? "s" : ""}`}
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}