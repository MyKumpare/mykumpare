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

  // When opening form with most recent data
  useEffect(() => {
    if (showUpdateForm && mostRecentOwnership) {
      setEffectiveDate(new Date(mostRecentOwnership.effective_date));
      setOwners(mostRecentOwnership.owners || []);
    } else if (showUpdateForm) {
      setEffectiveDate(new Date());
      setOwners([]);
    }
  }, [showUpdateForm, mostRecentOwnership]);

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

  const addOwnerMutation = useMutation({
    mutationFn: (data) => base44.entities.Ownership.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ownership", firmId] });
      setShowUpdateForm(false);
      setOwners([]);
      setSelectedContactId("");
      setOwnershipPercentage("");
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

    addOwnerMutation.mutate({
      firm_id: firmId,
      effective_date: format(effectiveDate, "yyyy-MM-dd"),
      owners,
    });
  };

  const availableContacts = getAvailableContacts(selectedOwnerType);

  return (
    <div className="space-y-4">
      {/* Ownership History */}
      {ownershipHistory.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Ownership History</h3>
          {ownershipHistory.map((breakdown) => (
            <div key={breakdown.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
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
            </div>
          ))}
        </div>
      )}

      {/* Update Ownership Button */}
      <Button
        type="button"
        onClick={() => setShowUpdateForm(!showUpdateForm)}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
      >
        <Plus className="w-4 h-4" />
        Update Ownership
      </Button>

      {/* Update Form */}
      {showUpdateForm && (
        <div className="space-y-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          {/* Date Picker */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Effective Date</Label>
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
          </div>

          {/* Add Owner Section */}
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

          {/* Current Owners List */}
          {owners.length > 0 && (
            <div className="space-y-2 rounded-lg border border-white bg-white p-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-gray-900">Owners ({owners.length})</h4>
                <span className={`text-xs font-medium ${totalOwnershipPercentage === 100 ? "text-green-600" : "text-amber-600"}`}>
                  Total: {totalOwnershipPercentage.toFixed(2)}%
                </span>
              </div>

              {percentageWarning && (
                <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">Total ownership is {totalOwnershipPercentage.toFixed(2)}%, not 100%</p>
                </div>
              )}

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {owners.map((owner) => (
                  <div key={owner.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2 border border-gray-200">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Avatar className="h-6 w-6 flex-shrink-0">
                        <AvatarImage src={owner.contact_photo_url} alt={owner.contact_full_name} />
                        <AvatarFallback className="text-xs">{owner.contact_full_name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{owner.contact_full_name}</p>
                        <p className="text-xs text-gray-500">{owner.owner_type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-medium text-indigo-600 min-w-[3rem] text-right">{owner.ownership_percentage.toFixed(2)}%</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveOwner(owner.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowUpdateForm(false);
                setOwners([]);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveOwnership}
              disabled={!isValidPercentage || addOwnerMutation.isPending}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {addOwnerMutation.isPending ? "Saving..." : "Save Ownership"}
            </Button>
          </div>
        </div>
      )}

      {/* Add Contact Dialog */}
      <AddContactDialog
        open={showAddContact}
        onOpenChange={setShowAddContact}
        currentFirmId={firmId}
        firms={[]}
      />
    </div>
  );
}