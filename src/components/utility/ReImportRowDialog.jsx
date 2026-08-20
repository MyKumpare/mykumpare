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

// Lets the user fix the data for a single skipped/failed product row and
// re-import just that row (without re-running the whole file). The original
// row's values are pre-filled; the user corrects them and submits, which
// starts a one-item product import job.
export default function ReImportRowDialog({ rowData, onClose }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [productName, setProductName] = useState(rowData?.product_name || "");
  const [productType, setProductType] = useState(rowData?.product_type || "");
  const [firmName, setFirmName] = useState(rowData?.firm_name || "");
  const [firmType, setFirmType] = useState(rowData?.firm_type || "");
  const [submitting, setSubmitting] = useState(false);

  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list(null, 5000),
  });

  if (!rowData) return null;

  const handleSubmit = async () => {
    if (!productName || !productType || !firmName || !firmType) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const tenant_id = user?.linked_firm_id;
      const exactFirm = (firms || []).find(
        (f) => !f.deleted_at && f.name && f.name.toLowerCase().trim() === firmName.toLowerCase().trim()
      );
      const item = {
        product: {
          name: productName,
          product_type: productType,
          firm_name: firmName,
          tenant_id,
        },
        row: rowData.row,
        firmName,
        firmId: exactFirm ? exactFirm.id : null,
        createFirm: !exactFirm,
        accept: true,
        firmType,
      };
      await base44.functions.invoke("startImportJob", {
        source: "product",
        items: [item],
        validationSkipped: [],
        tenant_id,
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["firms"] });
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
          <p className="text-sm font-semibold text-gray-800">Fix & re-import row {rowData.row}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-red-600 bg-red-50 rounded p-2">{rowData.error || rowData.reason}</p>
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
            <input value={firmName} onChange={(e) => setFirmName(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-sm rounded-md border border-gray-200 focus:border-indigo-300 focus:outline-none" />
          </div>
          <div>
            <label className="text-[11px] text-gray-500">Associated Firm Type</label>
            <Select value={firmType} onValueChange={setFirmType}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {FIRM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
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