import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Globe, Check, X, Sparkles, AlertTriangle, ShieldCheck } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { enrichFirmFromWeb, autoFillMissingLinkedInUrls } from "../ai/firmEnrichment";
import { validateEnrichment } from "../ai/enrichmentValidation";
import { logEnrichmentAttempt } from "../ai/enrichmentLogger";
import TeamHierarchyView from "./TeamHierarchyView";
import { Network as NetworkIcon, List as ListIcon } from "lucide-react";

// ─── Progress bar ───
function ProgressBar({ value, className }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`w-full h-1.5 bg-gray-200 rounded-full overflow-hidden ${className || ""}`}>
      <div
        className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Loading stage cycler ───
// The initial web scrape is a single backend function call, so we can't get
// real progress from it. Instead we cycle through human-readable status
// messages based on elapsed time so the user knows what's happening.
const LOADING_STAGES = [
  { label: "Fetching website", detail: "Connecting to the public website" },
  { label: "Reading page content", detail: "Scraping text, links, and images" },
  { label: "Extracting firm details", detail: "Parsing logo, description, addresses" },
  { label: "Finding personnel", detail: "Discovering team members and bios" },
  { label: "Deep-reading profiles", detail: "Extracting education and experience" },
  { label: "Finalizing", detail: "Organizing data for review" },
];

function useLoadingProgress(active) {
  const [stageIdx, setStageIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setStageIdx(0);
      setElapsed(0);
      return;
    }
    startRef.current = Date.now();
    setStageIdx(0);
    setElapsed(0);
    const interval = setInterval(() => {
      const secs = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsed(secs);
      // Advance stage roughly every 5 seconds, capped at last stage.
      const idx = Math.min(LOADING_STAGES.length - 1, Math.floor(secs / 5));
      setStageIdx(idx);
    }, 1000);
    return () => clearInterval(interval);
  }, [active]);

  if (!active) return null;
  const stage = LOADING_STAGES[stageIdx];
  const pct = ((stageIdx + 1) / LOADING_STAGES.length) * 100;
  return { ...stage, elapsed, pct };
}

// ─── Status badge ───
function StatusBadge({ status }) {
  if (status === "exact") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
        <X className="w-2.5 h-2.5" /> Already exists
      </span>
    );
  }
  if (status === "similar") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
        <AlertTriangle className="w-2.5 h-2.5" /> Similar to existing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
      <ShieldCheck className="w-2.5 h-2.5" /> New
    </span>
  );
}

// ─── Row wrappers (now accept a `status` + disabled state) ───

function RowShell({ label, display, accepted, onToggle, status, children }) {
  const isDuplicate = status === "exact";
  return (
    <div className={`flex items-start gap-2 py-1.5 px-2 rounded-md border border-transparent hover:border-gray-100 ${isDuplicate ? "bg-gray-50 opacity-60" : "hover:bg-gray-50"}`}>
      <Checkbox checked={isDuplicate ? false : accepted} onCheckedChange={onToggle} disabled={isDuplicate} className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <StatusBadge status={status} />
        </div>
        {children || <p className="text-sm text-gray-800 break-words">{display}</p>}
      </div>
    </div>
  );
}

function FieldRow({ label, value, accepted, onToggle, status }) {
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) return null;
  const display = Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value);
  if (!display || !display.trim()) return null;
  const truncated = display.length > 120 ? display.substring(0, 120) + "..." : display;
  return <RowShell label={label} display={truncated} accepted={accepted} onToggle={onToggle} status={status} />;
}

