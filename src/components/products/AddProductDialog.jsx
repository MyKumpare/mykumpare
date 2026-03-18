import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil } from "lucide-react";
import ProductClassificationsTab from "./ProductClassificationsTab";
import ProductInvestmentTeamTab from "./ProductInvestmentTeamTab";
import ProductInvestmentDescriptionTab from "./ProductInvestmentDescriptionTab";

// Map product type -> firm type(s) that can be associated
const PRODUCT_TYPE_TO_FIRM_TYPE = {
  "Investment Manager Product": "Investment Manager",
  "Multi-Manager Product": "Manager of Managers",
};

const PRODUCT_TYPES = ["Investment Manager Product", "Multi-Manager Product"];

const EMPTY_CLASSIFICATIONS = {
  asset_class: "",
  geography: "",
  market_cap: "",
  style: "",
  investment_process: "",
  implementation_process: "",
  aapryl_style: "",
  vehicle_offerings: [],
};

function classificationsFromProduct(p) {
  if (!p) return EMPTY_CLASSIFICATIONS;
  return {
    asset_class: p.asset_class || "",
    geography: p.geography || "",
    market_cap: p.market_cap || "",
    style: p.style || "",
    investment_process: p.investment_process || "",
    implementation_process: p.implementation_process || "",
    aapryl_style: p.aapryl_style || "",
    vehicle_offerings: p.vehicle_offerings || [],
  };
}

