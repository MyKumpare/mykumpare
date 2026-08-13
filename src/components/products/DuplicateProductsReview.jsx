import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, ArrowRightLeft, Trash2, Loader2, Package, ScanSearch } from "lucide-react";
import { findDuplicateProductClusters } from "@/components/products/productDuplicateCheck";
import { useEntityDuplicateReviews } from "@/components/firms/useEntityDuplicateReviews";
import MergeDuplicateProductsDialog from "@/components/products/MergeDuplicateProductsDialog";

function productSubtitle(p) {
  const parts = [p.firm_name, p.product_type, p.product_status].filter(Boolean);
  return parts.join(" · ") || "—";
}

export default function DuplicateProductsReview() {
  const queryClient = useQueryClient();
  const [scanned, setScanned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mergeCluster, setMergeCluster] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date", 5000),
  });

  const { isGroupAccepted, acceptGroup } = useEntityDuplicateReviews("product");

  const activeProducts = useMemo(
    () => products.filter((p) => !p.deleted_at),
    [products]
  );

  const clusters = useMemo(() => findDuplicateProductClusters(activeProducts), [activeProducts]);
  const pendingClusters = useMemo(
    () => clusters.filter((g) => !isGroupAccepted(g)),
    [clusters, isGroupAccepted]
  );

  const runScan = () => {
    setBusy(true);
    setTimeout(() => {
      setScanned(true);
      setBusy(false);
    }, 300);
  };

  const handleAccept = async (group) => {
    setBusy(true);
    try {
      await acceptGroup(group);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await base44.entities.Product.update(deleteTarget.id, { deleted_at: new Date().toISOString() });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["duplicateReviews", "product"] });
      setDeleteTarget(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanSearch className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-gray-700">Product Duplicates</span>
          {scanned && pendingClusters.length > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              <AlertTriangle className="w-3 h-3" /> {pendingClusters.length} set{pendingClusters.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={runScan} disabled={busy}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanSearch className="w-3.5 h-3.5" />}
          {scanned ? "Re-scan" : "Scan Now"}
        </Button>
      </div>

      {!scanned ? (
        <p className="text-xs text-gray-500 py-2">
          Run a scan to find potential duplicate products within the same firm. For each set you can keep both (accept), merge them, or delete the duplicate.
        </p>
      ) : pendingClusters.length === 0 ? (
        <p className="text-xs text-gray-500 py-2 text-center">
          No duplicate products detected. 🎉
        </p>
      ) : (
        <div className="space-y-2 max-h-[55vh] overflow-y-auto">
          {pendingClusters.map((group, gi) => (
            <div key={gi} className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 space-y-2">
              <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Duplicate set {gi + 1}</div>
              <div className="space-y-1.5">
                {group.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 bg-white rounded-md border border-gray-200 px-2 py-1.5">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <Package className="w-3 h-3 text-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-800 truncate">{p.name || "—"}</p>
                      <p className="text-[10px] text-gray-500 truncate">{productSubtitle(p)}</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-red-600 hover:bg-red-50" onClick={() => setDeleteTarget(p)} disabled={busy}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => handleAccept(group)} disabled={busy}>
                  <Check className="w-3.5 h-3.5" /> Accept (keep both)
                </Button>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setMergeCluster(group)} disabled={busy || group.length < 2}>
                  <ArrowRightLeft className="w-3.5 h-3.5" /> Merge
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {mergeCluster && (
        <MergeDuplicateProductsDialog
          open={true}
          onOpenChange={(v) => { if (!v) setMergeCluster(null); }}
          products={mergeCluster}
          onMerged={() => {
            queryClient.invalidateQueries({ queryKey: ["products"] });
            queryClient.invalidateQueries({ queryKey: ["duplicateReviews", "product"] });
            setMergeCluster(null);
          }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-red-600 font-semibold">
              <AlertTriangle className="w-5 h-5" /> Delete Product?
            </div>
            <p className="text-sm text-gray-600">
              Delete <strong>{deleteTarget.name}</strong>{deleteTarget.firm_name ? ` (${deleteTarget.firm_name})` : ""}? This moves the product to deleted records.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)} disabled={busy}>Cancel</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={busy}>
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}