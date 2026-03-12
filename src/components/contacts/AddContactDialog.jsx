import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Building2, Pencil, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import QuickAddFirmForm from "./QuickAddFirmForm";

export default function AddContactDialog({ open, onOpenChange, editingContact, currentFirmId, firms: firmsProp = [], viewMode: initialViewMode = false }) {
  const [viewMode, setViewMode] = useState(initialViewMode);
  const { data: liveFirms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date"),
  });
  const firms = liveFirms.length > 0 ? liveFirms : firmsProp;
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [firmIds, setFirmIds] = useState([]);
  const [firmSearch, setFirmSearch] = useState("");
  const [showFirmPicker, setShowFirmPicker] = useState(false);
  const [showQuickAddFirm, setShowQuickAddFirm] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      if (editingContact) {
        setFirstName(editingContact.first_name || "");
        setLastName(editingContact.last_name || "");
        setTitle(editingContact.title || "");
        setEmail(editingContact.email || "");
        setPhone(editingContact.phone || "");
        setNotes(editingContact.notes || "");
        setFirmIds(editingContact.firm_ids || []);
      } else {
        setFirstName("");
        setLastName("");
        setTitle("");
        setEmail("");
        setPhone("");
        setNotes("");
        setFirmIds(currentFirmId ? [currentFirmId] : []);
      }
      setFirmSearch("");
      setShowFirmPicker(false);
      setShowQuickAddFirm(false);
      setViewMode(initialViewMode);
    }
  }, [open, editingContact, currentFirmId, initialViewMode]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Contact.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      onOpenChange(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contact.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      onOpenChange(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Contact.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      onOpenChange(false);
    },
  });

  const isValid = firstName.trim() && lastName.trim();

  const handleSubmit = () => {
    if (!isValid) return;
    const data = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      title: title.trim(),
      email: email.trim(),
      phone: phone.trim(),
      notes: notes.trim(),
      firm_ids: firmIds,
    };
    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const sortedFirms = [...firms].sort((a, b) => a.name.localeCompare(b.name));
  const filteredFirms = sortedFirms.filter(
    (f) => !firmIds.includes(f.id) && f.name.toLowerCase().includes(firmSearch.toLowerCase())
  );

  const addFirm = (id) => {
    setFirmIds([...firmIds, id]);
    setFirmSearch("");
    setShowFirmPicker(false);
  };

  const removeFirm = (id) => {
    setFirmIds(firmIds.filter((fid) => fid !== id));
  };

  const getFirmName = (id) => firms.find((f) => f.id === id)?.name || id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {viewMode
              ? `${editingContact?.first_name} ${editingContact?.last_name}`
              : editingContact
              ? "Edit Contact"
              : "Add Contact"}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-4 py-2 pr-1">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">First Name {!viewMode && "*"}</Label>
              {viewMode ? (
                <div className="text-sm text-gray-900 px-1">{firstName || <span className="text-gray-400 italic">—</span>}</div>
              ) : (
                <Input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-9" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Last Name {!viewMode && "*"}</Label>
              {viewMode ? (
                <div className="text-sm text-gray-900 px-1">{lastName || <span className="text-gray-400 italic">—</span>}</div>
              ) : (
                <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-9" />
              )}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Title</Label>
            {viewMode ? (
              <div className="text-sm text-gray-900 px-1">{title || <span className="text-gray-400 italic">—</span>}</div>
            ) : (
              <Input placeholder="e.g. Portfolio Manager" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Email</Label>
            {viewMode ? (
              <div className="text-sm text-indigo-600 px-1">{email || <span className="text-gray-400 italic">—</span>}</div>
            ) : (
              <Input type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9" />
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Phone</Label>
            {viewMode ? (
              <div className="text-sm text-gray-900 px-1">{phone || <span className="text-gray-400 italic">—</span>}</div>
            ) : (
              <Input placeholder="+1 (555) 000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9" />
            )}
          </div>

          {/* Associated Firms */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Associated Firms</Label>
            <div className="flex flex-wrap gap-1.5 mb-1">
              {firmIds.map((id) => (
                <Badge key={id} variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-xs">
                  <Building2 className="w-3 h-3" />
                  {getFirmName(id)}
                  {!viewMode && (
                    <button type="button" onClick={() => removeFirm(id)} className="ml-0.5 hover:text-red-500 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </Badge>
              ))}
              {viewMode && firmIds.length === 0 && <span className="text-sm text-gray-400 italic px-1">—</span>}
            </div>

            {!viewMode && (!showFirmPicker ? (
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50" onClick={() => setShowFirmPicker(true)}>
                <Plus className="w-3 h-3" /> Add Firm
              </Button>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Input autoFocus placeholder="Search firms..." value={firmSearch} onChange={(e) => setFirmSearch(e.target.value)} className="h-8 border-0 border-b rounded-none text-sm" />
                <div className="max-h-40 overflow-y-auto">
                  {filteredFirms.length === 0 ? (
                    <div className="text-xs text-gray-400 italic text-center py-3">No firms available</div>
                  ) : (
                    filteredFirms.map((f) => (
                      <button key={f.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors" onClick={() => addFirm(f.id)}>
                        {f.name}
                        <span className="ml-1.5 text-xs text-gray-400">{f.firm_type}</span>
                      </button>
                    ))
                  )}
                </div>
                {showQuickAddFirm ? (
                  <QuickAddFirmForm
                    onFirmCreated={(newFirm) => {
                      setFirmIds((prev) => [...prev, newFirm.id]);
                      setShowQuickAddFirm(false);
                      setShowFirmPicker(false);
                      setFirmSearch("");
                    }}
                    onCancel={() => setShowQuickAddFirm(false)}
                  />
                ) : (
                  <div className="border-t px-2 py-1.5 flex items-center justify-between">
                    <button type="button" onClick={() => setShowFirmPicker(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    <button type="button" onClick={() => setShowQuickAddFirm(true)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5">
                      <Plus className="w-3 h-3" /> Add New Firm
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Notes</Label>
            {viewMode ? (
              <div className="text-sm text-gray-900 px-1 whitespace-pre-wrap">{notes || <span className="text-gray-400 italic">—</span>}</div>
            ) : (
              <Textarea placeholder="Additional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16 text-sm" />
            )}
          </div>
        </div>

        <DialogFooter className="pt-2 border-t gap-2">
          {viewMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => deleteMutation.mutate(editingContact.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setViewMode(false)}>
                <Pencil className="w-4 h-4 mr-1" /> Edit
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => editingContact ? setViewMode(true) : onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!isValid} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {editingContact ? "Save Changes" : "Add Contact"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}