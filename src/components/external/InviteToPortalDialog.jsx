import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Search, Building2, User, UserPlus, Mail, Loader2, AlertTriangle, Check, ArrowLeft,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  findContactDuplicates, findContactsByNormalizedName,
} from "@/components/contacts/contactDuplicateCheck";

const SALUTATIONS = ["Mr.", "Ms.", "Mrs.", "Dr.", "Prof.", "Hon."];
const SUFFIXES = ["Jr.", "Sr.", "II", "III", "IV", "Esq.", "CFA", "CPA", "MBA", "PhD", "MD"];

export default function InviteToPortalDialog({
  open,
  onOpenChange,
  preselectedContact = null,
  preselectedFirmId = null,
}) {
  const { user } = useAuth();
  const [firmSearch, setFirmSearch] = useState("");
  const [selectedFirm, setSelectedFirm] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [addingNew, setAddingNew] = useState(false);
  const [ncSalutation, setNcSalutation] = useState("");
  const [ncFirst, setNcFirst] = useState("");
  const [ncLast, setNcLast] = useState("");
  const [ncSuffix, setNcSuffix] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
    enabled: open,
  });
  const { data: allContacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
    enabled: open,
  });

  // Reset / pre-fill when the dialog opens
  useEffect(() => {
    if (!open) return;
    setDuplicateWarning(null);
    setSending(false);
    if (preselectedContact) {
      setSelectedContact(preselectedContact);
      setEmail(preselectedContact.email || "");
      setAddingNew(false);
      const fid = preselectedFirmId || preselectedContact.firm_ids?.[0] || null;
      const f = fid ? firms.find((x) => x.id === fid) : null;
      setSelectedFirm(f || null);
    } else {
      setSelectedContact(null);
      setSelectedFirm(null);
      setAddingNew(false);
      setEmail("");
      setNcFirst(""); setNcLast(""); setNcSalutation(""); setNcSuffix("");
      setFirmSearch("");
    }
  }, [open, preselectedContact, preselectedFirmId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedFirms = useMemo(
    () => [...firms].filter((f) => !f.deleted_at).sort((a, b) => a.name.localeCompare(b.name)),
    [firms]
  );
  const filteredFirms = sortedFirms.filter((f) =>
    f.name.toLowerCase().includes(firmSearch.toLowerCase())
  );

  const firmContacts = useMemo(() => {
    if (!selectedFirm) return [];
    return allContacts
      .filter((c) => !c.deleted_at && c.firm_ids?.includes(selectedFirm.id))
      .sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
      );
  }, [allContacts, selectedFirm]);

  const handleSelectFirm = (firm) => {
    setSelectedFirm(firm);
    setSelectedContact(null);
    setAddingNew(false);
    setEmail("");
  };

  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
    setAddingNew(false);
    setEmail(contact.email || "");
  };

  const handleStartAddNew = () => {
    setAddingNew(true);
    setSelectedContact(null);
    setEmail("");
    setNcFirst(""); setNcLast(""); setNcSalutation(""); setNcSuffix("");
  };

  const inviteeName = addingNew
    ? `${ncFirst} ${ncLast}`.trim()
    : selectedContact
      ? [selectedContact.first_name, selectedContact.last_name].filter(Boolean).join(" ")
      : "";

  const canSend = (() => {
    if (!selectedFirm) return false;
    if (!email.trim()) return false;
    if (addingNew && (!ncFirst.trim() || !ncLast.trim())) return false;
    return true;
  })();

  const handleSend = async (forceNew = false) => {
    if (!selectedFirm) {
      toast({ title: "Select a firm", variant: "destructive" });
      return;
    }
    if (!email.trim()) {
      toast({ title: "Email required", description: "Enter the contact's email to send the invitation.", variant: "destructive" });
      return;
    }

    // Duplicate check for new contacts (unless user already chose to force-create)
    if (addingNew && !forceNew) {
      const newContactData = { first_name: ncFirst, last_name: ncLast, email };
      const dups = findContactDuplicates(newContactData, allContacts);
      const normDups = findContactsByNormalizedName(newContactData, allContacts);
      const allDups = dups.length > 0
        ? dups
        : normDups.map((d) => ({
            contact: d.contact,
            name: d.name,
            email: d.email,
            reasons: ["Same first and last name as an existing contact"],
            score: 0.75,
          }));
      if (allDups.length > 0) {
        setDuplicateWarning({ duplicates: allDups });
        return;
      }
    }

    setSending(true);
    try {
      const res = await base44.functions.invoke("inviteToPortal", {
        action: "invite",
        firm_id: selectedFirm.id,
        firm_name: selectedFirm.name,
        contact_id: selectedContact?.id || null,
        first_name: addingNew ? ncFirst.trim() : (selectedContact?.first_name || ""),
        last_name: addingNew ? ncLast.trim() : (selectedContact?.last_name || ""),
        email: email.trim(),
        is_new_contact: addingNew,
        salutation: addingNew ? ncSalutation : undefined,
        suffix: addingNew ? ncSuffix : undefined,
      });
      if (res.data?.error) throw new Error(res.data.error);
      if (!res.data?.success) throw new Error(res.data?.error || "Could not send invitation.");

      // Send the branded invitation email (best-effort)
      try {
        const inviteFirst = addingNew ? ncFirst.trim() : (selectedContact?.first_name || "");
        const inviteLast = addingNew ? ncLast.trim() : (selectedContact?.last_name || "");
        const inviteSalutation = addingNew ? ncSalutation : (selectedContact?.salutation || "");
        const inviteSuffix = addingNew ? ncSuffix : (selectedContact?.suffix || "");
        const params = new URLSearchParams({
          firm: selectedFirm.name || "",
          first: inviteFirst,
          last: inviteLast,
          email: email.trim(),
        });
        if (inviteSalutation) params.set("salutation", inviteSalutation);
        if (inviteSuffix) params.set("suffix", inviteSuffix);
        const regUrl = `${window.location.origin}/#/register?${params.toString()}`;
        await base44.functions.invoke("sendExternalInvitationEmail", {
          email: email.trim().toLowerCase(),
          inviteeName,
          firmName: selectedFirm.name,
          invitedByName: user?.full_name || user?.email,
          registrationUrl: regUrl,
        });
      } catch (emailErr) {
        console.warn("Invitation email failed:", emailErr);
      }

      toast({
        title: "Invitation sent",
        description: `${email.trim()} has been invited to the ${selectedFirm.name} portal.`,
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Invitation failed",
        description: err?.message || "Could not send invitation.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleForceCreate = () => {
    setDuplicateWarning(null);
    handleSend(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-base">
              <Mail className="w-4 h-4 text-indigo-500" /> Invite to External Portal
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 space-y-4 py-1 pr-1">
            {/* Preselected contact summary */}
            {preselectedContact && selectedContact && (
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {selectedContact.photo_url ? (
                    <img src={selectedContact.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-indigo-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {[selectedContact.salutation, selectedContact.first_name, selectedContact.last_name, selectedContact.suffix].filter(Boolean).join(" ")}
                  </p>
                  {selectedContact.title && <p className="text-xs text-gray-500 truncate">{selectedContact.title}</p>}
                </div>
              </div>
            )}

            {/* Firm selector — hidden when a firm is already locked in via preselection */}
            {!preselectedContact && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Firm</Label>
                {selectedFirm ? (
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-800 truncate">{selectedFirm.name}</span>
                    </div>
                    <button type="button" onClick={() => { setSelectedFirm(null); setSelectedContact(null); setAddingNew(false); setEmail(""); }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5">
                      <ArrowLeft className="w-3 h-3" /> Change
                    </button>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <Input autoFocus placeholder="Search firms..." value={firmSearch} onChange={(e) => setFirmSearch(e.target.value)}
                        className="h-9 border-0 border-b rounded-none pl-8" />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {filteredFirms.length === 0 ? (
                        <div className="text-xs text-gray-400 italic text-center py-4">No firms found</div>
                      ) : (
                        filteredFirms.map((f) => (
                          <button key={f.id} type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center gap-2"
                            onClick={() => handleSelectFirm(f)}>
                            <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{f.name}</span>
                            <span className="ml-auto text-[10px] text-gray-400 truncate">{(f.firm_types || []).join(", ") || f.firm_type}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Contact picker — shown once a firm is selected (and not preselected) */}
            {selectedFirm && !preselectedContact && !selectedContact && !addingNew && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Contact at {selectedFirm.name}</Label>
                {firmContacts.length === 0 ? (
                  <div className="text-center py-3 rounded-lg border border-dashed border-gray-200">
                    <p className="text-xs text-gray-400 mb-2">No contacts found for this firm.</p>
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50" onClick={handleStartAddNew}>
                      <UserPlus className="w-3.5 h-3.5" /> Add New Contact
                    </Button>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                    {firmContacts.map((c) => (
                      <button key={c.id} type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors flex items-center gap-2 border-b border-gray-50 last:border-0"
                        onClick={() => handleSelectContact(c)}>
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {c.photo_url ? <img src={c.photo_url} alt="" className="w-full h-full object-cover" /> : <User className="w-3.5 h-3.5 text-gray-400" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {[c.salutation, c.first_name, c.last_name, c.suffix].filter(Boolean).join(" ")}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate">{c.title || c.email || "No email"}</p>
                        </div>
                      </button>
                    ))}
                    <button type="button"
                      className="w-full text-left px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-50 font-medium flex items-center gap-1.5 border-t border-indigo-100"
                      onClick={handleStartAddNew}>
                      <UserPlus className="w-3.5 h-3.5" /> Add New Contact
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Selected contact summary (when picked from list) */}
            {selectedContact && !preselectedContact && (
              <div className="rounded-lg border border-gray-200 bg-white p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {selectedContact.photo_url ? <img src={selectedContact.photo_url} alt="" className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-indigo-400" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {[selectedContact.salutation, selectedContact.first_name, selectedContact.last_name, selectedContact.suffix].filter(Boolean).join(" ")}
                    </p>
                    {selectedContact.title && <p className="text-[11px] text-gray-400 truncate">{selectedContact.title}</p>}
                  </div>
                </div>
                <button type="button" onClick={() => { setSelectedContact(null); setEmail(""); }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5 flex-shrink-0">
                  <ArrowLeft className="w-3 h-3" /> Change
                </button>
              </div>
            )}

            {/* New contact form */}
            {addingNew && (
              <div className="space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/30 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1"><UserPlus className="w-3.5 h-3.5" /> New Contact</p>
                  <button type="button" onClick={() => { setAddingNew(false); setEmail(""); setNcFirst(""); setNcLast(""); }}
                    className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-gray-600">Salutation</Label>
                    <Select value={ncSalutation} onValueChange={setNcSalutation}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>—</SelectItem>
                        {SALUTATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-gray-600">First Name *</Label>
                    <Input className="h-8 text-xs" value={ncFirst} onChange={(e) => setNcFirst(e.target.value)} placeholder="First" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-gray-600">Last Name *</Label>
                    <Input className="h-8 text-xs" value={ncLast} onChange={(e) => setNcLast(e.target.value)} placeholder="Last" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1 col-span-1">
                    <Label className="text-[11px] text-gray-600">Suffix</Label>
                    <Select value={ncSuffix} onValueChange={setNcSuffix}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>—</SelectItem>
                        {SUFFIXES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Email field — shown when a contact is selected or a new contact is being added */}
            {(selectedContact || addingNew) && selectedFirm && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Invitation Email *</Label>
                <Input type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9" />
                {!email.trim() && selectedContact && (
                  <p className="text-[11px] text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> This contact has no email on file — enter one to send the invitation.
                  </p>
                )}
                <p className="text-[11px] text-gray-400">
                  They'll receive a link to register at <span className="font-mono">{window.location.origin}/#/register</span>
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => handleSend()} disabled={!canSend || sending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {sending ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate contact warning */}
      {duplicateWarning && (
        <Dialog open={true} onOpenChange={() => setDuplicateWarning(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" /> Potential Duplicate Contact
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-gray-600">
                The following existing contact(s) appear similar to the one you're about to invite. Please review before proceeding.
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {duplicateWarning.duplicates.map((dup, i) => (
                  <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="font-semibold text-sm text-gray-800">{dup.name}</p>
                    {dup.email && <p className="text-xs text-gray-500">{dup.email}</p>}
                    <ul className="mt-1.5 space-y-0.5">
                      {dup.reasons.map((r, ri) => (
                        <li key={ri} className="text-xs text-amber-700 flex items-start gap-1">
                          <span className="text-amber-500 mt-0.5">⚠</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDuplicateWarning(null)}>Cancel</Button>
              <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleForceCreate} disabled={sending}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Invite Anyway
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}