export default function AddProductDialog({
  open,
  onOpenChange,
  onSubmit,
  onDelete,
  editingProduct,
  firms = [],
  existingProducts = [],
  preselectedProductType = null,
  preselectedFirmId = null,
  onFirmClick = null,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [productType, setProductType] = useState("");
  const [firmId, setFirmId] = useState("");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [classifications, setClassifications] = useState(EMPTY_CLASSIFICATIONS);
  const [investmentDescriptions, setInvestmentDescriptions] = useState({});
  const nameInputRef = useRef(null);

  const isAddMode = !editingProduct;
  const activelyEditing = isAddMode || isEditing;

  useEffect(() => {
    if (open) {
      if (editingProduct) {
        setProductType(editingProduct.product_type);
        setFirmId(editingProduct.firm_id);
        setProductName(editingProduct.name);
        setDescription(editingProduct.description || "");
        setClassifications(classificationsFromProduct(editingProduct));
        setInvestmentDescriptions({
          investment_philosophy: editingProduct.inv_desc_philosophy || "",
          investment_process: editingProduct.inv_desc_process || "",
        });
        setIsEditing(false);
      } else {
        setProductType(preselectedProductType || "");
        setFirmId(preselectedFirmId || "");
        setProductName("");
        setDescription("");
        setClassifications(EMPTY_CLASSIFICATIONS);
        setInvestmentDescriptions({});
        setIsEditing(true);
      }
    }
  }, [editingProduct, open, preselectedProductType, preselectedFirmId]);

  useEffect(() => {
    if (isEditing && editingProduct) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [isEditing]);

  // Reset firm selection when product type changes (but not when it's preselected)
  useEffect(() => {
    if (!preselectedFirmId) {
      setFirmId("");
    }
  }, [productType]);

  const eligibleFirms = productType
    ? firms
        .filter((f) => f.firm_type === PRODUCT_TYPE_TO_FIRM_TYPE[productType])
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const hasChanges = editingProduct
    ? productName.trim() !== editingProduct.name ||
      productType !== editingProduct.product_type ||
      firmId !== editingProduct.firm_id ||
      description !== (editingProduct.description || "") ||
      JSON.stringify(classifications) !== JSON.stringify(classificationsFromProduct(editingProduct))
    : false;

  const matchingProducts =
    productName.trim().length >= 2
      ? existingProducts.filter((p) => {
          if (p.id === editingProduct?.id) return false;
          const existing = p.name.toLowerCase();
          const input = productName.trim().toLowerCase();
          return existing.includes(input) || input.includes(existing);
        })
      : [];

  const isDuplicate = matchingProducts.length > 0;

  const isValid = productType && firmId && productName.trim() && !isDuplicate;

  const handleSubmit = () => {
    if (!isValid) return;
    const selectedFirm = firms.find((f) => f.id === firmId);
    onSubmit({
      product_type: productType,
      firm_id: firmId,
      firm_name: selectedFirm?.name || "",
      name: productName.trim(),
      description,
      ...classifications,
      inv_desc_philosophy: investmentDescriptions.investment_philosophy || "",
      inv_desc_process: investmentDescriptions.investment_process || "",
    });
    setProductType("");
    setFirmId("");
    setProductName("");
    setDescription("");
    setClassifications(EMPTY_CLASSIFICATIONS);
  };

  const handleClose = () => {
    onOpenChange(false);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setProductType(editingProduct.product_type);
    setFirmId(editingProduct.firm_id);
    setProductName(editingProduct.name);
    setDescription(editingProduct.description || "");
    setClassifications(classificationsFromProduct(editingProduct));
    setInvestmentDescriptions({
      investment_philosophy: editingProduct.inv_desc_philosophy || "",
      investment_process: editingProduct.inv_desc_process || "",
    });
    setIsEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-xl font-semibold">
              {isAddMode ? "Add Product" : "Product Details"}
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

        {/* Sticky product name banner (view mode only) */}
        {!isAddMode && productName && (
          <div className="px-1 pb-2 border-b mb-1">
            <p className="text-sm font-semibold text-indigo-700 truncate">{productName}</p>
            {(editingProduct?.firm_name || firms.find((f) => f.id === firmId)?.name) && (() => {
              const firmName = editingProduct?.firm_name || firms.find((f) => f.id === firmId)?.name;
              const firm = firms.find((f) => f.id === firmId || f.name === editingProduct?.firm_name);
              return onFirmClick && firm ? (
                <button
                  type="button"
                  onClick={() => onFirmClick(firm)}
                  className="text-xs text-indigo-500 hover:underline hover:text-indigo-700 truncate text-left"
                >
                  {firmName}
                </button>
              ) : (
                <p className="text-xs text-gray-400 truncate">{firmName}</p>
              );
            })()}
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-1">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-1">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="classifications">Classifications</TabsTrigger>
            </TabsList>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="description">Inv. Description</TabsTrigger>
              <TabsTrigger value="team" disabled={isAddMode}>Investment Team</TabsTrigger>
            </TabsList>

            {/* ── Details Tab ── */}
            <TabsContent value="details" className="space-y-4">
              {/* Product Type */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Product Type</Label>
                {!activelyEditing || (preselectedProductType && !editingProduct) ? (
                  <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-700 font-medium">
                    {productType}
                  </div>
                ) : (
                  <Select value={productType} onValueChange={setProductType}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select product type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Associated Firm */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Associated Firm</Label>
                {!activelyEditing || (preselectedFirmId && !editingProduct) ? (
                  <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-700 font-medium">
                    {editingProduct?.firm_name || firms.find((f) => f.id === firmId)?.name || "—"}
                  </div>
                ) : (
                  <>
                    <Select value={firmId} onValueChange={setFirmId} disabled={!productType}>
                      <SelectTrigger className="h-9">
                        <SelectValue
                          placeholder={
                            !productType
                              ? "Select a product type first..."
                              : eligibleFirms.length === 0
                              ? `No ${PRODUCT_TYPE_TO_FIRM_TYPE[productType]} firms available`
                              : "Select a firm..."
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {eligibleFirms.map((firm) => (
                          <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {productType && eligibleFirms.length === 0 && (
                      <p className="text-sm text-amber-600 mt-1">
                        No {PRODUCT_TYPE_TO_FIRM_TYPE[productType]} firms found. Add one first.
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Product Name */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Product Name</Label>
                {!activelyEditing ? (
                  <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-900 font-medium">
                    {productName}
                  </div>
                ) : (
                  <>
                    <Input
                      ref={nameInputRef}
                      placeholder="Enter product name..."
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      className={`h-9 ${isDuplicate ? "border-amber-400 focus-visible:ring-amber-400" : ""}`}
                      onKeyDown={(e) => e.key === "Enter" && isValid && handleSubmit()}
                      spellCheck={true}
                      autoCorrect="on"
                      autoCapitalize="words"
                      lang="en"
                    />
                    {matchingProducts.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        <p className="text-xs font-medium text-amber-600">
                          Similar product{matchingProducts.length > 1 ? "s" : ""} already in the system:
                        </p>
                        {matchingProducts.map((p) => (
                          <div key={p.id} className="flex items-start gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                              {p.firm_name && <p className="text-xs text-gray-500 truncate">{p.firm_name}</p>}
                              {p.product_type && <p className="text-xs text-gray-400 truncate">{p.product_type}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Description</Label>
                {!activelyEditing ? (
                  <div className="px-3 py-2 rounded-md border bg-gray-50 text-sm text-gray-700 min-h-[72px] whitespace-pre-wrap">
                    {description || <span className="text-gray-400">—</span>}
                  </div>
                ) : (
                  <Textarea
                    placeholder="Enter product description..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-[72px]"
                  />
                )}
              </div>
            </TabsContent>

            {/* ── Classifications Tab ── */}
            <TabsContent value="classifications">
              <ProductClassificationsTab
                classifications={classifications}
                onChange={setClassifications}
                isEditing={activelyEditing}
              />
            </TabsContent>

            {/* ── Investment Description Tab ── */}
            <TabsContent value="description">
              <ProductInvestmentDescriptionTab
                descriptions={investmentDescriptions}
                onChange={setInvestmentDescriptions}
                isEditing={activelyEditing}
              />
            </TabsContent>

            {/* ── Investment Team Tab ── */}
            <TabsContent value="team">
              {editingProduct && (
                <ProductInvestmentTeamTab
                  productId={editingProduct.id}
                  firmId={editingProduct.firm_id}
                  isEditing={activelyEditing}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2 border-t">
          <div>
            {editingProduct && onDelete && (
              <Button
                variant="ghost"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 w-full sm:w-auto"
                onClick={() => { handleClose(); onDelete(editingProduct); }}
              >
                Delete Product
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
                <Button
                  onClick={handleSubmit}
                  disabled={!isValid}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Add Product
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