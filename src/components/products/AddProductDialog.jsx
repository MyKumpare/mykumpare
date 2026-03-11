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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil } from "lucide-react";

// Map product type -> firm type(s) that can be associated
const PRODUCT_TYPE_TO_FIRM_TYPE = {
  "Investment Manager Product": "Investment Manager",
  "Multi-Manager Product": "Manager of Managers",
};

const PRODUCT_TYPES = ["Investment Manager Product", "Multi-Manager Product"];

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
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [productType, setProductType] = useState("");
  const [firmId, setFirmId] = useState("");
  const [productName, setProductName] = useState("");
  const nameInputRef = useRef(null);

  const isAddMode = !editingProduct;

  useEffect(() => {
    if (open) {
      if (editingProduct) {
        setProductType(editingProduct.product_type);
        setFirmId(editingProduct.firm_id);
        setProductName(editingProduct.name);
        setIsEditing(false);
      } else {
        setProductType(preselectedProductType || "");
        setFirmId(preselectedFirmId || "");
        setProductName("");
        setIsEditing(true);
      }
    }
  }, [editingProduct, open, preselectedProductType, preselectedFirmId]);

  useEffect(() => {
    if (isEditing && editingProduct) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [isEditing]);

  // Reset firm selection when product type changes
  useEffect(() => {
    setFirmId("");
  }, [productType]);

  const eligibleFirms = productType
    ? firms
        .filter((f) => f.firm_type === PRODUCT_TYPE_TO_FIRM_TYPE[productType])
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const hasChanges = editingProduct
    ? productName.trim() !== editingProduct.name ||
      productType !== editingProduct.product_type ||
      firmId !== editingProduct.firm_id
    : false;

  const isDuplicate =
    productName.trim().length > 0 &&
    existingProducts.some((p) => {
      if (p.id === editingProduct?.id) return false;
      const existing = p.name.toLowerCase();
      const input = productName.trim().toLowerCase();
      return existing.includes(input) || input.includes(existing);
    });

  const isValid = productType && firmId && productName.trim() && !isDuplicate;
  const activelyEditing = isAddMode || isEditing;

  const handleSubmit = () => {
    if (!isValid) return;
    const selectedFirm = firms.find((f) => f.id === firmId);
    onSubmit({
      product_type: productType,
      firm_id: firmId,
      firm_name: selectedFirm?.name || "",
      name: productName.trim(),
    });
    setProductType("");
    setFirmId("");
    setProductName("");
  };

  const handleClose = () => {
    onOpenChange(false);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setProductType(editingProduct.product_type);
    setFirmId(editingProduct.firm_id);
    setProductName(editingProduct.name);
    setIsEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
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

        <div className="space-y-5 py-4">
          {/* Product Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Product Type</Label>
            {!activelyEditing || (preselectedProductType && !editingProduct) ? (
              <div className="h-11 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-700 font-medium">
                {productType}
              </div>
            ) : (
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select product type..." />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Associated Firm */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Associated Firm</Label>
            {!activelyEditing ? (
              <div className="h-11 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-700 font-medium">
                {firms.find((f) => f.id === firmId)?.name || "—"}
              </div>
            ) : (
              <>
                <Select
                  value={firmId}
                  onValueChange={setFirmId}
                  disabled={!productType}
                >
                  <SelectTrigger className="h-11">
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
                      <SelectItem key={firm.id} value={firm.id}>
                        {firm.name}
                      </SelectItem>
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
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Product Name</Label>
            {!activelyEditing ? (
              <div className="h-11 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-900 font-medium">
                {productName}
              </div>
            ) : (
              <>
                <Input
                  ref={nameInputRef}
                  placeholder="Enter product name..."
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className={`h-11 ${isDuplicate ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                  onKeyDown={(e) => e.key === "Enter" && isValid && handleSubmit()}
                  spellCheck={true}
                  autoCorrect="on"
                  autoCapitalize="words"
                  lang="en"
                />
                {isDuplicate && (
                  <p className="text-sm text-red-500 mt-1">This Product is Already in the System.</p>
                )}
              </>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
          {/* Left: Delete */}
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

          {/* Right: Actions */}
          <div className="flex gap-2 justify-end">
            {isEditing && !isAddMode ? (
              <>
                <Button variant="outline" onClick={handleCancelEdit}>
                  Cancel
                </Button>
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
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!isValid}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Add Product
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}