import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Loader2 } from "lucide-react";

const PRODUCT_TYPES = ["Investment Manager Product", "Multi-Manager Product"];
const FIRM_TYPES = [
  "Manager of Managers",
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

// Lets the user fix the data for a single skipped/failed row and re-import just
// that row (without re-running the whole file). Supports both firm and product
// imports. The original row's values are pre-filled; the user corrects them
// and submits, which starts a one-item import job.
export default function ReImportRowDialog({ rowData, source = "product", onClose }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isFirm = source === "firm";

  // Firm fields
  const initialFirmTypes = (rowData?.firm_types || "")
    .split(/[;|]/).map((t) => t.trim()).filter(Boolean);
  const [firmName, setFirmName] = useState(rowData?.name || "");
  const [firmTypes, setFirmTypes] = useState(initialFirmTypes);

  // Product fields
  const [productName, setProductName] = useState(rowData?.product_name || "");
  const [productType, setProductType] = useState(rowData?.product_type || "");
  const [productFirmName, setProductFirmName] = useState(rowData?.firm_name || "");
  const [productFirmType, setProductFirmType] = useState(rowData?.firm_type || "");

  const [submitting, setSubmitting] = useState(false);

  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list(null, 5000),
  });

  if (!rowData) return null;

  const toggleFirmType = (t) => {
    setFirmTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const handleSubmit = async () => {
    const tenant_id = user?.linked_firm_id;
    if (isFirm) {
      if (!firmName || firmTypes.length === 0) {
        toast({ title: "Firm name and at least one firm type are required", variant: "destructive" });
        return;
      }
    } else {
      if (!productName || !productType || !productFirmName || !productFirmType) {
        toast({ title: "All fields are required", variant: "destructive" });
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isFirm) {
        const item = {
          firm: { name: firmName, firm_types: firmTypes, tenant_id },
          row: rowData.row,
          accept: true,
          duplicates: [],
        };
        await base44.functions.invoke("startImportJob", {
          source: "firm",
          items: [item],
          validationSkipped: [],
          tenant_id,
        });
      } else {
        const exactFirm = (firms || []).find(
          (f) => !f.deleted_at && f.name && f.name.toLowerCase().trim() === productFirmName.toLowerCase().trim()
        );
        const item = {
          product: {
            name: productName,
            product_type: productType,
            firm_name: productFirmName,
            tenant_id,
          },
          row: rowData.row,
          firmName: productFirmName,
          firmId: exactFirm ? exactFirm.id : null,
          createFirm: !exactFirm,
          accept: true,
          firmType: productFirmType,
        };
        await base44.functions.invoke("startImportJob", {
          source: "product",
          items: [item],
          validationSkipped: [],
          tenant_id,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["firms"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
      toast({ title: "✅ Row re-imported" });
      onClose();
    } catch (err) {
      toast({ title: "Re-import failed", description: err?.message || "Failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">
            Fix & re-import row {rowData.row} <span className="text-gray-400 font-normal">· {isFirm ? "Firm" : "Product"}</span>
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-red-600 bg-red-50 rounded p-2">{rowData.error || rowData.reason}</p>

        {isFirm ? (
          <div className="space-y-2">
            <div>
              <label className="text-[11px] text-gray-500">Firm Name</label>
              <input value={firmName} onChange={(e) => setFirmName(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-sm rounded-md border border-gray-200 focus:border-indigo-300 focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-gray-500">Firm Types</label>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {FIRM_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleFirmType(t)}
                    className={`px-2 py-1 text-xs rounded-md border ${firmTypes.includes(t) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <label className="text-[11px] text-gray-500">Product Name</label>
              <input value={productName} onChange={(e) => setProductName(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-sm rounded-md border border-gray-200 focus:border-indigo-300 focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-gray-500">Product Type</label>
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-gray-500">Associated Firm Name</label>
              <input value={productFirmName} onChange={(e) => setProductFirmName(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-sm rounded-md border border-gray-200 focus:border-indigo-300 focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-gray-500">Associated Firm Type</label>
              <Select value={productFirmType} onValueChange={setProductFirmType}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {FIRM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Re-import"}
          </Button>
        </div>
      </div>
    </div>
  );
}