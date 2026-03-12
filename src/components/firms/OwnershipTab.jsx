import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Plus, X, AlertCircle, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AddContactDialog from "../contacts/AddContactDialog";

export default function OwnershipTab({ firmId, firmName }) {
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(new Date());
  const [owners, setOwners] = useState([]);
  const [selectedOwnerType, setSelectedOwnerType] = useState("Employee");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [ownershipPercentage, setOwnershipPercentage] = useState("");
  const [showAddContact, setShowAddContact] = useState(false);
  const [addContactType, setAddContactType] = useState("Employee");
  const [selectedOwnership, setSelectedOwnership] = useState(null);
  const [viewMode, setViewMode] = useState(true);
  const [selectedContact, setSelectedContact] = useState(null);
  const [expandedSummaryRow, setExpandedSummaryRow] = useState(null);
  const [expandedEthnicity, setExpandedEthnicity] = useState(null);

  const queryClient = useQueryClient();

  // Fetch contacts for the firm
  const { data: allContacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list(),
  });

  // Fetch ownership history
  const { data: ownershipHistory = [] } = useQuery({
    queryKey: ["ownership", firmId],
    queryFn: () => base44.entities.Ownership.filter({ firm_id: firmId }, "-effective_date"),
  });

  // Get most recent ownership breakdown
  const mostRecentOwnership = ownershipHistory[0];

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

  // Filter contacts by owner type
  const getAvailableContacts = (type) => {
    return firmContacts.filter(c => {
      const isAlreadyOwner = owners.some(o => o.contact_id === c.id);
      return !isAlreadyOwner;
    });
  };

  const totalOwnershipPercentage = owners.reduce((sum, o) => sum + (parseFloat(o.ownership_percentage) || 0), 0);
  const isValidPercentage = totalOwnershipPercentage > 0;
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
      womenOwned: { employee: 0, nonEmployee: 0 },
      ethnicMinorityAndWomenOwned: { employee: 0, nonEmployee: 0 },
      ethnicMinorityAndWomenAndVeteranOwned: { employee: 0, nonEmployee: 0 },
      ethnicMinorityAndWomenAndDisabledVeteranOwned: { employee: 0, nonEmployee: 0 },
    };

    owners.forEach((owner) => {
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

  const ownershipSummary = calculateOwnershipSummary();

  // Helper function to get owners by specific ethnicity
  const getOwnersByEthnicity = (ethnicity) => {
    return owners.filter((owner) => {
      const contact = allContacts.find(c => c.id === owner.contact_id);
      if (!contact) return false;
      return contact.ethnicity && contact.ethnicity.includes(ethnicity);
    }).map(owner => ({
      fullName: owner.contact_full_name,
      photoUrl: owner.contact_photo_url,
      percentage: owner.ownership_percentage,
      type: owner.owner_type,
    }));
  };

  // Get all ethnicities present in ethnic minority owners
  const getEthnicities = () => {
    const ethnicities = new Set();
    const ethnicMinorityOwners = owners.filter((owner) => {
      const contact = allContacts.find(c => c.id === owner.contact_id);
      if (!contact) return false;
      return contact.ethnicity && contact.ethnicity.length > 0 && !contact.ethnicity.includes("Caucasian");
    });
    
    ethnicMinorityOwners.forEach(owner => {
      const contact = allContacts.find(c => c.id === owner.contact_id);
      if (contact && contact.ethnicity) {
        contact.ethnicity.forEach(eth => {
          if (eth !== "Caucasian") ethnicities.add(eth);
        });
      }
    });
    
    return Array.from(ethnicities).sort();
  };

  // Helper function to get ownership composition for a specific category
  const getOwnershipComposition = (category) => {
    const categoryOwners = owners.filter((owner) => {
      const contact = allContacts.find(c => c.id === owner.contact_id);
      if (!contact) return false;

      const isVeteran = contact.veteran_status === "Veteran Owned";
      const isDisabled = contact.disability_status === "Disabled";
      const isEthnicMinority = contact.ethnicity && contact.ethnicity.length > 0 && !contact.ethnicity.includes("Caucasian");
      const isWoman = contact.gender === "Female";

      switch (category) {
        case "ethnicMinority":
          return isEthnicMinority;
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
      setSelectedContactId("");
      setOwnershipPercentage("");
      setViewMode(true);
    },
  });

  const updateOwnershipMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Ownership.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ownership", firmId] });
      setSelectedOwnership(null);
      setOwners([]);
      setSelectedContactId("");
      setOwnershipPercentage("");
      setViewMode(true);
    },
  });

  const handleAddOwner = () => {
    if (!selectedContactId || !ownershipPercentage) return;

    const contact = allContacts.find(c => c.id === selectedContactId);
    if (!contact) return;

    const newOwner = {
      id: crypto.randomUUID(),
      contact_id: selectedContactId,
      owner_type: selectedOwnerType,
      ownership_percentage: parseFloat(ownershipPercentage),
      contact_photo_url: contact.photo_url || "",
      contact_full_name: [contact.salutation, contact.first_name, contact.middle_name, contact.last_name, contact.suffix].filter(Boolean).join(" "),
    };

    setOwners([...owners, newOwner]);
    setSelectedContactId("");
    setOwnershipPercentage("");
  };

  const handleRemoveOwner = (ownerId) => {
    setOwners(owners.filter(o => o.id !== ownerId));
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

  return (
    <div className="space-y-4">
      {/* Ownership History */}
      {ownershipHistory.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Ownership History</h3>
          {ownershipHistory.map((breakdown) => (
            <button
              key={breakdown.id}
              type="button"
              onClick={() => setSelectedOwnership(breakdown)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-indigo-300 transition-colors p-3 space-y-2 text-left"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">
                  {format(new Date(breakdown.effective_date), "MMM d, yyyy")}
                </span>
                {breakdown.id === mostRecentOwnership?.id && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    Most Recent
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {breakdown.owners?.map((owner) => (
                  <div key={owner.id} className="flex items-center gap-1.5 bg-white rounded-full pl-1.5 pr-2.5 py-0.5 border border-gray-200">
                    <Avatar className="h-5 w-5 flex-shrink-0">
                      <AvatarImage src={owner.contact_photo_url} alt={owner.contact_full_name} />
                      <AvatarFallback className="text-xs">{owner.contact_full_name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-gray-700">{owner.contact_full_name}</span>
                    <span className="text-xs font-medium text-indigo-600">{owner.ownership_percentage}%</span>
                  </div>
                ))}
              </div>
            </button>
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

          {/* Add Owner Section - only show in edit mode */}
          {!viewMode && (
            <div className="space-y-3 rounded-lg border border-white bg-white p-3">
              <h4 className="text-xs font-semibold text-gray-900">Add Owner</h4>

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
                        setSelectedContactId("");
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

              {/* Contact Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Contact</Label>
                <div className="flex gap-2">
                  <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                    <SelectTrigger className="h-9 text-sm flex-1">
                      <SelectValue placeholder="Select contact..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableContacts.length === 0 ? (
                        <div className="px-2 py-1.5 text-xs text-gray-500">No {selectedOwnerType.toLowerCase()}s available</div>
                      ) : (
                        availableContacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {[contact.first_name, contact.middle_name, contact.last_name].filter(Boolean).join(" ")}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50 gap-1"
                    onClick={() => {
                      setAddContactType(selectedOwnerType);
                      setShowAddContact(true);
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New
                  </Button>
                </div>
              </div>

              {/* Ownership Percentage */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Ownership %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="0.00"
                  value={ownershipPercentage}
                  onChange={(e) => setOwnershipPercentage(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <Button
                type="button"
                onClick={handleAddOwner}
                disabled={!selectedContactId || !ownershipPercentage}
                className="w-full h-8 text-sm bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Add Owner
              </Button>
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
              <p className="text-xs text-amber-600">{remainingToAllocate.toFixed(2)}% remaining to allocate</p>
            )}
            {totalOwnershipPercentage === 100 && (
              <p className="text-xs text-green-600 font-medium">✓ Ownership fully allocated</p>
            )}
          </div>

          {/* Current Owners List */}
          {owners.length > 0 && (
            <div className="space-y-2 rounded-lg border border-white bg-white p-3">
              <h4 className="text-xs font-semibold text-gray-900">Owners ({owners.length})</h4>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {owners.map((owner) => {
                  const contact = allContacts.find(c => c.id === owner.contact_id);
                  const demographics = [];
                  if (contact?.gender === "Female") demographics.push("Woman");
                  if (contact?.veteran_status === "Veteran Owned") demographics.push("Veteran");
                  if (contact?.disability_status === "Disabled") demographics.push("Disabled");
                  if (contact?.ethnicity && contact.ethnicity.length > 0 && !contact.ethnicity.includes("Caucasian")) {
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
                           <p className="text-xs text-gray-500">{owner.owner_type}</p>
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
              </div>
            </div>
          )}

          {/* Ownership Summary Table */}
          {owners.length > 0 && (
            <div className="space-y-2 rounded-lg border border-white bg-white p-3 overflow-x-auto">
              <h4 className="text-xs font-semibold text-gray-900">Ownership Summary</h4>
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
                          {getEthnicities().map((ethnicity) => (
                            <div key={ethnicity}>
                              <button
                                onClick={() => setExpandedEthnicity(expandedEthnicity === ethnicity ? null : ethnicity)}
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer mb-1"
                              >
                                {ethnicity}
                              </button>
                              {expandedEthnicity === ethnicity && (
                                <div className="space-y-1 ml-4">
                                  {getOwnersByEthnicity(ethnicity).map((o, i) => (
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
                        <div className="space-y-1.5">
                          {getOwnershipComposition("women").map((o, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={o.photoUrl} alt={o.fullName} />
                                  <AvatarFallback className="text-xs">{o.fullName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span className="text-gray-700">{o.fullName}</span>
                              </div>
                              <span className="text-gray-500">{o.type} • {o.percentage}%</span>
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
                        <div className="space-y-1.5">
                          {getOwnershipComposition("veteran").map((o, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={o.photoUrl} alt={o.fullName} />
                                  <AvatarFallback className="text-xs">{o.fullName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span className="text-gray-700">{o.fullName}</span>
                              </div>
                              <span className="text-gray-500">{o.type} • {o.percentage}%</span>
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
                        <div className="space-y-1.5">
                          {getOwnershipComposition("disabled").map((o, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={o.photoUrl} alt={o.fullName} />
                                  <AvatarFallback className="text-xs">{o.fullName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span className="text-gray-700">{o.fullName}</span>
                              </div>
                              <span className="text-gray-500">{o.type} • {o.percentage}%</span>
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
                        <div className="space-y-1.5">
                          {getOwnershipComposition("disabledVeteran").map((o, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={o.photoUrl} alt={o.fullName} />
                                  <AvatarFallback className="text-xs">{o.fullName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span className="text-gray-700">{o.fullName}</span>
                              </div>
                              <span className="text-gray-500">{o.type} • {o.percentage}%</span>
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
                        <div className="space-y-1.5">
                          {getOwnershipComposition("ethnicMinorityAndWomen").map((o, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={o.photoUrl} alt={o.fullName} />
                                  <AvatarFallback className="text-xs">{o.fullName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span className="text-gray-700">{o.fullName}</span>
                              </div>
                              <span className="text-gray-500">{o.type} • {o.percentage}%</span>
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
                        <div className="space-y-1.5">
                          {getOwnershipComposition("ethnicMinorityAndWomenAndVeteran").map((o, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={o.photoUrl} alt={o.fullName} />
                                  <AvatarFallback className="text-xs">{o.fullName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span className="text-gray-700">{o.fullName}</span>
                              </div>
                              <span className="text-gray-500">{o.type} • {o.percentage}%</span>
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
                        <div className="space-y-1.5">
                          {getOwnershipComposition("ethnicMinorityAndWomenAndDisabledVeteran").map((o, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={o.photoUrl} alt={o.fullName} />
                                  <AvatarFallback className="text-xs">{o.fullName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span className="text-gray-700">{o.fullName}</span>
                              </div>
                              <span className="text-gray-500">{o.type} • {o.percentage}%</span>
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
          onOpenChange={(open) => !open && setSelectedContact(null)}
          editingContact={selectedContact}
          firms={[]}
        />
      )}
    </div>
  );
}