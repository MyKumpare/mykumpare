import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Scale, Plus, Trash2 } from "lucide-react";

const ENTITY_TYPES = ["LLC", "LP", "LLLP", "Corporation", "Trust", "Other"];

export default function LegalComplianceTab({ firmId, isEditing }) {
  const [legalEntityName, setLegalEntityName] = useState("");
  const [entityType, setEntityType] = useState("");
  const [crdNumber, setCrdNumber] = useState("");
  const [complianceOfficerName, setComplianceOfficerName] = useState("");
  const [complianceOfficerEmail, setComplianceOfficerEmail] = useState("");
  const [notes, setNotes] = useState("");

  // Load from localStorage keyed by firmId so data persists per firm
  useEffect(() => {
    if (!firmId) return;
    try {
      const stored = localStorage.getItem(`legal_compliance_${firmId}`);
      if (stored) {
        const data = JSON.parse(stored);
        setLegalEntityName(data.legalEntityName || "");
        setEntityType(data.entityType || "");
        setCrdNumber(data.crdNumber || "");
        setComplianceOfficerName(data.complianceOfficerName || "");
        setComplianceOfficerEmail(data.complianceOfficerEmail || "");
        setNotes(data.notes || "");
      }
    } catch {}
  }, [firmId]);

  const handleSave = () => {
    if (!firmId) return;
    const data = { legalEntityName, entityType, crdNumber, complianceOfficerName, complianceOfficerEmail, notes };
    localStorage.setItem(`legal_compliance_${firmId}`, JSON.stringify(data));
  };

  return (
    <div className="space-y-4 py-1">
      <div className="flex items-center gap-2 text-indigo-700">
        <Scale className="w-4 h-4" />
        <h4 className="text-sm font-semibold">Legal & Compliance Information</h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">Legal Entity Name</Label>
          <Input
            placeholder="Official legal entity name..."
            value={legalEntityName}
            onChange={(e) => setLegalEntityName(e.target.value)}
            disabled={!isEditing}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">Entity Type</Label>
          <Select value={entityType} onValueChange={setEntityType} disabled={!isEditing}>
            <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">SEC CRD Number</Label>
          <Input
            placeholder="e.g. 123456"
            value={crdNumber}
            onChange={(e) => setCrdNumber(e.target.value)}
            disabled={!isEditing}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">Compliance Officer</Label>
          <Input
            placeholder="Full name..."
            value={complianceOfficerName}
            onChange={(e) => setComplianceOfficerName(e.target.value)}
            disabled={!isEditing}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">Compliance Officer Email</Label>
          <Input
            type="email"
            placeholder="compliance@firm.com"
            value={complianceOfficerEmail}
            onChange={(e) => setComplianceOfficerEmail(e.target.value)}
            disabled={!isEditing}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">Notes</Label>
        <Textarea
          placeholder="Regulatory notes, disclosures, form ADV details..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-20"
          disabled={!isEditing}
        />
      </div>

      {isEditing && (
        <div className="flex justify-end">
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSave}>
            Save Legal & Compliance
          </Button>
        </div>
      )}
    </div>
  );
}