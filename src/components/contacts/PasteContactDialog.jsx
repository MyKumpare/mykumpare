import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ClipboardPaste, Image as ImageIcon, Upload, Loader2, Building2,
  CheckCircle2, AlertTriangle, Plus, ArrowRight,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { findFirmNameDuplicates } from "@/components/firms/firmNameDuplicateCheck";
import { parsePhoneString } from "@/components/ai/firmEnrichment";

const FIRM_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    salutation: { type: "string" },
    first_name: { type: "string" },
    middle_name: { type: "string" },
    last_name: { type: "string" },
    suffix: { type: "string" },
    title: { type: "string" },
    designations: { type: "array", items: { type: "string" } },
    email: { type: "string" },
    phone: { type: "string" },
    linkedin_url: { type: "string" },
    firm_name: { type: "string" },
    website: { type: "string" },
    address: {
      type: "object",
      properties: {
        address_line1: { type: "string" },
        address_line2: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        postal_code: { type: "string" },
        country: { type: "string" },
      },
    },
  },
};

function emptyParsed() {
  return {
    salutation: "", first_name: "", middle_name: "", last_name: "", suffix: "",
    title: "", designations: [], email: "", phone: "", linkedin_url: "",
    firm_name: "", website: "",
    address: { address_line1: "", address_line2: "", city: "", state: "", postal_code: "", country: "" },
  };
}

