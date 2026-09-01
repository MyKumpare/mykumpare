import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import XponanceContactPicker from "@/components/xponance/XponanceContactPicker";

export default function OnsiteVisitRuleDialog({ open, onOpenChange, firmId, firmName, editingRule, onSaved }) {
  const { user } = useAuth();
  const [visitCycleDays, setVisitCycleDays] = useState("");
  const [autoDeadlineDays, setAutoDeadlineDays] = useState("");
  const [analystId, setAnalystId] = useState("");
  const [analystName, setAnalystName] = useState("");
  const [onsiteType, setOnsiteType] = useState("In-person");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingRule) {
      setVisitCycleDays(editingRule.visit_cycle_days ? String(editingRule.visit_cycle_days) : "");
      setAutoDeadlineDays(editingRule.auto_deadline_days ? String(editingRule.auto_deadline_days) : "");
      setAnalystId(editingRule.visiting_analyst_contact_id || "");
      setAnalystName(editingRule.visiting_analyst_name || "");
      setOnsiteType(editingRule.onsite_type || "In-person");
      setEnabled(editingRule.enabled !== false);
    } else {
      setVisitCycleDays("");
      setAutoDeadlineDays("");
      setAnalystId("");
      setAnalystName("");
      setOnsiteType("In-person");
      setEnabled(true);
    }
  }, [open, editingRule]);

  const handleSave = async () => {
    const cycle = parseInt(visitCycleDays, 10);
    if (!cycle || cycle < 1) {
      toast({ title: "Visit cycle required", description: "Enter a valid number of days (1 or more).", variant: "destructive" });
      return;
    }
    const deadline = parseInt(autoDeadlineDays, 10);
    setSaving(true);
    try {
      const payload = {
        firm_id: firmId,
        firm_name: firmName,
        tenant_id: user?.linked_firm_id,
        visit_cycle_days: cycle,
        auto_deadline_days: deadline > 0 ? deadline : undefined,
        visiting_analyst_contact_id: analystId || undefined,
        visiting_analyst_name: analystName || undefined,
        onsite_type: onsiteType,
        enabled,
        created_by_name: user?.full_name || "",
      };
      if (editingRule) {
        await base44.entities.OnsiteVisitRule.update(editingRule.id, payload);
        toast({ title: "Visit rule updated" });
      } else {
        await base44.entities.OnsiteVisitRule.create(payload);
        toast({ title: "Visit rule created" });
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Could not save rule", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingRule ? "Edit Visit Rule" : "Create Visit Rule"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-xs text-gray-500">
            Define the required visit cycle for {firmName}. The report uses this to flag firms as "visited", "needs visit", or "late".
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Visit Cycle (days) *</Label>
              <Input
                type="number"
                min="1"
                placeholder="e.g. 180"
                value={visitCycleDays}
                onChange={(e) => setVisitCycleDays(e.target.value)}
              />
              <p className="text-[11px] text-gray-400">How often a visit must be completed.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Auto Deadline (days)</Label>
              <Input
                type="number"
                min="1"
                placeholder="e.g. 150"
                value={autoDeadlineDays}
                onChange={(e) => setAutoDeadlineDays(e.target.value)}
              />
              <p className="text-[11px] text-gray-400">Target date for the next auto visit.</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Default Visiting Analyst</Label>
            <XponanceContactPicker
              label="Default Visiting Analyst"
              value={analystId ? { contact_id: analystId, contact_name: analystName } : null}
              onChange={(id, name) => { setAnalystId(id); setAnalystName(name); }}
              onClear={() => { setAnalystId(""); setAnalystName(""); }}
              editing={true}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Default Onsite Type</Label>
              <Select value={onsiteType} onValueChange={setOnsiteType}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="In-person">In-person</SelectItem>
                  <SelectItem value="Virtual">Virtual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Enabled</Label>
              <div className="h-9 flex items-center">
                <Switch checked={enabled} onCheckedChange={setEnabled} />
                <span className="ml-2 text-sm text-gray-600">{enabled ? "Active" : "Inactive"}</span>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-white">
            {saving ? "Saving..." : editingRule ? "Update Rule" : "Create Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}