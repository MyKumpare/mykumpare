import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { X, Plus, Building2, Pencil, Trash2, User, Phone, MapPin, Upload, TrendingUp, Tag, GraduationCap, Briefcase, Activity } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import QuickAddFirmForm from "./QuickAddFirmForm";
import ContactPhoneForm from "./ContactPhoneForm";
import ContactAddressForm from "./ContactAddressForm";
import ContactEducationTab from "./ContactEducationTab";
import ContactProfessionalExperienceTab from "./ContactProfessionalExperienceTab";

const SALUTATIONS = ["Mr.", "Ms.", "Mrs.", "Dr.", "Prof.", "Hon."];
const SUFFIXES = ["Jr.", "Sr.", "II", "III", "IV", "Esq.", "CFA", "CPA", "MBA", "PhD", "MD"];

function newPhone() {
  return { id: crypto.randomUUID(), phone_type: "", country_code: "", area_code: "", number_mid: "", number_last: "", is_default: false };
}

function newAddress() {
  return { id: crypto.randomUUID(), is_primary: false, country: "", state: "", city: "", postal_code: "", address_line1: "", address_line2: "" };
}

export default function AddContactDialog({ open, onOpenChange, editingContact, currentFirmId, firms: firmsProp = [], viewMode: initialViewMode = false, onNavigateToOwnership }) {
  const [viewMode, setViewMode] = useState(initialViewMode);
  const { data: liveFirms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date"),
  });
  const firms = liveFirms.length > 0 ? liveFirms : firmsProp;

  const [photoUrl, setPhotoUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [salutation, setSalutation] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [biography, setBiography] = useState("");
  const [designations, setDesignations] = useState([]);
  const [employeeStatus, setEmployeeStatus] = useState("");
  const [contactStatus, setContactStatus] = useState("Active");
  const [contactRole, setContactRole] = useState("");
  const [contactType, setContactType] = useState("");
  const [gender, setGender] = useState("Undetermined");
  const [ethnicity, setEthnicity] = useState([]);
  const [veteranStatus, setVeteranStatus] = useState("Undetermined");
  const [disabilityStatus, setDisabilityStatus] = useState("Undetermined");
  const [showUndeterminedWarning, setShowUndeterminedWarning] = useState(false);
  const [notes, setNotes] = useState("");
  const [firmIds, setFirmIds] = useState([]);
  const [firmSearch, setFirmSearch] = useState("");
  const [showFirmPicker, setShowFirmPicker] = useState(false);
  const [showQuickAddFirm, setShowQuickAddFirm] = useState(false);
  const [education, setEducation] = useState([]);
  const [professionalExperience, setProfessionalExperience] = useState([]);
  const [phones, setPhones] = useState([newPhone()]);
  const [addresses, setAddresses] = useState([newAddress()]);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      if (editingContact) {
        setPhotoUrl(editingContact.photo_url || "");
        setSalutation(editingContact.salutation || "");
        setFirstName(editingContact.first_name || "");
        setMiddleName(editingContact.middle_name || "");
        setLastName(editingContact.last_name || "");
        setSuffix(editingContact.suffix || "");
        setTitle(editingContact.title || "");
        setDesignations(editingContact.designations || []);
        setEmail(editingContact.email || "");
        setLinkedinUrl(editingContact.linkedin_url || "");
        setEmployeeStatus(editingContact.employee_status || "");
        setContactStatus(editingContact.contact_status || "Active");
        setContactRole(editingContact.contact_role || "");
        setContactType(editingContact.contact_type || "");
        setGender(editingContact.gender || "Undetermined");
        setEthnicity(editingContact.ethnicity || []);
        setVeteranStatus(editingContact.veteran_status || "Undetermined");
        setDisabilityStatus(editingContact.disability_status || "Undetermined");
        setBiography(editingContact.biography || "");
        setNotes(editingContact.notes || "");
        setFirmIds(editingContact.firm_ids || []);
        setEducation(editingContact.education || []);
        setProfessionalExperience(editingContact.professional_experience || []);
        setPhones(editingContact.phones?.length > 0 ? editingContact.phones : [newPhone()]);
        setAddresses(editingContact.addresses?.length > 0 ? editingContact.addresses : [newAddress()]);
      } else {
        setPhotoUrl("");
        setSalutation("");
        setFirstName("");
        setMiddleName("");
        setLastName("");
        setSuffix("");
        setTitle("");
        setDesignations([]);
        setEmail("");
        setLinkedinUrl("");
        setEmployeeStatus("");
        setContactStatus("Active");
        setContactRole("");
        setContactType("");
        setGender("Undetermined");
        setEthnicity([]);
        setVeteranStatus("Undetermined");
        setDisabilityStatus("Undetermined");
        setShowUndeterminedWarning(false);
        setBiography("");
        setNotes("");
        setFirmIds(currentFirmId ? [currentFirmId] : []);
        setEducation([]);
        setProfessionalExperience([]);
        setPhones([newPhone()]);
        setAddresses([newAddress()]);
      }
      setFirmSearch("");
      setShowFirmPicker(false);
      setShowQuickAddFirm(false);
      setViewMode(initialViewMode);
    }
  }, [open, editingContact, currentFirmId, initialViewMode]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Contact.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["contacts"] }); onOpenChange(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contact.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["contacts"] }); onOpenChange(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Contact.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["contacts"] }); onOpenChange(false); },
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setPhotoUrl(file_url);
    setUploadingPhoto(false);
  };

  const isValid = firstName.trim() && lastName.trim();

  const hasUndetermined = gender === "Undetermined" || ethnicity.length === 0 || veteranStatus === "Undetermined" || disabilityStatus === "Undetermined";

  // Dismiss warning automatically when all undetermined items are resolved
  React.useEffect(() => {
    if (!hasUndetermined) setShowUndeterminedWarning(false);
  }, [hasUndetermined]);

  const handleSubmit = () => {
    if (!isValid) return;
    setShowUndeterminedWarning(false);
    const data = {
      photo_url: photoUrl,
      salutation,
      first_name: firstName.trim(),
      middle_name: middleName.trim(),
      last_name: lastName.trim(),
      suffix,
      title: title.trim(),
      designations,
      email: email.trim(),
      linkedin_url: linkedinUrl.trim(),
      employee_status: employeeStatus,
      contact_status: contactStatus,
      contact_role: contactRole,
      contact_type: contactType,
      gender,
      ethnicity,
      veteran_status: veteranStatus,
      disability_status: disabilityStatus,
      biography: biography.trim(),
      notes: notes.trim(),
      education,
      professional_experience: professionalExperience,
      firm_ids: firmIds,
      phones,
      addresses,
    };
    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const { data: allOwnerships = [] } = useQuery({
    queryKey: ["ownership"],
    queryFn: () => base44.entities.Ownership.list("-effective_date"),
    enabled: !!editingContact,
  });

  // Find all ownership records where this contact appears as an owner, grouped by firm
  const contactOwnershipByFirm = useMemo(() => {
    if (!editingContact) return [];
    const result = {};
    allOwnerships.forEach(ownership => {
      const ownerEntry = ownership.owners?.find(o => o.contact_id === editingContact.id);
      if (ownerEntry) {
        if (!result[ownership.firm_id]) result[ownership.firm_id] = [];
        result[ownership.firm_id].push({
          ownershipId: ownership.id,
          effective_date: ownership.effective_date,
          percentage: ownerEntry.ownership_percentage,
          owner_type: ownerEntry.owner_type,
        });
      }
    });
    // Sort each firm's history by date descending
    Object.keys(result).forEach(fid => {
      result[fid].sort((a, b) => new Date(b.effective_date) - new Date(a.effective_date));
    });
    return result;
  }, [allOwnerships, editingContact]);

  const sortedFirms = [...firms].sort((a, b) => a.name.localeCompare(b.name));
  const filteredFirms = sortedFirms.filter(
    (f) => !firmIds.includes(f.id) && f.name.toLowerCase().includes(firmSearch.toLowerCase())
  );
  const addFirm = (id) => { setFirmIds([...firmIds, id]); setFirmSearch(""); setShowFirmPicker(false); };
  const removeFirm = (id) => setFirmIds(firmIds.filter((fid) => fid !== id));
  const getFirmName = (id) => firms.find((f) => f.id === id)?.name || id;

  // Phone handlers
  const updatePhone = (idx, p) => setPhones(phones.map((ph, i) => i === idx ? p : ph));
  const deletePhone = (idx) => setPhones(phones.filter((_, i) => i !== idx));
  const setDefaultPhone = (idx) => setPhones(phones.map((ph, i) => ({ ...ph, is_default: i === idx })));
  const addPhone = () => setPhones([...phones, newPhone()]);

  // Address handlers
  const updateAddress = (idx, a) => setAddresses(addresses.map((ad, i) => i === idx ? a : ad));
  const deleteAddress = (idx) => setAddresses(addresses.filter((_, i) => i !== idx));
  const setPrimaryAddress = (idx) => setAddresses(addresses.map((ad, i) => ({ ...ad, is_primary: i === idx })));
  const addAddress = () => setAddresses([...addresses, newAddress()]);

  const formatMiddleName = (name) => {
    if (!name) return "";
    return name.length === 1 ? `${name}.` : name;
  };

  const formatFullName = () => {
    const parts = [salutation, firstName, formatMiddleName(middleName), lastName].filter(Boolean);
    const name = parts.join(" ");
    return suffix ? `${name}, ${suffix}` : name;
  };

  const ro = (val, className = "text-sm text-gray-900 px-1") => (
    <div className={className}>{val || <span className="text-gray-400 italic">—</span>}</div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          {viewMode && editingContact ? (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-indigo-200">
                {photoUrl ? (
                  <img src={photoUrl} alt="Contact" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-indigo-400" />
                )}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base leading-tight">
                  {formatFullName()}
                  {designations?.length > 0 && `, ${designations.join(", ")}`}
                </DialogTitle>
                {firmIds.length > 0 && (
                  <p className="text-sm text-indigo-600 font-medium mt-0.5 truncate">
                    {firmIds.map(id => getFirmName(id)).join(", ")}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <DialogTitle>
              {editingContact ? "Edit Contact" : "Add Contact"}
            </DialogTitle>
          )}
        </DialogHeader>

        <div className="overflow-y-auto flex-1 py-2 pr-1">
          <Tabs defaultValue="info">
            <div className="space-y-1 mb-4">
              <TabsList className="w-full">
                <TabsTrigger value="info" className="flex-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Info
                </TabsTrigger>
                <TabsTrigger value="phones" className="flex-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Phones
                </TabsTrigger>
                <TabsTrigger value="addresses" className="flex-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Addresses
                </TabsTrigger>
              </TabsList>
              <TabsList className="w-full">
                <TabsTrigger value="education" className="flex-1 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5" /> Education
                </TabsTrigger>
                <TabsTrigger value="experience" className="flex-1 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" /> Experience
                </TabsTrigger>
                <TabsTrigger value="classification" className="flex-1 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" /> Classification
                </TabsTrigger>
              </TabsList>
              <TabsList className="w-full">
                <TabsTrigger value="demographics" className="flex-1 flex items-center gap-1.5">
                  Demographics
                </TabsTrigger>
                <TabsTrigger value="ownership" className="flex-1 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" /> Ownership
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── INFO TAB ── */}
            <TabsContent value="info" className="space-y-4 mt-0">
              {/* Photo (edit mode only — in view mode it appears in the header) */}
              {!viewMode && (
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-indigo-200">
                    {photoUrl ? (
                      <img src={photoUrl} alt="Contact" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-7 h-7 text-indigo-400" />
                    )}
                  </div>
                  <div>
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                      <div className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 rounded-md px-3 py-1.5 hover:bg-indigo-50 transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        {uploadingPhoto ? "Uploading..." : photoUrl ? "Change Photo" : "Upload Photo"}
                      </div>
                    </label>
                    {photoUrl && (
                      <button type="button" onClick={() => setPhotoUrl("")} className="mt-1 text-xs text-red-500 hover:text-red-700 ml-1">
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Salutation + First Name + Middle Name */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Salutation</Label>
                  {viewMode ? ro(salutation) : (
                    <Select value={salutation} onValueChange={setSalutation}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>—</SelectItem>
                        {SALUTATIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">First Name *</Label>
                  {viewMode ? ro(firstName) : (
                    <Input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-9" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Middle Name</Label>
                  {viewMode ? ro(middleName) : (
                    <Input placeholder="Middle" value={middleName} onChange={(e) => setMiddleName(e.target.value)} className="h-9" />
                  )}
                </div>
              </div>

              {/* Last Name + Suffix */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Last Name *</Label>
                  {viewMode ? ro(lastName) : (
                    <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-9" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Suffix</Label>
                  {viewMode ? ro(suffix) : (
                    <Select value={suffix} onValueChange={setSuffix}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>—</SelectItem>
                        {SUFFIXES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Title</Label>
                {viewMode ? ro(title) : (
                  <Input placeholder="e.g. Portfolio Manager" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
                )}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Email</Label>
                {viewMode ? (
                  <div className="text-sm px-1">
                    {email ? <a href={`mailto:${email}`} className="text-indigo-600 hover:underline">{email}</a> : <span className="text-gray-400 italic">—</span>}
                  </div>
                ) : (
                  <Input type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9" />
                )}
              </div>

              {/* LinkedIn URL */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">LinkedIn</Label>
                {viewMode ? (
                  <div className="text-sm px-1">
                    {linkedinUrl ? <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">View LinkedIn</a> : <span className="text-gray-400 italic">—</span>}
                  </div>
                ) : (
                  <Input type="url" placeholder="https://linkedin.com/in/..." value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} className="h-9" />
                )}
              </div>

              {/* Biography */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Biography</Label>
                {viewMode ? (
                  <div className="text-sm text-gray-900 px-1 whitespace-pre-wrap">{biography || <span className="text-gray-400 italic">—</span>}</div>
                ) : (
                  <Textarea placeholder="Brief biography..." value={biography} onChange={(e) => setBiography(e.target.value)} className="min-h-20 text-sm" />
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
                            {f.name}<span className="ml-1.5 text-xs text-gray-400">{f.firm_type}</span>
                          </button>
                        ))
                      )}
                    </div>
                    {showQuickAddFirm ? (
                      <QuickAddFirmForm
                        onFirmCreated={(newFirm) => { setFirmIds((prev) => [...prev, newFirm.id]); setShowQuickAddFirm(false); setShowFirmPicker(false); setFirmSearch(""); }}
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
            </TabsContent>

            {/* ── PHONES TAB ── */}
            <TabsContent value="phones" className="space-y-3 mt-0">
              {/* Firm phones suggestion */}
              {!viewMode && (() => {
                const firmPhones = firms
                  .filter(f => firmIds.includes(f.id) && f.phones?.length > 0)
                  .flatMap(f => f.phones.map(p => ({ ...p, _firmName: f.name })));
                if (firmPhones.length === 0) return null;
                const formatNum = (p) => [p.country_code ? `+${p.country_code}` : null, p.area_code ? `(${p.area_code})` : null, [p.number_mid, p.number_last].filter(Boolean).join("-") || null].filter(Boolean).join(" ") || "—";
                const alreadyAdded = (p) => phones.some(ph => ph.area_code === p.area_code && ph.number_mid === p.number_mid && ph.number_last === p.number_last);
                return (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 space-y-2">
                    <p className="text-xs font-medium text-indigo-700 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Firm Phone Numbers</p>
                    {firmPhones.map((p, i) => (
                      <div key={i} className="flex items-center justify-between bg-white rounded-lg border border-indigo-100 px-3 py-2">
                        <div>
                          <div className="text-sm text-gray-800 font-mono">{formatNum(p)}</div>
                          <div className="text-xs text-gray-400">{p.phone_type || "Phone"} · {p._firmName}</div>
                        </div>
                        {alreadyAdded(p) ? (
                          <span className="text-xs text-green-600 font-medium">Added</span>
                        ) : (
                          <Button type="button" size="sm" variant="outline"
                            className="h-7 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                            onClick={() => setPhones(prev => {
                              const hasEmpty = prev.some(ph => !ph.number_mid && !ph.number_last);
                              const newEntry = { ...p, id: crypto.randomUUID(), is_default: false };
                              return hasEmpty ? prev.map((ph, i) => i === prev.findIndex(ph => !ph.number_mid && !ph.number_last) ? newEntry : ph) : [...prev, newEntry];
                            })}>
                            Use This
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
              {phones.map((ph, idx) => (
                <ContactPhoneForm
                  key={ph.id}
                  phone={ph}
                  onChange={(p) => updatePhone(idx, p)}
                  onDelete={() => deletePhone(idx)}
                  onSetDefault={() => setDefaultPhone(idx)}
                  isDefault={!!ph.is_default}
                  isEditing={!viewMode}
                  isOnly={phones.length === 1}
                />
              ))}
              <Button type="button" variant="outline" size="sm" className="w-full h-8 text-xs gap-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50" onClick={() => { if (viewMode) setViewMode(false); addPhone(); }}>
                <Plus className="w-3.5 h-3.5" /> Add Phone
              </Button>
            </TabsContent>

            {/* ── ADDRESSES TAB ── */}
            <TabsContent value="addresses" className="space-y-3 mt-0">
              {/* Firm addresses suggestion */}
              {!viewMode && (() => {
                const firmAddresses = firms
                  .filter(f => firmIds.includes(f.id) && f.addresses?.length > 0)
                  .flatMap(f => f.addresses.map(a => ({ ...a, _firmName: f.name })));
                if (firmAddresses.length === 0) return null;
                const formatAddr = (a) => [a.address_line1, a.city, a.state, a.country].filter(Boolean).join(", ") || "—";
                const alreadyAdded = (a) => addresses.some(ad => ad.address_line1 === a.address_line1 && ad.city === a.city && ad.postal_code === a.postal_code);
                return (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 space-y-2">
                    <p className="text-xs font-medium text-indigo-700 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Firm Addresses</p>
                    {firmAddresses.map((a, i) => (
                      <div key={i} className="flex items-center justify-between bg-white rounded-lg border border-indigo-100 px-3 py-2">
                        <div>
                          <div className="text-sm text-gray-800">{formatAddr(a)}</div>
                          <div className="text-xs text-gray-400">{a.is_headquarters ? "HQ · " : ""}{a._firmName}</div>
                        </div>
                        {alreadyAdded(a) ? (
                          <span className="text-xs text-green-600 font-medium">Added</span>
                        ) : (
                          <Button type="button" size="sm" variant="outline"
                            className="h-7 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                            onClick={() => setAddresses(prev => {
                              const hasEmpty = prev.some(ad => !ad.address_line1 && !ad.city);
                              const newEntry = { ...a, id: crypto.randomUUID(), is_primary: false, _firmName: undefined };
                              return hasEmpty ? prev.map((ad, i) => i === prev.findIndex(ad => !ad.address_line1 && !ad.city) ? newEntry : ad) : [...prev, newEntry];
                            })}>
                            Use This
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
              {addresses.map((addr, idx) => (
                <ContactAddressForm
                  key={addr.id}
                  address={addr}
                  onChange={(a) => updateAddress(idx, a)}
                  onDelete={() => deleteAddress(idx)}
                  onSetPrimary={() => setPrimaryAddress(idx)}
                  isPrimary={!!addr.is_primary}
                  isEditing={!viewMode}
                  isOnly={addresses.length === 1}
                />
              ))}
              <Button type="button" variant="outline" size="sm" className="w-full h-8 text-xs gap-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50" onClick={() => { if (viewMode) setViewMode(false); addAddress(); }}>
                <Plus className="w-3.5 h-3.5" /> Add Address
              </Button>
            </TabsContent>

            {/* ── EDUCATION TAB ── */}
            <TabsContent value="education" className="mt-0">
              <ContactEducationTab
                education={education}
                onChange={setEducation}
                designations={designations}
                onDesignationsChange={setDesignations}
                viewMode={viewMode}
              />
            </TabsContent>

            {/* ── EXPERIENCE TAB ── */}
            <TabsContent value="experience" className="mt-0">
              <ContactProfessionalExperienceTab
                experience={professionalExperience}
                onChange={setProfessionalExperience}
                firms={firms}
                viewMode={viewMode}
              />
            </TabsContent>

            {/* ── CLASSIFICATION TAB ── */}
            <TabsContent value="classification" className="space-y-4 mt-0">
              {/* Contact Status */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Contact Status</Label>
                {viewMode ? (
                  <div className="text-sm px-1">
                    {contactStatus ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${contactStatus === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {contactStatus}
                      </span>
                    ) : <span className="text-gray-400 italic">—</span>}
                  </div>
                ) : (
                  <Select value={contactStatus} onValueChange={setContactStatus}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Contact Priority */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Contact Priority</Label>
                {viewMode ? (
                  <div className="text-sm px-1">
                    {contactRole ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${contactRole === "Primary" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"}`}>
                        {contactRole}
                      </span>
                    ) : <span className="text-gray-400 italic">—</span>}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {["Primary", "Secondary"].map(role => (
                      <button key={role} type="button"
                        onClick={() => setContactRole(contactRole === role ? "" : role)}
                        className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${contactRole === role
                          ? role === "Primary" ? "bg-indigo-600 text-white border-indigo-600" : "bg-gray-600 text-white border-gray-600"
                          : "bg-white text-gray-600 border-gray-300 hover:border-indigo-300 hover:text-indigo-600"}`}>
                        {role}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Contact Type */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Contact Type</Label>
                {viewMode ? (
                  <div className="text-sm px-1">
                    {contactType ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{contactType}</span>
                    ) : <span className="text-gray-400 italic">—</span>}
                  </div>
                ) : (
                  <Select value={contactType} onValueChange={(v) => setContactType(v === contactType ? "" : v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {["Allocator", "Investment Consultant", "Investment Manager", "Securities Broker", "Trade Organization Representative"].map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Employee Status */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Employee Status</Label>
                {viewMode ? (
                  <div className="text-sm px-1">
                    {employeeStatus ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${employeeStatus === "Employee" ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"}`}>
                        {employeeStatus}
                      </span>
                    ) : <span className="text-gray-400 italic">—</span>}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {["Employee", "Non-Employee"].map(status => (
                      <button key={status} type="button"
                        onClick={() => setEmployeeStatus(employeeStatus === status ? "" : status)}
                        className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${employeeStatus === status
                          ? status === "Employee" ? "bg-indigo-600 text-white border-indigo-600" : "bg-amber-600 text-white border-amber-600"
                          : "bg-white text-gray-600 border-gray-300 hover:border-indigo-300 hover:text-indigo-600"}`}>
                        {status}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── DEMOGRAPHICS TAB ── */}
            <TabsContent value="demographics" className="space-y-4 mt-0">
              <div className={`space-y-3 rounded-xl border p-3 ${hasUndetermined && !viewMode ? "border-red-200 bg-red-50/40" : "border-gray-100 bg-gray-50/60"}`}>
                {/* Gender */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Gender</Label>
                  {viewMode ? (
                    <div className="text-sm px-1 text-gray-900">{gender || "Undetermined"}</div>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {["Undetermined", "Male", "Female"].map(g => (
                        <button key={g} type="button" onClick={() => setGender(g)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${gender === g
                            ? g === "Undetermined" ? "bg-red-500 text-white border-red-500" : "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-gray-600 border-gray-300 hover:border-indigo-300 hover:text-indigo-600"}`}>
                          {g}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ethnicity */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Ethnicity</Label>
                  {viewMode ? (
                    <div className="text-sm px-1 text-gray-900">{ethnicity?.length > 0 ? ethnicity.join(", ") : "Undetermined"}</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button type="button"
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${ethnicity.length === 0 ? "bg-red-500 text-white border-red-500" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-300 hover:text-indigo-600"}`}
                        onClick={() => setEthnicity([])}>
                        Undetermined
                      </button>
                      {["African American", "Asian American", "Caucasian", "Latino American", "Native American Indian", "Native Alaskan Indian"].map(e => {
                        const selected = ethnicity.includes(e);
                        return (
                          <button key={e} type="button"
                            onClick={() => setEthnicity(selected ? ethnicity.filter(x => x !== e) : [...ethnicity, e])}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${selected ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-300 hover:text-indigo-600"}`}>
                            {e}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Veteran Status */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Veteran Status</Label>
                  {viewMode ? (
                    <div className="text-sm px-1 text-gray-900">{veteranStatus || "Undetermined"}</div>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {["Undetermined", "Veteran Owned", "Non-Veteran Owned"].map(v => (
                        <button key={v} type="button" onClick={() => setVeteranStatus(v)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${veteranStatus === v
                            ? v === "Undetermined" ? "bg-red-500 text-white border-red-500" : "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-gray-600 border-gray-300 hover:border-indigo-300 hover:text-indigo-600"}`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Disability Status */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Disability Status</Label>
                  {viewMode ? (
                    <div className="text-sm px-1 text-gray-900">{disabilityStatus || "Undetermined"}</div>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {["Undetermined", "Disabled", "Non-Disabled"].map(d => (
                        <button key={d} type="button" onClick={() => setDisabilityStatus(d)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${disabilityStatus === d
                            ? d === "Undetermined" ? "bg-red-500 text-white border-red-500" : "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-gray-600 border-gray-300 hover:border-indigo-300 hover:text-indigo-600"}`}>
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ── OWNERSHIP TAB ── */}
            <TabsContent value="ownership" className="space-y-4 mt-0">
              {editingContact && Object.keys(contactOwnershipByFirm).length > 0 ? (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 divide-y divide-indigo-100">
                  {Object.entries(contactOwnershipByFirm).map(([firmId, history]) => {
                    const firmName = getFirmName(firmId);
                    const latest = history[0];
                    return (
                      <div key={firmId} className="p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-indigo-700">{firmName}</span>
                          <span className="text-sm font-bold text-indigo-600">{latest.percentage?.toFixed(2)}%</span>
                        </div>
                        <div className="space-y-0.5">
                          {history.map((h, i) => (
                            <div key={i} className="flex items-center justify-between text-xs text-gray-500">
                              {onNavigateToOwnership && h.ownershipId ? (
                                <button
                                  type="button"
                                  onClick={() => { onOpenChange(false); onNavigateToOwnership(firmId, h.ownershipId); }}
                                  className="text-indigo-600 hover:underline font-medium"
                                >
                                  {new Date(h.effective_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                                </button>
                              ) : (
                                <span>{new Date(h.effective_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                              )}
                              <span className="font-medium text-gray-700">{h.percentage?.toFixed(2)}% · {h.owner_type}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-gray-400 italic text-center py-8">No ownership records found.</div>
              )}
            </TabsContent>
          </Tabs>
        </div>



        <DialogFooter className="pt-2 border-t gap-2">
          {viewMode ? (
            <>
              <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => deleteMutation.mutate(editingContact.id)} disabled={deleteMutation.isPending}>
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
              <Button variant="outline" onClick={() => { setShowUndeterminedWarning(false); editingContact ? setViewMode(true) : onOpenChange(false); }}>Cancel</Button>
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