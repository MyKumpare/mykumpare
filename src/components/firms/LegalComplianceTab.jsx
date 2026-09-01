import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Scale, Plus, UserPlus, X, Search, Loader2, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";

const ENTITY_TYPES = ["LLC", "LP", "LLLP", "Corporation", "Trust", "Other"];

const JURISDICTION_DATA = {
  "North America": {
    "United States of America": "U.S. Securities Exchange Commission (SEC)",
    "Canada": "Canadian Securities Administrators (CSA)",
  },
  "Europe and United Kingdom": {
    "United Kingdom": "Financial Conduct Authority (FCA)",
    "Europe": "European Securities and Markets Authority (ESMA)",
    "France": "Autorité des Marchés Financiers (AMF)",
    "Germany": "Bundesanstalt für Finanzdienstleistungsaufsicht (BaFin)",
    "Luxembourg": "Commission de Surveillance du Secteur Financier (CSSF)",
  },
  "Asia-Pacific": {
    "Hong Kong": "Securities and Futures Commission (SFC)",
    "Singapore": "Monetary Authority of Singapore (MAS)",
    "Australia": "Australian Securities and Investments Commission (ASIC)",
    "Japan": "Financial Services Agency (FSA)",
  },
  "Middle East and Offshore Hubs": {
    "United Arab Emirates": "Dubai Financial Services Authority (DFSA) & Abu Dhabi Global Market (ADGM)",
    "Cayman Islands": "Cayman Islands Monetary Authority (CIMA)",
  },
};
const JURISDICTION_OPTIONS = Object.keys(JURISDICTION_DATA);

const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

const emptyJurisdiction = () => ({
  id: newId(),
  entityJurisdiction: "",
  jurisdictionCountry: "",
  registrationNumber: "",
  renewalDate: "",
});

function isComplianceContact(c) {
  const roles = [...(c.contact_roles || []), ...(c.contact_firm_roles || [])];
  return roles.some((r) => (r || "").toLowerCase().includes("compliance"));
}

function contactDisplayName(c) {
  const parts = [c.first_name, c.last_name].filter(Boolean);
  let name = parts.join(" ");
  if (c.suffix) name += `, ${c.suffix}`;
  return name || c.email || "Unnamed";
}

// Migrate legacy single-value stored data into the new array shape.
function migrateStored(data) {
  if (!data) return null;
  // Already in new shape (has jurisdictions array)
  if (Array.isArray(data.jurisdictions)) {
    return {
      legalEntityName: data.legalEntityName || "",
      entityType: data.entityType || "",
      jurisdictions: data.jurisdictions.map((j) => ({
        id: j.id || newId(),
        entityJurisdiction: j.entityJurisdiction || "",
        jurisdictionCountry: j.jurisdictionCountry || "",
        registrationNumber: j.registrationNumber || "",
        renewalDate: j.renewalDate || "",
      })),
      complianceOfficerIds: Array.isArray(data.complianceOfficerIds)
        ? data.complianceOfficerIds
        : data.complianceOfficerId
        ? [data.complianceOfficerId]
        : [],
      notes: data.notes || "",
    };
  }
  // Legacy single-value shape → wrap into one jurisdiction entry + one officer
  const hasJur = data.entityJurisdiction || data.jurisdictionCountry || data.registrationNumber;
  return {
    legalEntityName: data.legalEntityName || "",
    entityType: data.entityType || "",
    jurisdictions: hasJur
      ? [{
          id: newId(),
          entityJurisdiction: data.entityJurisdiction || "",
          jurisdictionCountry: data.jurisdictionCountry || "",
          registrationNumber: data.registrationNumber || "",
          renewalDate: "",
        }]
      : [],
    complianceOfficerIds: data.complianceOfficerId ? [data.complianceOfficerId] : [],
    notes: data.notes || "",
  };
}

