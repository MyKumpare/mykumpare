import React, { useState, useEffect, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Pencil, Building2, Plus, Upload, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AddressForm from "./AddressForm";
import PhoneForm from "./PhoneForm";

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

export default function AddFirmDialog({ open, onOpenChange, onSubmit, onDelete, editingFirm, preselectedType, existingFirms = [] }) {
  const [isEditing, setIsEditing] = useState(false);
  const [firmType, setFirmType] = useState("");
  const [firmName, setFirmName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [addresses, setAddresses] = useState([]);
  const [phones, setPhones] = useState([]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [expandedPhoneId, setExpandedPhoneId] = useState(null);
  const nameInputRef = useRef(null);
  const logoInputRef = useRef(null);

  const isAddMode = !editingFirm;
  const activelyEditing = isAddMode || isEditing;

  useEffect(() => {
    if (open) {
      setExpandedPhoneId(null);
      if (editingFirm) {
        setFirmType(editingFirm.firm_type || "");
        setFirmName(editingFirm.name || "");
        setLogoUrl(editingFirm.logo_url || "");
        setAddresses(editingFirm.addresses?.length ? editingFirm.addresses : []);
        setPhones(editingFirm.phones?.length ? editingFirm.phones : []);
        setIsEditing(false);
      } else {
        setFirmType(preselectedType || "");
        setFirmName("");
        setLogoUrl("");
        setAddresses([]);
        setPhones([]);
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

  const isDuplicate = firmName.trim().length > 0 &&
    existingFirms.some((f) => {
      if (f.id === editingFirm?.id) return false;
      const existing = f.name.toLowerCase();
      const input = firmName.trim().toLowerCase();
      return existing.includes(input) || input.includes(existing);
    });

  const hasChanges = editingFirm
    ? firmName.trim() !== editingFirm.name ||
      firmType !== editingFirm.firm_type ||
      logoUrl !== (editingFirm.logo_url || "") ||
      JSON.stringify(addresses) !== JSON.stringify(editingFirm.addresses || []) ||
      JSON.stringify(phones) !== JSON.stringify(editingFirm.phones || [])
    : false;

  const phonesValid = phones.length === 0 || phones.every(p => p.address_id && p.phone_type && p.country_code && p.area_code && p.number_mid && p.number_last);

  const isValid = firmType && firmName.trim() && !isDuplicate && phonesValid;

  const handleSubmit = () => {
    if (!isValid) return;
    onSubmit({ firm_type: firmType, name: firmName.trim(), logo_url: logoUrl, addresses, phones });
    setFirmType(""); setFirmName(""); setLogoUrl(""); setAddresses([]); setPhones([]);
  };

  const handleClose = () => {
    onOpenChange(false);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setFirmType(editingFirm.firm_type);
    setFirmName(editingFirm.name);
    setLogoUrl(editingFirm.logo_url || "");
    setAddresses(editingFirm.addresses || []);
    setPhones(editingFirm.phones || []);
    setIsEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-xl font-semibold">
              {isAddMode ? "Add Firm" : "Firm Details"}
            </DialogTitle>
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

          {/* Logo + Firm Name row */}
          <div className="flex items-end gap-4">
            {/* Logo */}
            <div className="flex-shrink-0 space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Logo</Label>
              <div
                className={`w-16 h-16 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors ${activelyEditing ? "cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 border-gray-300" : "border-gray-200 bg-gray-50"}`}
                onClick={() => activelyEditing && logoInputRef.current?.click()}
              >
                {uploadingLogo ? (
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                ) : logoUrl ? (
                  <img src={logoUrl} alt="logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <div className="flex flex-col items-center gap-0.5">
                    {activelyEditing ? (
                      <Upload className="w-5 h-5 text-gray-400" />
                    ) : (
                      <Building2 className="w-5 h-5 text-gray-300" />
                    )}
                  </div>
                )}
              </div>
              {activelyEditing && logoUrl && (
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

            {/* Firm name + type */}
            <div className="flex-1 space-y-3">
              {/* Firm Type */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Type of Firm</Label>
                {!activelyEditing || (preselectedType && !editingFirm) ? (
                  <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-700 font-medium">
                    {firmType}
                  </div>
                ) : (
                  <Select value={firmType} onValueChange={setFirmType}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select firm type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {FIRM_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Firm Name */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Firm Name</Label>
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
                      className={`h-9 ${isDuplicate ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                      onKeyDown={(e) => e.key === "Enter" && isValid && handleSubmit()}
                      spellCheck autoCorrect="on" autoCapitalize="words" lang="en"
                    />
                    {isDuplicate && (
                      <p className="text-xs text-red-500">The Firm is Already in the System.</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Contact / Addresses Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-gray-700">Addresses</Label>
              {activelyEditing && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
                  onClick={handleAddAddress}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Address
                </Button>
              )}
            </div>

            {addresses.length === 0 && (
              <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
                {activelyEditing ? 'Click "Add Address" to add a location' : "No addresses added"}
              </div>
            )}

            <div className="space-y-3">
              {addresses.map((addr, i) => (
                <AddressForm
                  key={addr.id}
                  address={addr}
                  onChange={(updated) => handleAddressChange(i, updated)}
                  onDelete={() => handleDeleteAddress(i)}
                  onSetHeadquarters={() => handleSetHeadquarters(i)}
                  isHeadquarters={addr.is_headquarters}
                  isEditing={activelyEditing}
                  isOnly={addresses.length === 1}
                />
              ))}
            </div>
          </div>

          {/* Phone Numbers Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-gray-700">Phone Numbers</Label>
              {activelyEditing && addresses.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
                  onClick={handleAddPhone}
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
              <div className="space-y-3">
                {phones.map((ph, i) => (
                  <PhoneForm
                    key={ph.id}
                    phone={ph}
                    onChange={(updated) => handlePhoneChange(i, updated)}
                    onDelete={() => handleDeletePhone(i)}
                    onSetDefault={() => handleSetDefaultPhone(i)}
                    isDefault={ph.is_default}
                    isEditing={activelyEditing}
                    isOnly={phones.length === 1}
                    addresses={addresses}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {addresses.map((addr) => {
                  const addressPhones = phones.filter(p => p.address_id === addr.id);
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
                         ⚠️ Phones without address - click to fix
                       </div>
                       <div className="space-y-2">
                         {orphanedPhones.map((ph) => {
                           const phoneIndex = phones.findIndex(p => p.id === ph.id);
                           const isExpanded = expandedPhoneId === ph.id;
                           return (
                             <div key={ph.id} onClick={() => setExpandedPhoneId(isExpanded ? null : ph.id)} className="cursor-pointer hover:opacity-80 transition-opacity">
                               <PhoneForm
                                 phone={ph}
                                 onChange={(updated) => handlePhoneChange(phoneIndex, updated)}
                                 onDelete={() => handleDeletePhone(phoneIndex)}
                                 onSetDefault={() => handleSetDefaultPhone(phoneIndex)}
                                 isDefault={ph.is_default}
                                 isEditing={isExpanded}
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
          </div>
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
                  className={`text-white transition-all ${hasChanges && isValid ? "bg-indigo-600 hover:bg-indigo-700 shadow-md" : "bg-indigo-300"}`}
                >
                  Save Changes
                </Button>
              </>
            ) : isAddMode ? (
              <>
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={!isValid} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  Add Firm
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={handleClose}>Close</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}