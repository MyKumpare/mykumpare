import React, { useState, useEffect, useMemo, useRef } from "react";
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
import { X, Plus, Building2, Pencil, Trash2, User, Phone, MapPin, Upload, TrendingUp, Tag, GraduationCap, Briefcase, Activity, Package, AlertTriangle, Linkedin, Loader2, ClipboardCheck, Image as ImageIcon, Bell, MessageSquare, Mail, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import QuickAddFirmForm from "./QuickAddFirmForm";
import ContactPhoneForm from "./ContactPhoneForm";
import ContactAddressForm from "./ContactAddressForm";
import ContactEducationTab from "./ContactEducationTab";
import ContactProfessionalExperienceTab from "./ContactProfessionalExperienceTab";
import ContactActivitiesTab from "./ContactActivitiesTab";
import ContactTimeline from "./ContactTimeline";
import ContactDueDiligenceTab from "./ContactDueDiligenceTab";
import ContactNotificationsTab from "./ContactNotificationsTab";
import ContactChatTab from "./ContactChatTab";
import ContactProductsTab from "./ContactProductsTab";
import ScrapeProfileButton from "./ScrapeProfileButton";
import ContactRolePicker from "./ContactRolePicker";
import ContactDepartmentPicker from "./ContactDepartmentPicker";
import ContactTypePicker, { defaultContactTypesFromFirm } from "./ContactTypePicker";
import { findContactDuplicates, findContactsByNormalizedName } from "./contactDuplicateCheck";
import SimilarAddressDialog from "../SimilarAddressDialog";
import { findAddressIssues } from "../addressDuplicateCheck";
import SubRecordDuplicateDialog from "./SubRecordDuplicateDialog";
import { findEducationDuplicates, findExperienceDuplicates, findPhoneDuplicates } from "./subRecordDuplicateCheck";
import InviteToPortalDialog from "../external/InviteToPortalDialog";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const SALUTATIONS = ["Mr.", "Ms.", "Mrs.", "Dr.", "Prof.", "Hon."];
const SUFFIXES = ["Jr.", "Sr.", "II", "III", "IV", "Esq.", "CFA", "CPA", "MBA", "PhD", "MD"];

function newPhone() {
  return { id: crypto.randomUUID(), phone_type: "", country_code: "", area_code: "", number_mid: "", number_last: "", is_default: false };
}

function newAddress() {
  return { id: crypto.randomUUID(), is_primary: false, country: "", state: "", city: "", postal_code: "", address_line1: "", address_line2: "" };
}

export default function AddContactDialog({ open, onOpenChange, editingContact, currentFirmId, firms: firmsProp = [], viewMode: initialViewMode = false, initialPhotoUrl = null, onNavigateToOwnership, onContactCreated, onProductClick, onFirmClick, onContactClick }) {
  const [viewMode, setViewMode] = useState(initialViewMode);
  const [activeTab, setActiveTab] = useState("info");
  const [highlightChatId, setHighlightChatId] = useState(null);
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
  const [bioUrl, setBioUrl] = useState("");
  const [designations, setDesignations] = useState([]);
  const [employeeStatus, setEmployeeStatus] = useState("Employee");
  const [contactStatus, setContactStatus] = useState("Active");
  const [contactRole, setContactRole] = useState("");
  const [contactType, setContactType] = useState([]);
  const [contactRoles, setContactRoles] = useState([]);
  const [contactFirmRoles, setContactFirmRoles] = useState([]);
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
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [linkedinLookupLoading, setLinkedinLookupLoading] = useState(false);
  const [linkedinPhotoLoading, setLinkedinPhotoLoading] = useState(false);
  const [similarAddressPairs, setSimilarAddressPairs] = useState(null);
  const [subRecordReview, setSubRecordReview] = useState(null);
  const [extracting, setExtracting] = useState(null); // "education" | "experience" | null
  const [portalInviteOpen, setPortalInviteOpen] = useState(false);

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: allContacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });

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
        setContactType(Array.isArray(editingContact.contact_type) ? editingContact.contact_type : (editingContact.contact_type ? [editingContact.contact_type] : []));
        setContactRoles(editingContact.contact_roles || []);
        setContactFirmRoles(editingContact.contact_firm_roles || []);
        setGender(editingContact.gender || "Undetermined");
        setEthnicity(editingContact.ethnicity || []);
        setVeteranStatus(editingContact.veteran_status || "Undetermined");
        setDisabilityStatus(editingContact.disability_status || "Undetermined");
        setBiography(editingContact.biography || "");
        setBioUrl(editingContact.bio_url || "");
        setNotes(editingContact.notes || "");
        setFirmIds(editingContact.firm_ids || []);
        setEducation(editingContact.education || []);
        setProfessionalExperience(editingContact.professional_experience || []);
        setPhones(editingContact.phones?.length > 0
          ? [...editingContact.phones].sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0))
          : [newPhone()]);
        setAddresses(editingContact.addresses?.length > 0
          ? [...editingContact.addresses].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
          : [newAddress()]);
      } else {
        setPhotoUrl(initialPhotoUrl || "");
        setSalutation("");
        setFirstName("");
        setMiddleName("");
        setLastName("");
        setSuffix("");
        setTitle("");
        setDesignations([]);
        setEmail("");
        setLinkedinUrl("");
        setEmployeeStatus("Employee");
        setContactStatus("Active");
        setContactRole("");
        setContactType([]);
        setContactRoles([]);
        setContactFirmRoles([]);
        setGender("Undetermined");
        setEthnicity([]);
        setVeteranStatus("Undetermined");
        setDisabilityStatus("Undetermined");
        setShowUndeterminedWarning(false);
        setBiography("");
        setBioUrl("");
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
      }, [open, editingContact, currentFirmId, initialViewMode, initialPhotoUrl]);

      // Default contact type from the initial firm (for new contacts with a pre-selected firm).
      // Runs once per dialog open, after firms have loaded.
      const initialTypeDefaultApplied = useRef(false);
      useEffect(() => {
      if (open && !editingContact && currentFirmId && firms.length > 0 && !initialTypeDefaultApplied.current) {
      const firm = firms.find((f) => f.id === currentFirmId);
      if (firm) {
        const defaults = defaultContactTypesFromFirm(firm);
        if (defaults.length > 0) setContactType(defaults);
      }
      initialTypeDefaultApplied.current = true;
      }
      if (!open) initialTypeDefaultApplied.current = false;
      }, [open, editingContact, currentFirmId, firms]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Contact.create(data),
    onSuccess: (createdContact) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      onOpenChange(false);
      if (onContactCreated) onContactCreated(createdContact);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contact.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["contacts"] }); onOpenChange(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Contact.update(id, { deleted_at: new Date().toISOString() }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["contacts"] }); queryClient.invalidateQueries({ queryKey: ["deletedContacts"] }); onOpenChange(false); toast({ title: "✅ Contact deleted" }); },
    onError: (err) => { toast({ title: "Delete failed", description: err.message || "Could not delete this contact.", variant: "destructive" }); },
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setPhotoUrl(file_url);
    setUploadingPhoto(false);
  };

  const handleLinkedInLookup = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast({ title: "Name required", description: "Enter the contact's first and last name first.", variant: "destructive" });
      return;
    }
    const firm = firms.find((f) => firmIds.includes(f.id));
    setLinkedinLookupLoading(true);
    try {
      const res = await base44.functions.invoke("linkedinContactLookup", {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        firm_id: firm?.id || "",
        website: firm?.website || "",
        current_title: title.trim(),
      });
      if (res.data?.linkedin_url) {
        setLinkedinUrl(res.data.linkedin_url);
        // Auto-fill the contact photo from the firm team/bio page when no photo is set yet.
        if (res.data.photo_url && !photoUrl) {
          setPhotoUrl(res.data.photo_url);
          toast({ title: "✅ LinkedIn profile found", description: res.data.linkedin_url });
          toast({ title: "✅ Photo added", description: "Pulled the contact's headshot from their web profile." });
        } else {
          toast({ title: "✅ LinkedIn profile found", description: res.data.linkedin_url });
        }
      } else {
        toast({ title: "No profile found", description: res.data?.message || "Could not find a LinkedIn profile for this contact." });
      }
    } catch (err) {
      toast({ title: "LinkedIn lookup failed", description: err.response?.data?.error || err.message || "Please connect your LinkedIn account first.", variant: "destructive" });
    }
    setLinkedinLookupLoading(false);
  };

  // Pull the contact's profile photo directly from their LinkedIn profile page.
  const handleLinkedInPhoto = async () => {
    const url = linkedinUrl.trim();
    if (!url) {
      toast({ title: "No LinkedIn URL", description: "Enter a LinkedIn profile link first.", variant: "destructive" });
      return;
    }
    setLinkedinPhotoLoading(true);
    try {
      const firm = firms.find((f) => firmIds.includes(f.id));
      const res = await base44.functions.invoke("linkedinProfilePhoto", {
        linkedin_url: url,
        firm_id: firm?.id || "",
        website: firm?.website || "",
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      if (res.data?.photo_url) {
        setPhotoUrl(res.data.photo_url);
        toast({ title: "✅ Photo added", description: "Pulled the headshot from the LinkedIn profile." });
      } else {
        toast({ title: "No photo found", description: res.data?.message || "Could not extract a photo from that LinkedIn profile.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Photo extraction failed", description: err.response?.data?.error || err.message || "Could not extract the photo.", variant: "destructive" });
    }
    setLinkedinPhotoLoading(false);
  };

  const isValid = firstName.trim() && lastName.trim();

  const hasUndetermined = gender === "Undetermined" || ethnicity.length === 0 || veteranStatus === "Undetermined" || disabilityStatus === "Undetermined";

  // Dismiss warning automatically when all undetermined items are resolved
  React.useEffect(() => {
    if (!hasUndetermined) setShowUndeterminedWarning(false);
  }, [hasUndetermined]);

  // Unified pre-submit validator: checks sub-record duplicates (education,
  // experience, phones) first, then address duplicates. Each resolution path
  // re-enters this function so all checks always run before the final save.
  const validateAndSubmit = (addrs, overrides = {}, opts = {}) => {
    if (!isValid) return;
    const ed = overrides.education ?? education;
    const ex = overrides.professional_experience ?? professionalExperience;
    const ph = overrides.phones ?? phones;

    // 1. Sub-record duplicates → open the review dialog (skipped when resuming
    //    right after the user already resolved them, so "accept" decisions
    //    don't re-trigger the same review in a loop).
    if (!opts.skipSubRecords) {
      const eduPairs = findEducationDuplicates(ed);
      const expPairs = findExperienceDuplicates(ex);
      const phonePairs = findPhoneDuplicates(ph);
      if (eduPairs.length || expPairs.length || phonePairs.length) {
        setSubRecordReview({
          pairs: [...eduPairs, ...expPairs, ...phonePairs],
          arrays: { education: ed, professional_experience: ex, phones: ph },
          submitAfter: { addresses: addrs },
        });
        return;
      }
    }

    // 2. Address duplicates (existing flow)
    const { exactPairs, similarPairs } = findAddressIssues(addrs);
    if (exactPairs.length > 0) {
      const [i, j] = exactPairs[0];
      toast({ title: "Duplicate address", description: `Address #${i + 1} and #${j + 1} are identical. Please remove or edit the duplicate before saving.`, variant: "destructive" });
      return;
    }
    if (similarPairs.length > 0) {
      setSimilarAddressPairs({ pairs: similarPairs.map(([i, j]) => ({ i, j, ai: addrs[i], aj: addrs[j] })) });
      return;
    }

    performSubmit(addrs, overrides);
  };

  const handleSubmit = () => validateAndSubmit(addresses);

  const performSubmit = (addrs, overrides = {}) => {
    setShowUndeterminedWarning(false);
    const ed = overrides.education ?? education;
    const ex = overrides.professional_experience ?? professionalExperience;
    const ph = overrides.phones ?? phones;
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
      contact_roles: contactRoles,
      contact_firm_roles: contactFirmRoles,
      gender,
      ethnicity,
      veteran_status: veteranStatus,
      disability_status: disabilityStatus,
      biography: biography.trim(),
      bio_url: bioUrl.trim(),
      notes: notes.trim(),
      education: ed,
      professional_experience: ex,
      firm_ids: firmIds,
      phones: ph,
      addresses: addrs,
      tenant_id: user?.linked_firm_id,
    };
    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, data });
    } else {
      const duplicates = findContactDuplicates(data, allContacts);
      // Fallback: also check normalized first+last name to catch cases where
      // suffixes/designations are embedded in the name field.
      const normDups = findContactsByNormalizedName(data, allContacts);
      const allDups = duplicates.length > 0 ? duplicates : normDups.map(d => ({
        contact: d.contact,
        name: d.name,
        email: d.email,
        reasons: ["Same first and last name as an existing contact"],
        score: 0.75,
      }));
      if (allDups.length > 0) {
        setDuplicateWarning({ data, duplicates: allDups });
        return;
      }
      createMutation.mutate(data);
    }
  };

  const handleResolveSimilarAddresses = (removeIndices) => {
    let cleaned = addresses.filter((_, i) => !removeIndices.includes(i));
    // Reassign primary if the primary address was removed
    if (cleaned.length > 0 && !cleaned.some((a) => a.is_primary)) {
      cleaned = cleaned.map((a, i) => i === 0 ? { ...a, is_primary: true } : a);
    }
    setAddresses(cleaned);
    setSimilarAddressPairs(null);
    validateAndSubmit(cleaned);
  };

  // Apply the user's accept/merge/delete decisions from the sub-record review.
  // If the review was triggered from Save, re-enter the validator to finish.
  const handleApplySubRecordReview = (resolvedArrays) => {
    setEducation(resolvedArrays.education);
    setProfessionalExperience(resolvedArrays.professional_experience);
    setPhones(resolvedArrays.phones);
    const submitAfter = subRecordReview?.submitAfter;
    setSubRecordReview(null);
    if (submitAfter) {
      validateAndSubmit(submitAfter.addresses, resolvedArrays, { skipSubRecords: true });
    }
  };

  // Extract structured education or professional-experience records from the
  // contact's biography via LLM, then merge with existing records. Any
  // duplicates against existing records are surfaced in the review dialog.
  const handleExtractFromBio = async (type) => {
    if (!biography || !biography.trim()) {
      toast({ title: "No biography", description: "Add a biography for this contact first, then extract.", variant: "destructive" });
      return;
    }
    // Leave view mode so the user can review and save the extracted records.
    if (viewMode) setViewMode(false);
    setExtracting(type);
    try {
      const isEdu = type === "education";
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are extracting structured ${isEdu ? "education history" : "professional experience"} from a person's biography. Only include facts that are explicitly stated. Do not fabricate.

Biography:
"""
${biography.trim().substring(0, 8000)}
"""

Return a JSON object. For education, each item: institution, degree, area_of_specialization, graduation_year (string), majors (array of strings). Only include schools/universities the person attended as a student. For professional experience, each item: company_name, title, start_year (string), end_year (string, empty if it is the person's current employer). Include ALL employers mentioned in the biography, including the person's current employer (leave end_year empty for current roles). Order entries from most recent to oldest.`,
        response_json_schema: isEdu
          ? {
              type: "object",
              properties: {
                education: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      institution: { type: "string" },
                      degree: { type: "string" },
                      area_of_specialization: { type: "string" },
                      graduation_year: { type: "string" },
                      majors: { type: "array", items: { type: "string" } },
                    },
                  },
                },
              },
            }
          : {
              type: "object",
              properties: {
                professional_experience: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      company_name: { type: "string" },
                      title: { type: "string" },
                      start_year: { type: "string" },
                      end_year: { type: "string" },
                    },
                  },
                },
              },
            },
      });
      const raw = isEdu ? res?.education : res?.professional_experience;
      const items = (Array.isArray(raw) ? raw : []).map((x) => ({
        ...x,
        id: crypto.randomUUID(),
        ...(isEdu ? { majors: Array.isArray(x.majors) ? x.majors : [], minors: [] } : {}),
      }));
      if (items.length === 0) {
        toast({ title: "Nothing extracted", description: "No structured records could be found in the biography." });
        return;
      }
      const existing = isEdu ? education : professionalExperience;
      const sortFn = isEdu
        ? (a, b) => (parseInt(b.graduation_year) || 0) - (parseInt(a.graduation_year) || 0)
        : (a, b) => (parseInt(b.start_year) || 0) - (parseInt(a.start_year) || 0);
      const combined = [...existing, ...items].sort(sortFn);
      const pairs = isEdu ? findEducationDuplicates(combined) : findExperienceDuplicates(combined);
      if (pairs.length > 0) {
        setSubRecordReview({
          pairs,
          arrays: isEdu
            ? { education: combined, professional_experience: professionalExperience, phones }
            : { education: education, professional_experience: combined, phones },
          submitAfter: null,
        });
      } else {
        if (isEdu) setEducation(combined); else setProfessionalExperience(combined);
        toast({ title: `✅ ${items.length} record${items.length === 1 ? "" : "s"} extracted`, description: "Added from biography." });
      }
    } catch (err) {
      toast({ title: "Extraction failed", description: err?.message || "Could not extract from biography.", variant: "destructive" });
    } finally {
      setExtracting(null);
    }
  };

  const handleForceCreate = () => {
    if (duplicateWarning?.data) {
      createMutation.mutate(duplicateWarning.data);
    }
    setDuplicateWarning(null);
  };

  // Handle the response from ScrapeProfileButton — update dialog state with
  // the freshly scraped data so the user can review it before saving.
  const handleScrapeComplete = (data) => {
    if (!data) return;
    const ext = data.extracted || {};
    setBioUrl(data.profile_url || bioUrl);
    if (ext.biography && ext.biography.length > (biography || "").length) setBiography(ext.biography);
    if (ext.title && ext.title.length >= (title || "").length) setTitle(ext.title);
    if (ext.email && !email) setEmail(ext.email);
    if (ext.photo_url && !photoUrl) setPhotoUrl(ext.photo_url);
    if (Array.isArray(ext.designations) && ext.designations.length > 0) {
      const existing = new Set((designations || []).map((d) => d.toLowerCase()));
      const newOnes = ext.designations.filter((d) => d && !existing.has(d.toLowerCase()));
      if (newOnes.length > 0) setDesignations([...(designations || []), ...newOnes]);
    }
    if (Array.isArray(ext.education) && ext.education.length > 0) {
      const eduKey = (e) => `${(e.institution || "").toLowerCase()}|${(e.degree || "").toLowerCase()}|${(e.graduation_year || "").toLowerCase()}`;
      const existingKeys = new Set((education || []).map(eduKey));
      const newEdu = ext.education
        .filter((e) => e && (e.institution || e.degree))
        .filter((e) => { const k = eduKey(e); if (existingKeys.has(k)) return false; existingKeys.add(k); return true; })
        .map((e) => ({ ...e, id: crypto.randomUUID(), majors: Array.isArray(e.majors) ? e.majors : [], minors: [] }));
      if (newEdu.length > 0) setEducation([...(education || []), ...newEdu]);
    }
    if (Array.isArray(ext.professional_experience) && ext.professional_experience.length > 0) {
      const expKey = (e) => `${(e.company_name || "").toLowerCase()}|${(e.title || "").toLowerCase()}|${(e.start_year || "").toLowerCase()}`;
      const existingKeys = new Set((professionalExperience || []).map(expKey));
      const newExp = ext.professional_experience
        .filter((e) => e && (e.company_name || e.title))
        .filter((e) => { const k = expKey(e); if (existingKeys.has(k)) return false; existingKeys.add(k); return true; })
        .map((e) => ({ ...e, id: crypto.randomUUID() }));
      if (newExp.length > 0) setProfessionalExperience([...(professionalExperience || []), ...newExp]);
    }
    // Refresh the query cache so the list reflects the backend update.
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
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

  // Firm types that show Contact Role and Contact Department
  const CONTACT_ROLE_FIRM_TYPES = ["Manager of Managers", "Investment Manager", "Allocator", "Investment Consultant"];
  const associatedFirmTypes = firmIds.flatMap(fid => {
    const firm = firms.find(f => f.id === fid);
    return firm?.firm_types || (firm?.firm_type ? [firm.firm_type] : []);
  });
  const showContactFirmRoles = associatedFirmTypes.some(t => CONTACT_ROLE_FIRM_TYPES.includes(t));

  const [firmRemoveWarning, setFirmRemoveWarning] = useState(null); // firmId pending removal
  const [confirmDeleteContact, setConfirmDeleteContact] = useState(false);

  const sortedFirms = [...firms].sort((a, b) => a.name.localeCompare(b.name));
  const filteredFirms = sortedFirms.filter(
    (f) => !firmIds.includes(f.id) && f.name.toLowerCase().includes(firmSearch.toLowerCase())
  );
  const addFirm = (id) => {
    setFirmIds([...firmIds, id]);
    setFirmSearch("");
    setShowFirmPicker(false);
    // Default contact type based on the newly added firm's type
    const firm = firms.find((f) => f.id === id);
    if (firm) {
      const defaults = defaultContactTypesFromFirm(firm);
      if (defaults.length > 0) {
        setContactType((prev) => [...new Set([...prev, ...defaults])]);
      }
    }
  };
  const removeFirm = (id) => {
    if (editingContact) {
      setFirmRemoveWarning(id);
    } else {
      setFirmIds(firmIds.filter((fid) => fid !== id));
    }
  };
  const confirmRemoveFirm = () => {
    setFirmIds(firmIds.filter((fid) => fid !== firmRemoveWarning));
    setFirmRemoveWarning(null);
  };
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

  const onDragEndPhones = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const reordered = [...phones];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    if (viewMode) setViewMode(false);
    setPhones(reordered);
  };

  const onDragEndAddresses = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const reordered = [...addresses];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    if (viewMode) setViewMode(false);
    setAddresses(reordered);
  };

  const formatMiddleName = (name) => {
    if (!name) return "";
    return name.length === 1 ? `${name}.` : name;
  };

  // Auto title-case: first letter upper, rest lower. Leaves mixed-case names
  // (e.g. "McDonald") untouched so users can override the auto-formatting.
  const autoCaseName = (val) => {
    if (!val) return "";
    const trimmed = val.trim();
    const lower = trimmed.toLowerCase();
    const upper = trimmed.toUpperCase();
    if (trimmed !== lower && trimmed !== upper) return trimmed;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  };

  const formatFullName = () => {
    const parts = [salutation, firstName, formatMiddleName(middleName), lastName].filter(Boolean);
    const name = parts.join(" ");
    return suffix ? `${name}, ${suffix}` : name;
  };

  const ro = (val, className = "text-sm text-gray-900 px-1") => (
    <div className={className}>{val || <span className="text-gray-400 italic">—</span>}</div>
  );

  const hasContactChanges = (() => {
    if (viewMode) return false;
    if (editingContact) {
      const e = editingContact;
      return (
        photoUrl !== (e.photo_url || "") ||
        salutation !== (e.salutation || "") ||
        firstName.trim() !== (e.first_name || "").trim() ||
        middleName.trim() !== (e.middle_name || "").trim() ||
        lastName.trim() !== (e.last_name || "").trim() ||
        suffix !== (e.suffix || "") ||
        title.trim() !== (e.title || "").trim() ||
        email.trim() !== (e.email || "").trim() ||
        linkedinUrl.trim() !== (e.linkedin_url || "").trim() ||
        biography.trim() !== (e.biography || "").trim() ||
        notes.trim() !== (e.notes || "").trim() ||
        employeeStatus !== (e.employee_status || "") ||
        contactStatus !== (e.contact_status || "Active") ||
        contactRole !== (e.contact_role || "") ||
        JSON.stringify(contactType) !== JSON.stringify(Array.isArray(e.contact_type) ? e.contact_type : (e.contact_type ? [e.contact_type] : [])) ||
        gender !== (e.gender || "Undetermined") ||
        veteranStatus !== (e.veteran_status || "Undetermined") ||
        disabilityStatus !== (e.disability_status || "Undetermined") ||
        JSON.stringify(ethnicity) !== JSON.stringify(e.ethnicity || []) ||
        JSON.stringify(designations) !== JSON.stringify(e.designations || []) ||
        JSON.stringify(contactRoles) !== JSON.stringify(e.contact_roles || []) ||
        JSON.stringify(contactFirmRoles) !== JSON.stringify(e.contact_firm_roles || []) ||
        JSON.stringify([...firmIds].sort()) !== JSON.stringify([...(e.firm_ids || [])].sort()) ||
        JSON.stringify(education) !== JSON.stringify(e.education || []) ||
        JSON.stringify(professionalExperience) !== JSON.stringify(e.professional_experience || []) ||
        JSON.stringify(phones) !== JSON.stringify(e.phones || []) ||
        JSON.stringify(addresses) !== JSON.stringify(e.addresses || [])
      );
    }
    return !!(firstName.trim() || lastName.trim() || email.trim() || title.trim() ||
      biography.trim() || notes.trim() || photoUrl || linkedinUrl.trim() ||
      firmIds.length > 0 || education.length > 0 || professionalExperience.length > 0 ||
      phones.some(p => p.area_code || p.number_mid || p.number_last) ||
      addresses.some(a => a.address_line1 || a.city || a.state));
  })();

  const { guardedClose, guardDialog } = useUnsavedChangesGuard(hasContactChanges, () => onOpenChange(false), handleSubmit);

  return (
    <>
    {/* Similar address confirmation */}
    <SimilarAddressDialog
      open={!!similarAddressPairs}
      onOpenChange={(v) => { if (!v) setSimilarAddressPairs(null); }}
      pairs={similarAddressPairs?.pairs || []}
      onResolve={handleResolveSimilarAddresses}
    />

    {/* Sub-record (education / experience / phones) duplicate review */}
    <SubRecordDuplicateDialog
      review={subRecordReview}
      onApply={handleApplySubRecordReview}
      onCancel={() => setSubRecordReview(null)}
    />

    {/* Firm remove warning */}
    {firmRemoveWarning && (
      <Dialog open={!!firmRemoveWarning} onOpenChange={() => setFirmRemoveWarning(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" />Remove Associated Firm?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">You are about to remove <strong>{getFirmName(firmRemoveWarning)}</strong> from this contact's associated firms. Do you want to proceed?</p>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setFirmRemoveWarning(null)}>Cancel</Button>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={confirmRemoveFirm}>Yes, Remove It</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    <Dialog open={open} onOpenChange={(v) => { if (!v) guardedClose(); }}>
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
                <DialogTitle className="text-base leading-tight flex items-center gap-2 flex-wrap">
                  <span>
                    {formatFullName()}
                    {designations?.length > 0 && `, ${designations.join(", ")}`}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      (contactStatus || "Active") === "Inactive"
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        (contactStatus || "Active") === "Inactive" ? "bg-red-500" : "bg-green-500"
                      }`}
                    />
                    {contactStatus || "Active"}
                  </span>
                </DialogTitle>
                {firmIds.length > 0 && (
                  <p className="text-sm text-indigo-600 font-medium mt-0.5 truncate">
                    {firmIds.map((id, i) => (
                      <span key={id}>
                        {i > 0 && ", "}
                        {onFirmClick ? (
                          <button
                            type="button"
                            className="underline hover:text-indigo-800"
                            onClick={() => onFirmClick(firms.find(f => f.id === id))}
                          >
                            {getFirmName(id)}
                          </button>
                        ) : getFirmName(id)}
                      </span>
                    ))}
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
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="space-y-1 mb-4">
              <TabsList className="w-full">
                <TabsTrigger value="info" className="flex-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Info
                </TabsTrigger>
                <TabsTrigger value="addresses" className="flex-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Addresses
                </TabsTrigger>
                <TabsTrigger value="phones" className="flex-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Phones
                </TabsTrigger>
              </TabsList>
              <TabsList className="w-full">
                <TabsTrigger value="products" className="flex-1 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" /> Products
                </TabsTrigger>
                <TabsTrigger value="education" className="flex-1 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5" /> Education
                </TabsTrigger>
                <TabsTrigger value="experience" className="flex-1 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" /> Experience
                </TabsTrigger>
              </TabsList>
              <TabsList className="w-full">
                <TabsTrigger value="classification" className="flex-1 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" /> Classifications
                </TabsTrigger>
                <TabsTrigger value="demographics" className="flex-1 flex items-center gap-1.5">
                  Demographics
                </TabsTrigger>
                <TabsTrigger value="ownership" className="flex-1 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" /> Ownership
                </TabsTrigger>
              </TabsList>
              <div className="flex gap-1">
                <TabsList className="">
                  <TabsTrigger value="activities" className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" /> Activities
                  </TabsTrigger>
                  <TabsTrigger value="timeline" className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Timeline
                  </TabsTrigger>
                  <TabsTrigger value="due-diligence" className="flex items-center gap-1.5">
                    <ClipboardCheck className="w-3.5 h-3.5" /> Due Diligence
                  </TabsTrigger>
                  <TabsTrigger value="chat" className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" /> Chat
                  </TabsTrigger>
                </TabsList>
              </div>
              <div className="flex gap-1">
                <TabsList className="">
                  <TabsTrigger value="notifications" className="flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5" /> Notifications
                  </TabsTrigger>
                </TabsList>
              </div>
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
                    <Input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} onBlur={() => setFirstName(autoCaseName(firstName))} className="h-9" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Middle Name</Label>
                  {viewMode ? ro(middleName) : (
                    <Input placeholder="Middle" value={middleName} onChange={(e) => setMiddleName(e.target.value)} onBlur={() => setMiddleName(autoCaseName(middleName))} className="h-9" />
                  )}
                </div>
              </div>

              {/* Last Name + Suffix */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Last Name *</Label>
                  {viewMode ? ro(lastName) : (
                    <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} onBlur={() => setLastName(autoCaseName(lastName))} className="h-9" />
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

              {/* Contact Status */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Contact Status</Label>
                {viewMode ? (
                  <div className="text-sm px-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${(contactStatus || "Active") === "Inactive" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${(contactStatus || "Active") === "Inactive" ? "bg-red-500" : "bg-green-500"}`} />
                      {contactStatus || "Active"}
                    </span>
                  </div>
                ) : (
                  <Select value={contactStatus || "Active"} onValueChange={setContactStatus}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select status..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
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
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">LinkedIn</Label>
                </div>
                {viewMode ? (
                  <div className="text-sm px-1">
                    {linkedinUrl ? <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">View LinkedIn</a> : <span className="text-gray-400 italic">—</span>}
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <Input type="url" placeholder="https://linkedin.com/in/..." value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} className="h-9 flex-1" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 px-2 text-[#0A66C2] border-[#0A66C2]/30 hover:bg-[#0A66C2]/10 gap-1"
                      onClick={handleLinkedInLookup}
                      disabled={linkedinLookupLoading || !firstName.trim() || !lastName.trim()}
                      title="Find LinkedIn profile"
                    >
                      {linkedinLookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Linkedin className="w-4 h-4" />}
                      <span className="text-xs">Find</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 px-2 text-[#0A66C2] border-[#0A66C2]/30 hover:bg-[#0A66C2]/10 gap-1"
                      onClick={handleLinkedInPhoto}
                      disabled={linkedinPhotoLoading || !linkedinUrl.trim()}
                      title="Extract photo from LinkedIn profile"
                    >
                      {linkedinPhotoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                      <span className="text-xs">Photo</span>
                    </Button>
                  </div>
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

              {/* Scrape Profile Page — lets the user point at the contact's
                  individual profile URL and re-scrape it for bio, education,
                  experience, and designations. Only shown for existing contacts
                  (needs a contact_id to update). */}
              {editingContact && (
                <ScrapeProfileButton
                  contactId={editingContact.id}
                  bioUrl={bioUrl}
                  onScrapeComplete={handleScrapeComplete}
                />
              )}

              {/* Associated Firms */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Associated Firms</Label>
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {firmIds.map((id) => (
                    <Badge key={id} variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-xs">
                      <Building2 className="w-3 h-3" />
                      {onFirmClick ? (
                        <button
                          type="button"
                          className="underline hover:text-indigo-800 text-left"
                          onClick={() => onFirmClick(firms.find(f => f.id === id))}
                        >
                          {getFirmName(id)}
                        </button>
                      ) : (
                        <span>{getFirmName(id)}</span>
                      )}
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
              <DragDropContext onDragEnd={onDragEndPhones}>
                <Droppable droppableId="contact-phones">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                      {phones.map((ph, idx) => (
                        <Draggable key={ph.id} draggableId={ph.id} index={idx} isDragDisabled={viewMode}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              className={snap.isDragging ? "ring-2 ring-indigo-400 shadow-lg rounded-xl z-50" : ""}
                            >
                              <ContactPhoneForm
                                phone={ph}
                                onChange={(p) => updatePhone(idx, p)}
                                onDelete={() => deletePhone(idx)}
                                onSetDefault={() => setDefaultPhone(idx)}
                                isDefault={!!ph.is_default}
                                isEditing={!viewMode}
                                isOnly={phones.length === 1}
                                dragHandleProps={viewMode ? null : prov.dragHandleProps}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
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
              <DragDropContext onDragEnd={onDragEndAddresses}>
                <Droppable droppableId="contact-addresses">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                      {addresses.map((addr, idx) => (
                        <Draggable key={addr.id} draggableId={addr.id} index={idx} isDragDisabled={viewMode}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              className={snap.isDragging ? "ring-2 ring-indigo-400 shadow-lg rounded-xl z-50" : ""}
                            >
                              <ContactAddressForm
                                address={addr}
                                onChange={(a) => updateAddress(idx, a)}
                                onDelete={() => deleteAddress(idx)}
                                onSetPrimary={() => setPrimaryAddress(idx)}
                                isPrimary={!!addr.is_primary}
                                isEditing={!viewMode}
                                isOnly={addresses.length === 1}
                                dragHandleProps={viewMode ? null : prov.dragHandleProps}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
              <Button type="button" variant="outline" size="sm" className="w-full h-8 text-xs gap-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50" onClick={() => { if (viewMode) setViewMode(false); addAddress(); }}>
                <Plus className="w-3.5 h-3.5" /> Add Address
              </Button>
            </TabsContent>

            {/* ── PRODUCTS TAB ── */}
            <TabsContent value="products" className="mt-0">
              <ContactProductsTab
                contactId={editingContact?.id}
                firmIds={firmIds}
                onProductClick={onProductClick}
              />
            </TabsContent>

            {/* ── EDUCATION TAB ── */}
            <TabsContent value="education" className="mt-0">
              <ContactEducationTab
                education={education}
                onChange={setEducation}
                designations={designations}
                onDesignationsChange={setDesignations}
                viewMode={viewMode}
                biography={biography}
                onExtractFromBio={handleExtractFromBio}
                extracting={extracting === "education"}
              />
            </TabsContent>

            {/* ── EXPERIENCE TAB ── */}
            <TabsContent value="experience" className="mt-0">
              <ContactProfessionalExperienceTab
                experience={professionalExperience}
                onChange={setProfessionalExperience}
                firms={firms}
                viewMode={viewMode}
                biography={biography}
                onExtractFromBio={handleExtractFromBio}
                extracting={extracting === "experience"}
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
                <ContactTypePicker value={contactType} onChange={setContactType} viewMode={viewMode} />
              </div>

              {/* Contact Department (firm-specific, for IM / MoM / Allocator / IC firms) */}
              {(showContactFirmRoles || contactFirmRoles.length > 0) && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Contact Department</Label>
                  <ContactDepartmentPicker value={contactFirmRoles} onChange={setContactFirmRoles} viewMode={viewMode} />
                </div>
              )}

              {/* Contact Role — searchable multi-select (always available) */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Contact Role</Label>
                <ContactRolePicker
                  value={contactRoles}
                  onChange={setContactRoles}
                  viewMode={viewMode}
                />
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
                <div className="flex flex-col items-center gap-3 py-8">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Not an Equity Owner</span>
                  <p className="text-sm text-gray-400 italic">No ownership records found.</p>
                  {onNavigateToOwnership && firmIds.length > 0 && (
                    <div className="flex flex-col items-center gap-2 mt-1">
                      <p className="text-xs text-gray-400">Add ownership via a firm's Ownership tab:</p>
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {firmIds.map((fid) => (
                          <button
                            key={fid}
                            type="button"
                            onClick={() => { onOpenChange(false); onNavigateToOwnership(fid, null); }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            {getFirmName(fid)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
            {/* ── ACTIVITIES TAB ── */}
            <TabsContent value="activities" className="mt-0">
              <ContactActivitiesTab
                contactId={editingContact?.id}
                contactName={[firstName, lastName].filter(Boolean).join(" ")}
                contactFirmId={firmIds?.[0]}
                contactFirmName={firmIds?.[0] ? firms?.find?.(f => f.id === firmIds[0])?.name : undefined}
              />
            </TabsContent>
            {/* ── TIMELINE TAB ── */}
            <TabsContent value="timeline" className="mt-0">
              <ContactTimeline
                contactId={editingContact?.id}
                contactNotes={notes}
              />
            </TabsContent>
            {/* ── DUE DILIGENCE TAB ── */}
            <TabsContent value="due-diligence" className="mt-0">
              <ContactDueDiligenceTab
                contactId={editingContact?.id}
                contactName={[firstName, lastName].filter(Boolean).join(" ")}
                onContactClick={onContactClick ? (contact) => { onOpenChange(false); onContactClick(contact); } : undefined}
                onProductClick={onProductClick ? (product) => { onOpenChange(false); onProductClick(product); } : undefined}
              />
            </TabsContent>
            {/* ── NOTIFICATIONS TAB ── */}
            <TabsContent value="notifications" className="mt-0">
              <ContactNotificationsTab
                contactId={editingContact?.id}
                contactName={[firstName, lastName].filter(Boolean).join(" ")}
                onContactClick={onContactClick ? (contact) => { onOpenChange(false); onContactClick(contact); } : undefined}
                onProductClick={onProductClick ? (product) => { onOpenChange(false); onProductClick(product); } : undefined}
                onOpenChat={(chatId) => { setHighlightChatId(chatId); setActiveTab("chat"); }}
              />
            </TabsContent>

            {/* ── CHAT TAB ── */}
            <TabsContent value="chat" className="space-y-3 mt-0">
              {editingContact ? (
                <ContactChatTab
                  contactId={editingContact.id}
                  contactName={[editingContact.first_name, editingContact.last_name].filter(Boolean).join(" ")}
                  firmIds={firmIds}
                  firms={firms}
                  highlightChatId={highlightChatId}
                />
              ) : (
                <div className="text-sm text-gray-400 italic py-4 text-center">
                  Save the contact to start chatting.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>



        <DialogFooter className="pt-2 border-t gap-2">
          {viewMode ? (
            <>
              {confirmDeleteContact ? (
                <>
                  <span className="text-xs text-red-600 font-medium flex-1">Delete this contact?</span>
                  <Button variant="outline" size="sm" onClick={() => setConfirmDeleteContact(false)}>Cancel</Button>
                  <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => deleteMutation.mutate(editingContact.id)} disabled={deleteMutation.isPending}>
                    {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
                  </Button>
                </>
              ) : (
              <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setConfirmDeleteContact(true)}>
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
              )}
              {!confirmDeleteContact && (
                <>
                  <Button variant="outline" size="sm" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                    onClick={() => setPortalInviteOpen(true)}>
                    <Mail className="w-4 h-4 mr-1" /> Invite to Portal
                  </Button>
                  <div className="flex-1" />
                  <Button variant="outline" onClick={guardedClose}>Close</Button>
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setViewMode(false)}>
                    <Pencil className="w-4 h-4 mr-1" /> Edit
                  </Button>
                </>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => { setShowUndeterminedWarning(false); editingContact ? setViewMode(true) : guardedClose(); }}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!isValid} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {editingContact ? "Save Changes" : "Add Contact"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      {duplicateWarning && (
        <Dialog open={true} onOpenChange={() => setDuplicateWarning(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Potential Duplicate Contact
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-gray-600">
                The following existing contact(s) appear to be similar to the one you're about to create. Please review before proceeding.
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
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleForceCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create Anyway"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Invite to External Portal — launched from view mode */}
      {editingContact && (
        <InviteToPortalDialog
          open={portalInviteOpen}
          onOpenChange={setPortalInviteOpen}
          preselectedContact={editingContact}
          preselectedFirmId={firmIds?.[0] || null}
        />
      )}
      {guardDialog}
    </Dialog>
    </>
  );
}