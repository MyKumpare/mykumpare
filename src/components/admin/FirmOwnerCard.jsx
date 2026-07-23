import React, { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Save, Upload, X, ImageIcon } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const EMPTY = { name: "", primary_contact_name: "", address: "", phone: "", email: "", logo_url: "" };

export default function FirmOwnerCard() {
  const queryClient = useQueryClient();
  const { data: owners = [] } = useQuery({
    queryKey: ["firm_owner"],
    queryFn: () => base44.entities.FirmOwner.list(),
  });
  const existing = owners[0];

  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name || "",
        primary_contact_name: existing.primary_contact_name || "",
        address: existing.address || "",
        phone: existing.phone || "",
        email: existing.email || "",
        logo_url: existing.logo_url || "",
      });
    }
  }, [existing?.id]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm((f) => ({ ...f, logo_url: file_url }));
    } catch (err) {
      toast({ title: "Logo upload failed", description: err?.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        await base44.entities.FirmOwner.update(existing.id, form);
      } else {
        await base44.entities.FirmOwner.create(form);
      }
      queryClient.invalidateQueries({ queryKey: ["firm_owner"] });
      toast({ title: "Firm owner saved" });
    } catch (e) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <Building2 className="w-4 h-4 text-indigo-500" />
        <h2 className="text-sm font-bold text-gray-800">Firm Owner</h2>
        <span className="text-[11px] text-gray-400 ml-auto">Owner of this application</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-4">
          <div className="shrink-0 flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden">
              {form.logo_url ? (
                <img src={form.logo_url} alt="logo" className="w-full h-full object-contain" />
              ) : (
                <ImageIcon className="w-7 h-7 text-gray-300" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogo}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5" /> {uploading ? "Uploading..." : "Logo"}
              </Button>
              {form.logo_url && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-gray-500"
                  onClick={() => setForm((f) => ({ ...f, logo_url: "" }))}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Firm / Owner Name *</Label>
                <Input value={form.name} onChange={set("name")} className="h-8 text-sm" placeholder="Firm name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Primary Contact Name</Label>
                <Input value={form.primary_contact_name} onChange={set("primary_contact_name")} className="h-8 text-sm" placeholder="Primary contact" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Address</Label>
              <Textarea value={form.address} onChange={set("address")} className="min-h-16 text-sm" placeholder="Street, city, state, zip, country" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-700">Phone</Label>
            <Input value={form.phone} onChange={set("phone")} className="h-8 text-sm" placeholder="Phone number" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-700">Email</Label>
            <Input type="email" value={form.email} onChange={set("email")} className="h-8 text-sm" placeholder="owner@firm.com" />
          </div>
        </div>
        <div className="flex justify-end pt-1">
          <Button
            size="sm"
            className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            disabled={saving}
            onClick={handleSave}
          >
            <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save Firm Owner"}
          </Button>
        </div>
      </div>
    </div>
  );
}