export default function LegalComplianceTab({ firmId, isEditing, contacts = [] }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [legalEntityName, setLegalEntityName] = useState("");
  const [entityType, setEntityType] = useState("");
  const [jurisdictions, setJurisdictions] = useState([]);
  const [complianceOfficerIds, setComplianceOfficerIds] = useState([]);
  const [notes, setNotes] = useState("");
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactFirst, setNewContactFirst] = useState("");
  const [newContactLast, setNewContactLast] = useState("");
  const [addingContact, setAddingContact] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [firmName, setFirmName] = useState("");
  const [lookingUpId, setLookingUpId] = useState(null);

  useEffect(() => {
    if (!firmId) return;
    let active = true;
    const apply = (migrated) => {
      if (!active || !migrated) return;
      setLegalEntityName(migrated.legalEntityName);
      setEntityType(migrated.entityType);
      setJurisdictions(migrated.jurisdictions);
      setComplianceOfficerIds(migrated.complianceOfficerIds);
      setNotes(migrated.notes);
    };
    const seedAutoCrd = (autoCrd) => {
      if (!autoCrd) return;
      setJurisdictions((prev) => {
        if (prev.length === 0) return [{ ...emptyJurisdiction(), registrationNumber: autoCrd }];
        if (prev[0].registrationNumber) return prev;
        const copy = [...prev];
        copy[0] = { ...copy[0], registrationNumber: autoCrd };
        return copy;
      });
    };

    // Legacy localStorage fallback (immediate, before the server round-trip).
    try {
      const stored = localStorage.getItem(`legal_compliance_${firmId}`);
      if (stored) apply(migrateStored(JSON.parse(stored)));
    } catch {}

    base44.entities.Firm.get(firmId)
      .then((f) => {
        if (!active) return;
        setFirmName(f?.name || "");
        const lc = f?.legal_compliance;
        if (lc && (lc.jurisdictions?.length || lc.complianceOfficerIds?.length || lc.legalEntityName)) {
          // Server-side data is the source of truth — override localStorage.
          apply(migrateStored(lc));
        }
        // If the auto-lookup workflow saved a CRD and no jurisdiction has one, seed the first.
        seedAutoCrd(f?.registration_number || "");
      })
      .catch(() => {});
    return () => { active = false; };
  }, [firmId]);

  const firmContacts = useMemo(
    () => contacts.filter((c) => (c.firm_ids || []).includes(firmId) && !c.deleted_at),
    [contacts, firmId]
  );

  const complianceOfficers = useMemo(
    () => firmContacts.filter(isComplianceContact),
    [firmContacts]
  );

  const updateJurisdiction = (id, patch) => {
    setJurisdictions((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
    setDirty(true);
  };

  const addJurisdiction = () => {
    setJurisdictions((prev) => [...prev, emptyJurisdiction()]);
    setDirty(true);
  };

  const removeJurisdiction = (id) => {
    setJurisdictions((prev) => prev.filter((j) => j.id !== id));
    setDirty(true);
  };

  const handleJurisdictionChange = (id, value) => {
    updateJurisdiction(id, { entityJurisdiction: value, jurisdictionCountry: "" });
  };

  const regulatoryBodyFor = (j) =>
    j.entityJurisdiction && j.jurisdictionCountry
      ? JURISDICTION_DATA[j.entityJurisdiction]?.[j.jurisdictionCountry] || ""
      : "";

  const handleLookupRegistration = async (j) => {
    if (!firmName) {
      toast({ title: "Firm name required", description: "The firm needs a name to search the registry.", variant: "destructive" });
      return;
    }
    const regulatoryBody = regulatoryBodyFor(j);
    if (!regulatoryBody) {
      toast({ title: "Select jurisdiction", description: "Pick the entity jurisdiction and country first.", variant: "destructive" });
      return;
    }
    setLookingUpId(j.id);
    try {
      const res = await base44.functions.invoke("lookupRegistrationNumber", {
        firm_name: firmName,
        regulatory_body: regulatoryBody,
        jurisdiction: j.entityJurisdiction,
        country: j.jurisdictionCountry,
      });
      const data = res?.data || res;
      if (data?.found && data.registration_number) {
        updateJurisdiction(j.id, { registrationNumber: data.registration_number });
        toast({
          title: "Registration number found",
          description: data.source_url ? `${data.registration_number} — via ${data.source_url}` : data.registration_number,
        });
      } else {
        toast({
          title: "Not found",
          description: data?.note || "Couldn't find a registration number on the regulator's registry.",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({ title: "Lookup failed", description: e.message, variant: "destructive" });
    }
    setLookingUpId(null);
  };

  const toggleOfficer = async (contactId) => {
    setComplianceOfficerIds((prev) => {
      const next = prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId];
      return next;
    });
    setDirty(true);
    // Tag the contact as a Compliance Officer if not already.
    const contact = firmContacts.find((c) => c.id === contactId);
    if (contact && !isComplianceContact(contact)) {
      try {
        const updatedRoles = [...(contact.contact_roles || []), "Compliance Officer"];
        await base44.entities.Contact.update(contact.id, { contact_roles: updatedRoles });
        queryClient.invalidateQueries({ queryKey: ["contacts"] });
        toast({ title: "Role updated", description: `${contact.first_name} ${contact.last_name} tagged as Compliance Officer.` });
      } catch (err) {
        toast({ title: "Failed to tag role", description: err.message, variant: "destructive" });
      }
    }
  };

  const removeOfficer = (contactId) => {
    setComplianceOfficerIds((prev) => prev.filter((id) => id !== contactId));
    setDirty(true);
  };

  const selectedOfficers = complianceOfficerIds
    .map((id) => firmContacts.find((c) => c.id === id))
    .filter(Boolean);

  const handleSave = async () => {
    if (!firmId) return;
    const data = {
      legalEntityName,
      entityType,
      jurisdictions,
      complianceOfficerIds,
      complianceOfficerNames: selectedOfficers.map(contactDisplayName),
      notes,
    };
    localStorage.setItem(`legal_compliance_${firmId}`, JSON.stringify(data));
    try {
      await base44.entities.Firm.update(firmId, { legal_compliance: data });
      queryClient.invalidateQueries({ queryKey: ["firms"] });
      setDirty(false);
      toast({ title: "Saved", description: "Legal & Compliance information saved." });
    } catch (err) {
      toast({ title: "Failed to save to firm record", description: err.message, variant: "destructive" });
    }
  };

  const handleAddContact = async () => {
    if (!newContactFirst.trim() || !newContactLast.trim()) return;
    setAddingContact(true);
    try {
      const created = await base44.entities.Contact.create({
        first_name: newContactFirst.trim(),
        last_name: newContactLast.trim(),
        firm_ids: [firmId],
        contact_roles: ["Compliance Officer"],
        tenant_id: user?.linked_firm_id,
      });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setComplianceOfficerIds((prev) => [...prev, created.id]);
      setShowAddContact(false);
      setNewContactFirst("");
      setNewContactLast("");
      toast({ title: "Contact created", description: `${created.first_name} ${created.last_name} added as compliance officer.` });
    } catch (err) {
      toast({ title: "Failed to create contact", description: err.message, variant: "destructive" });
    }
    setAddingContact(false);
  };

  return (
    <div className="space-y-4 py-1">
      <div className="flex items-center gap-2 text-indigo-700">
        <Scale className="w-4 h-4" />
        <h4 className="text-sm font-semibold">Legal & Compliance Information</h4>
      </div>

      {/* Legal Entity Name */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">Legal Entity Name</Label>
        <Input
          placeholder="Official legal entity name..."
          value={legalEntityName}
          onChange={(e) => { setLegalEntityName(e.target.value); setDirty(true); }}
          disabled={!isEditing}
        />
      </div>

      {/* Entity Type */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">Entity Type</Label>
          <Select value={entityType} onValueChange={(v) => { setEntityType(v); setDirty(true); }} disabled={!isEditing}>
            <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Jurisdictions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold text-gray-700">Jurisdictions & Registrations</Label>
          {isEditing && (
            <Button type="button" variant="outline" size="sm" onClick={addJurisdiction} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Jurisdiction
            </Button>
          )}
        </div>

        {jurisdictions.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-4 text-center text-sm text-gray-500">
            No jurisdictions added yet. Click “Add Jurisdiction” to add one.
          </div>
        )}

        {jurisdictions.map((j, idx) => {
          const regulatoryBody = regulatoryBodyFor(j);
          return (
            <div key={j.id} className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3 relative">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Jurisdiction {idx + 1}</span>
                {isEditing && jurisdictions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => removeJurisdiction(j.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                    title="Remove jurisdiction"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Entity Jurisdiction</Label>
                  <Select value={j.entityJurisdiction} onValueChange={(v) => handleJurisdictionChange(j.id, v)} disabled={!isEditing}>
                    <SelectTrigger><SelectValue placeholder="Select jurisdiction..." /></SelectTrigger>
                    <SelectContent>
                      {JURISDICTION_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Country / Region</Label>
                  <Select
                    value={j.jurisdictionCountry}
                    onValueChange={(v) => updateJurisdiction(j.id, { jurisdictionCountry: v })}
                    disabled={!isEditing || !j.entityJurisdiction}
                  >
                    <SelectTrigger><SelectValue placeholder="Select country..." /></SelectTrigger>
                    <SelectContent>
                      {j.entityJurisdiction && Object.keys(JURISDICTION_DATA[j.entityJurisdiction]).map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Governing Regulatory Body</Label>
                  <div className="h-9 px-3 flex items-center rounded-md border bg-white text-sm text-gray-900">
                    {regulatoryBody || <span className="text-gray-400">—</span>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Registration Number / Identifier</Label>
                  <Input
                    placeholder="e.g. 801-123456"
                    value={j.registrationNumber}
                    onChange={(e) => updateJurisdiction(j.id, { registrationNumber: e.target.value })}
                    disabled={!isEditing}
                  />
                  {isEditing && regulatoryBody && (
                    <button type="button" onClick={() => handleLookupRegistration(j)} disabled={lookingUpId === j.id}
                      className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50">
                      {lookingUpId === j.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      {lookingUpId === j.id ? "Searching registry..." : `Auto-detect from ${regulatoryBody}`}
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Registration Renewal Date</Label>
                  <Input
                    type="date"
                    value={j.renewalDate || ""}
                    onChange={(e) => updateJurisdiction(j.id, { renewalDate: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compliance Officers */}
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold text-gray-700">Compliance Officers</Label>

        {selectedOfficers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedOfficers.map((c) => (
              <div key={c.id} className="flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 pl-3 pr-1 py-1">
                <span className="text-sm text-indigo-800">{contactDisplayName(c)}</span>
                {isEditing && (
                  <button type="button" onClick={() => removeOfficer(c.id)} className="w-5 h-5 flex items-center justify-center rounded-full text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {!isEditing ? (
          selectedOfficers.length === 0 && (
            <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-400">—</div>
          )
        ) : showAddContact ? (
          <div className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50/30 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-indigo-700">New Compliance Officer</span>
              <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowAddContact(false)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="First name" value={newContactFirst} onChange={(e) => setNewContactFirst(e.target.value)} className="h-8" />
              <Input placeholder="Last name" value={newContactLast} onChange={(e) => setNewContactLast(e.target.value)} className="h-8" />
            </div>
            <Button type="button" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white w-full" onClick={handleAddContact} disabled={addingContact || !newContactFirst.trim() || !newContactLast.trim()}>
              {addingContact ? "Creating..." : "Create & Add"}
            </Button>
          </div>
        ) : (
          <Select value="" onValueChange={(v) => v && toggleOfficer(v)}>
            <SelectTrigger>
              <span className="text-gray-500 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5" /> Add compliance officer…
              </span>
            </SelectTrigger>
            <SelectContent>
              {complianceOfficers.length > 0 && (
                <>
                  <div className="px-3 py-1 text-xs font-semibold text-gray-500">Compliance Contacts</div>
                  {complianceOfficers
                    .filter((c) => !complianceOfficerIds.includes(c.id))
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>{contactDisplayName(c)}</SelectItem>
                    ))}
                </>
              )}
              {firmContacts.filter((c) => !isComplianceContact(c) && !complianceOfficerIds.includes(c.id)).length > 0 && (
                <>
                  <div className="border-t mt-1 pt-1 px-3 py-1 text-xs font-semibold text-gray-500">Other Firm Contacts</div>
                  {firmContacts
                    .filter((c) => !isComplianceContact(c) && !complianceOfficerIds.includes(c.id))
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>{contactDisplayName(c)}</SelectItem>
                    ))}
                </>
              )}
              {complianceOfficers.length === 0 && firmContacts.filter((c) => !isComplianceContact(c)).length === 0 && (
                <div className="px-3 py-2 text-xs text-gray-400">No contacts for this firm yet.</div>
              )}
              <div className="border-t mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddContact(true)}
                  className="flex items-center gap-1.5 w-full px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 text-left"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Add New Contact
                </button>
              </div>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">Notes</Label>
        <Textarea
          placeholder="Regulatory notes, disclosures, form ADV details..."
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
          className="min-h-20"
          disabled={!isEditing}
        />
      </div>

      {dirty && (
        <div className="flex justify-end">
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSave} disabled={!firmId}>
            Save Legal & Compliance
          </Button>
        </div>
      )}
    </div>
  );
}