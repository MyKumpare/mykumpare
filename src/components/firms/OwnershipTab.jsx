import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Plus, X, AlertCircle, CalendarIcon, Trash2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AddContactDialog from "../contacts/AddContactDialog";
import DistributeRemainingDialog from "./DistributeRemainingDialog";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function OwnershipTab({ firmId, firmName, firmWebsite, defaultOwnershipId }) {
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(new Date());
  const [owners, setOwners] = useState([]);
  const [selectedOwnerType, setSelectedOwnerType] = useState("Employee");
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [addContactType, setAddContactType] = useState("Employee");
  const [selectedOwnership, setSelectedOwnership] = useState(null);
  const [viewMode, setViewMode] = useState(true);
  const [selectedContact, setSelectedContact] = useState(null);
  const [expandedSummaryRow, setExpandedSummaryRow] = useState(null);
  const [expandedEthnicity, setExpandedEthnicity] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [refreshingPhotos, setRefreshingPhotos] = useState(false);
  const [showDistributeDialog, setShowDistributeDialog] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch contacts for the firm (higher limit so owner lookups don't miss anyone)
  const { data: allContacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 500),
  });

  // Fetch ownership history
  const { data: ownershipHistory = [] } = useQuery({
    queryKey: ["ownership", firmId],
    queryFn: () => base44.entities.Ownership.filter({ firm_id: firmId }, "-effective_date"),
  });

  // Get most recent ownership breakdown
  const mostRecentOwnership = ownershipHistory[0];

  // Pre-select a specific ownership record when navigated from contact dialog
  useEffect(() => {
    if (defaultOwnershipId && ownershipHistory.length > 0) {
      const target = ownershipHistory.find(o => o.id === defaultOwnershipId);
      if (target) setSelectedOwnership(target);
    }
  }, [defaultOwnershipId, ownershipHistory]);

  // When opening form with most recent data or selected ownership
  useEffect(() => {
    if (selectedOwnership) {
      setEffectiveDate(new Date(selectedOwnership.effective_date));
      setOwners(selectedOwnership.owners || []);
      setViewMode(true);
      setShowUpdateForm(false);
    } else if (showUpdateForm && mostRecentOwnership) {
      setEffectiveDate(new Date(mostRecentOwnership.effective_date));
      setOwners(mostRecentOwnership.owners || []);
    } else if (showUpdateForm) {
      setEffectiveDate(new Date());
      setOwners([]);
    }
  }, [selectedOwnership, showUpdateForm, mostRecentOwnership]);

  // Get firm contacts
  const firmContacts = allContacts.filter(c => c.firm_ids?.includes(firmId));

  // Committed total from owners already added
  const committedTotal = owners.reduce((sum, o) => sum + (parseFloat(o.ownership_percentage) || 0), 0);

  // Live preview of owners being added (before "Add Selected" is clicked):
  // each selected contact gets an equal share of the remaining available %,
  // so the allocation bar + ownership summary update as the user picks contacts.
  const pendingOwners = useMemo(() => {
    if (selectedContactIds.length === 0) return [];
    const remaining = Math.max(0, 100 - committedTotal);
    const share = remaining / selectedContactIds.length;
    return selectedContactIds.map((cid) => {
      const contact = allContacts.find(c => c.id === cid);
      if (!contact) return null;
      return {
        id: `__pending__${cid}`,
        contact_id: cid,
        owner_type: selectedOwnerType,
        ownership_percentage: parseFloat(share.toFixed(2)),
        contact_photo_url: contact.photo_url || "",
        contact_full_name: [contact.salutation, contact.first_name, contact.middle_name, contact.last_name, contact.suffix].filter(Boolean).join(" "),
      };
    }).filter(Boolean);
  }, [selectedContactIds, selectedOwnerType, allContacts, committedTotal]);

  const previewOwners = [...owners, ...pendingOwners];
  const hasPending = pendingOwners.length > 0;

  // Filter contacts by owner type (matching employee_status) and exclude existing owners.
  // Match by contact_id first; fall back to a normalized core name (first/middle/last,
  // salutations & suffixes stripped) so owners stored without a contact_id are still excluded.
  const SALUTATIONS = ["mr", "ms", "mrs", "dr", "prof", "hon"];
  const SUFFIXES = ["jr", "sr", "ii", "iii", "iv", "esq", "cfa", "cpa", "mba", "phd", "md"];
  const normalizeName = (name) => {
    if (!name) return "";
    return name.toLowerCase()
      .split(/\s+/)
      .map((t) => t.replace(/[.,]/g, ""))
      .filter((t) => t && !SALUTATIONS.includes(t) && !SUFFIXES.includes(t))
      .join(" ")
      .trim();
  };
  const getAvailableContacts = (type) => {
    const ownerContactIds = new Set(owners.map((o) => o.contact_id).filter(Boolean));
    const ownerNames = new Set(
      owners.map((o) => normalizeName(o.contact_full_name)).filter(Boolean)
    );
    return firmContacts.filter((c) => {
      if (ownerContactIds.has(c.id)) return false;
      const coreName = normalizeName([c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" "));
      if (coreName && ownerNames.has(coreName)) return false;
      return c.employee_status === type;
    });
  };

  const totalOwnershipPercentage = previewOwners.reduce((sum, o) => sum + (parseFloat(o.ownership_percentage) || 0), 0);
  const isValidPercentage = committedTotal > 0;
  const percentageWarning = totalOwnershipPercentage !== 100;
  const remainingToAllocate = Math.max(0, 100 - totalOwnershipPercentage);
  const exceedsMax = totalOwnershipPercentage > 100;

  // Calculate ownership summary
  const calculateOwnershipSummary = () => {
    const summary = {
      veteranOwned: { employee: 0, nonEmployee: 0 },
      disabledOwned: { employee: 0, nonEmployee: 0 },
      disabledVeteranOwned: { employee: 0, nonEmployee: 0 },
      ethnicMinorityOwned: { employee: 0, nonEmployee: 0 },
      caucasianOwned: { employee: 0, nonEmployee: 0 },
      womenOwned: { employee: 0, nonEmployee: 0 },
      ethnicMinorityAndWomenOwned: { employee: 0, nonEmployee: 0 },
      ethnicMinorityAndWomenAndVeteranOwned: { employee: 0, nonEmployee: 0 },
      ethnicMinorityAndWomenAndDisabledVeteranOwned: { employee: 0, nonEmployee: 0 },
    };

    previewOwners.forEach((owner) => {
      const contact = allContacts.find(c => c.id === owner.contact_id);
      if (!contact) return;

      const percentage = parseFloat(owner.ownership_percentage) || 0;
      const ownerType = owner.owner_type === "Employee" ? "employee" : "nonEmployee";

      // Veteran owned
      const isVeteran = contact.veteran_status === "Veteran Owned";
      if (isVeteran) {
        summary.veteranOwned[ownerType] += percentage;
      }

      // Disabled owned
      const isDisabled = contact.disability_status === "Disabled";
      if (isDisabled) {
        summary.disabledOwned[ownerType] += percentage;
      }

      // Disabled Veteran owned
      if (isDisabled && isVeteran) {
        summary.disabledVeteranOwned[ownerType] += percentage;
      }

      // Ethnic minority owned (all except Caucasian)
      const isEthnicMinority = contact.ethnicity && contact.ethnicity.length > 0 && !contact.ethnicity.includes("Caucasian");
      if (isEthnicMinority) {
        summary.ethnicMinorityOwned[ownerType] += percentage;
      }

      // Caucasian owned
      const isCaucasian = contact.ethnicity && contact.ethnicity.includes("Caucasian");
      if (isCaucasian) {
        summary.caucasianOwned[ownerType] += percentage;
      }

      // Women owned
      const isWoman = contact.gender === "Female";
      if (isWoman) {
        summary.womenOwned[ownerType] += percentage;
      }

      // Ethnic minority AND women owned
      if (isEthnicMinority && isWoman) {
        summary.ethnicMinorityAndWomenOwned[ownerType] += percentage;
      }

      // Ethnic minority & women AND veteran owned
      if (isEthnicMinority && isWoman && isVeteran) {
        summary.ethnicMinorityAndWomenAndVeteranOwned[ownerType] += percentage;
      }

      // Ethnic minority & women AND disabled veteran owned
      if (isEthnicMinority && isWoman && isDisabled && isVeteran) {
        summary.ethnicMinorityAndWomenAndDisabledVeteranOwned[ownerType] += percentage;
      }
    });

    return summary;
  };

  const ownershipSummary = useMemo(() => calculateOwnershipSummary(), [previewOwners, allContacts]);

  // Helper function to get owners by specific ethnicity and category
  const getOwnersByEthnicityAndCategory = (ethnicity, category) => {
    return previewOwners.filter((owner) => {
      const contact = allContacts.find(c => c.id === owner.contact_id);
      if (!contact) return false;
      
      // Check if matches category
      const isVeteran = contact.veteran_status === "Veteran Owned";
      const isDisabled = contact.disability_status === "Disabled";
      const isEthnicMinority = contact.ethnicity && contact.ethnicity.length > 0 && !contact.ethnicity.includes("Caucasian");
      const isWoman = contact.gender === "Female";

      let categoryMatch = false;
      switch (category) {
        case "women":
          categoryMatch = isWoman;
          break;
        case "veteran":
          categoryMatch = isVeteran;
          break;
        case "disabled":
          categoryMatch = isDisabled;
          break;
        case "disabledVeteran":
          categoryMatch = isDisabled && isVeteran;
          break;
        case "ethnicMinority":
          categoryMatch = isEthnicMinority;
          break;
        case "caucasian":
          categoryMatch = contact.ethnicity && contact.ethnicity.includes("Caucasian");
          break;
        case "ethnicMinorityAndWomen":
          categoryMatch = isEthnicMinority && isWoman;
          break;
        case "ethnicMinorityAndWomenAndVeteran":
          categoryMatch = isEthnicMinority && isWoman && isVeteran;
          break;
        case "ethnicMinorityAndWomenAndDisabledVeteran":
          categoryMatch = isEthnicMinority && isWoman && isDisabled && isVeteran;
          break;
        default:
          return false;
      }

      // Check ethnicity match
      return categoryMatch && contact.ethnicity && contact.ethnicity.includes(ethnicity);
    }).map(owner => ({
      fullName: owner.contact_full_name,
      photoUrl: owner.contact_photo_url,
      percentage: owner.ownership_percentage,
      type: owner.owner_type,
    }));
  };

  // Get ethnicities breakdown for a category
  const getEthnicityBreakdownForCategory = (category) => {
    const ethnicityMap = {};
    const categoryOwners = previewOwners.filter((owner) => {
      const contact = allContacts.find(c => c.id === owner.contact_id);
      if (!contact) return false;

      const isVeteran = contact.veteran_status === "Veteran Owned";
      const isDisabled = contact.disability_status === "Disabled";
      const isEthnicMinority = contact.ethnicity && contact.ethnicity.length > 0 && !contact.ethnicity.includes("Caucasian");
      const isWoman = contact.gender === "Female";

      switch (category) {
        case "ethnicMinority":
          return isEthnicMinority;
        case "caucasian":
          return contact.ethnicity && contact.ethnicity.includes("Caucasian");
        case "women":
          return isWoman;
        case "veteran":
          return isVeteran;
        case "disabled":
          return isDisabled;
        case "disabledVeteran":
          return isDisabled && isVeteran;
        case "ethnicMinorityAndWomen":
          return isEthnicMinority && isWoman;
        case "ethnicMinorityAndWomenAndVeteran":
          return isEthnicMinority && isWoman && isVeteran;
        case "ethnicMinorityAndWomenAndDisabledVeteran":
          return isEthnicMinority && isWoman && isDisabled && isVeteran;
        default:
          return false;
      }
    });

    categoryOwners.forEach(owner => {
      const contact = allContacts.find(c => c.id === owner.contact_id);
      if (contact && contact.ethnicity) {
        contact.ethnicity.forEach(eth => {
          ethnicityMap[eth] = (ethnicityMap[eth] || 0) + owner.ownership_percentage;
        });
      }
    });

    return Object.entries(ethnicityMap)
      .map(([ethnicity, total]) => ({ ethnicity, total }))
      .sort((a, b) => b.total - a.total);
  };

  // Helper function to get ownership composition for a specific category
  const getOwnershipComposition = (category) => {
    const categoryOwners = previewOwners.filter((owner) => {
      const contact = allContacts.find(c => c.id === owner.contact_id);
      if (!contact) return false;

      const isVeteran = contact.veteran_status === "Veteran Owned";
      const isDisabled = contact.disability_status === "Disabled";
      const isEthnicMinority = contact.ethnicity && contact.ethnicity.length > 0 && !contact.ethnicity.includes("Caucasian");
      const isWoman = contact.gender === "Female";

      switch (category) {
        case "ethnicMinority":
          return isEthnicMinority;
        case "caucasian":
          return contact.ethnicity && contact.ethnicity.includes("Caucasian");
        case "women":
          return isWoman;
        case "veteran":
          return isVeteran;
        case "disabled":
          return isDisabled;
        case "disabledVeteran":
          return isDisabled && isVeteran;
        case "ethnicMinorityAndWomen":
          return isEthnicMinority && isWoman;
        case "ethnicMinorityAndWomenAndVeteran":
          return isEthnicMinority && isWoman && isVeteran;
        case "ethnicMinorityAndWomenAndDisabledVeteran":
          return isEthnicMinority && isWoman && isDisabled && isVeteran;
        default:
          return false;
      }
    });

    return categoryOwners.map(owner => {
      return {
        fullName: owner.contact_full_name,
        photoUrl: owner.contact_photo_url,
        percentage: owner.ownership_percentage,
        type: owner.owner_type,
      };
    });
  };

  const addOwnerMutation = useMutation({
    mutationFn: (data) => base44.entities.Ownership.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ownership", firmId] });
      setShowUpdateForm(false);
      setSelectedOwnership(null);
      setOwners([]);
      setSelectedContactIds([]);
      setViewMode(true);
    },
  });

  const updateOwnershipMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Ownership.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ownership", firmId] });
      setSelectedOwnership(null);
      setOwners([]);
      setSelectedContactIds([]);
      setViewMode(true);
    },
  });

  const deleteOwnershipMutation = useMutation({
    mutationFn: (id) => base44.entities.Ownership.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ownership", firmId] });
      if (selectedOwnership?.id === deleteTarget?.id) {
        setSelectedOwnership(null);
        setOwners([]);
        setViewMode(true);
      }
      setDeleteTarget(null);
    },
  });

  const handleAddSelectedOwners = () => {
    if (selectedContactIds.length === 0) return;
    const remaining = Math.max(0, 100 - committedTotal);
    const share = remaining / selectedContactIds.length;
    const newOwners = selectedContactIds.map((cid) => {
      const contact = allContacts.find(c => c.id === cid);
      if (!contact) return null;
      return {
        id: crypto.randomUUID(),
        contact_id: cid,
        owner_type: selectedOwnerType,
        ownership_percentage: parseFloat(share.toFixed(2)),
        contact_photo_url: contact.photo_url || "",
        contact_full_name: [contact.salutation, contact.first_name, contact.middle_name, contact.last_name, contact.suffix].filter(Boolean).join(" "),
      };
    }).filter(Boolean);
    setOwners([...owners, ...newOwners]);
    setSelectedContactIds([]);
  };

  const handleRemoveOwner = (ownerId) => {
    setOwners(owners.filter(o => o.id !== ownerId));
  };

  // Distribute the remaining unallocated percentage across existing owners,
  // proportionally to their current ownership weights.
  const handleDistributeRemaining = () => {
    if (owners.length === 0 || committedTotal >= 100) return;
    const remaining = Math.max(0, 100 - committedTotal);
    const updated = owners.map((o) => {
      const weight = committedTotal > 0 ? (o.ownership_percentage / committedTotal) * remaining : remaining / owners.length;
      const next = parseFloat((parseFloat(o.ownership_percentage || 0) + weight).toFixed(2));
      return { ...o, ownership_percentage: next };
    });
    setOwners(updated);
  };

  const handleSaveOwnership = () => {
    if (!isValidPercentage) return;

    if (selectedOwnership) {
      updateOwnershipMutation.mutate({
        id: selectedOwnership.id,
        data: {
          effective_date: format(effectiveDate, "yyyy-MM-dd"),
          owners,
        },
      });
    } else {
      addOwnerMutation.mutate({
        firm_id: firmId,
        effective_date: format(effectiveDate, "yyyy-MM-dd"),
        owners,
      });
    }
  };

  const availableContacts = getAvailableContacts(selectedOwnerType);

  // Detect mismatches between owner_type in ownership record and employee_status in contact
  const ownerTypeMismatches = useMemo(() => {
    return owners.filter(owner => {
      const contact = allContacts.find(c => c.id === owner.contact_id);
      if (!contact || !contact.employee_status) return false;
      return owner.owner_type !== contact.employee_status;
    });
  }, [owners, allContacts]);

  const resolveOwnerTypeMismatch = (ownerId, useContactValue) => {
    const owner = owners.find(o => o.id === ownerId);
    if (!owner) return;
    const contact = allContacts.find(c => c.id === owner.contact_id);
    if (!contact) return;
    const newType = useContactValue ? contact.employee_status : owner.owner_type;
    setOwners(owners.map(o => o.id === ownerId ? { ...o, owner_type: newType } : o));
  };

  const handleRefreshPhotos = async () => {
    setRefreshingPhotos(true);
    try {
      const res = await base44.functions.invoke('refreshFirmContactPhotos', {
        firm_id: firmId,
        website: firmWebsite,
        firm_name: firmName,
      });
      const data = res?.data || res;
      if (data.updated > 0) {
        queryClient.invalidateQueries({ queryKey: ["contacts"] });
        queryClient.invalidateQueries({ queryKey: ["ownership", firmId] });
      }
      return data;
    } catch (e) {
      throw e;
    } finally {
      setRefreshingPhotos(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Ownership History */}
      {ownershipHistory.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Ownership History</h3>
            {firmWebsite && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const data = await handleRefreshPhotos();
                    if (data?.updated > 0) {
                      toast({ title: "Photos refreshed", description: `Updated ${data.updated} contact photo${data.updated === 1 ? "" : "s"} from ${firmName} website.` });
                    } else {
                      toast({ title: "No photo updates", description: "No new photos were found on the firm website." });
                    }
                  } catch (e) {
                    toast({ title: "Refresh failed", description: e.message || "Could not refresh photos.", variant: "destructive" });
                  }
                }}
                disabled={refreshingPhotos}
                className="h-7 text-xs gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingPhotos ? "animate-spin" : ""}`} />
                  {refreshingPhotos ? "Refreshing..." : "Refresh Photos"}
                </Button>
            )}
          </div>
          {ownershipHistory.map((breakdown) => (
            <div
              key={breakdown.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedOwnership(breakdown)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedOwnership(breakdown); } }}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-indigo-300 transition-colors p-3 space-y-2 text-left cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">
                  {format(new Date(breakdown.effective_date), "MMM d, yyyy")}
                </span>
                <div className="flex items-center gap-2">
                  {breakdown.id === mostRecentOwnership?.id && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      Most Recent
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(breakdown); }}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50"
                    title="Delete this ownership record"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {breakdown.owners?.map((owner) => {
                  const ownerContact = allContacts.find((c) => c.id === owner.contact_id);
                  const displayName = ownerContact
                    ? [ownerContact.salutation, ownerContact.first_name, ownerContact.middle_name, ownerContact.last_name, ownerContact.suffix].filter(Boolean).join(" ")
                    : owner.contact_full_name;
                  const displayPhoto = ownerContact?.photo_url || owner.contact_photo_url;
                  return (
                    <div key={owner.id} className="flex items-center gap-1.5 bg-white rounded-full pl-1.5 pr-2.5 py-0.5 border border-gray-200">
                      <Avatar className="h-5 w-5 flex-shrink-0">
                        <AvatarImage src={displayPhoto} alt={displayName} />
                        <AvatarFallback className="text-xs">{displayName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-gray-700">{displayName}</span>
                      <span className="text-xs font-medium text-indigo-600">{owner.ownership_percentage}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Update Ownership Button */}
      {!selectedOwnership && (
        <Button
          type="button"
          onClick={() => {
            setShowUpdateForm(true);
            setViewMode(false);
          }}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Update Ownership
        </Button>
      )}

      {/* Update/View Form */}
      {(showUpdateForm || selectedOwnership) && (
        <div className="space-y-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              {viewMode ? "Ownership Breakdown" : "Update Ownership"}
            </h3>
            <div className="flex gap-2">
              {viewMode && selectedOwnership && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode(false)}
                  className="text-indigo-600 border-indigo-200 hover:bg-indigo-100"
                >
                  Edit
                </Button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedOwnership(null);
                  setShowUpdateForm(false);
                  setOwners([]);
                  setViewMode(true);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Date Picker */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Effective Date</Label>
            {viewMode ? (
              <div className="text-sm px-3 py-2 bg-white rounded-md border border-gray-300 text-gray-900">
                {format(effectiveDate, "MMM d, yyyy")}
              </div>
            ) : (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    {format(effectiveDate, "MMM d, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={effectiveDate}
                    onSelect={(date) => date && setEffectiveDate(date)}
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Add Owners Section - only show in edit mode */}
          {!viewMode && (
            <div className="space-y-3 rounded-lg border border-white bg-white p-3">
              <h4 className="text-xs font-semibold text-gray-900">Add Owners</h4>

              {/* Owner Type Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Owner Type</Label>
                <div className="flex gap-2">
                  {["Employee", "Non-Employee"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setSelectedOwnerType(type);
                        setSelectedContactIds([]);
                      }}
                      className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                        selectedOwnerType === type
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-gray-700 border-gray-300 hover:border-indigo-300"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Multi-select Contact List */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-gray-700">Contacts</Label>
                  {availableContacts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = availableContacts.map(c => c.id);
                        const allSelected = allIds.every(id => selectedContactIds.includes(id));
                        setSelectedContactIds(allSelected ? [] : allIds);
                      }}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      {availableContacts.every(c => selectedContactIds.includes(c.id)) ? "Clear all" : "Select all"}
                    </button>
                  )}
                </div>
                <div className="max-h-40 overflow-y-auto rounded-md border border-gray-200 divide-y divide-gray-100">
                  {availableContacts.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-500">No {selectedOwnerType.toLowerCase()}s available</div>
                  ) : (
                    availableContacts.map((contact) => {
                      const checked = selectedContactIds.includes(contact.id);
                      return (
                        <label key={contact.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-indigo-50">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedContactIds(checked
                                ? selectedContactIds.filter(id => id !== contact.id)
                                : [...selectedContactIds, contact.id]);
                            }}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-xs text-gray-700">
                            {[contact.first_name, contact.middle_name, contact.last_name].filter(Boolean).join(" ")}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {selectedContactIds.length > 0 && (
                <p className="text-xs text-indigo-600">
                  {selectedContactIds.length} selected — each gets{" "}
                  {(Math.max(0, 100 - committedTotal) / selectedContactIds.length).toFixed(2)}% of remaining allocation
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 gap-1"
                  onClick={() => {
                    setAddContactType(selectedOwnerType);
                    setShowAddContact(true);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  New
                </Button>
                <Button
                  type="button"
                  onClick={handleAddSelectedOwners}
                  disabled={selectedContactIds.length === 0}
                  className="flex-1 h-8 text-sm bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Add {selectedContactIds.length > 0 ? `${selectedContactIds.length} ` : ""}Owner{selectedContactIds.length === 1 ? "" : "s"}
                </Button>
              </div>
            </div>
          )}

          {/* Percentage Progress */}
          <div className="space-y-1.5 rounded-lg border border-white bg-white p-3">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs font-semibold text-gray-900">Ownership Allocation</h4>
              <span className={`text-xs font-medium ${totalOwnershipPercentage === 100 ? "text-green-600" : exceedsMax ? "text-red-600" : "text-amber-600"}`}>
                {totalOwnershipPercentage.toFixed(2)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all ${exceedsMax ? "bg-red-500" : totalOwnershipPercentage === 100 ? "bg-green-500" : "bg-amber-500"}`}
                style={{ width: `${Math.min(totalOwnershipPercentage, 100)}%` }}
              />
            </div>
            {exceedsMax && (
              <p className="text-xs text-red-600 font-medium">⚠️ Ownership exceeds 100% by {(totalOwnershipPercentage - 100).toFixed(2)}%</p>
            )}
            {!exceedsMax && totalOwnershipPercentage < 100 && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-amber-600">{remainingToAllocate.toFixed(2)}% remaining to allocate</p>
                {!viewMode && owners.length > 0 && committedTotal > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowDistributeDialog(true)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline whitespace-nowrap"
                    title="Choose owners and enter weights for the remaining %"
                  >
                    Distribute remaining weights
                  </button>
                )}
              </div>
            )}
            {!exceedsMax && totalOwnershipPercentage < 100 && !viewMode && owners.length > 0 && committedTotal === 0 && (
              <button
                type="button"
                onClick={handleDistributeRemaining}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                title="Split 100% equally across owners"
              >
                Split equally
              </button>
            )}
            {totalOwnershipPercentage === 100 && !hasPending && (
              <p className="text-xs text-green-600 font-medium">✓ Ownership fully allocated</p>
            )}
            {hasPending && (
              <p className="text-xs text-indigo-600 italic">
                Includes {pendingOwners.length} pending — click "Add" to confirm
              </p>
            )}
          </div>

          {/* Current Owners List */}
          {(owners.length > 0 || hasPending) && (
            <div className="space-y-2 rounded-lg border border-white bg-white p-3">
              <h4 className="text-xs font-semibold text-gray-900">
                Owners ({owners.length}){hasPending && <span className="text-indigo-500 font-normal"> + {pendingOwners.length} pending</span>}
              </h4>

              {/* Mismatch warnings */}
              {ownerTypeMismatches.length > 0 && (
                <div className="space-y-2">
                  {ownerTypeMismatches.map(owner => {
                    const contact = allContacts.find(c => c.id === owner.contact_id);
                    return (
                      <div key={owner.id} className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs">
                        <div className="flex items-start gap-2 mb-2">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                          <span className="text-amber-800">
                            <strong>{owner.contact_full_name}</strong> is listed as <strong>{owner.owner_type}</strong> in this ownership record, but their contact profile now shows <strong>{contact?.employee_status}</strong>.
                          </span>
                        </div>
                        {!viewMode && (
                          <div className="flex gap-2 ml-5">
                            <button
                              type="button"
                              onClick={() => resolveOwnerTypeMismatch(owner.id, false)}
                              className="px-2 py-1 rounded border border-amber-400 text-amber-700 hover:bg-amber-100 text-xs font-medium"
                            >
                              Keep "{owner.owner_type}"
                            </button>
                            <button
                              type="button"
                              onClick={() => resolveOwnerTypeMismatch(owner.id, true)}
                              className="px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 text-xs font-medium"
                            >
                              Update to "{contact?.employee_status}"
                            </button>
                          </div>
                        )}
                        {viewMode && (
                          <p className="text-amber-700 ml-5">Edit this ownership record to resolve the conflict.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {owners.map((owner) => {
                  const contact = allContacts.find(c => c.id === owner.contact_id);
                  const demographics = [];
                  if (contact?.gender === "Female") demographics.push("Woman");
                  if (contact?.veteran_status === "Veteran Owned") demographics.push("Veteran");
                  if (contact?.disability_status === "Disabled") demographics.push("Disabled");
                  if (contact?.ethnicity && contact.ethnicity.length > 0) {
                    demographics.push(contact.ethnicity.slice(0, 2).join(", "));
                  }

                  return (
                    <div key={owner.id} className="flex items-start justify-between bg-gray-50 rounded-lg p-2 border border-gray-200">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <Avatar className="h-6 w-6 flex-shrink-0 mt-0.5">
                          <AvatarImage src={owner.contact_photo_url} alt={owner.contact_full_name} />
                          <AvatarFallback className="text-xs">{owner.contact_full_name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                           <button
                             type="button"
                             onClick={() => setSelectedContact(allContacts.find(c => c.id === owner.contact_id))}
                             className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline text-left"
                           >
                             {owner.contact_full_name}
                           </button>
                           <p className="text-xs text-gray-500">{contact?.employee_status || owner.owner_type}</p>
                          {demographics.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {demographics.map((d) => (
                                <span key={d} className="inline-block text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{d}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={owner.ownership_percentage}
                            onChange={(e) => {
                              const updated = owners.map(o => o.id === owner.id ? { ...o, ownership_percentage: parseFloat(e.target.value) || 0 } : o);
                              setOwners(updated);
                            }}
                            disabled={viewMode}
                            className="text-xs font-medium text-indigo-600 min-w-[3rem] text-right px-1 py-0.5 rounded border border-indigo-200 disabled:bg-transparent disabled:border-0"
                          />
                          <span className="text-xs">%</span>
                          {!viewMode && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOwner(owner.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {pendingOwners.map((po) => (
                  <div key={po.id} className="flex items-start justify-between bg-indigo-50 rounded-lg p-2 border border-dashed border-indigo-300">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <Avatar className="h-6 w-6 flex-shrink-0 mt-0.5">
                        <AvatarImage src={po.contact_photo_url} alt={po.contact_full_name} />
                        <AvatarFallback className="text-xs">{po.contact_full_name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-indigo-700">{po.contact_full_name}</span>
                        <p className="text-xs text-indigo-500 italic">Pending — click "Add" to confirm</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-xs font-medium text-indigo-600">{po.ownership_percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ownership Summary Table */}
          {previewOwners.length > 0 && (
            <div className="space-y-2 rounded-lg border border-white bg-white p-3 overflow-x-auto">
              <h4 className="text-xs font-semibold text-gray-900">
                Ownership Summary {hasPending && <span className="text-indigo-500 font-normal italic">(live preview)</span>}
              </h4>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-gray-700 font-medium p-2 border border-gray-200 bg-gray-100">Category</th>
                    <th className="text-right text-gray-700 font-medium p-2 border border-gray-200 bg-gray-100">Employee Owned</th>
                    <th className="text-right text-gray-700 font-medium p-2 border border-gray-200 bg-gray-100">Non-Employee Owned</th>
                    <th className="text-right text-gray-700 font-medium p-2 border border-gray-200 bg-gray-100">Total</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {/* Ethnic Minority Owned */}
                  <tr>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "ethnicMinority" ? null : "ethnicMinority")}
                      className="text-gray-700 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      Ethnic Minority Owned
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "ethnicMinority" ? null : "ethnicMinority")}
                      className="text-right font-medium text-indigo-600 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      {ownershipSummary.ethnicMinorityOwned.employee.toFixed(2)}%
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "ethnicMinority" ? null : "ethnicMinority")}
                      className="text-right font-medium text-indigo-600 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      {ownershipSummary.ethnicMinorityOwned.nonEmployee.toFixed(2)}%
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "ethnicMinority" ? null : "ethnicMinority")}
                      className="text-right font-medium text-indigo-600 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      {(ownershipSummary.ethnicMinorityOwned.employee + ownershipSummary.ethnicMinorityOwned.nonEmployee).toFixed(2)}%
                    </td>
                  </tr>
                  {expandedSummaryRow === "ethnicMinority" && (
                    <tr>
                      <td colSpan="4" className="p-3 border border-gray-200 bg-gray-50">
                        <div className="space-y-2">
                          {getEthnicityBreakdownForCategory("ethnicMinority").map(({ ethnicity, total }) => (
                             <div key={ethnicity}>
                               <button
                                 onClick={() => setExpandedEthnicity(expandedEthnicity === `ethnicMinority-${ethnicity}` ? null : `ethnicMinority-${ethnicity}`)}
                                 className="text-xs font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer mb-1"
                               >
                                 {ethnicity} {total.toFixed(2)}%
                               </button>
                               {expandedEthnicity === `ethnicMinority-${ethnicity}` && (
                                 <div className="space-y-1 ml-4">
                                   {getOwnersByEthnicityAndCategory(ethnicity, "ethnicMinority").map((o, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-4 w-4">
                                          <AvatarImage src={o.photoUrl} alt={o.fullName} />
                                          <AvatarFallback className="text-xs">{o.fullName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-gray-700">{o.fullName}</span>
                                      </div>
                                      <span className="text-gray-500">{o.type} • {o.percentage}%</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Women Owned */}
                  <tr>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "women" ? null : "women")}
                      className="text-gray-700 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      Women Owned
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "women" ? null : "women")}
                      className="text-right font-medium text-indigo-600 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      {ownershipSummary.womenOwned.employee.toFixed(2)}%
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "women" ? null : "women")}
                      className="text-right font-medium text-indigo-600 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      {ownershipSummary.womenOwned.nonEmployee.toFixed(2)}%
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "women" ? null : "women")}
                      className="text-right font-medium text-indigo-600 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      {(ownershipSummary.womenOwned.employee + ownershipSummary.womenOwned.nonEmployee).toFixed(2)}%
                    </td>
                  </tr>
                  {expandedSummaryRow === "women" && (
                    <tr>
                      <td colSpan="4" className="p-3 border border-gray-200 bg-gray-50">
                        <div className="space-y-2">
                          {getEthnicityBreakdownForCategory("women").map(({ ethnicity, total }) => (
                            <div key={ethnicity}>
                              <button
                                onClick={() => setExpandedEthnicity(expandedEthnicity === `women-${ethnicity}` ? null : `women-${ethnicity}`)}
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer mb-1"
                              >
                                {ethnicity} {total.toFixed(2)}%
                              </button>
                              {expandedEthnicity === `women-${ethnicity}` && (
                                <div className="space-y-1 ml-4">
                                  {getOwnersByEthnicityAndCategory(ethnicity, "women").map((o, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-4 w-4">
                                          <AvatarImage src={o.photoUrl} alt={o.fullName} />
                                          <AvatarFallback className="text-xs">{o.fullName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-gray-700">{o.fullName}</span>
                                      </div>
                                      <span className="text-gray-500">{o.type} • {o.percentage}%</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Caucasian Owned */}
                  <tr>
                    <td
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "caucasian" ? null : "caucasian")}
                      className="text-gray-700 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      Caucasian Owned
                    </td>
                    <td
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "caucasian" ? null : "caucasian")}
                      className="text-right font-medium text-indigo-600 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      {ownershipSummary.caucasianOwned.employee.toFixed(2)}%
                    </td>
                    <td
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "caucasian" ? null : "caucasian")}
                      className="text-right font-medium text-indigo-600 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      {ownershipSummary.caucasianOwned.nonEmployee.toFixed(2)}%
                    </td>
                    <td
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "caucasian" ? null : "caucasian")}
                      className="text-right font-medium text-indigo-600 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      {(ownershipSummary.caucasianOwned.employee + ownershipSummary.caucasianOwned.nonEmployee).toFixed(2)}%
                    </td>
                  </tr>
                  {expandedSummaryRow === "caucasian" && (
                    <tr>
                      <td colSpan="4" className="p-3 border border-gray-200 bg-gray-50">
                        <div className="space-y-2">
                          {getEthnicityBreakdownForCategory("caucasian").map(({ ethnicity, total }) => (
                            <div key={ethnicity}>
                              <button
                                onClick={() => setExpandedEthnicity(expandedEthnicity === `caucasian-${ethnicity}` ? null : `caucasian-${ethnicity}`)}
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer mb-1"
                              >
                                {ethnicity} {total.toFixed(2)}%
                              </button>
                              {expandedEthnicity === `caucasian-${ethnicity}` && (
                                <div className="space-y-1 ml-4">
                                  {getOwnersByEthnicityAndCategory(ethnicity, "caucasian").map((o, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-4 w-4">
                                          <AvatarImage src={o.photoUrl} alt={o.fullName} />
                                          <AvatarFallback className="text-xs">{o.fullName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-gray-700">{o.fullName}</span>
                                      </div>
                                      <span className="text-gray-500">{o.type} • {o.percentage}%</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Veteran Owned */}
                  <tr>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "veteran" ? null : "veteran")}
                      className="text-gray-700 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      Veteran Owned
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "veteran" ? null : "veteran")}
                      className="text-right font-medium text-indigo-600 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      {ownershipSummary.veteranOwned.employee.toFixed(2)}%
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "veteran" ? null : "veteran")}
                      className="text-right font-medium text-indigo-600 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      {ownershipSummary.veteranOwned.nonEmployee.toFixed(2)}%
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "veteran" ? null : "veteran")}
                      className="text-right font-medium text-indigo-600 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      {(ownershipSummary.veteranOwned.employee + ownershipSummary.veteranOwned.nonEmployee).toFixed(2)}%
                    </td>
                  </tr>
                  {expandedSummaryRow === "veteran" && (
                    <tr>
                      <td colSpan="4" className="p-3 border border-gray-200 bg-gray-50">
                        <div className="space-y-2">
                          {getEthnicityBreakdownForCategory("veteran").map(({ ethnicity, total }) => (
                            <div key={ethnicity}>
                              <button
                                onClick={() => setExpandedEthnicity(expandedEthnicity === `veteran-${ethnicity}` ? null : `veteran-${ethnicity}`)}
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer mb-1"
                              >
                                {ethnicity} {total.toFixed(2)}%
                              </button>
                              {expandedEthnicity === `veteran-${ethnicity}` && (
                                <div className="space-y-1 ml-4">
                                  {getOwnersByEthnicityAndCategory(ethnicity, "veteran").map((o, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-4 w-4">
                                          <AvatarImage src={o.photoUrl} alt={o.fullName} />
                                          <AvatarFallback className="text-xs">{o.fullName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-gray-700">{o.fullName}</span>
                                      </div>
                                      <span className="text-gray-500">{o.type} • {o.percentage}%</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Disability Owned */}
                  <tr>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "disabled" ? null : "disabled")}
                      className="text-gray-700 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      Disability Owned
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "disabled" ? null : "disabled")}
                      className="text-right font-medium text-indigo-600 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      {ownershipSummary.disabledOwned.employee.toFixed(2)}%
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "disabled" ? null : "disabled")}
                      className="text-right font-medium text-indigo-600 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      {ownershipSummary.disabledOwned.nonEmployee.toFixed(2)}%
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "disabled" ? null : "disabled")}
                      className="text-right font-medium text-indigo-600 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      {(ownershipSummary.disabledOwned.employee + ownershipSummary.disabledOwned.nonEmployee).toFixed(2)}%
                    </td>
                  </tr>
                  {expandedSummaryRow === "disabled" && (
                    <tr>
                      <td colSpan="4" className="p-3 border border-gray-200 bg-gray-50">
                        <div className="space-y-2">
                          {getEthnicityBreakdownForCategory("disabled").map(({ ethnicity, total }) => (
                            <div key={ethnicity}>
                              <button
                                onClick={() => setExpandedEthnicity(expandedEthnicity === `disabled-${ethnicity}` ? null : `disabled-${ethnicity}`)}
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer mb-1"
                              >
                                {ethnicity} {total.toFixed(2)}%
                              </button>
                              {expandedEthnicity === `disabled-${ethnicity}` && (
                                <div className="space-y-1 ml-4">
                                  {getOwnersByEthnicityAndCategory(ethnicity, "disabled").map((o, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-4 w-4">
                                          <AvatarImage src={o.photoUrl} alt={o.fullName} />
                                          <AvatarFallback className="text-xs">{o.fullName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-gray-700">{o.fullName}</span>
                                      </div>
                                      <span className="text-gray-500">{o.type} • {o.percentage}%</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Disabled Veteran Owned */}
                  <tr>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "disabledVeteran" ? null : "disabledVeteran")}
                      className="text-gray-700 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      Disabled Veteran Owned
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "disabledVeteran" ? null : "disabledVeteran")}
                      className="text-right font-medium text-indigo-600 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      {ownershipSummary.disabledVeteranOwned.employee.toFixed(2)}%
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "disabledVeteran" ? null : "disabledVeteran")}
                      className="text-right font-medium text-indigo-600 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      {ownershipSummary.disabledVeteranOwned.nonEmployee.toFixed(2)}%
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "disabledVeteran" ? null : "disabledVeteran")}
                      className="text-right font-medium text-indigo-600 p-2 border border-gray-200 cursor-pointer hover:bg-gray-50"
                    >
                      {(ownershipSummary.disabledVeteranOwned.employee + ownershipSummary.disabledVeteranOwned.nonEmployee).toFixed(2)}%
                    </td>
                  </tr>
                  {expandedSummaryRow === "disabledVeteran" && (
                    <tr>
                      <td colSpan="4" className="p-3 border border-gray-200 bg-gray-50">
                        <div className="space-y-2">
                          {getEthnicityBreakdownForCategory("disabledVeteran").map(({ ethnicity, total }) => (
                            <div key={ethnicity}>
                              <button
                                onClick={() => setExpandedEthnicity(expandedEthnicity === `disabledVeteran-${ethnicity}` ? null : `disabledVeteran-${ethnicity}`)}
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer mb-1"
                              >
                                {ethnicity} {total.toFixed(2)}%
                              </button>
                              {expandedEthnicity === `disabledVeteran-${ethnicity}` && (
                                <div className="space-y-1 ml-4">
                                  {getOwnersByEthnicityAndCategory(ethnicity, "disabledVeteran").map((o, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-4 w-4">
                                          <AvatarImage src={o.photoUrl} alt={o.fullName} />
                                          <AvatarFallback className="text-xs">{o.fullName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-gray-700">{o.fullName}</span>
                                      </div>
                                      <span className="text-gray-500">{o.type} • {o.percentage}%</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Ethnic Minority & Women Owned */}
                  <tr className="bg-indigo-50">
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "ethnicMinorityAndWomen" ? null : "ethnicMinorityAndWomen")}
                      className="text-gray-900 font-medium p-2 border border-indigo-200 cursor-pointer hover:bg-indigo-100"
                    >
                      Ethnic Minority & Women Owned
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "ethnicMinorityAndWomen" ? null : "ethnicMinorityAndWomen")}
                      className="text-right font-semibold text-indigo-700 p-2 border border-indigo-200 cursor-pointer hover:bg-indigo-100"
                    >
                      {ownershipSummary.ethnicMinorityAndWomenOwned.employee.toFixed(2)}%
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "ethnicMinorityAndWomen" ? null : "ethnicMinorityAndWomen")}
                      className="text-right font-semibold text-indigo-700 p-2 border border-indigo-200 cursor-pointer hover:bg-indigo-100"
                    >
                      {ownershipSummary.ethnicMinorityAndWomenOwned.nonEmployee.toFixed(2)}%
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "ethnicMinorityAndWomen" ? null : "ethnicMinorityAndWomen")}
                      className="text-right font-semibold text-indigo-700 p-2 border border-indigo-200 cursor-pointer hover:bg-indigo-100"
                    >
                      {(ownershipSummary.ethnicMinorityAndWomenOwned.employee + ownershipSummary.ethnicMinorityAndWomenOwned.nonEmployee).toFixed(2)}%
                    </td>
                  </tr>
                  {expandedSummaryRow === "ethnicMinorityAndWomen" && (
                    <tr>
                      <td colSpan="4" className="p-3 border border-indigo-200 bg-indigo-100">
                        <div className="space-y-2">
                          {getEthnicityBreakdownForCategory("ethnicMinorityAndWomen").map(({ ethnicity, total }) => (
                            <div key={ethnicity}>
                              <button
                                onClick={() => setExpandedEthnicity(expandedEthnicity === `ethnicMinorityAndWomen-${ethnicity}` ? null : `ethnicMinorityAndWomen-${ethnicity}`)}
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer mb-1"
                              >
                                {ethnicity} {total.toFixed(2)}%
                              </button>
                              {expandedEthnicity === `ethnicMinorityAndWomen-${ethnicity}` && (
                                <div className="space-y-1 ml-4">
                                  {getOwnersByEthnicityAndCategory(ethnicity, "ethnicMinorityAndWomen").map((o, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-4 w-4">
                                          <AvatarImage src={o.photoUrl} alt={o.fullName} />
                                          <AvatarFallback className="text-xs">{o.fullName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-gray-700">{o.fullName}</span>
                                      </div>
                                      <span className="text-gray-500">{o.type} • {o.percentage}%</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Ethnic Minority & Women & Veteran Owned */}
                  <tr className="bg-indigo-50">
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "ethnicMinorityAndWomenAndVeteran" ? null : "ethnicMinorityAndWomenAndVeteran")}
                      className="text-gray-900 font-medium p-2 border border-indigo-200 cursor-pointer hover:bg-indigo-100"
                    >
                      Ethnic Minority & Women & Veteran Owned
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "ethnicMinorityAndWomenAndVeteran" ? null : "ethnicMinorityAndWomenAndVeteran")}
                      className="text-right font-semibold text-indigo-700 p-2 border border-indigo-200 cursor-pointer hover:bg-indigo-100"
                    >
                      {ownershipSummary.ethnicMinorityAndWomenAndVeteranOwned.employee.toFixed(2)}%
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "ethnicMinorityAndWomenAndVeteran" ? null : "ethnicMinorityAndWomenAndVeteran")}
                      className="text-right font-semibold text-indigo-700 p-2 border border-indigo-200 cursor-pointer hover:bg-indigo-100"
                    >
                      {ownershipSummary.ethnicMinorityAndWomenAndVeteranOwned.nonEmployee.toFixed(2)}%
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "ethnicMinorityAndWomenAndVeteran" ? null : "ethnicMinorityAndWomenAndVeteran")}
                      className="text-right font-semibold text-indigo-700 p-2 border border-indigo-200 cursor-pointer hover:bg-indigo-100"
                    >
                      {(ownershipSummary.ethnicMinorityAndWomenAndVeteranOwned.employee + ownershipSummary.ethnicMinorityAndWomenAndVeteranOwned.nonEmployee).toFixed(2)}%
                    </td>
                  </tr>
                  {expandedSummaryRow === "ethnicMinorityAndWomenAndVeteran" && (
                    <tr>
                      <td colSpan="4" className="p-3 border border-indigo-200 bg-indigo-100">
                        <div className="space-y-2">
                          {getEthnicityBreakdownForCategory("ethnicMinorityAndWomenAndVeteran").map(({ ethnicity, total }) => (
                            <div key={ethnicity}>
                              <button
                                onClick={() => setExpandedEthnicity(expandedEthnicity === `ethnicMinorityAndWomenAndVeteran-${ethnicity}` ? null : `ethnicMinorityAndWomenAndVeteran-${ethnicity}`)}
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer mb-1"
                              >
                                {ethnicity} {total.toFixed(2)}%
                              </button>
                              {expandedEthnicity === `ethnicMinorityAndWomenAndVeteran-${ethnicity}` && (
                                <div className="space-y-1 ml-4">
                                  {getOwnersByEthnicityAndCategory(ethnicity, "ethnicMinorityAndWomenAndVeteran").map((o, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-4 w-4">
                                          <AvatarImage src={o.photoUrl} alt={o.fullName} />
                                          <AvatarFallback className="text-xs">{o.fullName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-gray-700">{o.fullName}</span>
                                      </div>
                                      <span className="text-gray-500">{o.type} • {o.percentage}%</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Ethnic Minority & Women & Disabled Veteran Owned */}
                  <tr className="bg-indigo-50">
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "ethnicMinorityAndWomenAndDisabledVeteran" ? null : "ethnicMinorityAndWomenAndDisabledVeteran")}
                      className="text-gray-900 font-medium p-2 border border-indigo-200 cursor-pointer hover:bg-indigo-100"
                    >
                      Ethnic Minority & Women & Disabled Veteran Owned
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "ethnicMinorityAndWomenAndDisabledVeteran" ? null : "ethnicMinorityAndWomenAndDisabledVeteran")}
                      className="text-right font-semibold text-indigo-700 p-2 border border-indigo-200 cursor-pointer hover:bg-indigo-100"
                    >
                      {ownershipSummary.ethnicMinorityAndWomenAndDisabledVeteranOwned.employee.toFixed(2)}%
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "ethnicMinorityAndWomenAndDisabledVeteran" ? null : "ethnicMinorityAndWomenAndDisabledVeteran")}
                      className="text-right font-semibold text-indigo-700 p-2 border border-indigo-200 cursor-pointer hover:bg-indigo-100"
                    >
                      {ownershipSummary.ethnicMinorityAndWomenAndDisabledVeteranOwned.nonEmployee.toFixed(2)}%
                    </td>
                    <td 
                      onClick={() => setExpandedSummaryRow(expandedSummaryRow === "ethnicMinorityAndWomenAndDisabledVeteran" ? null : "ethnicMinorityAndWomenAndDisabledVeteran")}
                      className="text-right font-semibold text-indigo-700 p-2 border border-indigo-200 cursor-pointer hover:bg-indigo-100"
                    >
                      {(ownershipSummary.ethnicMinorityAndWomenAndDisabledVeteranOwned.employee + ownershipSummary.ethnicMinorityAndWomenAndDisabledVeteranOwned.nonEmployee).toFixed(2)}%
                    </td>
                  </tr>
                  {expandedSummaryRow === "ethnicMinorityAndWomenAndDisabledVeteran" && (
                    <tr>
                      <td colSpan="4" className="p-3 border border-indigo-200 bg-indigo-100">
                        <div className="space-y-2">
                          {getEthnicityBreakdownForCategory("ethnicMinorityAndWomenAndDisabledVeteran").map(({ ethnicity, total }) => (
                            <div key={ethnicity}>
                              <button
                                onClick={() => setExpandedEthnicity(expandedEthnicity === `ethnicMinorityAndWomenAndDisabledVeteran-${ethnicity}` ? null : `ethnicMinorityAndWomenAndDisabledVeteran-${ethnicity}`)}
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer mb-1"
                              >
                                {ethnicity} {total.toFixed(2)}%
                              </button>
                              {expandedEthnicity === `ethnicMinorityAndWomenAndDisabledVeteran-${ethnicity}` && (
                                <div className="space-y-1 ml-4">
                                  {getOwnersByEthnicityAndCategory(ethnicity, "ethnicMinorityAndWomenAndDisabledVeteran").map((o, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-4 w-4">
                                          <AvatarImage src={o.photoUrl} alt={o.fullName} />
                                          <AvatarFallback className="text-xs">{o.fullName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-gray-700">{o.fullName}</span>
                                      </div>
                                      <span className="text-gray-500">{o.type} • {o.percentage}%</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Action Buttons */}
          {!viewMode && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowUpdateForm(false);
                  setSelectedOwnership(null);
                  setOwners([]);
                  setViewMode(true);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveOwnership}
                disabled={!isValidPercentage || addOwnerMutation.isPending || updateOwnershipMutation.isPending}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {addOwnerMutation.isPending || updateOwnershipMutation.isPending ? "Saving..." : "Save Ownership"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Add Contact Dialog */}
      <AddContactDialog
        open={showAddContact}
        onOpenChange={setShowAddContact}
        currentFirmId={firmId}
        firms={[]}
      />

      {/* View/Edit Contact Dialog */}
      {selectedContact && (
        <AddContactDialog
          open={!!selectedContact}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedContact(null);
              queryClient.invalidateQueries({ queryKey: ["contacts"] });
              queryClient.invalidateQueries({ queryKey: ["ownership", firmId] });
            }
          }}
          editingContact={selectedContact}
          firms={[]}
        />
      )}

      {/* Distribute Remaining Weights Dialog */}
      <DistributeRemainingDialog
        open={showDistributeDialog}
        onOpenChange={setShowDistributeDialog}
        owners={owners}
        remaining={Math.max(0, 100 - committedTotal)}
        onConfirm={(additions) => {
          setOwners((prev) =>
            prev.map((o) =>
              additions[o.id]
                ? { ...o, ownership_percentage: parseFloat((parseFloat(o.ownership_percentage || 0) + additions[o.id]).toFixed(2)) }
                : o
            )
          );
          setShowDistributeDialog(false);
        }}
      />

      {/* Delete Ownership Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete ownership record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the ownership breakdown for{" "}
              <strong>{deleteTarget ? format(new Date(deleteTarget.effective_date), "MMM d, yyyy") : ""}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteOwnershipMutation.mutate(deleteTarget.id)}
              disabled={deleteOwnershipMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteOwnershipMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}