// Parses pasted contact text OR a business-card photo into structured fields,
// resolves the associated firm (match existing / create new with type + duplicate
// check), then hands the pre-filled data to the standard Add Contact dialog so
// the existing contact duplicate validation runs unchanged.
export default function PasteContactDialog({ open, onClose, onReady, firms: firmsProp = [] }) {
  const { user } = useAuth();
  const [mode, setMode] = useState("text");
  const [rawText, setRawText] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [firmType, setFirmType] = useState("");
  const [resolvedFirmId, setResolvedFirmId] = useState(null);
  const [creatingFirm, setCreatingFirm] = useState(false);
  const [newFirmId, setNewFirmId] = useState(null);
  const [firmSearch, setFirmSearch] = useState("");
  const fileInputRef = useRef(null);

  const { data: liveFirms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date"),
  });
  const firms = liveFirms.length > 0 ? liveFirms : firmsProp;

  useEffect(() => {
    if (open) {
      setMode("text");
      setRawText("");
      setPhotoUrl("");
      setParsed(null);
      setFirmType("");
      setResolvedFirmId(null);
      setNewFirmId(null);
      setFirmSearch("");
    }
  }, [open]);

  // Firm duplicate check against the parsed firm name (current firm creation validation)
  const firmDuplicates = useMemo(() => {
    if (!parsed?.firm_name) return [];
    return findFirmNameDuplicates(parsed.firm_name, firms);
  }, [parsed, firms]);

  const exactFirm = firmDuplicates.find((d) => d.score >= 0.99) || null;
  const similarFirms = firmDuplicates.filter((d) => d.score < 0.99);

  const activeFirmId = resolvedFirmId || newFirmId || exactFirm?.firm?.id || null;
  const activeFirmName = activeFirmId ? (firms.find((f) => f.id === activeFirmId)?.name || "") : "";

  const handleParse = async () => {
    if (mode === "text" && !rawText.trim()) {
      toast({ title: "Nothing to parse", description: "Paste some contact information first.", variant: "destructive" });
      return;
    }
    if (mode === "photo" && !photoUrl) {
      toast({ title: "No photo", description: "Upload a business card photo first.", variant: "destructive" });
      return;
    }
    setParsing(true);
    try {
      const prompt = mode === "text"
        ? `You are extracting contact information from the text below (it may be an email signature, a directory listing, or a business card transcription). Extract only what is explicitly present — do not fabricate. Return a JSON object with: salutation, first_name, middle_name, last_name, suffix, title, designations (array of professional credentials such as CFA, CPA, MBA, PhD), email, phone (full phone string as written), linkedin_url, firm_name (the company/organization), website, and address (object with address_line1, address_line2, city, state, postal_code, country). Leave any field empty/null if not present.\n\nText:\n"""\n${rawText.trim().substring(0, 6000)}\n"""`
        : `You are extracting contact information from a business card image. Read the card and extract only what is visible — do not fabricate. Return a JSON object with: salutation, first_name, middle_name, last_name, suffix, title, designations (array of professional credentials such as CFA, CPA, MBA, PhD), email, phone (full phone string as printed), linkedin_url, firm_name (the company/organization), website, and address (object with address_line1, address_line2, city, state, postal_code, country). Leave any field empty/null if not present on the card.`;
      const args = { prompt, response_json_schema: EXTRACT_SCHEMA };
      if (mode === "photo") args.file_urls = [photoUrl];
      const res = await base44.integrations.Core.InvokeLLM(args);
      const data = { ...emptyParsed(), ...(res || {}) };
      if (!data.address || typeof data.address !== "object") data.address = emptyParsed().address;
      setParsed(data);
      setResolvedFirmId(null);
      setNewFirmId(null);
      setFirmType("");
      toast({ title: "✅ Information extracted", description: "Review the fields and resolve the firm before continuing." });
    } catch (err) {
      toast({ title: "Extraction failed", description: err?.message || "Could not parse the information.", variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotoUrl(file_url);
    } catch (err) {
      toast({ title: "Upload failed", description: err?.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleCreateFirm = async () => {
    if (!parsed?.firm_name?.trim()) {
      toast({ title: "Firm name required", variant: "destructive" });
      return;
    }
    if (!firmType) {
      toast({ title: "Select a firm type", variant: "destructive" });
      return;
    }
    setCreatingFirm(true);
    try {
      const firm = await base44.entities.Firm.create({
        name: parsed.firm_name.trim(),
        firm_type: firmType,
        firm_types: [firmType],
        website: parsed.website?.trim() || undefined,
        tenant_id: user?.linked_firm_id,
      });
      setNewFirmId(firm.id);
      setResolvedFirmId(null);
      toast({ title: "✅ Firm created", description: firm.name });
    } catch (err) {
      toast({ title: "Failed to create firm", description: err?.message, variant: "destructive" });
    } finally {
      setCreatingFirm(false);
    }
  };

  const canContinue = !!(parsed && parsed.first_name?.trim() && parsed.last_name?.trim() && activeFirmId);

  const handleContinue = () => {
    if (!parsed) return;
    if (!parsed.first_name?.trim() || !parsed.last_name?.trim()) {
      toast({ title: "First and last name required", variant: "destructive" });
      return;
    }
    if (!activeFirmId) {
      toast({ title: "Resolve the firm first", description: "Match or create the associated firm before continuing.", variant: "destructive" });
      return;
    }
    const phoneObj = parsed.phone ? parsePhoneString(parsed.phone) : null;
    const address = parsed.address || {};
    const hasAddress = !!(address.address_line1 || address.city || address.state || address.postal_code || address.country);
    const initialData = {
      salutation: parsed.salutation || "",
      first_name: parsed.first_name || "",
      middle_name: parsed.middle_name || "",
      last_name: parsed.last_name || "",
      suffix: parsed.suffix || "",
      title: parsed.title || "",
      designations: Array.isArray(parsed.designations) ? parsed.designations : [],
      email: parsed.email || "",
      linkedin_url: parsed.linkedin_url || "",
      biography: "",
      notes: "",
      phones: phoneObj ? [{ ...phoneObj, id: crypto.randomUUID(), is_default: true }] : [],
      addresses: hasAddress ? [{ ...address, id: crypto.randomUUID(), is_primary: true }] : [],
      firm_ids: [activeFirmId],
    };
    onReady(initialData);
  };

  const filteredFirms = useMemo(() => {
    if (!firmSearch.trim()) return [];
    const q = firmSearch.toLowerCase();
    return firms.filter((f) => !f.deleted_at && f.name.toLowerCase().includes(q)).slice(0, 8);
  }, [firmSearch, firms]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="w-5 h-5 text-indigo-600" />
            Add Contact from Text or Business Card
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 pr-1 space-y-4">
          {!parsed ? (
            <>
              <Tabs value={mode} onValueChange={setMode}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="text" className="gap-1.5"><ClipboardPaste className="w-3.5 h-3.5" /> Paste Text</TabsTrigger>
                  <TabsTrigger value="photo" className="gap-1.5"><ImageIcon className="w-3.5 h-3.5" /> Business Card</TabsTrigger>
                </TabsList>
                <TabsContent value="text" className="space-y-2 mt-3">
                  <Label className="text-xs font-medium text-gray-600">Paste contact information</Label>
                  <Textarea
                    autoFocus
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder={"Paste an email signature, directory listing, or contact details here…\n\nExample:\nJohn Smith, CFA\nPortfolio Manager\nAcme Capital LLC\njohn.smith@acmecapital.com\n(212) 555-1234\nlinkedin.com/in/johnsmith\n123 Main St, New York, NY 10001"}
                    className="min-h-[180px] text-sm"
                  />
                  <p className="text-[11px] text-gray-400">The system will parse this into the contact fields, then check for an existing firm and duplicates.</p>
                </TabsContent>
                <TabsContent value="photo" className="space-y-2 mt-3">
                  <Label className="text-xs font-medium text-gray-600">Upload a business card photo</Label>
                  <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
                  {photoUrl ? (
                    <div className="flex items-center gap-3">
                      <img src={photoUrl} alt="Business card" className="w-32 h-20 object-cover rounded-md border border-gray-200" />
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Replace
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="text-red-500" onClick={() => setPhotoUrl("")}>Remove</Button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                      className="w-full border-2 border-dashed border-gray-200 rounded-lg py-8 flex flex-col items-center gap-2 text-gray-400 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                      {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                      <span className="text-sm font-medium">Click to upload a business card photo</span>
                      <span className="text-xs">JPG, PNG up to ~10MB</span>
                    </button>
                  )}
                </TabsContent>
              </Tabs>

              <div className="flex justify-end">
                <Button type="button" onClick={handleParse} disabled={parsing} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
                  {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  {parsing ? "Parsing…" : "Parse & Review"}
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Parsed review */}
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Extracted information — review and edit
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <Field label="Salutation" value={parsed.salutation} onChange={(v) => setParsed({ ...parsed, salutation: v })} />
                  <Field label="First name *" value={parsed.first_name} onChange={(v) => setParsed({ ...parsed, first_name: v })} />
                  <Field label="Middle name" value={parsed.middle_name} onChange={(v) => setParsed({ ...parsed, middle_name: v })} />
                  <Field label="Last name *" value={parsed.last_name} onChange={(v) => setParsed({ ...parsed, last_name: v })} />
                  <Field label="Suffix" value={parsed.suffix} onChange={(v) => setParsed({ ...parsed, suffix: v })} />
                  <Field label="Title" value={parsed.title} onChange={(v) => setParsed({ ...parsed, title: v })} />
                  <Field label="Email" value={parsed.email} onChange={(v) => setParsed({ ...parsed, email: v })} full />
                  <Field label="Phone" value={parsed.phone} onChange={(v) => setParsed({ ...parsed, phone: v })} />
                  <Field label="LinkedIn URL" value={parsed.linkedin_url} onChange={(v) => setParsed({ ...parsed, linkedin_url: v })} full />
                  <Field label="Designations (comma-separated)" value={(parsed.designations || []).join(", ")} onChange={(v) => setParsed({ ...parsed, designations: v.split(",").map((s) => s.trim()).filter(Boolean) })} full />
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  <Field label="Address line 1" value={parsed.address?.address_line1 || ""} onChange={(v) => setParsed({ ...parsed, address: { ...parsed.address, address_line1: v } })} />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Field label="City" value={parsed.address?.city || ""} onChange={(v) => setParsed({ ...parsed, address: { ...parsed.address, city: v } })} />
                    <Field label="State" value={parsed.address?.state || ""} onChange={(v) => setParsed({ ...parsed, address: { ...parsed.address, state: v } })} />
                    <Field label="Postal code" value={parsed.address?.postal_code || ""} onChange={(v) => setParsed({ ...parsed, address: { ...parsed.address, postal_code: v } })} />
                    <Field label="Country" value={parsed.address?.country || ""} onChange={(v) => setParsed({ ...parsed, address: { ...parsed.address, country: v } })} />
                  </div>
                </div>
              </div>

              {/* Firm resolution */}
              <div className="rounded-lg border border-gray-200 p-3 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                  <Building2 className="w-3.5 h-3.5 text-indigo-500" /> Associated Firm
                </div>
                <Field label="Firm / company name" value={parsed.firm_name || ""} onChange={(v) => setParsed({ ...parsed, firm_name: v })} full />
                <Field label="Firm website" value={parsed.website || ""} onChange={(v) => setParsed({ ...parsed, website: v })} full />

                {activeFirmId ? (
                  <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm text-emerald-700">Will associate with <strong>{activeFirmName}</strong></span>
                    <Button type="button" variant="ghost" size="sm" className="ml-auto h-7 text-xs text-gray-500" onClick={() => { setResolvedFirmId(null); setNewFirmId(null); }}>Change</Button>
                  </div>
                ) : exactFirm ? (
                  <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm text-emerald-700">Matched existing firm: <strong>{exactFirm.firm.name}</strong></span>
                    <Button type="button" size="sm" className="ml-auto h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setResolvedFirmId(exactFirm.firm.id)}>Associate</Button>
                  </div>
                ) : similarFirms.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-amber-700">
                      <AlertTriangle className="w-3.5 h-3.5" /> Similar firm(s) already exist — use one or create a new one.
                    </div>
                    {similarFirms.map((d) => (
                      <div key={d.firm.id} className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
                        <span className="text-sm text-gray-700 flex-1 truncate">{d.firm.name}</span>
                        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setResolvedFirmId(d.firm.id)}>Use existing</Button>
                      </div>
                    ))}
                    <CreateNewFirmRow firmType={firmType} setFirmType={setFirmType} onCreate={handleCreateFirm} creating={creatingFirm} />
                  </div>
                ) : parsed.firm_name?.trim() ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Plus className="w-3.5 h-3.5" /> No matching firm found. Select a firm type to create it.
                    </div>
                    <CreateNewFirmRow firmType={firmType} setFirmType={setFirmType} onCreate={handleCreateFirm} creating={creatingFirm} />
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">Enter a firm name above to check for an existing firm or create a new one.</div>
                )}

                {/* Manual firm search fallback */}
                {!activeFirmId && (
                  <div className="pt-1 border-t">
                    <Label className="text-[11px] text-gray-500">Or search for an existing firm</Label>
                    <input
                      value={firmSearch}
                      onChange={(e) => setFirmSearch(e.target.value)}
                      placeholder="Type a firm name…"
                      className="mt-1 w-full h-8 rounded-md border border-gray-200 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                    {filteredFirms.length > 0 && (
                      <div className="mt-1 max-h-32 overflow-y-auto rounded-md border border-gray-200 divide-y divide-gray-100">
                        {filteredFirms.map((f) => (
                          <button key={f.id} type="button" className="w-full text-left px-2 py-1.5 text-sm hover:bg-indigo-50 hover:text-indigo-700" onClick={() => { setResolvedFirmId(f.id); setFirmSearch(""); }}>
                            {f.name} <span className="text-xs text-gray-400 ml-1">{f.firm_type}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="pt-2 border-t gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {parsed && (
            <Button onClick={handleContinue} disabled={!canContinue} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
              <ArrowRight className="w-4 h-4" /> Review in Contact Form
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, full }) {
  return (
    <div className={full ? "col-span-2 sm:col-span-3 space-y-1" : "space-y-1"}>
      <Label className="text-[11px] text-gray-500">{label}</Label>
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-8 rounded-md border border-gray-200 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
      />
    </div>
  );
}

function CreateNewFirmRow({ firmType, setFirmType, onCreate, creating }) {
  return (
    <div className="flex items-end gap-2 rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
      <div className="flex-1 space-y-1">
        <Label className="text-[11px] text-gray-500">Firm type *</Label>
        <Select value={firmType} onValueChange={setFirmType}>
          <SelectTrigger className="h-8 text-sm bg-white"><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>
            {FIRM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button type="button" size="sm" className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white gap-1" onClick={onCreate} disabled={creating || !firmType}>
        {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        Create firm
      </Button>
    </div>
  );
}