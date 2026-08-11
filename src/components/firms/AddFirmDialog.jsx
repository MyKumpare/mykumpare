import React, { useState, useEffect, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Building2, Plus, Upload, X, Globe, AlertTriangle, Linkedin, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { findContactDuplicates, findContactsByNormalizedName } from "@/components/contacts/contactDuplicateCheck";
import { detectDesignations } from "@/components/contacts/designationDetector";
import FirmEnrichmentPanel from "./FirmEnrichmentPanel";
import AddressForm from "./AddressForm";
import PhoneForm from "./PhoneForm";
import ContactsTab from "../contacts/ContactsTab";
import OwnershipTab from "./OwnershipTab";
import OrgChartTab from "./OrgChartTab";
import FirmProductsTab from "./FirmProductsTab";
import FirmPortfoliosTab from "./FirmPortfoliosTab";
import FirmActivityLogTab from "./FirmActivityLogTab";
import FirmDocumentsTab from "./FirmDocumentsTab";
import FirmDueDiligenceTab from "./FirmDueDiligenceTab";
import LegalComplianceTab from "./LegalComplianceTab";
import EnrichmentApprovalDialog from "./EnrichmentApprovalDialog";
import SimilarAddressDialog from "../SimilarAddressDialog";
import { findAddressIssues, addressesAreExact } from "../addressDuplicateCheck";
import SimilarFirmFieldDialog from "./SimilarFirmFieldDialog";
import { findFirmFieldConflicts } from "./firmFieldDuplicateCheck";
import LiveFieldConflictWarning from "./LiveFieldConflictWarning";
import { isFirmNameSimilarToLinkedin } from "./firmNameSimilarity";
import LinkedinFirmMismatchDialog from "./LinkedinFirmMismatchDialog";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

function getCountryCodeFromCountryName(countryName) {
  if (!countryName) return "";
  // Import and use the actual country codes from phoneData
  const COUNTRY_CODES = [
    { code: "1", country: "United States" },
    { code: "1", country: "Canada" },
    { code: "44", country: "United Kingdom" },
    { code: "61", country: "Australia" },
    { code: "33", country: "France" },
    { code: "49", country: "Germany" },
    { code: "39", country: "Italy" },
    { code: "34", country: "Spain" },
    { code: "31", country: "Netherlands" },
    { code: "41", country: "Switzerland" },
    { code: "43", country: "Austria" },
    { code: "45", country: "Denmark" },
    { code: "46", country: "Sweden" },
    { code: "47", country: "Norway" },
    { code: "48", country: "Poland" },
    { code: "81", country: "Japan" },
    { code: "86", country: "China" },
    { code: "91", country: "India" },
    { code: "55", country: "Brazil" },
    { code: "52", country: "Mexico" },
  ];
  const match = COUNTRY_CODES.find(c => 
    c.country.toLowerCase() === countryName.toLowerCase()
  );
  return match ? match.code : "";
}

import { parsePhoneString, computeContactUpdates } from "../ai/firmEnrichment";
import { toast } from "@/components/ui/use-toast";

// Auto-geocode addresses that don't have lat/long, using the batch
// geocodeLocations backend function. Called after enrichment applies
// new addresses so they (and any pre-existing un-geocoded addresses)
// get coordinates for map search without requiring a manual "Auto-locate".
async function autoGeocodeAddresses(addressList, setAddressesFn) {
  const needsGeo = addressList.some(
    (a) => (a.latitude == null || a.longitude == null) && (a.address_line1 || a.city || a.postal_code)
  );
  if (!needsGeo) return;

  const locations = addressList.map((a, i) => ({
    key: `addr_${i}`,
    addressLine1: a.address_line1,
    city: a.city,
    state: a.state,
    postalCode: a.postal_code,
    country: a.country,
  }));

  try {
    const resp = await base44.functions.invoke("geocodeLocations", {
      centerQuery: null,
      locations,
    });
    const data = resp?.data ?? resp ?? {};
    const geocoded = data.geocoded || {};

    const updated = addressList.map((a, i) => {
      const geo = geocoded[`addr_${i}`];
      if (geo && (a.latitude == null || a.longitude == null)) {
        return { ...a, latitude: geo.lat, longitude: geo.lon };
      }
      return a;
    });
    setAddressesFn(updated);
  } catch {
    // Silently fail — addresses are still set, just without geocodes
  }
}

// Returns the set of contact IDs the user has manually positioned (pinned)
// in the Team Structure view for this firm. Manual assignments live in
// localStorage keyed by firm ID (see TeamHierarchyView.jsx). Auto-fill must
// not touch these contacts — only new contacts should be added — so the
// user's manual placement is never undone by a re-scrape.
function getManuallyAssignedContactIds(firmId) {
  if (!firmId) return new Set();
  try {
    const raw = localStorage.getItem("mk_teamHierarchyAssign_" + firmId);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return new Set(Object.keys(parsed));
  } catch { /* ignore */ }
  return new Set();
}

const FIRM_TYPES = [
  "Manager of Managers",
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

const newPhone = () => ({
  id: crypto.randomUUID(),
  phone_type: "",
  country_code: "",
  area_code: "",
  number_mid: "",
  number_last: "",
  is_default: false,
  address_id: "",
});

const newAddress = () => ({
  id: crypto.randomUUID(),
  is_headquarters: false,
  country: "",
  state: "",
  city: "",
  postal_code: "",
  address_line1: "",
  address_line2: "",
});

export default function AddFirmDialog({ open, onOpenChange, onSubmit, onDelete, editingFirm, preselectedType, existingFirms = [], defaultTab, defaultOwnershipId, onProductClick, onPortfolioClick, onFirmClick, onContactClick }) {
  const [isEditing, setIsEditing] = useState(false);
  const [firmTypes, setFirmTypes] = useState([]);
  const [firmName, setFirmName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [yearFounded, setYearFounded] = useState("");
  const [description, setDescription] = useState("");
  const [addresses, setAddresses] = useState([]);
  const [phones, setPhones] = useState([]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [expandedPhoneId, setExpandedPhoneId] = useState(null);
  const [showEnrichment, setShowEnrichment] = useState(false);
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);
  const [pendingContacts, setPendingContacts] = useState([]);
  const [contactDuplicateWarning, setContactDuplicateWarning] = useState(null);
  const [enrichmentApproval, setEnrichmentApproval] = useState(null);
  const [similarAddressPairs, setSimilarAddressPairs] = useState(null);
  const [linkedinLookupLoading, setLinkedinLookupLoading] = useState(false);
  const [linkedinMismatch, setLinkedinMismatch] = useState(null);
  const [similarFirmWarning, setSimilarFirmWarning] = useState(null);
  const [firmFieldConflicts, setFirmFieldConflicts] = useState(null);
  const nameInputRef = useRef(null);

  const { data: allContacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });
  const logoInputRef = useRef(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isAddMode = !editingFirm;
  const activelyEditing = isAddMode || isEditing;

  useEffect(() => {
    if (open) {
      setExpandedPhoneId(null);
      if (editingFirm) {
        // Support both legacy firm_type (string) and new firm_types (array)
        const types = editingFirm.firm_types?.length
          ? editingFirm.firm_types
          : editingFirm.firm_type ? [editingFirm.firm_type] : [];
        setFirmTypes(types);
        setFirmName(editingFirm.name || "");
        setLogoUrl(editingFirm.logo_url || "");
        setWebsite(editingFirm.website || "");
        setEmail(editingFirm.email || "");
        setLinkedinUrl(editingFirm.linkedin_url || "");
        setYearFounded(editingFirm.year_founded ? String(editingFirm.year_founded) : "");
        setDescription(editingFirm.description || "");
        setAddresses(editingFirm.addresses?.length
          ? [...editingFirm.addresses].sort((a, b) => (b.is_headquarters ? 1 : 0) - (a.is_headquarters ? 1 : 0))
          : []);
        setPhones(editingFirm.phones?.length
          ? [...editingFirm.phones].sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0))
          : []);
        setPendingContacts([]);
        setIsEditing(false);
      } else {
        setFirmTypes(preselectedType ? [preselectedType] : []);
        setFirmName("");
        setLogoUrl("");
        setWebsite("");
        setEmail("");
        setLinkedinUrl("");
        setYearFounded("");
        setDescription("");
        setAddresses([]);
        setPhones([]);
        setShowEnrichment(false);
        setEnrichmentLoading(false);
        setPendingContacts([]);
        setIsEditing(true);
      }
    }
  }, [editingFirm, preselectedType, open]);

  useEffect(() => {
    if (open && preselectedType && !editingFirm) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [open, preselectedType, editingFirm]);

  useEffect(() => {
    if (isEditing && editingFirm) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [isEditing]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setLogoUrl(file_url);
    setUploadingLogo(false);
  };

  const handleLinkedInLookup = async () => {
    if (!firmName.trim()) {
      toast({ title: "Firm name required", description: "Enter the firm name first.", variant: "destructive" });
      return;
    }
    setLinkedinLookupLoading(true);
    try {
      const res = await base44.functions.invoke("linkedinFirmLookup", {
        firm_id: editingFirm?.id || "",
        website: website || "",
        name: firmName.trim(),
      });
      if (res.data?.linkedin_url) {
        const liName = res.data.linkedin_company_name || "";
        const liSlug = res.data.linkedin_slug || "";
        const { similar } = isFirmNameSimilarToLinkedin(firmName.trim(), liName, liSlug);
        if (similar) {
          setLinkedinUrl(res.data.linkedin_url);
          toast({ title: "✅ LinkedIn page found", description: res.data.linkedin_url });
        } else {
          setLinkedinMismatch({
            firmName: firmName.trim(),
            linkedinCompanyName: liName || liSlug,
            linkedinUrl: res.data.linkedin_url,
          });
        }
      } else {
        toast({ title: "No page found", description: res.data?.message || "Could not find the firm's LinkedIn page." });
      }
    } catch (err) {
      toast({ title: "LinkedIn lookup failed", description: err.response?.data?.error || err.message || "Could not find the firm's LinkedIn page.", variant: "destructive" });
    }
    setLinkedinLookupLoading(false);
  };

  const handleAddAddress = () => {
    const addr = newAddress();
    if (addresses.length === 0) addr.is_headquarters = true;
    setAddresses([...addresses, addr]);
  };

  const handleAddressChange = (index, updated) => {
    setAddresses(addresses.map((a, i) => i === index ? updated : a));
  };

  const handleDeleteAddress = (index) => {
    const remaining = addresses.filter((_, i) => i !== index);
    if (addresses[index].is_headquarters && remaining.length > 0) {
      remaining[0].is_headquarters = true;
    }
    setAddresses(remaining);
  };

  const handleSetHeadquarters = (index) => {
    setAddresses(addresses.map((a, i) => ({ ...a, is_headquarters: i === index })));
  };

  const handleAddPhone = () => {
    const ph = newPhone();
    if (phones.length === 0) ph.is_default = true;
    // Pre-select first address if available
    if (addresses.length > 0 && !ph.address_id) {
      ph.address_id = addresses[0].id;
      const addr = addresses[0];
      ph.country_code = getCountryCodeFromCountryName(addr.country);
    }
    setPhones([...phones, ph]);
  };

  const handlePhoneChange = (index, updated) => {
    setPhones(phones.map((p, i) => i === index ? updated : p));
  };

  const handleDeletePhone = (index) => {
    const remaining = phones.filter((_, i) => i !== index);
    if (phones[index].is_default && remaining.length > 0) {
      remaining[0].is_default = true;
    }
    setPhones(remaining);
  };

  const handleSetDefaultPhone = (index) => {
    setPhones(phones.map((p, i) => ({ ...p, is_default: i === index })));
  };

  const onDragEndAddresses = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const reordered = [...addresses];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    if (!activelyEditing) setIsEditing(true);
    setAddresses(reordered);
  };

  const onDragEndPhones = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const reordered = [...phones];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setPhones(reordered);
  };

  const existingTypes = editingFirm?.firm_types?.length
    ? editingFirm.firm_types
    : editingFirm?.firm_type ? [editingFirm.firm_type] : [];

  const hasChanges = editingFirm
    ? firmName.trim() !== editingFirm.name ||
      JSON.stringify([...firmTypes].sort()) !== JSON.stringify([...existingTypes].sort()) ||
      logoUrl !== (editingFirm.logo_url || "") ||
      website !== (editingFirm.website || "") ||
      email !== (editingFirm.email || "") ||
      linkedinUrl !== (editingFirm.linkedin_url || "") ||
      yearFounded !== (editingFirm.year_founded ? String(editingFirm.year_founded) : "") ||
      description !== (editingFirm.description || "") ||
      JSON.stringify(addresses) !== JSON.stringify(editingFirm.addresses || []) ||
      JSON.stringify(phones) !== JSON.stringify(editingFirm.phones || [])
    : false;

  // In add mode, any entered data counts as unsaved changes.
  const hasUnsavedChanges = editingFirm
    ? hasChanges
    : !!(firmName.trim() || firmTypes.length > 0 || logoUrl || website || email ||
        linkedinUrl || yearFounded || description ||
        addresses.some(a => a.address_line1 || a.city || a.state || a.postal_code) ||
        phones.some(p => p.area_code || p.number_mid || p.number_last) ||
        pendingContacts.length > 0);

  const phonesValid = phones.length === 0 || phones.every(p => {
    // Only validate phones that have some number content — empty/partial
    // phone slots shouldn't block saving. Core number parts are required
    // only when the phone has any content at all.
    const hasNumberContent = p.area_code || p.number_mid || p.number_last;
    if (!hasNumberContent) return true;
    return p.area_code && p.number_mid && p.number_last;
  });

  const isValid = firmTypes.length > 0 && firmName.trim() && phonesValid;

  // Live similar-firm detection: surface existing firms whose name overlaps
  // with what the user is typing, so they can see a potential duplicate before
  // they ever click Save. Reuses the same substring-inclusion check the
  // submit-time warning uses, so the two never disagree. Only in add mode.
  const liveSimilarFirms = useMemo(() => {
    if (!isAddMode || !activelyEditing) return [];
    const input = firmName.trim().toLowerCase();
    if (input.length < 3) return [];
    return existingFirms
      .filter((f) => {
        if (f.deleted_at) return false;
        if (editingFirm && f.id === editingFirm.id) return false;
        const existing = (f.name || "").toLowerCase();
        return existing.includes(input) || input.includes(existing);
      })
      .slice(0, 5);
  }, [isAddMode, activelyEditing, firmName, existingFirms, editingFirm]);

  // Live website/email/LinkedIn duplicate detection: surface existing firms
  // whose website, email, or LinkedIn matches (exactly or closely) what the
  // user is typing — mirroring the live similar-firm-name warning above, so a
  // conflict is visible before they ever click Save. Runs in both add and
  // edit modes (the current firm is excluded so it never conflicts with itself).
  const liveFieldConflicts = useMemo(() => {
    if (!activelyEditing) return [];
    return findFirmFieldConflicts(
      { website, email, linkedin_url: linkedinUrl },
      existingFirms,
      editingFirm?.id
    );
  }, [activelyEditing, website, email, linkedinUrl, existingFirms, editingFirm]);

  const liveConflictsByField = useMemo(() => {
    const byField = { website: [], email: [], linkedin_url: [] };
    for (const c of liveFieldConflicts) {
      if (byField[c.field]) byField[c.field].push(c);
    }
    return byField;
  }, [liveFieldConflicts]);

  const NON_PRODUCT_TYPES = ["Trade Organizations"];
  const hideProductTabs = firmTypes.length > 0 && firmTypes.every(t => NON_PRODUCT_TYPES.includes(t));
  const showPortfolioTab = firmTypes.includes("Allocator");
  const showAdvisorPortfolioTab = firmTypes.includes("Manager of Managers") || firmTypes.includes("Investment Manager");

  const handleSubmit = (forceFirmName = false, forceFieldConflicts = false) => {
    if (!isValid) return;
    // In add mode, warn on similar existing firm names before saving so the
    // user can confirm they're not creating a duplicate. Matches the same
    // substring-inclusion check used by the quick-add firm form.
    if (!forceFirmName && isAddMode && firmName.trim().length >= 2) {
      const input = firmName.trim().toLowerCase();
      const matches = existingFirms.filter((f) => {
        if (f.deleted_at) return false;
        if (editingFirm && f.id === editingFirm.id) return false;
        const existing = (f.name || "").toLowerCase();
        return existing.includes(input) || input.includes(existing);
      });
      if (matches.length > 0) {
        setSimilarFirmWarning(matches);
        return;
      }
    }
    // Block exact duplicate addresses; prompt for similar ones.
    const { exactPairs, similarPairs } = findAddressIssues(addresses);
    if (exactPairs.length > 0) {
      const [i, j] = exactPairs[0];
      toast({ title: "Duplicate address", description: `Address #${i + 1} and #${j + 1} are identical. Please remove or edit the duplicate before saving.`, variant: "destructive" });
      return;
    }
    if (similarPairs.length > 0) {
      setSimilarAddressPairs({ pairs: similarPairs.map(([i, j]) => ({ i, j, ai: addresses[i], aj: addresses[j] })) });
      return;
    }
    // Warn when the website, email, or LinkedIn URL matches (exactly or
    // closely) another firm already in the system — in both add and edit
    // modes (the current firm is excluded so it never conflicts with itself).
    if (!forceFieldConflicts) {
      const conflicts = findFirmFieldConflicts(
        { website, email, linkedin_url: linkedinUrl },
        existingFirms,
        editingFirm?.id
      );
      if (conflicts.length > 0) {
        setFirmFieldConflicts(conflicts);
        return;
      }
    }
    performSubmit(addresses);
  };

  const performSubmit = (addrs) => {
    onSubmit({ firm_type: firmTypes[0] || "", firm_types: firmTypes, name: firmName.trim(), logo_url: logoUrl, website, email, linkedin_url: linkedinUrl, year_founded: yearFounded ? parseInt(yearFounded) : null, description, addresses: addrs, phones, pending_contacts: pendingContacts.length > 0 ? pendingContacts : undefined });
    // NOTE: do NOT clear form state here. onSubmit triggers an async save; if it
    // fails (e.g. backend validation), clearing now would wipe the user's
    // in-progress data — including enrichment they just reviewed — leaving the
    // dialog open with empty fields. The form is re-initialized from the
    // editingFirm/open effect when the dialog reopens, so an eager clear is both
    // unnecessary and unsafe.
  };

  const handleResolveSimilarAddresses = (removeIndices) => {
    let cleaned = addresses.filter((_, i) => !removeIndices.includes(i));
    // Reassign headquarters if the HQ address was removed
    if (cleaned.length > 0 && !cleaned.some((a) => a.is_headquarters)) {
      cleaned = cleaned.map((a, i) => i === 0 ? { ...a, is_headquarters: true } : a);
    }
    setAddresses(cleaned);
    setSimilarAddressPairs(null);
    performSubmit(cleaned);
  };

  const handleApplyEnrichment = async (selected) => {
    const applied = [];
    // Enriched firm fields are applied to local form state only and committed
    // to the DB when the user clicks Save Changes (via the update mutation).
    // We do NOT write them to the DB here on apply — that would run the Firm
    // update against the current user's permissions (creator-or-admin), which
    // is rejected for firms the user didn't create, surfacing a "Permission
    // denied" toast mid-enrichment. Contacts are still saved on apply below.

    if (selected.logo_url && selected.logo_url !== logoUrl) { setLogoUrl(selected.logo_url); applied.push("Logo"); }
    if (selected.description && !description) { setDescription(selected.description); applied.push("Description"); }
    if (selected.website && !website) { setWebsite(selected.website); applied.push("Website"); }
    if (selected.email && !email) { setEmail(selected.email); applied.push("Email"); }
    if (selected.linkedin_url && !linkedinUrl) { setLinkedinUrl(selected.linkedin_url); applied.push("LinkedIn"); }
    if (selected.year_founded && !yearFounded) { setYearFounded(String(selected.year_founded)); applied.push("Year Founded"); }
    if (selected.firm_types?.length) {
      const merged = [...new Set([...firmTypes, ...selected.firm_types])];
      const added = merged.length - firmTypes.length;
      if (added > 0) { setFirmTypes(merged); applied.push("Firm Types"); }
    }
    let finalAddrs = addresses;
    if (selected.addresses?.length) {
      const newAddrs = selected.addresses.filter((a) => {
        // Robust duplicate check (normalized street/city/state/zip/country),
        // so case or abbreviation differences don't slip a duplicate in.
        const hasContent = !!(a.address_line1 || a.city || a.postal_code);
        if (!hasContent) return false;
        return !addresses.some((ex) => addressesAreExact(a, ex));
      });
      if (newAddrs.length > 0) {
        finalAddrs = [...addresses];
        if (finalAddrs.length === 0) newAddrs[0].is_headquarters = true;
        finalAddrs.push(...newAddrs);
        setAddresses(finalAddrs);
        applied.push(`${newAddrs.length} Address(es)`);
      }
    }

    // Auto-geocode any addresses (existing or newly added) that don't
    // have lat/long — fires the same batch geocoder as the "Auto-locate"
    // button so map search can use stored coordinates directly.
    autoGeocodeAddresses(finalAddrs, setAddresses);
    if (selected.phones?.length) {
      const existingNums = new Set(phones.map((p) => `${p.area_code}${p.number_mid}${p.number_last}`));
      const newPhs = selected.phones.filter((p) => !existingNums.has(`${p.area_code}${p.number_mid}${p.number_last}`));
      if (newPhs.length > 0) {
        const mergedPhones = [...phones];
        if (mergedPhones.length === 0) newPhs[0].is_default = true;
        if (addresses.length > 0) {
          newPhs.forEach((p) => {
            if (!p.address_id) p.address_id = addresses[0].id;
            if (!p.country_code) p.country_code = getCountryCodeFromCountryName(addresses[0].country);
          });
        }
        mergedPhones.push(...newPhs);
        setPhones(mergedPhones);
        applied.push(`${newPhs.length} Phone(s)`);
      }
    }
    if (selected.people?.length) {
      if (editingFirm) {
        const contactUpdates = [];
        const newContacts = [];
        // Contacts the user has manually positioned in the Team Structure view.
        // These are left untouched by auto-fill so their placement isn't undone;
        // only genuinely new contacts are added.
        const manuallyAssignedIds = getManuallyAssignedContactIds(editingFirm.id);
        for (const person of selected.people) {
          const fullName = `${person.first_name || ""} ${person.last_name || ""}`.trim();
          const designations = detectDesignations(fullName, person.biography);
          const contactData = {
            first_name: person.first_name || "",
            last_name: person.last_name || "",
            title: person.title || "",
            email: person.email || "",
            linkedin_url: person.linkedin_url || "",
            biography: person.biography || "",
            photo_url: person.photo_url || "",
            bio_url: person.bio_url || "",
            firm_ids: [editingFirm.id],
            employee_status: "Employee",
          };
          if (designations.length > 0) contactData.designations = designations;
          const parsedPhone = person.phone ? parsePhoneString(person.phone) : null;
          if (parsedPhone) contactData.phones = [parsedPhone];
          if (person.education?.length) contactData.education = person.education.map((e) => ({ ...e, id: crypto.randomUUID() }));
          if (person.professional_experience?.length) contactData.professional_experience = person.professional_experience.map((e) => ({ ...e, id: crypto.randomUUID() }));

          // Only match against contacts already linked to THIS firm — a
          // same-named person at a different firm must not receive this
          // firm's biography (or any field update) from the enrichment.
          const firmContacts = allContacts.filter((c) => (c.firm_ids || []).includes(editingFirm.id) && !c.deleted_at);
          const dups = findContactDuplicates(contactData, firmContacts);
          if (dups.length > 0) {
            const bestMatch = dups[0].contact;
            // Skip contacts the user has manually positioned in the team
            // hierarchy — auto-fill must not undo their placement. Only new
            // contacts are added; manually-positioned existing contacts are
            // left untouched.
            if (manuallyAssignedIds.has(bestMatch.id)) continue;
            const { updates, updatedFields, conflicts } = computeContactUpdates(bestMatch, person, editingFirm.id);
            // computeContactUpdates returns field conflicts as an array; extract
            // the biography conflict so the approval dialog + apply handler can
            // surface it for explicit user opt-in (existing bios are never
            // silently overwritten).
            const biographyChange = conflicts.find((c) => c.field === "biography") || null;
            if (Object.keys(updates).length > 0 || biographyChange) {
              contactUpdates.push({ id: bestMatch.id, updates, updatedFields, contactName: fullName, biographyChange });
            }
          } else {
            // Fallback: catch same-named contacts that findContactDuplicates
            // might miss (e.g. when suffixes/designations are embedded in the
            // last_name field). Flag as potential duplicates so the approval
            // dialog can warn the user before creating a duplicate record.
            const normDups = findContactsByNormalizedName(contactData, firmContacts);
            newContacts.push({ ...contactData, potentialDuplicates: normDups });
          }
        }

        if (contactUpdates.length > 0 || newContacts.length > 0) {
          setShowEnrichment(false);
          setEnrichmentApproval({ contactUpdates, newContacts, firmFieldsApplied: applied });
          return;
        }
      } else {
        const newPending = [];
        const skipped = [];
        for (const person of selected.people) {
          const parsedPhone = person.phone ? parsePhoneString(person.phone) : null;
          const contactData = {
            first_name: person.first_name || "",
            last_name: person.last_name || "",
            email: person.email || "",
            phones: parsedPhone ? [parsedPhone] : [],
          };
          const dups = findContactDuplicates(contactData, allContacts);
          const normDups = findContactsByNormalizedName(contactData, allContacts);
          const pendingDups = findContactDuplicates(contactData, pendingContacts);
          if (dups.length > 0) {
            skipped.push({ person, duplicates: dups });
          } else if (normDups.length > 0) {
            // Normalized name match — treat as potential duplicate and skip.
            skipped.push({ person, duplicates: normDups.map(d => ({ contact: d.contact, name: d.name, email: d.email, reasons: ["Same first and last name (after normalization)"], score: 0.75 })) });
          } else if (pendingDups.length > 0) {
            // Already in pending list — skip to avoid duplicates
          } else {
            const fullName = `${person.first_name || ""} ${person.last_name || ""}`.trim();
            const designations = detectDesignations(fullName, person.biography);
            newPending.push({
              first_name: person.first_name || "",
              last_name: person.last_name || "",
              title: person.title || "",
              email: person.email || "",
              linkedin_url: person.linkedin_url || "",
              biography: person.biography || "",
              photo_url: person.photo_url || "",
              bio_url: person.bio_url || "",
              phone: person.phone || "",
              designations: designations.length > 0 ? designations : undefined,
              education: (person.education || []).map((e) => ({ ...e, id: crypto.randomUUID() })),
              professional_experience: (person.professional_experience || []).map((e) => ({ ...e, id: crypto.randomUUID() })),
            });
          }
        }
        if (newPending.length > 0) {
          setPendingContacts(prev => [...prev, ...newPending]);
          applied.push(`${newPending.length} Contact(s)`);
        }
        if (skipped.length > 0) {
          setContactDuplicateWarning({ duplicates: skipped.map(s => ({
            contactData: {
              first_name: s.person.first_name || "",
              last_name: s.person.last_name || "",
              email: s.person.email || "",
            },
            duplicates: s.duplicates,
          })), isPending: true, people: skipped.map(s => s.person) });
        }
      }
    }

    setShowEnrichment(false);
    if (applied.length > 0) {
      toast({ title: "✅ New information added", description: applied.join(", ") + " populated from web." });
    } else {
      toast({ title: "No new information", description: "All fields are already populated." });
    }
  };

  const handleConfirmEnrichmentContacts = async (confirmData) => {
    if (!enrichmentApproval) return;
    const { contactUpdates, newContacts, firmFieldsApplied } = enrichmentApproval;
    const applied = [...firmFieldsApplied];
    // The approval dialog now passes an object with both the approved bio
    // set and the list of skipped new-contact indices.
    const bioSet = confirmData?.approvedBios instanceof Set
      ? confirmData.approvedBios
      : new Set(confirmData?.approvedBios || (confirmData instanceof Set ? confirmData : []));

    let updated = 0;
    const updatedNames = [];
    const bioUpdatedNames = [];
    const contactErrors = [];
    for (const cu of contactUpdates) {
      const finalUpdates = { ...cu.updates };
      const approvingBio = cu.biographyChange && bioSet.has(cu.id);
      if (approvingBio) finalUpdates.biography = cu.biographyChange.incoming;
      if (Object.keys(finalUpdates).length === 0) continue;
      // Try the full update first; if it fails (e.g. an overly-long biography or
      // an invalid field), fall back to applying each field individually so a
      // single problematic field doesn't silently block the biography (or other
      // fields) from being saved. Surface per-field errors so the user can see
      // why a field didn't update.
      try {
        await base44.entities.Contact.update(cu.id, finalUpdates);
        updated++;
        updatedNames.push(cu.contactName);
        if (approvingBio) bioUpdatedNames.push(cu.contactName);
      } catch (bulkErr) {
        let anyFieldSaved = false;
        for (const [field, value] of Object.entries(finalUpdates)) {
          try {
            await base44.entities.Contact.update(cu.id, { [field]: value });
            anyFieldSaved = true;
            if (field === "biography" && approvingBio) bioUpdatedNames.push(cu.contactName);
          } catch (fieldErr) {
            contactErrors.push(`${cu.contactName} → ${field}: ${fieldErr.message || fieldErr}`);
          }
        }
        if (anyFieldSaved) {
          updated++;
          updatedNames.push(cu.contactName);
        }
      }
    }
    let created = 0;
    const createErrors = [];
    const createdContacts = [];
    // Only create new contacts the user confirmed — contacts flagged as
    // potential duplicates can be unchecked in the approval dialog.
    const skippedNewContactIndices = confirmData?.skippedNewContacts || [];
    for (let i = 0; i < newContacts.length; i++) {
      if (skippedNewContactIndices.includes(i)) continue;
      const { potentialDuplicates, ...contactData } = newContacts[i];
      try {
        const createdContact = await base44.entities.Contact.create({ ...contactData, tenant_id: user?.linked_firm_id });
        createdContacts.push(createdContact);
        created++;
      }
      catch (createErr) { createErrors.push(`${createErr.message || createErr}`); }
    }

    // Auto-populate LinkedIn for newly created contacts the web scrape didn't
    // resolve a profile for — this mirrors the "Find" button in the contact
    // editor so the user doesn't have to trigger it manually for each contact
    // created by the auto-fill flow.
    const needsLinkedIn = createdContacts.filter((c) => !c.linkedin_url && c.first_name && c.last_name);
    if (needsLinkedIn.length > 0) {
      const firmId = editingFirm?.id || "";
      const firmWebsite = editingFirm?.website || "";
      const firmName = editingFirm?.name || "";
      let linkedinFound = 0;
      await Promise.all(needsLinkedIn.map(async (c) => {
        try {
          const res = await base44.functions.invoke("linkedinContactLookup", {
            first_name: c.first_name,
            last_name: c.last_name,
            firm_id: firmId,
            website: firmWebsite,
            current_title: c.title || "",
            firm_name: firmName,
          });
          const url = res?.data?.linkedin_url;
          if (url) {
            await base44.entities.Contact.update(c.id, { linkedin_url: url });
            linkedinFound++;
          }
        } catch { /* non-fatal — leave LinkedIn blank */ }
      }));
      if (linkedinFound > 0) {
        applied.push(`${linkedinFound} LinkedIn Profile(s) auto-populated`);
      }
    }

    if (created > 0 || updated > 0) {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    }
    if (created > 0) applied.push(`${created} New Contact(s)`);
    if (skippedNewContactIndices.length > 0) {
      applied.push(`${skippedNewContactIndices.length} Duplicate(s) Skipped`);
    }
    if (updated > 0) {
      applied.push(`Updated ${updated} Contact(s) (${updatedNames.join(", ")})`);
    }
    if (bioUpdatedNames.length > 0) {
      applied.push(`${bioUpdatedNames.length} Biography Update(s) (${bioUpdatedNames.join(", ")})`);
    }

    setEnrichmentApproval(null);
    if (applied.length > 0) {
      toast({ title: "✅ New information added", description: applied.join(", ") + " populated from web." });
    }
    if (contactErrors.length > 0 || createErrors.length > 0) {
      const allErrors = [...contactErrors, ...createErrors];
      toast({
        title: "⚠️ Some fields could not be updated",
        description: allErrors.slice(0, 3).join("\n") + (allErrors.length > 3 ? `\n...and ${allErrors.length - 3} more` : ""),
        variant: "destructive",
      });
    }
    // If there are no firm-level changes to save, exit edit mode so the
    // "Save Changes"/"Cancel" buttons disappear and the "Edit" icon
    // reappears. This prevents the confusing state where the user sees a
    // disabled "Save Changes" button after approving enrichment contacts.
    if (!hasChanges) {
      setIsEditing(false);
    }
  };

  const handleClose = () => {
    // Refresh the firms list when the dialog closes so any enrichment fields
    // persisted during apply (handleApplyEnrichment) are reflected in the list
    // and on a subsequent reopen — without re-rendering the dialog mid-edit.
    queryClient.invalidateQueries({ queryKey: ["firms"] });
    onOpenChange(false);
    setIsEditing(false);
    setShowEnrichment(false);
    setEnrichmentLoading(false);
    setEnrichmentApproval(null);
    setFirmFieldConflicts(null);
  };

  const { guardedClose, guardDialog } = useUnsavedChangesGuard(hasUnsavedChanges, handleClose, handleSubmit);

  const handleCancelEdit = () => {
    setFirmTypes(editingFirm.firm_types?.length ? editingFirm.firm_types : editingFirm.firm_type ? [editingFirm.firm_type] : []);
    setFirmName(editingFirm.name);
    setLogoUrl(editingFirm.logo_url || "");
    setWebsite(editingFirm.website || "");
    setEmail(editingFirm.email || "");
    setLinkedinUrl(editingFirm.linkedin_url || "");
    setYearFounded(editingFirm.year_founded ? String(editingFirm.year_founded) : "");
    setDescription(editingFirm.description || "");
    setAddresses([...(editingFirm.addresses || [])].sort((a, b) => (b.is_headquarters ? 1 : 0) - (a.is_headquarters ? 1 : 0)));
    setPhones([...(editingFirm.phones || [])].sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0)));
    setIsEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) guardedClose(); }}>
      <DialogContent
        className="sm:max-w-3xl max-h-[90vh] flex flex-col"
        onInteractOutside={(e) => { if (enrichmentLoading) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (enrichmentLoading) e.preventDefault(); }}
      >
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            {!isAddMode && !isEditing ? (
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {logoUrl ? (
                    <img src={logoUrl} alt="logo" className="w-full h-full object-contain p-0.5" />
                  ) : (
                    <Building2 className="w-5 h-5 text-gray-300" />
                  )}
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-base font-semibold leading-tight">Firm Details</DialogTitle>
                  {firmName && <p className="text-sm text-indigo-600 font-medium mt-0.5 truncate">{firmName}</p>}
                </div>
              </div>
            ) : (
              <DialogTitle className="text-xl font-semibold">
                {isAddMode ? "Add Firm" : "Edit Firm"}
              </DialogTitle>
            )}
            {!isAddMode && !isEditing && (
              <Button
                variant="ghost"
                size="sm"
                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1.5"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 pr-1 space-y-5 py-2">

          {/* Enrichment Panel */}
          {activelyEditing && showEnrichment && firmName.trim() && (
            <FirmEnrichmentPanel
              firmName={firmName.trim()}
              website={website}
              onApply={handleApplyEnrichment}
              onClose={() => setShowEnrichment(false)}
              onLoadingChange={setEnrichmentLoading}
              existingFirm={editingFirm || {
                name: firmName, logo_url: logoUrl, description, website, email,
                linkedin_url: linkedinUrl, year_founded: yearFounded ? parseInt(yearFounded) : null,
                firm_types: firmTypes, addresses, phones,
              }}
              existingContacts={editingFirm ? allContacts.filter((c) => (c.firm_ids || []).includes(editingFirm.id)) : allContacts}
            />
          )}

          {/* Logo + Firm Name row */}
          <div className="flex items-end gap-4">
            {/* Logo - only show in edit mode */}
            {activelyEditing && (
              <div className="flex-shrink-0 space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Logo</Label>
                <div
                  className={`w-16 h-16 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 border-gray-300`}
                  onClick={() => logoInputRef.current?.click()}
                >
                  {uploadingLogo ? (
                    <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  ) : logoUrl ? (
                    <img src={logoUrl} alt="logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <Upload className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoUrl("")}
                    className="text-xs text-red-400 hover:text-red-600 flex items-center gap-0.5"
                  >
                    <X className="w-3 h-3" /> Remove
                  </button>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </div>
            )}

            {/* Firm name + type */}
            <div className={activelyEditing ? "flex-1 space-y-3" : "w-full space-y-3"}>
              {/* Firm Type */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Type of Firm</Label>
                {!activelyEditing ? (
                  <div className="px-3 py-2 flex flex-wrap gap-1 rounded-md border bg-gray-50 min-h-9">
                    {firmTypes.length > 0
                      ? firmTypes.map((t) => (
                          <span key={t} className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700">{t}</span>
                        ))
                      : <span className="text-sm text-gray-400">—</span>
                    }
                  </div>
                ) : (
                  <div className="rounded-md border bg-white p-2 space-y-1.5">
                    {FIRM_TYPES.map((type) => (
                      <label key={type} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                        <Checkbox
                          checked={firmTypes.includes(type)}
                          onCheckedChange={(checked) => {
                            setFirmTypes(checked
                              ? [...firmTypes, type]
                              : firmTypes.filter((t) => t !== type)
                            );
                          }}
                          disabled={preselectedType === type && !editingFirm}
                        />
                        <span className="text-sm text-gray-700">{type}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Firm Name */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">Firm Name</Label>
                  {activelyEditing && firmName.trim() && !showEnrichment && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
                      onClick={() => setShowEnrichment(true)}
                    >
                      <Globe className="w-3.5 h-3.5" /> Auto-fill from Web
                    </Button>
                  )}
                </div>
                {!activelyEditing ? (
                  <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-900 font-medium">
                    {firmName}
                  </div>
                ) : (
                  <>
                    <Input
                      ref={nameInputRef}
                      placeholder="Enter firm name..."
                      value={firmName}
                      onChange={(e) => setFirmName(e.target.value)}
                      className="h-9"
                      onKeyDown={(e) => e.key === "Enter" && isValid && handleSubmit()}
                      spellCheck autoCorrect="on" autoCapitalize="words" lang="en"
                    />
                    {liveSimilarFirms.length > 0 && (
                      <div className="mt-1.5 rounded-md border border-amber-200 bg-amber-50 p-2 space-y-1">
                        <p className="text-xs font-medium text-amber-700 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {liveSimilarFirms.length} similar firm{liveSimilarFirms.length > 1 ? "s" : ""} already in the system
                        </p>
                        <ul className="space-y-0.5">
                          {liveSimilarFirms.map((f) => {
                            const types = f.firm_types?.length ? f.firm_types : (f.firm_type ? [f.firm_type] : []);
                            return (
                              <li key={f.id} className="text-xs text-gray-700 flex items-start gap-1 flex-wrap">
                                <span className="font-medium">{f.name}</span>
                                {types.length > 0 && <span className="text-gray-500">— {types.join(", ")}</span>}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Website */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Website</Label>
                {!activelyEditing ? (
                  <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-600">
                    {website ? <a href={website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">{website}</a> : <span className="text-gray-400">—</span>}
                  </div>
                ) : (
                  <>
                    <Input
                      placeholder="https://example.com"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      className="h-9"
                    />
                    <LiveFieldConflictWarning conflicts={liveConflictsByField.website} />
                  </>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Email</Label>
                {!activelyEditing ? (
                  <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-600">
                    {email ? <a href={`mailto:${email}`} className="text-indigo-600 hover:underline">{email}</a> : <span className="text-gray-400">—</span>}
                  </div>
                ) : (
                  <>
                    <Input
                      placeholder="info@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-9"
                    />
                    <LiveFieldConflictWarning conflicts={liveConflictsByField.email} />
                  </>
                )}
              </div>

              {/* LinkedIn URL */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">LinkedIn</Label>
                {!activelyEditing ? (
                  <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-600">
                    {linkedinUrl ? <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">View LinkedIn</a> : <span className="text-gray-400">—</span>}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex gap-1.5">
                      <Input
                        placeholder="https://linkedin.com/company/..."
                        value={linkedinUrl}
                        onChange={(e) => setLinkedinUrl(e.target.value)}
                        className="h-9 flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 px-2 text-[#0A66C2] border-[#0A66C2]/30 hover:bg-[#0A66C2]/10 gap-1"
                        onClick={handleLinkedInLookup}
                        disabled={linkedinLookupLoading || !firmName.trim()}
                        title="Find LinkedIn page"
                      >
                        {linkedinLookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Linkedin className="w-4 h-4" />}
                        <span className="text-xs">Find</span>
                      </Button>
                    </div>
                    <LiveFieldConflictWarning conflicts={liveConflictsByField.linkedin_url} />
                  </div>
                )}
              </div>

              {/* Year Founded */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Year Founded</Label>
                {!activelyEditing ? (
                  <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-700">
                    {yearFounded || <span className="text-gray-400">—</span>}
                  </div>
                ) : (
                  <Select value={yearFounded} onValueChange={setYearFounded}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select year..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {Array.from({ length: new Date().getFullYear() - 1799 }, (_, i) => String(new Date().getFullYear() - i)).map((yr) => (
                        <SelectItem key={yr} value={yr}>{yr}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Description</Label>
                {!activelyEditing ? (
                  <div className="px-3 py-2 rounded-md border bg-gray-50 text-sm text-gray-700 min-h-20 whitespace-pre-wrap">
                    {description || <span className="text-gray-400">—</span>}
                  </div>
                ) : (
                  <Textarea
                    placeholder="Enter firm description..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-20"
                  />
                )}
              </div>
              </div>
              </div>

          {/* Contacts, Addresses, Phones & Ownership Tabs */}
           <Tabs defaultValue={defaultTab || "contacts"} className="w-full">
             {/* Single 3-column tab grid — wraps to max 3 per row */}
             <TabsList className="grid w-full mt-0 grid-cols-3 h-auto">
               <TabsTrigger value="contacts">Contacts</TabsTrigger>
               <TabsTrigger value="addresses">Addresses</TabsTrigger>
               <TabsTrigger value="phones">Phones</TabsTrigger>
                 <TabsTrigger value="legal-compliance">Legal & Compliance</TabsTrigger>
                 {!hideProductTabs && (
                 <>
                   {showPortfolioTab && <TabsTrigger value="portfolios">Portfolios</TabsTrigger>}
                   {showAdvisorPortfolioTab && <TabsTrigger value="advisor-portfolios">Portfolios</TabsTrigger>}
                   <TabsTrigger value="products">Products</TabsTrigger>
                   <TabsTrigger value="due-diligence">Due Diligence</TabsTrigger>
                   <TabsTrigger value="documents">Documents</TabsTrigger>
                   <TabsTrigger value="activity-log">Activity Log</TabsTrigger>
                   <TabsTrigger value="ownership">Ownership</TabsTrigger>
                   <TabsTrigger value="orgchart">Org Chart</TabsTrigger>
                 </>
               )}
               {hideProductTabs && (
                 <>
                   <TabsTrigger value="orgchart">Org Chart</TabsTrigger>
                   <TabsTrigger value="activity-log">Activity Log</TabsTrigger>
                 </>
               )}
             </TabsList>

            <TabsContent value="contacts" className="space-y-3">
              {editingFirm ? (
                <ContactsTab firmId={editingFirm.id} firms={existingFirms} onNavigateToOwnership={undefined} onProductClick={onProductClick ? (product) => { handleClose(); onProductClick(product); } : undefined} onFirmClick={undefined} />
              ) : (
                <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
                  Save the firm first to add contacts
                </div>
              )}
            </TabsContent>

            <TabsContent value="addresses" className="space-y-3">
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs ml-auto"
                  onClick={() => { if (!activelyEditing) setIsEditing(true); handleAddAddress(); }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Address
                </Button>
              </div>

              {addresses.length === 0 && (
                <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
                  {activelyEditing ? 'Click "Add Address" to add a location' : "No addresses added"}
                </div>
              )}

              <DragDropContext onDragEnd={onDragEndAddresses}>
                <Droppable droppableId="firm-addresses">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                      {addresses.map((addr, i) => (
                        <Draggable key={addr.id} draggableId={addr.id} index={i} isDragDisabled={!activelyEditing}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              className={snap.isDragging ? "ring-2 ring-indigo-400 shadow-lg rounded-xl z-50" : ""}
                            >
                              <AddressForm
                                address={addr}
                                onChange={(updated) => handleAddressChange(i, updated)}
                                onDelete={() => handleDeleteAddress(i)}
                                onSetHeadquarters={() => handleSetHeadquarters(i)}
                                isHeadquarters={addr.is_headquarters}
                                isEditing={activelyEditing}
                                isOnly={addresses.length === 1}
                                dragHandleProps={activelyEditing ? prov.dragHandleProps : null}
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
            </TabsContent>

            <TabsContent value="phones" className="space-y-3">
              <div className="flex items-center justify-between">
                {addresses.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs ml-auto"
                    onClick={() => { if (!activelyEditing) setIsEditing(true); handleAddPhone(); }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Phone
                  </Button>
                )}
              </div>

              {addresses.length === 0 && activelyEditing ? (
                <div className="text-sm text-amber-600 italic py-2 px-3 text-center border border-dashed border-amber-200 rounded-xl bg-amber-50">
                  Add an address first before adding phone numbers
                </div>
              ) : phones.length === 0 ? (
                <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
                  {activelyEditing ? 'Click "Add Phone" to add a number' : "No phone numbers added"}
                </div>
              ) : null}

              {activelyEditing ? (
                <DragDropContext onDragEnd={onDragEndPhones}>
                  <Droppable droppableId="firm-phones">
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                        {phones.map((ph, i) => (
                          <Draggable key={ph.id} draggableId={ph.id} index={i} isDragDisabled={!activelyEditing}>
                            {(prov, snap) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                className={snap.isDragging ? "ring-2 ring-indigo-400 shadow-lg rounded-xl z-50" : ""}
                              >
                                <PhoneForm
                                  phone={ph}
                                  onChange={(updated) => handlePhoneChange(i, updated)}
                                  onDelete={() => handleDeletePhone(i)}
                                  onSetDefault={() => handleSetDefaultPhone(i)}
                                  isDefault={ph.is_default}
                                  isEditing={activelyEditing}
                                  isOnly={phones.length === 1}
                                  addresses={addresses}
                                  dragHandleProps={activelyEditing ? prov.dragHandleProps : null}
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
              ) : (
                <div className="space-y-4">
                  {[...addresses]
                    .sort((a, b) => (b.is_headquarters ? 1 : 0) - (a.is_headquarters ? 1 : 0))
                    .map((addr) => {
                    const addressPhones = phones
                      .filter(p => p.address_id === addr.id)
                      .sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0));
                    if (addressPhones.length === 0) return null;
                    return (
                      <div key={addr.id} className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                          <span>{addr.is_headquarters ? "🏢" : "📍"}</span>
                          <span>{addr.city}, {addr.state}</span>
                        </div>
                        <div className="space-y-2">
                          {addressPhones.map((ph) => {
                            const phoneIndex = phones.findIndex(p => p.id === ph.id);
                            return (
                              <PhoneForm
                                key={ph.id}
                                phone={ph}
                                onChange={(updated) => handlePhoneChange(phoneIndex, updated)}
                                onDelete={() => handleDeletePhone(phoneIndex)}
                                onSetDefault={() => handleSetDefaultPhone(phoneIndex)}
                                isDefault={ph.is_default}
                                isEditing={false}
                                isOnly={addressPhones.length === 1}
                                addresses={addresses}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {(() => {
                    const orphanedPhones = phones.filter(p => !p.address_id || !addresses.find(a => a.id === p.address_id));
                    return orphanedPhones.length > 0 ? (
                      <div className="space-y-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="text-xs font-semibold text-amber-700">
                             ⚠️ Phones without address - assign a location below
                           </div>
                           <div className="space-y-2">
                             {orphanedPhones.map((ph) => {
                               const phoneIndex = phones.findIndex(p => p.id === ph.id);
                               return (
                                 <div key={ph.id}>
                                   <PhoneForm
                                     phone={ph}
                                     onChange={(updated) => handlePhoneChange(phoneIndex, updated)}
                                     onDelete={() => handleDeletePhone(phoneIndex)}
                                     onSetDefault={() => handleSetDefaultPhone(phoneIndex)}
                                     isDefault={ph.is_default}
                                     isEditing={true}
                                     isOnly={orphanedPhones.length === 1}
                                     addresses={addresses}
                                   />
                                 </div>
                               );
                             })}
                           </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
              </TabsContent>

              <TabsContent value="legal-compliance" className="space-y-3">
              {editingFirm ? (
                <LegalComplianceTab firmId={editingFirm.id} isEditing={activelyEditing} contacts={allContacts} />
              ) : (
                <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
                  Save the firm first to add legal & compliance information
                </div>
              )}
              </TabsContent>

              <TabsContent value="portfolios" className="space-y-3">
              {editingFirm ? (
                <FirmPortfoliosTab firmId={editingFirm.id} firmName={editingFirm.name} onPortfolioClick={onPortfolioClick} />
              ) : (
                <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
                  Save the firm first to add portfolios
                </div>
              )}
              </TabsContent>

              <TabsContent value="products" className="space-y-3">
              {editingFirm ? (
                <FirmProductsTab firmId={editingFirm.id} firmName={editingFirm.name} firms={existingFirms} />
              ) : (
                <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
                  Save the firm first to add products
                </div>
              )}
              </TabsContent>

              <TabsContent value="due-diligence" className="space-y-3">
              {editingFirm ? (
                <FirmDueDiligenceTab
                  firmId={editingFirm.id}
                  firmName={editingFirm.name}
                  contacts={allContacts}
                  onContactClick={(c) => {
                    if (!c) return;
                    onOpenChange(false);
                    onContactClick(c);
                  }}
                  onProductClick={onProductClick}
                />
              ) : (
                <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
                  Save the firm first to add due diligence information
                </div>
              )}
              </TabsContent>

              <TabsContent value="documents" className="space-y-3">
              {editingFirm ? (
                <FirmDocumentsTab firmId={editingFirm.id} firmName={editingFirm.name} />
              ) : (
                <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
                  Save the firm first to add documents
                </div>
              )}
              </TabsContent>

              <TabsContent value="activity-log" className="space-y-3">
              {editingFirm ? (
                <FirmActivityLogTab firmId={editingFirm.id} firmName={editingFirm.name} onFirmClick={onFirmClick} onContactClick={onContactClick} />
              ) : (
                <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
                  Save the firm first to view activity logs
                </div>
              )}
              </TabsContent>

              <TabsContent value="advisor-portfolios" className="space-y-3">
              {editingFirm ? (
                <FirmPortfoliosTab
                  firmId={editingFirm.id}
                  firmName={editingFirm.name}
                  advisorMode
                  advisorType={firmTypes.includes("Manager of Managers") ? "Manager of Managers" : "Investment Manager"}
                  onPortfolioClick={onPortfolioClick}
                />
              ) : (
                <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
                  Save the firm first to view portfolios
                </div>
              )}
              </TabsContent>

              <TabsContent value="ownership" className="space-y-3">
              {editingFirm ? (
                <OwnershipTab firmId={editingFirm.id} firmName={editingFirm.name} firmWebsite={editingFirm.website} defaultOwnershipId={defaultOwnershipId} />
              ) : (
                <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
                  Save the firm first to add ownership information
                </div>
              )}
              </TabsContent>

              <TabsContent value="orgchart" className="space-y-3">
              {editingFirm ? (
                <OrgChartTab firmId={editingFirm.id} firmName={editingFirm.name} />
              ) : (
                <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
                  Save the firm first to build the org chart
                </div>
              )}
              </TabsContent>
              </Tabs>
              </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2 border-t">
          <div>
            {editingFirm && onDelete && (
              <Button
                variant="ghost"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 w-full sm:w-auto"
                onClick={() => { handleClose(); onDelete(editingFirm); }}
              >
                Delete Firm
              </Button>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            {isEditing && !isAddMode ? (
              <>
                <Button variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!isValid || !hasChanges}
                  title={!isValid ? "Firm name and type are required" : !hasChanges ? "Make a change to enable saving" : undefined}
                  className={`text-white transition-all ${hasChanges && isValid ? "bg-indigo-600 hover:bg-indigo-700 shadow-md" : "bg-indigo-300"}`}
                >
                  Save Changes
                </Button>
              </>
            ) : isAddMode ? (
              <>
                <Button variant="outline" onClick={guardedClose}>Cancel</Button>
                <Button onClick={() => handleSubmit()} disabled={!isValid} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  Add Firm
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={guardedClose}>Close</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      {contactDuplicateWarning && (
        <Dialog open={true} onOpenChange={() => setContactDuplicateWarning(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Potential Duplicate Contacts
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-gray-600">
                {contactDuplicateWarning.duplicates.length} contact(s) from the web enrichment appear to match existing records. Would you like to create them anyway?
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {contactDuplicateWarning.duplicates.map((dup, i) => (
                  <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="font-semibold text-sm text-gray-800">
                      {[dup.contactData.first_name, dup.contactData.last_name].filter(Boolean).join(" ")}
                    </p>
                    {dup.contactData.email && <p className="text-xs text-gray-500">{dup.contactData.email}</p>}
                    <ul className="mt-1.5 space-y-0.5">
                      {dup.duplicates.map((d, di) => (
                        <li key={di} className="text-xs text-amber-700">
                          ⚠ Matches: <span className="font-medium">{d.name}</span>{d.email ? ` (${d.email})` : ""} — {d.reasons.join(", ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setContactDuplicateWarning(null)}>Skip These</Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={async () => {
                  const warning = contactDuplicateWarning;
                  setContactDuplicateWarning(null);
                  if (warning.isPending) {
                    setPendingContacts(prev => [...prev, ...(warning.people || [])]);
                    toast({ title: "Contacts added", description: `${(warning.people || []).length} duplicate contact(s) will be created with this firm.` });
                  } else {
                    let created = 0;
                    for (const dup of warning.duplicates) {
                      try { await base44.entities.Contact.create({ ...dup.contactData, tenant_id: user?.linked_firm_id }); created++; } catch {}
                    }
                    if (created > 0) {
                      queryClient.invalidateQueries({ queryKey: ["contacts"] });
                      toast({ title: "✅ Contacts created", description: `${created} duplicate contact(s) created.` });
                    }
                  }
                }}
              >
                Create Anyway
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <SimilarAddressDialog
        open={!!similarAddressPairs}
        onOpenChange={(v) => { if (!v) setSimilarAddressPairs(null); }}
        pairs={similarAddressPairs?.pairs || []}
        onResolve={handleResolveSimilarAddresses}
      />

      {similarFirmWarning && (
        <Dialog open={true} onOpenChange={() => setSimilarFirmWarning(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Similar Firm Name Exists
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-gray-600">
                A firm with a similar name already exists. Would you like to add this firm anyway?
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {similarFirmWarning.map((f) => {
                  const types = f.firm_types?.length ? f.firm_types : (f.firm_type ? [f.firm_type] : []);
                  return (
                    <div key={f.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="font-semibold text-sm text-gray-800">{f.name}</p>
                      {types.length > 0 && <p className="text-xs text-gray-500">{types.join(", ")}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSimilarFirmWarning(null)}>Cancel</Button>
              <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => { setSimilarFirmWarning(null); handleSubmit(true); }}>
                Add Anyway
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <EnrichmentApprovalDialog
        open={!!enrichmentApproval}
        onOpenChange={(v) => { if (!v) setEnrichmentApproval(null); }}
        onConfirm={handleConfirmEnrichmentContacts}
        contactUpdates={enrichmentApproval?.contactUpdates || []}
        newContacts={enrichmentApproval?.newContacts || []}
        firmFieldsApplied={enrichmentApproval?.firmFieldsApplied || []}
      />

      <SimilarFirmFieldDialog
        open={!!firmFieldConflicts}
        conflicts={firmFieldConflicts || []}
        onAccept={() => { setFirmFieldConflicts(null); handleSubmit(true, true); }}
        onReject={() => setFirmFieldConflicts(null)}
      />

      <LinkedinFirmMismatchDialog
        open={!!linkedinMismatch}
        data={linkedinMismatch}
        onAccept={(url) => {
          if (url) setLinkedinUrl(url);
          toast({ title: "LinkedIn URL applied", description: "Match accepted by user." });
          setLinkedinMismatch(null);
        }}
        onReject={() => {
          toast({ title: "LinkedIn URL not applied", description: "Match rejected by user." });
          setLinkedinMismatch(null);
        }}
      />
      {guardDialog}
    </Dialog>
  );
}