function AddressRow({ address, index, accepted, onToggle, status }) {
  if (!address || (!address.address_line1 && !address.city)) return null;
  const parts = [address.address_line1, address.address_line2, address.city, address.state, address.postal_code, address.country].filter(Boolean);
  return (
    <RowShell label={`Address ${address.is_headquarters ? "(HQ)" : `#${index + 1}`}`} accepted={accepted} onToggle={onToggle} status={status}>
      <p className="text-sm text-gray-800 break-words">{parts.join(", ")}</p>
    </RowShell>
  );
}

function PhoneRow({ phone, index, accepted, onToggle, status }) {
  if (!phone) return null;
  const hasParts = phone.area_code && phone.number_mid && phone.number_last;
  const display = hasParts
    ? `+${phone.country_code || "1"} (${phone.area_code}) ${phone.number_mid}-${phone.number_last}`
    : phone.country_code || "";
  if (!display.trim()) return null;
  return <RowShell label={`Phone ${phone.phone_type ? `(${phone.phone_type})` : `#${index + 1}`}`} display={display} accepted={accepted} onToggle={onToggle} status={status} />;
}

function LogoRow({ logoUrl, accepted, onToggle, status }) {
  if (!logoUrl) return null;
  return (
    <RowShell label="Firm Logo" accepted={accepted} onToggle={onToggle} status={status}>
      <div className="flex items-center gap-2">
        <img src={logoUrl} alt="Logo" className="w-10 h-10 object-contain rounded border border-gray-200 flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
        <p className="text-xs text-gray-500 truncate">{logoUrl}</p>
      </div>
    </RowShell>
  );
}

function PersonRow({ person, index, accepted, onToggle, status }) {
  if (!person || (!person.first_name && !person.last_name)) return null;
  const fullName = [person.first_name, person.last_name].filter(Boolean).join(" ");
  const bio = person.biography || "";
  return (
    <RowShell label={`Person ${status === "exact" ? "(existing)" : `#${index + 1}`}`} accepted={accepted} onToggle={onToggle} status={status}>
      {person.photo_url ? (
        <img src={person.photo_url} alt={fullName} className="w-8 h-8 rounded-full object-cover border border-gray-200 flex-shrink-0 mb-1" onError={(e) => { e.target.style.display = 'none'; }} />
      ) : null}
      <p className="text-sm text-gray-800 font-medium">{fullName}{person.title ? ` — ${person.title}` : ""}</p>
      {person.email && <p className="text-xs text-gray-500">{person.email}</p>}
      {person.phone && <p className="text-xs text-gray-500">{person.phone}</p>}
      {person.linkedin_url && <p className="text-xs text-indigo-500 truncate">{person.linkedin_url}</p>}
      {bio && <p className="text-xs text-gray-600 mt-0.5">{bio.length > 100 ? bio.substring(0, 100) + "..." : bio}</p>}
    </RowShell>
  );
}

// ─── Similar-items confirmation dialog ───
function SimilarConfirmDialog({ open, onOpenChange, items, onConfirm }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Similar to existing data
          </DialogTitle>
          <DialogDescription>
            The following items look similar to data you already have. Would you like to add them?
            Exact duplicates are already blocked automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2 max-h-[45vh] overflow-y-auto">
          {items.map((it, i) => (
            <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
              <p className="text-xs font-semibold text-amber-700">{it.label}</p>
              {it.detail && <p className="text-xs text-gray-600 mt-0.5">{it.detail}</p>}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Skip similar</Button>
          <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => { onConfirm(); onOpenChange(false); }}>
            Accept &amp; add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main panel ───

export default function FirmEnrichmentPanel({ firmName, website, onApply, onClose, onLoadingChange, existingFirm, existingContacts = [] }) {
  const [loading, setLoading] = useState(false);
  const [linkedinFilling, setLinkedinFilling] = useState(false);
  const [linkedinProgress, setLinkedinProgress] = useState(null);
  const [enrichedData, setEnrichedData] = useState(null);
  const [error, setError] = useState(null);
  const [acceptedFields, setAcceptedFields] = useState({});
  const [statusMap, setStatusMap] = useState({});
  const [similarConfirm, setSimilarConfirm] = useState(null);
  const [teamView, setTeamView] = useState(false);
  const loadingProgress = useLoadingProgress(loading);

  // Re-run duplicate validation + accepted-fields initialization whenever the
  // enriched data changes (including when background LinkedIn lookups update it).
  const initValidation = (data) => {
    const { items } = validateEnrichment(data, existingFirm || {}, existingContacts);
    const smap = {};
    const initial = {};
    for (const it of items) {
      smap[it.key] = it.status;
      initial[it.key] = it.status !== "exact";
    }
    setStatusMap(smap);
    setAcceptedFields(initial);
  };

  const handleFetch = async () => {
    setLoading(true);
    onLoadingChange?.(true);
    setError(null);
    setEnrichedData(null);
    try {
      const data = await enrichFirmFromWeb(firmName, website);

      // Persist a log entry so the user can review enrichment results later.
      const { items: validationItems } = validateEnrichment(data, existingFirm || {}, existingContacts);
      logEnrichmentAttempt({
        firmName,
        websiteUrl: website || data.website || "",
        status: "success",
        validationItems,
      });

      // Show the review panel immediately — the website scrape already found
      // most LinkedIn URLs from the HTML. The slower web-search fallback for
      // any remaining contacts runs in the background and updates the panel
      // incrementally so the user isn't blocked waiting for it.
      setEnrichedData(data);
      initValidation(data);

      // Background LinkedIn auto-fill: find URLs the website scrape missed for
      // the firm and any contacts still without one. Runs non-blocking so the
      // user can review the already-fetched data while lookups are in flight.
      setLinkedinFilling(true);
      setLinkedinProgress(null);
      (async () => {
        try {
          await autoFillMissingLinkedInUrls(data, website || data.website || "", (p) => {
            setLinkedinProgress(p);
          });
          // Re-run validation to pick up any newly-found LinkedIn URLs.
          setEnrichedData((prev) => {
            if (!prev) return prev;
            // Shallow-merge so React sees a new reference.
            const updated = { ...prev };
            if (data.linkedin_url) updated.linkedin_url = data.linkedin_url;
            if (data.people) updated.people = data.people.map((p) => ({ ...p }));
            initValidation(updated);
            return updated;
          });
        } catch { /* non-fatal — keep enrichment data as-is */ }
        setLinkedinFilling(false);
        setLinkedinProgress(null);
      })();
    } catch (err) {
      const msg = err.message || "Failed to fetch data from the web";
      setError(msg);
      logEnrichmentAttempt({
        firmName,
        websiteUrl: website || "",
        status: "error",
        errorMessage: msg,
      });
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  };

  const toggleField = (key) => {
    if (statusMap[key] === "exact") return; // blocked
    setAcceptedFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const buildSelected = () => {
    const selected = {};
    if (!enrichedData) return selected;
    if (acceptedFields.description && enrichedData.description) selected.description = enrichedData.description;
    if (acceptedFields.website && enrichedData.website) selected.website = enrichedData.website;
    if (acceptedFields.email && enrichedData.email) selected.email = enrichedData.email;
    if (acceptedFields.linkedin_url && enrichedData.linkedin_url) selected.linkedin_url = enrichedData.linkedin_url;
    if (acceptedFields.year_founded && enrichedData.year_founded) selected.year_founded = enrichedData.year_founded;
    if (acceptedFields.firm_types && enrichedData.firm_types?.length) selected.firm_types = enrichedData.firm_types;
    const selAddresses = (enrichedData.addresses || [])
      .filter((_, i) => acceptedFields[`address_${i}`])
      .map((a) => ({ ...a, id: crypto.randomUUID() }));
    if (selAddresses.length) selected.addresses = selAddresses;
    const selPhones = (enrichedData.phones || [])
      .filter((_, i) => acceptedFields[`phone_${i}`])
      .map((p) => ({ ...p, id: crypto.randomUUID() }));
    if (selPhones.length) selected.phones = selPhones;
    if (acceptedFields.logo_url && enrichedData.logo_url) selected.logo_url = enrichedData.logo_url;
    const selPeople = (enrichedData.people || [])
      // Include existing (exact-match) people too: the apply handler runs an
      // append-only merge that only fills MISSING fields (e.g. a biography
      // that wasn't on the listing page last time), never overwriting
      // existing data. This lets re-enrichment populate bios for contacts
      // that were created earlier without one.
      .filter((p, i) => (acceptedFields[`person_${i}`] || statusMap[`person_${i}`] === "exact") && (p.first_name || p.last_name));
    if (selPeople.length) selected.people = selPeople;
    return selected;
  };

  const selectedSimilar = useMemo(() => {
    if (!enrichedData) return [];
    const out = [];
    const push = (key, label, detail) => {
      if (acceptedFields[key] && statusMap[key] === "similar") out.push({ key, label, detail });
    };
    if (acceptedFields.logo_url && statusMap.logo_url === "similar") out.push({ key: "logo_url", label: "Firm Logo", detail: enrichedData.logo_url });
    if (acceptedFields.description && statusMap.description === "similar") out.push({ key: "description", label: "Description", detail: (enrichedData.description || "").substring(0, 100) + "..." });
    if (acceptedFields.website && statusMap.website === "similar") out.push({ key: "website", label: "Website", detail: enrichedData.website });
    if (acceptedFields.email && statusMap.email === "similar") out.push({ key: "email", label: "Email", detail: enrichedData.email });
    if (acceptedFields.linkedin_url && statusMap.linkedin_url === "similar") out.push({ key: "linkedin_url", label: "LinkedIn", detail: enrichedData.linkedin_url });
    if (acceptedFields.year_founded && statusMap.year_founded === "similar") out.push({ key: "year_founded", label: "Year Founded", detail: String(enrichedData.year_founded) });
    if (acceptedFields.firm_types && statusMap.firm_types === "similar") out.push({ key: "firm_types", label: "Firm Types", detail: (enrichedData.firm_types || []).join(", ") });
    (enrichedData.addresses || []).forEach((a, i) => push(`address_${i}`, `Address: ${[a.address_line1, a.city].filter(Boolean).join(", ")}`, null));
    (enrichedData.phones || []).forEach((p, i) => push(`phone_${i}`, `Phone: ${p.country_code || ""} ${p.area_code || ""}${p.number_mid || ""}${p.number_last || ""}`, null));
    (enrichedData.people || []).forEach((person, i) => {
      if (acceptedFields[`person_${i}`] && statusMap[`person_${i}`] === "similar") {
        const fullName = [person.first_name, person.last_name].filter(Boolean).join(" ");
        out.push({ key: `person_${i}`, label: `Person: ${fullName}${person.title ? ` — ${person.title}` : ""}`, detail: person.email || "" });
      }
    });
    return out;
  }, [acceptedFields, statusMap, enrichedData]);

  const handleApply = () => {
    // If the user has selected any "similar" items, prompt for explicit
    // confirmation before adding them (standard global validation process).
    if (selectedSimilar.length > 0) {
      setSimilarConfirm({ items: selectedSimilar });
      return;
    }
    onApply(buildSelected());
  };

  const handleConfirmSimilar = () => {
    onApply(buildSelected());
  };

  // hasAccepted is true when there are non-except items accepted, OR when
  // there are exact-match people — buildSelected() includes exact-match people
  // for an append-only merge that fills in MISSING fields (e.g. photos, bios),
  // so the user must be able to apply even when all people are "exact".
  const hasAccepted = Object.entries(acceptedFields).some(([k, v]) => v && statusMap[k] !== "exact") ||
    Object.entries(statusMap).some(([k, v]) => v === "exact" && k.startsWith("person_"));

  if (!enrichedData && !loading && !error) {
    return (
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-indigo-600" />
          <p className="text-sm font-medium text-indigo-700">Auto-fill from Web</p>
        </div>
        <p className="text-xs text-gray-600">
          Search the web for <strong>{firmName}</strong>'s public website and automatically fill in fields like logo, description, address, phone, LinkedIn, key personnel, and more. Exact duplicates are blocked automatically; similar data will ask for your confirmation.
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleFetch} className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Search Web
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-8 text-xs text-gray-500">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (loading && loadingProgress) {
    return (
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-indigo-600 animate-spin flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-indigo-700">{loadingProgress.label}…</p>
              {loadingProgress.elapsed > 0 && (
                <span className="text-[11px] text-gray-400 tabular-nums">{loadingProgress.elapsed}s</span>
              )}
            </div>
            <p className="text-xs text-gray-500">{loadingProgress.detail} for {firmName}</p>
          </div>
        </div>
        <ProgressBar value={loadingProgress.pct} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <X className="w-4 h-4 text-red-500" />
          <p className="text-sm font-medium text-red-600">Search Failed</p>
        </div>
        <p className="text-xs text-gray-600">{error}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleFetch} className="h-8 text-xs">Retry</Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-8 text-xs text-gray-500">Close</Button>
        </div>
      </div>
    );
  }

  const hasData = enrichedData && (
    enrichedData.description ||
    enrichedData.website ||
    enrichedData.email ||
    enrichedData.linkedin_url ||
    enrichedData.year_founded ||
    enrichedData.firm_types?.length ||
    enrichedData.addresses?.length ||
    enrichedData.phones?.length ||
    enrichedData.logo_url ||
    enrichedData.people?.length
  );

  if (!hasData) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <X className="w-4 h-4 text-amber-500" />
          <p className="text-sm font-medium text-amber-700">No data found</p>
        </div>
        <p className="text-xs text-gray-600">Could not extract enough information for <strong>{firmName}</strong>{website ? ` from ${website}` : ""}. Please verify the website URL is correct, or try again.</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleFetch} className="h-8 text-xs">Try Again</Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-8 text-xs text-gray-500">Close</Button>
        </div>
      </div>
    );
  }

  const exactCount = Object.values(statusMap).filter((s) => s === "exact").length;
  const similarCount = Object.values(statusMap).filter((s) => s === "similar").length;

  return (
    <div className="rounded-lg border border-indigo-200 bg-white p-3 space-y-2">
      {similarConfirm && (
        <SimilarConfirmDialog
          open={!!similarConfirm}
          onOpenChange={(v) => { if (!v) setSimilarConfirm(null); }}
          items={similarConfirm.items}
          onConfirm={handleConfirmSimilar}
        />
      )}
      {linkedinFilling && (
        <div className="rounded-md bg-indigo-50 border border-indigo-100 px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin flex-shrink-0" />
            <p className="text-xs text-indigo-700 font-medium flex-1">
              Finding LinkedIn URLs in the background…
            </p>
            {linkedinProgress && linkedinProgress.total > 0 && (
              <span className="text-[11px] text-indigo-600 tabular-nums font-medium">
                {linkedinProgress.current}/{linkedinProgress.total}
              </span>
            )}
          </div>
          {linkedinProgress && linkedinProgress.total > 0 && (
            <ProgressBar value={(linkedinProgress.current / linkedinProgress.total) * 100} />
          )}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-green-600" />
          <p className="text-sm font-medium text-gray-800">Data found — review & select</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {(exactCount > 0 || similarCount > 0) && (
        <div className="flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
          {exactCount > 0 && <span className="inline-flex items-center gap-1"><X className="w-3 h-3" /> {exactCount} exact duplicate(s) blocked</span>}
          {similarCount > 0 && <span className="inline-flex items-center gap-1 text-amber-600"><AlertTriangle className="w-3 h-3" /> {similarCount} similar — needs review</span>}
        </div>
      )}

      <div className="max-h-80 overflow-y-auto space-y-0.5">
        <LogoRow logoUrl={enrichedData.logo_url} accepted={acceptedFields.logo_url} onToggle={() => toggleField("logo_url")} status={statusMap.logo_url} />
        <FieldRow label="Description" value={enrichedData.description} accepted={acceptedFields.description} onToggle={() => toggleField("description")} status={statusMap.description} />
        <FieldRow label="Website" value={enrichedData.website} accepted={acceptedFields.website} onToggle={() => toggleField("website")} status={statusMap.website} />
        <FieldRow label="Email" value={enrichedData.email} accepted={acceptedFields.email} onToggle={() => toggleField("email")} status={statusMap.email} />
        <FieldRow label="LinkedIn" value={enrichedData.linkedin_url} accepted={acceptedFields.linkedin_url} onToggle={() => toggleField("linkedin_url")} status={statusMap.linkedin_url} />
        <FieldRow label="Year Founded" value={enrichedData.year_founded} accepted={acceptedFields.year_founded} onToggle={() => toggleField("year_founded")} status={statusMap.year_founded} />
        <FieldRow label="Firm Types" value={enrichedData.firm_types} accepted={acceptedFields.firm_types} onToggle={() => toggleField("firm_types")} status={statusMap.firm_types} />
        {(enrichedData.addresses || []).map((addr, i) => (
          <AddressRow key={`addr-${i}`} address={addr} index={i} accepted={acceptedFields[`address_${i}`]} onToggle={() => toggleField(`address_${i}`)} status={statusMap[`address_${i}`]} />
        ))}
        {(enrichedData.phones || []).map((phone, i) => (
          <PhoneRow key={`ph-${i}`} phone={phone} index={i} accepted={acceptedFields[`phone_${i}`]} onToggle={() => toggleField(`phone_${i}`)} status={statusMap[`phone_${i}`]} />
        ))}
        {/* People section: toggle between flat list and team hierarchy view */}
        {(enrichedData.people?.length > 0) && (
          <div className="pt-2 mt-1 border-t border-gray-100">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                Personnel ({enrichedData.people.length})
              </p>
              <button
                type="button"
                onClick={() => setTeamView(v => !v)}
                className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md transition-colors ${
                  teamView ? "bg-indigo-100 text-indigo-700" : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {teamView ? (
                  <><ListIcon className="w-3 h-3" /> List view</>
                ) : (
                  <><NetworkIcon className="w-3 h-3" /> Team structure</>
                )}
              </button>
            </div>
            {teamView ? (
              <TeamHierarchyView people={enrichedData.people} firmName={firmName} />
            ) : (
              <div className="space-y-0.5">
                {(enrichedData.people || []).map((person, i) => (
                  <PersonRow key={`ppl-${i}`} person={person} index={i} accepted={acceptedFields[`person_${i}`]} onToggle={() => toggleField(`person_${i}`)} status={statusMap[`person_${i}`]} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-1.5 border-t">
        <p className="text-xs text-gray-400">{Object.values(acceptedFields).filter(Boolean).length} field(s) selected</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setAcceptedFields({})} className="h-8 text-xs gap-1">
            <X className="w-3 h-3" /> Clear
          </Button>
          <Button size="sm" onClick={handleApply} disabled={!hasAccepted} className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1">
            <Check className="w-3.5 h-3.5" /> {hasAccepted && !Object.entries(acceptedFields).some(([k, v]) => v && statusMap[k] !== "exact") ? "Update Existing" : "Apply Selected"}
          </Button>
        </div>
      </div>
    </div>
  );
}