import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Check, Plus, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { findContactDuplicates } from "@/components/contacts/contactDuplicateCheck";
import { useFirmOwner } from "@/components/admin/useFirmOwner";
import DueDiligenceStagePicker from "./DueDiligenceStagePicker";
import { useDueDiligenceStages, DD_STAGE_NOT_STARTED } from "./useDueDiligenceStages";

const DD_STATUSES = ["Pipeline", "Buy List", "Rejected"];
const PROCESS_STATUSES = ["Not Started", "In-process", "Completed"];
const PRODUCT_TYPES = ["Investment Manager Product", "Multi-Manager Product"];
const FIRM_TYPES = ["Manager of Managers", "Investment Manager", "Allocator", "Investment Consultant", "Securities Brokerage", "Trade Organizations"];

const contactName = (c) => [c?.first_name, c?.last_name].filter(Boolean).join(" ").trim();

// Capitalize the first letter of each word in a product name (preserves acronyms/numbers like "S&P 500").
function titleCaseProductName(str) {
  return str.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

// Reusable searchable single-select with an optional footer action.
function SearchableSelect({ options, value, onChange, placeholder, excludeValues = [], footer }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () =>
      options.filter(
        (o) =>
          !excludeValues.includes(o.value) &&
          o.label.toLowerCase().includes(search.toLowerCase())
      ),
    [options, search, excludeValues]
  );
  const selected = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between h-9 text-sm font-normal">
          <span className={selected ? "text-gray-900 truncate" : "text-gray-400"}>{selected ? selected.label : placeholder}</span>
          <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <div className="p-2 border-b">
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-sm" autoFocus />
        </div>
        <div className="max-h-52 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400 italic">No results</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 flex items-center gap-2"
                onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
              >
                <Check className={cn("w-3.5 h-3.5 shrink-0", value === o.value ? "opacity-100 text-indigo-600" : "opacity-0")} />
                <span className="truncate">{o.label}</span>
              </button>
            ))
          )}
        </div>
        {footer && <div className="border-t">{footer}</div>}
      </PopoverContent>
    </Popover>
  );
}

