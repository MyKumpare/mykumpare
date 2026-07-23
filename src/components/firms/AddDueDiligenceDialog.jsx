import React, { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
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

const DD_STATUSES = ["Pipeline", "Buy List", "Rejected"];
const PRODUCT_TYPES = ["Investment Manager Product", "Multi-Manager Product"];

const contactName = (c) => [c?.first_name, c?.last_name].filter(Boolean).join(" ").trim();

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

  const draft = { first_name: firstName, last_name: lastName, email };
  const duplicates = (firstName.trim() || lastName.trim() || email.trim())
    ? findContactDuplicates(draft, existingContacts)
    : [];
  const isValid = firstName.trim() && lastName.trim() && !saving;

  const handleCreate = async () => {
    if (!isValid) return;
    setSaving(true);
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

  const matches = name.trim().length >= 2
    ? existingProducts.filter((p) => {
        const existing = (p.name || "").toLowerCase();
        const input = name.trim().toLowerCase();
        return existing.includes(input) || input.includes(existing);
      })
    : [];
  const isDuplicate = matches.length > 0;
  const isValid = name.trim() && productType && !isDuplicate && !saving;

  const handleCreate = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const created = await base44.entities.Product.create({
        name: name.trim(),
        product_type: productType,
        firm_id: firmId,
        firm_name: firmName,
      });
      queryClient.invalidateQueries({ queryKey: ["products", firmId] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onCreated?.(created);
    } catch (err) {
      console.error(err);
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
      <div className="flex gap-2 justify-end pt-0.5">
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
        <Button type="button" size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" disabled={!isValid} onClick={handleCreate}>
          {saving ? "Adding..." : "Add Product"}
        </Button>
      </div>
    </div>
  );
}

export default function AddDueDiligenceDialog({ open, onOpenChange, firmId, firmName, products = [], contacts = [], editingRecord, onSubmit }) {
  const [productId, setProductId] = useState("");
  const [status, setStatus] = useState("Pipeline");
  const [primaryId, setPrimaryId] = useState("");
  const [secondaryId, setSecondaryId] = useState("");
  const [productMode, setProductMode] = useState("select"); // "select" | "new"
  const [addingPrimary, setAddingPrimary] = useState(false);
  const [addingSecondary, setAddingSecondary] = useState(false);
  const [localProducts, setLocalProducts] = useState([]);
  const [localContacts, setLocalContacts] = useState([]);

  // Reset & initialize whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setLocalProducts(products);
    setLocalContacts(contacts);
    setProductMode("select");
    setAddingPrimary(false);
    setAddingSecondary(false);
    if (editingRecord) {
      setProductId(editingRecord.product_id || "");
      setStatus(editingRecord.status || "Pipeline");
      setPrimaryId(editingRecord.primary_analyst_contact_id || "");
      setSecondaryId(editingRecord.secondary_analyst_contact_id || "");
    } else {
      setProductId("");
      setStatus("Pipeline"); // auto-select Pipeline for new due diligence
      setPrimaryId("");
      setSecondaryId("");
      // Auto-assign primary analyst from the signed-in user.
      (async () => {
        try {
          const user = await base44.auth.me();
          let match = null;
          if (user?.linked_contact_id) {
            match = contacts.find((c) => c.id === user.linked_contact_id && !c.deleted_at) || null;
          }
          if (!match && user?.email) {
            const email = user.email.toLowerCase();
            match = contacts.find((c) => !c.deleted_at && (c.email || "").toLowerCase() === email) || null;
          }
          if (match) setPrimaryId(match.id);
        } catch { /* not logged in — leave manual */ }
      })();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const allProducts = useMemo(() => {
    const ids = new Set(localProducts.map((p) => p.id));
    const merged = [...localProducts];
    products.forEach((p) => { if (!ids.has(p.id)) merged.push(p); });
    return merged;
  }, [localProducts, products]);

  const allContacts = useMemo(() => {
    const ids = new Set(localContacts.map((c) => c.id));
    const merged = [...localContacts];
    contacts.forEach((c) => { if (!ids.has(c.id)) merged.push(c); });
    return merged;
  }, [localContacts, contacts]);

  const productOptions = allProducts.map((p) => ({ value: p.id, label: p.name }));
  const contactOptions = allContacts.map((c) => ({ value: c.id, label: contactName(c) || c.email || c.id }));

  const selectedProduct = allProducts.find((p) => p.id === productId);
  const primaryContact = allContacts.find((c) => c.id === primaryId);
  const secondaryContact = allContacts.find((c) => c.id === secondaryId);

  // Validation: a contact picked for one analyst cannot be the other.
  const isValid = productId && primaryId && (primaryId !== secondaryId);

  const handleSave = () => {
    if (!isValid) return;
    onSubmit({
      firm_id: firmId,
      firm_name: firmName,
      product_id: productId,
      product_name: selectedProduct?.name || "",
      status,
      primary_analyst_contact_id: primaryId,
      primary_analyst_name: contactName(primaryContact) || "",
      secondary_analyst_contact_id: secondaryId || undefined,
      secondary_analyst_name: secondaryId ? contactName(secondaryContact) || "" : undefined,
    });
  };

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
                firmId={firmId}
                firmName={firmName}
                existingProducts={allProducts}
                onCreated={(p) => { setLocalProducts((prev) => [...prev, p]); setProductId(p.id); setProductMode("select"); }}
                onCancel={() => setProductMode("select")}
              />
            )}
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Due Diligence Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Primary analyst */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Primary Analyst <span className="text-red-400">*</span></Label>
            {addingPrimary ? (
              <NewContactForm
                firmId={firmId}
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
                firmId={firmId}
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