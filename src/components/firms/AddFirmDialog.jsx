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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Building2, Plus, Upload, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AddressForm from "./AddressForm";
import PhoneForm from "./PhoneForm";
import ContactsTab from "../contacts/ContactsTab";
import OwnershipTab from "./OwnershipTab";
import OrgChartTab from "./OrgChartTab";
import FirmProductsTab from "./FirmProductsTab";

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

export default function AddFirmDialog({ open, onOpenChange, onSubmit, onDelete, editingFirm, preselectedType, existingFirms = [], defaultTab, defaultOwnershipId, onProductClick }) {
  const [isEditing, setIsEditing] = useState(false);
  const [firmTypes, setFirmTypes] = useState([]);
  const [firmName, setFirmName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [yearFounded, setYearFounded] = useState("");
  const [description, setDescription] = useState("");
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
        // Support both legacy firm_type (string) and new firm_types (array)
        const types = editingFirm.firm_types?.length
          ? editingFirm.firm_types
          : editingFirm.firm_type ? [editingFirm.firm_type] : [];
        setFirmTypes(types);
        setFirmName(editingFirm.name || "");
        setLogoUrl(editingFirm.logo_url || "");
        setWebsite(editingFirm.website || "");
        setLinkedinUrl(editingFirm.linkedin_url || "");
        setYearFounded(editingFirm.year_founded ? String(editingFirm.year_founded) : "");
        setDescription(editingFirm.description || "");
        setAddresses(editingFirm.addresses?.length ? editingFirm.addresses : []);
        setPhones(editingFirm.phones?.length ? editingFirm.phones : []);
        setIsEditing(false);
      } else {
        setFirmTypes(preselectedType ? [preselectedType] : []);
        setFirmName("");
        setLogoUrl("");
        setWebsite("");
        setLinkedinUrl("");
        setYearFounded("");
        setDescription("");
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

  const existingTypes = editingFirm?.firm_types?.length
    ? editingFirm.firm_types
    : editingFirm?.firm_type ? [editingFirm.firm_type] : [];

  const hasChanges = editingFirm
    ? firmName.trim() !== editingFirm.name ||
      JSON.stringify([...firmTypes].sort()) !== JSON.stringify([...existingTypes].sort()) ||
      logoUrl !== (editingFirm.logo_url || "") ||
      website !== (editingFirm.website || "") ||
      linkedinUrl !== (editingFirm.linkedin_url || "") ||
      yearFounded !== (editingFirm.year_founded ? String(editingFirm.year_founded) : "") ||
      description !== (editingFirm.description || "") ||
      JSON.stringify(addresses) !== JSON.stringify(editingFirm.addresses || []) ||
      JSON.stringify(phones) !== JSON.stringify(editingFirm.phones || [])
    : false;

  const phonesValid = phones.length === 0 || phones.every(p => p.address_id && p.phone_type && p.country_code && p.area_code && p.number_mid && p.number_last);

  const isValid = firmTypes.length > 0 && firmName.trim() && !isDuplicate && phonesValid;

  const NON_PRODUCT_TYPES = ["Allocator", "Trade Organizations"];
  const hideProductTabs = firmTypes.length > 0 && firmTypes.every(t => NON_PRODUCT_TYPES.includes(t));

  const handleSubmit = () => {
    if (!isValid) return;
    onSubmit({ firm_type: firmTypes[0] || "", firm_types: firmTypes, name: firmName.trim(), logo_url: logoUrl, website, linkedin_url: linkedinUrl, year_founded: yearFounded ? parseInt(yearFounded) : null, description, addresses, phones });
    setFirmTypes([]); setFirmName(""); setLogoUrl(""); setWebsite(""); setLinkedinUrl(""); setYearFounded(""); setDescription(""); setAddresses([]); setPhones([]);
  };

  const handleClose = () => {
    onOpenChange(false);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setFirmTypes(editingFirm.firm_types?.length ? editingFirm.firm_types : editingFirm.firm_type ? [editingFirm.firm_type] : []);
    setFirmName(editingFirm.name);
    setLogoUrl(editingFirm.logo_url || "");
    setWebsite(editingFirm.website || "");
    setLinkedinUrl(editingFirm.linkedin_url || "");
    setYearFounded(editingFirm.year_founded ? String(editingFirm.year_founded) : "");
    setDescription(editingFirm.description || "");
    setAddresses(editingFirm.addresses || []);
    setPhones(editingFirm.phones || []);
    setIsEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
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

              {/* Website */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Website</Label>
                {!activelyEditing ? (
                  <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-600">
                    {website ? <a href={website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">{website}</a> : <span className="text-gray-400">—</span>}
                  </div>
                ) : (
                  <Input
                    placeholder="https://example.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="h-9"
                  />
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
                  <Input
                    placeholder="https://linkedin.com/company/..."
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    className="h-9"
                  />
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
             <TabsList className="grid w-full grid-cols-3">
               <TabsTrigger value="contacts">Contacts</TabsTrigger>
               <TabsTrigger value="addresses">Addresses</TabsTrigger>
               <TabsTrigger value="phones">Phones</TabsTrigger>
             </TabsList>
             {!hideProductTabs && (
             <TabsList className="grid w-full grid-cols-3 mt-1">
               <TabsTrigger value="products">Products</TabsTrigger>
               <TabsTrigger value="ownership">Ownership</TabsTrigger>
               <TabsTrigger value="orgchart">Org Chart</TabsTrigger>
             </TabsList>
             )}
             {hideProductTabs && (
             <TabsList className="grid w-full grid-cols-1 mt-1">
               <TabsTrigger value="orgchart">Org Chart</TabsTrigger>
             </TabsList>
             )}

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
                              <div key={ph.id}>
                                <div onClick={() => !isExpanded && setExpandedPhoneId(ph.id)} className={!isExpanded ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}>
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
                                {isExpanded && (
                                  <div className="flex gap-2 mt-2 px-4">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 text-xs"
                                      onClick={() => setExpandedPhoneId(null)}
                                    >
                                      Done
                                    </Button>
                                  </div>
                                )}
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

              <TabsContent value="products" className="space-y-3">
              {editingFirm ? (
                <FirmProductsTab firmId={editingFirm.id} firmName={editingFirm.name} firms={existingFirms} />
              ) : (
                <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
                  Save the firm first to add products
                </div>
              )}
              </TabsContent>

              <TabsContent value="ownership" className="space-y-3">
              {editingFirm ? (
                <OwnershipTab firmId={editingFirm.id} firmName={editingFirm.name} defaultOwnershipId={defaultOwnershipId} />
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
             );
           })()}
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