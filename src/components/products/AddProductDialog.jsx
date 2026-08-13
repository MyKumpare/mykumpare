import React, { useState, useEffect, useRef, useMemo } from "react";
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
import { Pencil, X, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import ProductClassificationsTab from "./ProductClassificationsTab";
import ProductInvestmentTeamTab from "./ProductInvestmentTeamTab";
import ProductInvestmentDescriptionTab from "./ProductInvestmentDescriptionTab";
import ProductReturnsTab from "./ProductReturnsTab";
import ProductAumHistoryTab from "./ProductAumHistoryTab";
import ProductAnalyticsTab from "./ProductAnalyticsTab";
import ProductDueDiligenceTab from "./ProductDueDiligenceTab";
import ConstituentProductMultiSelect from "./ConstituentProductMultiSelect";
import AddIMProductValidatedDialog from "./AddIMProductValidatedDialog";
import ProductStatusBadge from "./ProductStatusBadge";
import { base44 } from "@/api/base44Client";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

// Map product type -> firm type(s) that can be associated
const PRODUCT_TYPE_TO_FIRM_TYPE = {
  "Investment Manager Product": "Investment Manager",
  "Multi-Manager Product": "Manager of Managers",
};

const PRODUCT_TYPES = ["Investment Manager Product", "Multi-Manager Product"];

const PRODUCT_STATUSES = ["Not Reviewed", "On-Hold", "Rejected", "Approved", "Removed"];

const PRODUCT_STATUS_STYLES = {
  "Not Reviewed": "bg-gray-100 text-gray-700",
  "On-Hold": "bg-amber-100 text-amber-700",
  "Rejected": "bg-red-100 text-red-700",
  "Approved": "bg-emerald-100 text-emerald-700",
  "Removed": "bg-red-100 text-red-700",
};

// Capitalize the first letter of each word in a product name (preserves acronyms/numbers like "S&P 500").
function titleCaseProductName(str) {
  return str.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

const EMPTY_CLASSIFICATIONS = {
  asset_class: "",
  geography: "",
  market_cap: "",
  style: "",
  investment_process: "",
  implementation_process: "",
  diversification_classification: "",
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
    diversification_classification: p.diversification_classification || "",
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
  isSaving = false,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [productType, setProductType] = useState("");
  const [firmId, setFirmId] = useState("");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [productStatus, setProductStatus] = useState("Not Reviewed");
  const [classifications, setClassifications] = useState(EMPTY_CLASSIFICATIONS);
  const [investmentDescriptions, setInvestmentDescriptions] = useState({});
  const [constituentProductIds, setConstituentProductIds] = useState([]);
  const [addImProductOpen, setAddImProductOpen] = useState(false);
  const [aumDirty, setAumDirty] = useState(false);
  const aumSaveRef = useRef(null);
  const queryClient = useQueryClient();
  const nameInputRef = useRef(null);
  // Snapshot of original values captured when the dialog opens — prevents stale prop re-renders from resetting the form
  const originalSnapshotRef = useRef(null);

  const isAddMode = !editingProduct;
  const activelyEditing = isAddMode || isEditing;

  const prevOpenRef = useRef(false);
  useEffect(() => {
    const justOpened = open && !prevOpenRef.current;
    prevOpenRef.current = open;
    if (!justOpened) return;

    if (editingProduct) {
      const snapshot = {
        product_type: editingProduct.product_type,
        firm_id: editingProduct.firm_id,
        name: editingProduct.name,
        description: editingProduct.description || "",
        product_status: editingProduct.product_status || "Not Reviewed",
        classifications: classificationsFromProduct(editingProduct),
        descriptions: {
          investment_edge: editingProduct.inv_desc_edge || "",
          investment_philosophy: editingProduct.inv_desc_philosophy || "",
          investment_universe: editingProduct.inv_desc_universe || "",
          investment_process: editingProduct.inv_desc_process || "",
          investment_process_buy_discipline: editingProduct.inv_desc_process_buy_discipline || "",
          investment_process_sell_discipline: editingProduct.inv_desc_process_sell_discipline || "",
          market_positioning: editingProduct.inv_desc_market_positioning || [],
          benchmarks: (editingProduct.inv_desc_benchmarks || []).map(b => typeof b === "string" ? { id: b, role: "" } : b),
          portfolio_expectations: editingProduct.inv_desc_portfolio_expectations || "",
          tracking_error_min: editingProduct.inv_desc_tracking_error_min ?? "",
          tracking_error_max: editingProduct.inv_desc_tracking_error_max ?? "",
          excess_return_min: editingProduct.inv_desc_excess_return_min ?? "",
          excess_return_max: editingProduct.inv_desc_excess_return_max ?? "",
          information_ratio_min: editingProduct.inv_desc_information_ratio_min ?? "",
          information_ratio_max: editingProduct.inv_desc_information_ratio_max ?? "",
          holdings_min: editingProduct.inv_desc_holdings_min ?? "",
          holdings_max: editingProduct.inv_desc_holdings_max ?? "",
          product_biases: editingProduct.inv_desc_product_biases || {},
        },
        constituent_product_ids: editingProduct.constituent_product_ids || [],
      };
      originalSnapshotRef.current = snapshot;
      setProductType(snapshot.product_type);
      setFirmId(snapshot.firm_id);
      setProductName(snapshot.name);
      setDescription(snapshot.description);
      setProductStatus(snapshot.product_status);
      setClassifications(snapshot.classifications);
      setInvestmentDescriptions(snapshot.descriptions);
      setConstituentProductIds(snapshot.constituent_product_ids);
      setIsEditing(false);
    } else {
      originalSnapshotRef.current = null;
      setProductType(preselectedProductType || "");
      setFirmId(preselectedFirmId || "");
      setProductName("");
      setDescription("");
      setProductStatus("Not Reviewed");
      setClassifications(EMPTY_CLASSIFICATIONS);
      setInvestmentDescriptions({});
      setConstituentProductIds([]);
      setIsEditing(true);
    }
  }, [open]);

  useEffect(() => {
    if (isEditing && editingProduct) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [isEditing]);

  const [pendingProductTypeChange, setPendingProductTypeChange] = useState(null);
  const [showFirmChangeWarning, setShowFirmChangeWarning] = useState(false);
  const [pendingFirmId, setPendingFirmId] = useState(null);

  const handleProductTypeChange = (newType) => {
    if (isEditing && editingProduct && newType !== productType) {
      setPendingProductTypeChange(newType);
    } else if (!preselectedFirmId && !editingProduct) {
      setProductType(newType);
      setFirmId("");
    } else {
      setProductType(newType);
    }
  };

  const confirmProductTypeChange = () => {
    setProductType(pendingProductTypeChange);
    setFirmId("");
    setPendingProductTypeChange(null);
  };

  const handleFirmChange = (newFirmId) => {
    if (isEditing && editingProduct && newFirmId !== firmId) {
      setPendingFirmId(newFirmId);
      setShowFirmChangeWarning(true);
    } else {
      setFirmId(newFirmId);
    }
  };

  const confirmFirmChange = () => {
    setFirmId(pendingFirmId);
    setPendingFirmId(null);
    setShowFirmChangeWarning(false);
  };

  const eligibleFirms = productType
    ? firms
        .filter((f) => f.firm_type === PRODUCT_TYPE_TO_FIRM_TYPE[productType])
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  // IM products available as constituents for a Multi-Manager Product
  const imProductOptions = useMemo(() => {
    const getFirmTypes = (f) =>
      f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];
    const imFirmIds = new Set(
      firms.filter((f) => getFirmTypes(f).includes("Investment Manager")).map((f) => f.id)
    );
    return existingProducts
      .filter((p) => p.product_type === "Investment Manager Product" && imFirmIds.has(p.firm_id) && !p.deleted_at)
      .map((p) => ({ value: p.id, label: p.name, firm_name: p.firm_name || "" }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [firms, existingProducts]);

  const originalDescriptions = originalSnapshotRef.current?.descriptions ?? {};

  const hasChanges = originalSnapshotRef.current
    ? productName.trim() !== originalSnapshotRef.current.name ||
      productType !== originalSnapshotRef.current.product_type ||
      firmId !== originalSnapshotRef.current.firm_id ||
      description !== originalSnapshotRef.current.description ||
      productStatus !== (originalSnapshotRef.current.product_status || "Not Reviewed") ||
      JSON.stringify(constituentProductIds) !== JSON.stringify(originalSnapshotRef.current.constituent_product_ids || []) ||
      JSON.stringify(classifications) !== JSON.stringify(originalSnapshotRef.current.classifications) ||
      JSON.stringify(investmentDescriptions.product_biases ?? {}) !== JSON.stringify(originalDescriptions.product_biases ?? {}) ||
      JSON.stringify(investmentDescriptions.benchmarks ?? []) !== JSON.stringify(originalDescriptions.benchmarks ?? []) ||
      Object.keys({ ...originalDescriptions, ...investmentDescriptions }).some(
        (k) => k !== "product_biases" && k !== "benchmarks" && String(investmentDescriptions[k] ?? "") !== String(originalDescriptions[k] ?? "")
      )
    : false;

  // In add mode, any entered data counts as unsaved changes.
  const hasUnsavedChanges = hasChanges || (isAddMode && !!(
    productName.trim() || productType || firmId || description ||
    productStatus !== "Not Reviewed" ||
    JSON.stringify(classifications) !== JSON.stringify(EMPTY_CLASSIFICATIONS) ||
    Object.keys(investmentDescriptions).length > 0 ||
    constituentProductIds.length > 0
  ));

  const matchingProducts =
    productName.trim().length >= 2
      ? existingProducts.filter((p) => {
          if (p.id === editingProduct?.id) return false;
          if (firmId && p.firm_id !== firmId) return false;
          const existing = p.name.toLowerCase();
          const input = productName.trim().toLowerCase();
          return existing.includes(input) || input.includes(existing);
        })
      : [];

  const isDuplicate = matchingProducts.length > 0;

  // For existing products being edited, firmId from the snapshot is always valid even if eligibleFirms is empty
  const isValid = productType && firmId && productName.trim() && !isDuplicate;

  const handleSubmit = () => {
    if (!isValid) return;
    const selectedFirm = firms.find((f) => f.id === firmId);
    onSubmit({
      product_type: productType,
      firm_id: firmId,
      firm_name: selectedFirm?.name || "",
      name: isAddMode ? titleCaseProductName(productName.trim()) : productName.trim(),
      description,
      product_status: productStatus,
      ...classifications,
      inv_desc_edge: investmentDescriptions.investment_edge || "",
      inv_desc_philosophy: investmentDescriptions.investment_philosophy || "",
      inv_desc_universe: investmentDescriptions.investment_universe || "",
      inv_desc_process: investmentDescriptions.investment_process || "",
      inv_desc_process_buy_discipline: investmentDescriptions.investment_process_buy_discipline || "",
      inv_desc_process_sell_discipline: investmentDescriptions.investment_process_sell_discipline || "",
      inv_desc_market_positioning: investmentDescriptions.market_positioning || [],
      inv_desc_benchmarks: (investmentDescriptions.benchmarks || []).map(b => typeof b === "string" ? { id: b, role: "" } : b),
      inv_desc_portfolio_expectations: investmentDescriptions.portfolio_expectations || "",
      inv_desc_tracking_error_min: investmentDescriptions.tracking_error_min !== "" ? Number(investmentDescriptions.tracking_error_min) : null,
      inv_desc_tracking_error_max: investmentDescriptions.tracking_error_max !== "" ? Number(investmentDescriptions.tracking_error_max) : null,
      inv_desc_excess_return_min: investmentDescriptions.excess_return_min !== "" ? Number(investmentDescriptions.excess_return_min) : null,
      inv_desc_excess_return_max: investmentDescriptions.excess_return_max !== "" ? Number(investmentDescriptions.excess_return_max) : null,
      inv_desc_information_ratio_min: investmentDescriptions.information_ratio_min !== "" ? Number(investmentDescriptions.information_ratio_min) : null,
      inv_desc_information_ratio_max: investmentDescriptions.information_ratio_max !== "" ? Number(investmentDescriptions.information_ratio_max) : null,
      inv_desc_holdings_min: investmentDescriptions.holdings_min !== "" ? Number(investmentDescriptions.holdings_min) : null,
      inv_desc_holdings_max: investmentDescriptions.holdings_max !== "" ? Number(investmentDescriptions.holdings_max) : null,
      inv_desc_product_biases: investmentDescriptions.product_biases || {},
      constituent_product_ids: productType === "Multi-Manager Product" ? constituentProductIds : [],
    });
    setProductType("");
    setFirmId("");
    setProductName("");
    setDescription("");
    setProductStatus("Not Reviewed");
    setClassifications(EMPTY_CLASSIFICATIONS);
    setConstituentProductIds([]);
  };

  const handleClose = () => {
    onOpenChange(false);
    setIsEditing(false);
  };

  const { guardedClose, guardDialog } = useUnsavedChangesGuard(hasUnsavedChanges, handleClose, handleSubmit);

  const handleCancelEdit = () => {
    const snap = originalSnapshotRef.current;
    if (!snap) return;
    setProductType(snap.product_type);
    setFirmId(snap.firm_id);
    setProductName(snap.name);
    setDescription(snap.description);
    setProductStatus(snap.product_status);
    setClassifications(snap.classifications);
    setInvestmentDescriptions(snap.descriptions);
    setConstituentProductIds(snap.constituent_product_ids);
    setIsEditing(false);
  };

  return (
    <>
    {/* Product type change warning */}
    {pendingProductTypeChange && (
      <Dialog open={!!pendingProductTypeChange} onOpenChange={() => setPendingProductTypeChange(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" />Change Product Type?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">Changing the product type will clear the currently associated firm. Do you want to proceed?</p>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setPendingProductTypeChange(null)}>Cancel</Button>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={confirmProductTypeChange}>Yes, Change It</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    {/* Firm change warning */}
    {showFirmChangeWarning && (
      <Dialog open={showFirmChangeWarning} onOpenChange={() => setShowFirmChangeWarning(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" />Change Associated Firm?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">You are about to change the associated firm for this product. Do you want to proceed?</p>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowFirmChangeWarning(false)}>Cancel</Button>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={confirmFirmChange}>Yes, Change It</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    <Dialog open={open} onOpenChange={(v) => { if (!v) guardedClose(); }}>
      <DialogContent
        className="sm:max-w-7xl max-h-[90vh] flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-xl font-semibold">
              {isAddMode ? "Add Product" : "Product Details"}
            </DialogTitle>
            <div className="flex items-center gap-1">
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
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-gray-600" onClick={guardedClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Sticky product name banner (view mode only) */}
        {!isAddMode && productName && (
          <div className="px-1 pb-2 border-b mb-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-indigo-700 truncate">{productName}</p>
              <ProductStatusBadge status={productStatus} />
            </div>
            {(editingProduct?.firm_name || firms.find((f) => f.id === firmId)?.name) && (() => {
              const firmName = editingProduct?.firm_name || firms.find((f) => f.id === firmId)?.name;
              const firm = firms.find((f) => f.id === firmId || f.name === editingProduct?.firm_name);
              const firmIdForClick = editingProduct?.firm_id || firm?.id;
              const handleFirmClick = async () => {
                if (!onFirmClick) return;
                if (firm) { onFirmClick(firm); return; }
                if (firmIdForClick) {
                  try {
                    const full = await base44.entities.Firm.get(firmIdForClick);
                    if (full && !full.deleted_at) onFirmClick(full);
                  } catch (e) { /* firm not retrievable — no-op */ }
                }
              };
              return onFirmClick && firmIdForClick ? (
                <button
                  type="button"
                  onClick={handleFirmClick}
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
            <TabsList className="grid grid-cols-3 w-full mb-4 h-auto">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="dd" disabled={isAddMode}>Due Diligence</TabsTrigger>
              <TabsTrigger value="classifications">Classifications</TabsTrigger>
              <TabsTrigger value="description">Inv. Description</TabsTrigger>
              <TabsTrigger value="team" disabled={isAddMode}>Investment Team</TabsTrigger>
              <TabsTrigger value="aum-history" disabled={isAddMode}>AUM History</TabsTrigger>
              <TabsTrigger value="returns" disabled={isAddMode}>Returns</TabsTrigger>
              <TabsTrigger value="analytics" disabled={isAddMode}>Analytics</TabsTrigger>
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
                  <Select value={productType} onValueChange={handleProductTypeChange}>
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
                    <Select value={firmId} onValueChange={handleFirmChange} disabled={!productType}>
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
                    {productType && eligibleFirms.length > 0 && !firmId && (
                      <p className="text-sm text-red-600 mt-1">
                        A related firm is required to create this product.
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

              {/* Product Status */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Product Status</Label>
                {!activelyEditing ? (
                  <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50">
                    {productStatus ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRODUCT_STATUS_STYLES[productStatus] || "bg-gray-100 text-gray-700"}`}>
                        {productStatus}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </div>
                ) : (
                  <Select value={productStatus} onValueChange={setProductStatus}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select product status..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Constituent IM Products (Multi-Manager Product only) */}
              {productType === "Multi-Manager Product" && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Constituent IM Products</Label>
                  {!activelyEditing ? (
                    <div className="space-y-1">
                      {constituentProductIds.length === 0 ? (
                        <div className="px-3 py-2 rounded-md border bg-gray-50 text-sm text-gray-400">
                          —
                        </div>
                      ) : (
                        constituentProductIds.map((id) => {
                          const p = existingProducts.find((x) => x.id === id);
                          return (
                            <div
                              key={id}
                              className="px-3 py-2 rounded-md border bg-gray-50 text-sm text-gray-800"
                            >
                              <span className="font-medium">{p?.name || "Unknown product"}</span>
                              {p?.firm_name && (
                                <span className="text-gray-400"> · {p.firm_name}</span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  ) : (
                    <>
                      <ConstituentProductMultiSelect
                        options={imProductOptions}
                        value={constituentProductIds}
                        onChange={setConstituentProductIds}
                        onAddNew={() => setAddImProductOpen(true)}
                      />
                      {imProductOptions.length === 0 && (
                        <p className="text-xs text-amber-600">
                          No Investment Manager products found. Add one using "Add new IM product".
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ── Due Diligence Tab ── */}
            <TabsContent value="dd">
              {editingProduct && (
                <ProductDueDiligenceTab
                  productId={editingProduct.id}
                  productName={editingProduct.name}
                  firmId={editingProduct.firm_id}
                  firmName={editingProduct.firm_name}
                  onFirmClick={onFirmClick ? (firmId) => {
                    const firm = firms.find((f) => f.id === firmId);
                    if (firm) onFirmClick(firm);
                  } : undefined}
                />
              )}
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
                firmId={firmId}
                productName={productName}
                onRequestEdit={() => setIsEditing(true)}
              />
            </TabsContent>

            {/* ── Investment Team Tab ── */}
            <TabsContent value="team">
              {editingProduct && (
                <ProductInvestmentTeamTab
                  productId={editingProduct.id}
                  firmId={editingProduct.firm_id}
                />
              )}
            </TabsContent>

            {/* ── AUM History Tab ── */}
            <TabsContent value="aum-history">
              {editingProduct && (
                <ProductAumHistoryTab
                  productId={editingProduct.id}
                  productName={editingProduct.name}
                />
              )}
            </TabsContent>

            {/* ── Returns Tab ── */}
            <TabsContent value="returns">
              {editingProduct && (
                <ProductReturnsTab
                  productId={editingProduct.id}
                  productName={editingProduct.name}
                  isEditing={activelyEditing}
                />
              )}
            </TabsContent>

            {/* ── Analytics Tab ── */}
            <TabsContent value="analytics">
              {editingProduct && (
                <ProductAnalyticsTab productId={editingProduct.id} editingProduct={editingProduct} />
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
                  disabled={!isValid || !hasChanges || isSaving}
                  className={`text-white transition-all ${hasChanges && isValid ? "bg-indigo-600 hover:bg-indigo-700 shadow-md" : "bg-indigo-300"}`}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </>
            ) : isAddMode ? (
              <>
                <Button variant="outline" onClick={guardedClose}>Cancel</Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!isValid}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Add Product
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={guardedClose}>Close</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Inline validated Add IM Product dialog (for Multi-Manager Product constituents) */}
    <AddIMProductValidatedDialog
      open={addImProductOpen}
      onOpenChange={setAddImProductOpen}
      firms={firms}
      existingProducts={existingProducts}
      onCreated={(product) => {
        queryClient.invalidateQueries({ queryKey: ["products"] });
        setConstituentProductIds((prev) =>
          prev.includes(product.id) ? prev : [...prev, product.id]
        );
      }}
    />
    {guardDialog}
    </>
    );
    }