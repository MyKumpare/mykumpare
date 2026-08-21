import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Scale, Plus, UserPlus, X, Search, Loader2 } from "lucide-react";
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

export default function LegalComplianceTab({ firmId, isEditing, contacts = [] }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [legalEntityName, setLegalEntityName] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityJurisdiction, setEntityJurisdiction] = useState("");
  const [jurisdictionCountry, setJurisdictionCountry] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [complianceOfficerId, setComplianceOfficerId] = useState("");
  const [notes, setNotes] = useState("");
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactFirst, setNewContactFirst] = useState("");
  const [newContactLast, setNewContactLast] = useState("");
  const [addingContact, setAddingContact] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [firmName, setFirmName] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  useEffect(() => {
    if (!firmId) return;
    try {
      const stored = localStorage.getItem(`legal_compliance_${firmId}`);
      if (stored) {
        const data = JSON.parse(stored);
        setLegalEntityName(data.legalEntityName || "");
        setEntityType(data.entityType || "");
        setEntityJurisdiction(data.entityJurisdiction || "");
        setJurisdictionCountry(data.jurisdictionCountry || "");
        setRegistrationNumber(data.registrationNumber || "");
        setComplianceOfficerId(data.complianceOfficerId || "");
        setNotes(data.notes || "");
      }
    } catch {}
  }, [firmId]);

  useEffect(() => {
    if (!firmId) return;
    let active = true;
    base44.entities.Firm.get(firmId)
      .then((f) => {
        if (!active) return;
        setFirmName(f?.name || "");
        // If the auto-lookup workflow saved a CRD to the firm record and the
        // user hasn't manually entered one in this tab, populate it.
        const autoCrd = f?.registration_number || "";
        if (autoCrd) {
          try {
            const stored = localStorage.getItem(`legal_compliance_${firmId}`);
            const storedCrd = stored ? (JSON.parse(stored).registration_number || "") : "";
            if (!storedCrd) setRegistrationNumber(autoCrd);
          } catch {
            setRegistrationNumber(autoCrd);
          }
        }
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

  const regulatoryBody = entityJurisdiction && jurisdictionCountry
    ? JURISDICTION_DATA[entityJurisdiction]?.[jurisdictionCountry] || ""
    : "";

  const handleJurisdictionChange = (value) => {
    setEntityJurisdiction(value);
    setJurisdictionCountry("");
    setDirty(true);
  };

  const selectedContact = firmContacts.find((c) => c.id === complianceOfficerId);

  const handleSelectOfficer = async (contactId) => {
    setComplianceOfficerId(contactId);
    setDirty(true);
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

  const handleSave = () => {
    if (!firmId) return;
    const data = {
      legalEntityName, entityType,
      entityJurisdiction, jurisdictionCountry, registrationNumber,
      complianceOfficerId,
      complianceOfficerName: selectedContact ? contactDisplayName(selectedContact) : "",
      notes,
    };
    localStorage.setItem(`legal_compliance_${firmId}`, JSON.stringify(data));
    setDirty(false);
    toast({ title: "Saved", description: "Legal & Compliance information saved." });
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
      setComplianceOfficerId(created.id);
      setShowAddContact(false);
      setNewContactFirst("");
      setNewContactLast("");
      toast({ title: "Contact created", description: `${created.first_name} ${created.last_name} added as compliance officer.` });
    } catch (err) {
      toast({ title: "Failed to create contact", description: err.message, variant: "destructive" });
    }
    setAddingContact(false);
  };

  const handleLookupRegistration = async () => {
    if (!firmName) {
      toast({ title: "Firm name required", description: "The firm needs a name to search the registry.", variant: "destructive" });
      return;
    }
    if (!regulatoryBody) {
      toast({ title: "Select jurisdiction", description: "Pick the entity jurisdiction and country first.", variant: "destructive" });
      return;
    }
    setLookingUp(true);
    try {
      const res = await base44.functions.invoke("lookupRegistrationNumber", {
        firm_name: firmName,
        regulatory_body: regulatoryBody,
        jurisdiction: entityJurisdiction,
        country: jurisdictionCountry,
      });
      const data = res?.data || res;
      if (data?.found && data.registration_number) {
        setRegistrationNumber(data.registration_number);
        setDirty(true);
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
    setLookingUp(false);
  };

  return (
    <div className="space-y-4 py-1">
      <div className="flex items-center gap-2 text-indigo-700">
        <Scale className="w-4 h-4" />
        <h4 className="text-sm font-semibold">Legal & Compliance Information</h4>
      </div>

      {/* Row 1: Legal Entity Name (full width) */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">Legal Entity Name</Label>
        <Input
          placeholder="Official legal entity name..."
          value={legalEntityName}
          onChange={(e) => { setLegalEntityName(e.target.value); setDirty(true); }}
          disabled={!isEditing}
        />
      </div>

      {/* Row 2: Entity Type + SEC CRD Number */}
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

      {/* Entity Jurisdiction Section */}
      <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Entity Jurisdiction</Label>
            <Select value={entityJurisdiction} onValueChange={handleJurisdictionChange} disabled={!isEditing}>
              <SelectTrigger><SelectValue placeholder="Select jurisdiction..." /></SelectTrigger>
              <SelectContent>
                {JURISDICTION_OPTIONS.map((j) => (
                  <SelectItem key={j} value={j}>{j}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Country / Region</Label>
            <Select value={jurisdictionCountry} onValueChange={(v) => { setJurisdictionCountry(v); setDirty(true); }} disabled={!isEditing || !entityJurisdiction}>
              <SelectTrigger><SelectValue placeholder="Select country..." /></SelectTrigger>
              <SelectContent>
                {entityJurisdiction && Object.keys(JURISDICTION_DATA[entityJurisdiction]).map((c) => (
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
              value={registrationNumber}
              onChange={(e) => { setRegistrationNumber(e.target.value); setDirty(true); }}
              disabled={!isEditing}
            />
            {isEditing && regulatoryBody && (
              <button type="button" onClick={handleLookupRegistration} disabled={lookingUp}
                className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50">
                {lookingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                {lookingUp ? "Searching registry..." : `Auto-detect from ${regulatoryBody}`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Compliance Officer dropdown */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">Compliance Officer</Label>
        {!isEditing ? (
          <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-900">
            {selectedContact ? contactDisplayName(selectedContact) : <span className="text-gray-400">—</span>}
          </div>
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
              {addingContact ? "Creating..." : "Create & Select"}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Select value={complianceOfficerId} onValueChange={handleSelectOfficer}>
              <SelectTrigger><SelectValue placeholder="Select compliance officer..." /></SelectTrigger>
              <SelectContent>
                {complianceOfficers.length > 0 && (
                  <>
                    <div className="px-3 py-1 text-xs font-semibold text-gray-500">Compliance Officers</div>
                    {complianceOfficers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{contactDisplayName(c)}</SelectItem>
                    ))}
                  </>
                )}
                {complianceOfficers.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-400">No compliance contacts for this firm yet.</div>
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
            {complianceOfficerId && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                title="Clear selection"
                onClick={() => { setComplianceOfficerId(""); setDirty(true); }}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
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