// Inline "add new contact" form with duplicate validation, reused for both analysts.
function NewContactForm({ firmId, existingContacts, onCreated, onCancel }) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const draft = { first_name: firstName, last_name: lastName, email };
  const duplicates = (firstName.trim() || lastName.trim() || email.trim())
    ? findContactDuplicates(draft, existingContacts)
    : [];
  const isValid = firstName.trim() && lastName.trim() && !saving;

  const handleCreate = async () => {
    if (!isValid) return;
    setSaving(true);
    setError("");
    try {
      const created = await base44.entities.Contact.create({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || undefined,
        firm_ids: [firmId],
      });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      onCreated?.(created);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to create contact. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-indigo-700">Add New Contact</span>
        <button type="button" onClick={onCancel}><span className="text-xs text-gray-400 hover:text-gray-600">cancel</span></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-8 text-sm" autoFocus />
        <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-8 text-sm" />
      </div>
      <Input placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 text-sm" />
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
      {duplicates.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Potential duplicate:</p>
          {duplicates.map((d) => (
            <div key={d.contact.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-amber-50 border border-amber-200">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 truncate">{d.name}</p>
                <p className="text-[11px] text-gray-500 truncate">{d.reasons.join(", ")}</p>
              </div>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 shrink-0" onClick={() => onCreated?.(d.contact)}>
                Use Existing
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 justify-end pt-0.5">
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
        <Button type="button" size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" disabled={!isValid} onClick={handleCreate}>
          {saving ? "Adding..." : "Add Contact"}
        </Button>
      </div>
    </div>
  );
}

// Inline "add new product" form with duplicate validation.
function NewProductForm({ firmId, firmName, existingProducts, onCreated, onCancel }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [productType, setProductType] = useState(PRODUCT_TYPES[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const matches = name.trim().length >= 2
    ? existingProducts.filter((p) => {
        const existing = (p.name || "").toLowerCase();
        const input = name.trim().toLowerCase();
        return existing.includes(input) || input.includes(existing);
      })
    : [];
  const isDuplicate = matches.length > 0;
  const isValid = name.trim() && productType && firmId && !isDuplicate && !saving;

  const handleCreate = async () => {
    if (!isValid) return;
    setSaving(true);
    setError("");
    try {
      const created = await base44.entities.Product.create({
        name: titleCaseProductName(name.trim()),
        product_type: productType,
        firm_id: firmId,
        firm_name: firmName,
      });
      queryClient.invalidateQueries({ queryKey: ["products", firmId] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onCreated?.(created);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to create product. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-indigo-700">Create New Product</span>
        <button type="button" onClick={onCancel}><span className="text-xs text-gray-400 hover:text-gray-600">cancel</span></button>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-700">Product Name</Label>
        <Input
          placeholder="Enter product name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={cn("h-9 text-sm", isDuplicate && "border-amber-400 focus-visible:ring-amber-400")}
          autoFocus
        />
        {matches.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Similar product exists:</p>
            {matches.map((p) => (
              <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-amber-50 border border-amber-200">
                <span className="text-sm font-medium text-gray-800 truncate flex-1">{p.name}</span>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 shrink-0" onClick={() => onCreated?.(p)}>
                  Use Existing
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-700">Product Type</Label>
        <Select value={productType} onValueChange={setProductType}>
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PRODUCT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {!firmId && (
        <p className="text-xs text-red-600">Select a firm before adding a product.</p>
      )}
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
      <div className="flex gap-2 justify-end pt-0.5">
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
        <Button type="button" size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" disabled={!isValid} onClick={handleCreate}>
          {saving ? "Adding..." : "Add Product"}
        </Button>
      </div>
    </div>
  );
}

// Inline "add new firm" form with duplicate validation.
function NewFirmForm({ existingFirms, onCreated, onCancel }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [firmType, setFirmType] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const matches = name.trim().length >= 2
    ? existingFirms.filter((f) => {
        const existing = (f.name || "").toLowerCase();
        const input = name.trim().toLowerCase();
        return existing.includes(input) || input.includes(existing);
      })
    : [];
  const isValid = name.trim() && !saving;

  const handleCreate = async () => {
    if (!isValid) return;
    setSaving(true);
    setError("");
    try {
      const payload = { name: name.trim() };
      if (firmType) {
        payload.firm_type = firmType;
        payload.firm_types = [firmType];
      }
      const created = await base44.entities.Firm.create(payload);
      queryClient.invalidateQueries({ queryKey: ["firms"] });
      onCreated?.(created);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to create firm. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-indigo-700">Create New Firm</span>
        <button type="button" onClick={onCancel}><span className="text-xs text-gray-400 hover:text-gray-600">cancel</span></button>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-700">Firm Name</Label>
        <Input
          placeholder="Enter firm name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={cn("h-9 text-sm", matches.length > 0 && "border-amber-400 focus-visible:ring-amber-400")}
          autoFocus
        />
        {matches.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Similar firm exists:</p>
            {matches.map((f) => (
              <div key={f.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-amber-50 border border-amber-200">
                <span className="text-sm font-medium text-gray-800 truncate flex-1">{f.name}</span>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 shrink-0" onClick={() => onCreated?.(f)}>
                  Use Existing
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-700">Firm Type (optional)</Label>
        <Select value={firmType} onValueChange={setFirmType}>
          <SelectTrigger className="h-9 text-sm">
            <span className={firmType ? "text-gray-900" : "text-gray-400"}>{firmType || "Select firm type..."}</span>
          </SelectTrigger>
          <SelectContent>
            {FIRM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
      <div className="flex gap-2 justify-end pt-0.5">
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
        <Button type="button" size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" disabled={!isValid} onClick={handleCreate}>
          {saving ? "Adding..." : "Add Firm"}
        </Button>
      </div>
    </div>
  );
}

export default function AddDueDiligenceDialog({ open, onOpenChange, firmId, firmName, products = [], contacts = [], editingRecord, onSubmit, firmSelectionMode = false, preselectProductId = "" }) {
  const [productId, setProductId] = useState("");
  const [status, setStatus] = useState("Pipeline");
  const [processStatus, setProcessStatus] = useState("Not Started");
  const [ddStage, setDdStage] = useState(DD_STAGE_NOT_STARTED);
  const { stages } = useDueDiligenceStages();
  const [primaryId, setPrimaryId] = useState("");
  const [secondaryId, setSecondaryId] = useState("");
  const [productMode, setProductMode] = useState("select"); // "select" | "new"
  const [addingPrimary, setAddingPrimary] = useState(false);
  const [addingSecondary, setAddingSecondary] = useState(false);
  const [localProducts, setLocalProducts] = useState([]);
  const [localContacts, setLocalContacts] = useState([]);
  const [selectedFirmId, setSelectedFirmId] = useState("");
  const [selectedFirmName, setSelectedFirmName] = useState("");
  const [firmMode, setFirmMode] = useState("select"); // "select" | "new"

  // Analysts are sourced from the OWNER firm (the firm that owns this app),
  // not the firm under due diligence. The owner firm is resolved from the
  // FirmOwner config by matching its name to a Firm record.
  const firmOwner = useFirmOwner();
  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });
  const { data: allFirms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date"),
  });
  const { data: ownerContactsRaw = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });
  // Resolve the owner firm: prefer the signed-in user's linked firm, fall back
  // to the FirmOwner config (matched by name), then to the analyzed firm.
  const ownerFirmId = useMemo(() => {
    if (currentUser?.linked_firm_id) return currentUser.linked_firm_id;
    if (firmOwner?.name) {
      const f = allFirms.find(
        (x) => !x.deleted_at && (x.name || "").toLowerCase() === (firmOwner.name || "").toLowerCase()
      );
      return f?.id || null;
    }
    return null;
  }, [currentUser, firmOwner, allFirms]);
  const analystContacts = useMemo(() => {
    if (ownerFirmId) {
      return ownerContactsRaw.filter((c) => !c.deleted_at && (c.firm_ids || []).includes(ownerFirmId));
    }
    return contacts; // fallback to the analyzed firm's contacts when no owner is configured
  }, [ownerFirmId, ownerContactsRaw, contacts]);

  // Effective firm: when editing, use the record's firm; when in firm-selection
  // (create) mode, use the firm the user picked; otherwise the supplied firmId.
  const effectiveFirmId = editingRecord
    ? editingRecord.firm_id
    : firmSelectionMode
      ? selectedFirmId
      : firmId;
  const effectiveFirmName = editingRecord
    ? editingRecord.firm_name
    : firmSelectionMode
      ? selectedFirmName
      : firmName;

  // Products for the effective firm (only in firm-selection mode where we don't
  // get a pre-filtered list from the parent).
  const { data: firmProducts = [] } = useQuery({
    queryKey: ["products", effectiveFirmId],
    queryFn: () => base44.entities.Product.filter({ firm_id: effectiveFirmId }),
    enabled: !!effectiveFirmId && firmSelectionMode,
  });

  // Firm options for the picker (firm-selection mode only).
  const firmOptions = useMemo(
    () => allFirms
      .filter((f) => !f.deleted_at)
      .map((f) => ({ value: f.id, label: f.name }))
      .sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase())),
    [allFirms]
  );

  // Reset & initialize whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setLocalProducts(products);
    setLocalContacts([]);
    setProductMode("select");
    setAddingPrimary(false);
    setAddingSecondary(false);
    setFirmMode("select");
    if (editingRecord) {
      setProductId(editingRecord.product_id || "");
      setStatus(editingRecord.status || "Pipeline");
      setProcessStatus(editingRecord.process_status || "Not Started");
      setDdStage(editingRecord.due_diligence_stage || DD_STAGE_NOT_STARTED);
      setPrimaryId(editingRecord.primary_analyst_contact_id || "");
      setSecondaryId(editingRecord.secondary_analyst_contact_id || "");
      setSelectedFirmId(editingRecord.firm_id || "");
      setSelectedFirmName(editingRecord.firm_name || "");
    } else {
      setProductId(preselectProductId || "");
      setStatus("Pipeline"); // auto-select Pipeline for new due diligence
      setProcessStatus("Not Started");
      setDdStage(DD_STAGE_NOT_STARTED);
      setPrimaryId("");
      setSecondaryId("");
      setSelectedFirmId("");
      setSelectedFirmName("");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-assign primary analyst from the signed-in user, matched among the
  // OWNER firm's contacts. Runs once contacts resolve; never overrides a selection.
  useEffect(() => {
    if (!open || editingRecord || primaryId) return;
    (async () => {
      try {
        const user = await base44.auth.me();
        let match = null;
        if (user?.linked_contact_id) {
          match = analystContacts.find((c) => c.id === user.linked_contact_id) || null;
        }
        if (!match && user?.email) {
          const email = user.email.toLowerCase();
          match = analystContacts.find((c) => (c.email || "").toLowerCase() === email) || null;
        }
        if (match) setPrimaryId(match.id);
      } catch { /* not logged in — leave manual */ }
    })();
  }, [open, editingRecord, analystContacts, primaryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const allProducts = useMemo(() => {
    const ids = new Set(localProducts.map((p) => p.id));
    const merged = [...localProducts];
    if (firmSelectionMode) {
      firmProducts.forEach((p) => { if (!ids.has(p.id)) { merged.push(p); ids.add(p.id); } });
    } else {
      products.forEach((p) => { if (!ids.has(p.id)) merged.push(p); });
    }
    return merged;
  }, [localProducts, products, firmProducts, firmSelectionMode]);

  const allContacts = useMemo(() => {
    const ids = new Set(localContacts.map((c) => c.id));
    const merged = [...localContacts];
    analystContacts.forEach((c) => { if (!ids.has(c.id)) merged.push(c); });
    return merged.sort((a, b) => {
      const fa = (a.first_name || "").toLowerCase();
      const fb = (b.first_name || "").toLowerCase();
      if (fa < fb) return -1;
      if (fa > fb) return 1;
      return (a.last_name || "").toLowerCase().localeCompare((b.last_name || "").toLowerCase());
    });
  }, [localContacts, analystContacts]);

  const productOptions = allProducts.map((p) => ({ value: p.id, label: p.name }));
  const contactOptions = allContacts.map((c) => ({ value: c.id, label: contactName(c) || c.email || c.id }));

  const selectedProduct = allProducts.find((p) => p.id === productId);
  const primaryContact = allContacts.find((c) => c.id === primaryId);
  const secondaryContact = allContacts.find((c) => c.id === secondaryId);

  // Validation: a contact picked for one analyst cannot be the other.
  const isValid = !!effectiveFirmId && productId && primaryId && (primaryId !== secondaryId);

  // When the process is started, auto-select Stage 1 (Pre-liminary Assessment)
  // if no real stage has been chosen yet; when reset to Not Started, clear the stage.
  const handleProcessStatusChange = (v) => {
    setProcessStatus(v);
    if (v === "Not Started") {
      setDdStage(DD_STAGE_NOT_STARTED);
    } else if (v === "In-process") {
      if (!ddStage || ddStage === DD_STAGE_NOT_STARTED) {
        const first = stages[0];
        if (first) setDdStage(first.name);
      }
    }
  };

  const handleSave = () => {
    if (!isValid) return;
    onSubmit({
      firm_id: effectiveFirmId,
      firm_name: effectiveFirmName,
      product_id: productId,
      product_name: selectedProduct?.name || "",
      status,
      process_status: status === "Buy List" ? "Completed" : processStatus,
      due_diligence_stage: ddStage || DD_STAGE_NOT_STARTED,
      primary_analyst_contact_id: primaryId,
      primary_analyst_name: contactName(primaryContact) || "",
      secondary_analyst_contact_id: secondaryId || undefined,
      secondary_analyst_name: secondaryId ? contactName(secondaryContact) || "" : undefined,
    });
  };

  const firmFooter = (
    <button
      type="button"
      className="w-full text-left px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-50 flex items-center gap-1.5 font-medium"
      onClick={() => setFirmMode("new")}
    >
      <Plus className="w-3.5 h-3.5" /> Create new firm
    </button>
  );

  const productFooter = (
    <button
      type="button"
      className="w-full text-left px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-50 flex items-center gap-1.5 font-medium"
      onClick={() => setProductMode("new")}
    >
      <Plus className="w-3.5 h-3.5" /> Create new product
    </button>
  );

  const primaryFooter = (
    <button
      type="button"
      className="w-full text-left px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-50 flex items-center gap-1.5 font-medium"
      onClick={() => setAddingPrimary(true)}
    >
      <Plus className="w-3.5 h-3.5" /> Add new contact
    </button>
  );

  const secondaryFooter = (
    <button
      type="button"
      className="w-full text-left px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-50 flex items-center gap-1.5 font-medium"
      onClick={() => setAddingSecondary(true)}
    >
      <Plus className="w-3.5 h-3.5" /> Add new contact
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingRecord ? "Edit Due Diligence" : "Add Due Diligence"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Firm picker (contact-context create mode only) */}
          {firmSelectionMode && !editingRecord && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Firm <span className="text-red-400">*</span></Label>
              {firmMode === "select" ? (
                <SearchableSelect
                  options={firmOptions}
                  value={selectedFirmId}
                  onChange={(v) => {
                    setSelectedFirmId(v);
                    setSelectedFirmName(firmOptions.find((f) => f.value === v)?.label || "");
                    setProductId("");
                    setProductMode("select");
                  }}
                  placeholder="Select firm..."
                  footer={firmFooter}
                />
              ) : (
                <NewFirmForm
                  existingFirms={allFirms}
                  onCreated={(f) => {
                    setSelectedFirmId(f.id);
                    setSelectedFirmName(f.name);
                    setProductId("");
                    setProductMode("select");
                    setFirmMode("select");
                  }}
                  onCancel={() => setFirmMode("select")}
                />
              )}
            </div>
          )}

          {/* Product */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Product <span className="text-red-400">*</span></Label>
            {productMode === "select" ? (
              <SearchableSelect
                options={productOptions}
                value={productId}
                onChange={setProductId}
                placeholder="Select product for this firm..."
                footer={productFooter}
              />
            ) : (
              <NewProductForm
                firmId={effectiveFirmId}
                firmName={effectiveFirmName}
                existingProducts={allProducts}
                onCreated={(p) => { setLocalProducts((prev) => [...prev, p]); setProductId(p.id); setProductMode("select"); }}
                onCancel={() => setProductMode("select")}
              />
            )}
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Due Diligence Status</Label>
            <Select value={status} onValueChange={(v) => { setStatus(v); if (v === "Buy List") setProcessStatus("Completed"); }}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Process status */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Due Diligence Process Status</Label>
            <Select value={processStatus} onValueChange={handleProcessStatusChange}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROCESS_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Due Diligence Stage */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Due Diligence Stage</Label>
            <DueDiligenceStagePicker
              value={ddStage}
              onChange={setDdStage}
              disabled={status === "Buy List"}
            />
          </div>

          {/* Primary analyst */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Primary Analyst <span className="text-red-400">*</span></Label>
            {addingPrimary ? (
              <NewContactForm
                firmId={ownerFirmId || firmId}
                existingContacts={allContacts}
                onCreated={(c) => { setLocalContacts((prev) => [...prev, c]); setPrimaryId(c.id); setAddingPrimary(false); }}
                onCancel={() => setAddingPrimary(false)}
              />
            ) : (
              <SearchableSelect
                options={contactOptions}
                value={primaryId}
                onChange={setPrimaryId}
                placeholder="Select primary analyst..."
                excludeValues={secondaryId ? [secondaryId] : []}
                footer={primaryFooter}
              />
            )}
          </div>

          {/* Secondary analyst */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Secondary Analyst</Label>
            {addingSecondary ? (
              <NewContactForm
                firmId={ownerFirmId || firmId}
                existingContacts={allContacts}
                onCreated={(c) => { setLocalContacts((prev) => [...prev, c]); setSecondaryId(c.id); setAddingSecondary(false); }}
                onCancel={() => setAddingSecondary(false)}
              />
            ) : (
              <SearchableSelect
                options={contactOptions}
                value={secondaryId}
                onChange={setSecondaryId}
                placeholder="Select secondary analyst (optional)..."
                excludeValues={primaryId ? [primaryId] : []}
                footer={secondaryFooter}
              />
            )}
            {primaryId && secondaryId && primaryId === secondaryId && (
              <p className="text-xs text-red-600">Primary and secondary analyst cannot be the same contact.</p>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={!isValid} onClick={handleSave}>
            {editingRecord ? "Save Changes" : "Add Due Diligence"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}