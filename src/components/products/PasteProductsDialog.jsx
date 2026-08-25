import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ClipboardPaste, Loader2, ArrowRight, Package, CheckCircle2,
  AlertTriangle, Plus, AlertCircle,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { classifyNameMatch } from "@/components/shared/nameSimilarity";

const PRODUCT_TYPES = ["Investment Manager Product", "Multi-Manager Product"];
const AVAILABILITY_STATUSES = ["Active", "Closed"];

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          product_type: { type: "string", enum: ["Investment Manager Product", "Multi-Manager Product"] },
          asset_class: { type: "string" },
          inception_date: { type: "string", description: "YYYY-MM-DD if known" },
          product_availability_status: { type: "string", enum: ["Active", "Closed"] },
          evestment_universe: { type: "string" },
          default_benchmark: { type: "string" },
        },
      },
    },
  },
};

function makeProduct(raw = {}) {
  return {
    name: raw.name || "",
    product_type: raw.product_type || "Investment Manager Product",
    asset_class: raw.asset_class || "",
    inception_date: raw.inception_date || "",
    product_availability_status: raw.product_availability_status || "Active",
    evestment_universe: raw.evestment_universe || "",
    default_benchmark: raw.default_benchmark || "",
  };
}

/**
 * Paste-and-scrub product creation. The user pastes a product list (one per
 * line or a free-form block), an LLM extracts structured fields, and each
 * product's eVestment Universe and default benchmark are validated against
 * the existing master lists. Exact matches are auto-linked; near matches
 * alert the user to accept-merge (use existing) or reject (create new).
 * On confirm, new master-list entries and products are created, each
 * auto-associated to the firm.
 */
export default function PasteProductsDialog({ open, onClose, firmId, firmName, existingProducts = [] }) {
  const queryClient = useQueryClient();
  const [rawText, setRawText] = useState("");
  const [scrubbing, setScrubbing] = useState(false);
  const [products, setProducts] = useState(null);
  const [decisions, setDecisions] = useState({});
  const [creating, setCreating] = useState(false);

  const { data: benchmarks = [] } = useQuery({
    queryKey: ["benchmarks"],
    queryFn: () => base44.entities.Benchmark.list("-created_date"),
  });
  const { data: universes = [] } = useQuery({
    queryKey: ["evestment-universes"],
    queryFn: () => base44.entities.EVestmentUniverse.list("-created_date"),
  });
  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  useEffect(() => {
    if (open) {
      setRawText("");
      setProducts(null);
      setDecisions({});
    }
  }, [open]);

  const matchInfo = useMemo(() => {
    if (!products) return [];
    return products.map((p) => {
      const bm = p.default_benchmark?.trim()
        ? classifyNameMatch(p.default_benchmark, benchmarks)
        : { status: "new", match: null };
      const un = p.evestment_universe?.trim()
        ? classifyNameMatch(p.evestment_universe, universes)
        : { status: "new", match: null };
      return { benchmark: bm, universe: un };
    });
  }, [products, benchmarks, universes]);

  useEffect(() => {
    if (!matchInfo.length) return;
    setDecisions((prev) => {
      const next = { ...prev };
      matchInfo.forEach((m, i) => {
        if (m.benchmark.status === "near" && !next[i]?.benchmark) {
          next[i] = { ...(next[i] || {}), benchmark: "merge" };
        }
        if (m.universe.status === "near" && !next[i]?.universe) {
          next[i] = { ...(next[i] || {}), universe: "merge" };
        }
      });
      return next;
    });
  }, [matchInfo]);

  const handleScrub = async () => {
    if (!rawText.trim()) {
      toast({ title: "Nothing to scrub", description: "Paste a product list first.", variant: "destructive" });
      return;
    }
    setScrubbing(true);
    try {
      const prompt = `You are extracting a list of investment products from the text below. The text may be a table, a list (one product per line), or a free-form block. Extract every distinct product mentioned. For each product, return:
- name: the product name (required)
- product_type: "Investment Manager Product" or "Multi-Manager Product" (default to "Investment Manager Product" if unclear)
- asset_class: the asset class (e.g. Equity, Fixed Income, Private Equity, Private Credit) if stated
- inception_date: the product inception date in YYYY-MM-DD format if stated, otherwise empty
- product_availability_status: "Active" or "Closed" if stated, otherwise "Active"
- evestment_universe: the eVestment Universe classification/strategy if stated
- default_benchmark: the primary/default benchmark name if stated

Only include fields that are explicitly present or clearly implied. Do not fabricate values. If a product name is not clearly identifiable, skip that line. Return only the products array.

Text:
"""
${rawText.trim().substring(0, 8000)}
"""`;
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: EXTRACT_SCHEMA,
      });
      const list = Array.isArray(res?.products) ? res.products : [];
      if (!list.length) {
        toast({ title: "No products found", description: "Could not extract any products from the pasted text.", variant: "destructive" });
        return;
      }
      setProducts(list.map(makeProduct));
      toast({ title: `✅ ${list.length} product${list.length > 1 ? "s" : ""} extracted`, description: "Review the fields and resolve any near-match warnings." });
    } catch (err) {
      toast({ title: "Scrub failed", description: err?.message || "Could not extract products.", variant: "destructive" });
    } finally {
      setScrubbing(false);
    }
  };

  const updateProduct = (i, patch) => {
    setProducts((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };

  const setDecision = (i, field, val) => {
    setDecisions((prev) => ({ ...prev, [i]: { ...(prev[i] || {}), [field]: val } }));
  };

  const resolvedBenchmarks = useMemo(() => {
    if (!products) return { create: [], link: [] };
    const create = new Map();
    const link = [];
    products.forEach((p, i) => {
      const m = matchInfo[i]?.benchmark;
      const dec = decisions[i]?.benchmark;
      if (!m || m.status === "new" || (m.status === "near" && dec === "new") || !p.default_benchmark?.trim()) {
        if (p.default_benchmark?.trim()) create.set(p.default_benchmark.trim(), p.asset_class || "Equity");
      } else {
        link.push({ idx: i, id: m.match?.id, name: m.match?.name });
      }
    });
    return { create: Array.from(create.entries()).map(([name, asset_class]) => ({ name, asset_class })), link };
  }, [products, matchInfo, decisions]);

  const resolvedUniverses = useMemo(() => {
    if (!products) return { create: [], link: [] };
    const create = new Set();
    const link = [];
    products.forEach((p, i) => {
      const m = matchInfo[i]?.universe;
      const dec = decisions[i]?.universe;
      if (!m || m.status === "new" || (m.status === "near" && dec === "new") || !p.evestment_universe?.trim()) {
        if (p.evestment_universe?.trim()) create.add(p.evestment_universe.trim());
      } else {
        link.push({ idx: i, name: m.match?.name });
      }
    });
    return { create: Array.from(create), link };
  }, [products, matchInfo, decisions]);

  const validProducts = useMemo(() => {
    if (!products) return [];
    return products.filter((p) => p.name?.trim() && p.product_type);
  }, [products]);

  const duplicateProductNames = useMemo(() => {
    const existingNames = (existingProducts || []).filter((p) => !p.deleted_at && p.firm_id === firmId).map((p) => p.name.toLowerCase());
    const newNames = validProducts.map((p) => p.name.trim().toLowerCase());
    return new Set(newNames.filter((n) => existingNames.includes(n)));
  }, [validProducts, existingProducts, firmId]);

  const canCreate = validProducts.length > 0 && !creating && duplicateProductNames.size === 0;

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      const benchmarkIdByName = new Map();
      for (const b of resolvedBenchmarks.create) {
        try {
          const created = await base44.entities.Benchmark.create({ name: b.name, asset_class: b.asset_class });
          benchmarkIdByName.set(b.name, created);
        } catch (e) { /* may already exist */ }
      }
      if (resolvedBenchmarks.create.length) queryClient.invalidateQueries({ queryKey: ["benchmarks"] });

      for (const u of resolvedUniverses.create) {
        try { await base44.entities.EVestmentUniverse.create({ name: u }); } catch (e) { /* may already exist */ }
      }
      if (resolvedUniverses.create.length) queryClient.invalidateQueries({ queryKey: ["evestment-universes"] });

      let createdCount = 0;
      for (let i = 0; i < products.length; i++) {
        const p = products[i];
        if (!p.name?.trim() || !p.product_type) continue;

        let benchmarkId = "";
        let benchmarkName = "";
        const bm = matchInfo[i]?.benchmark;
        const bmDec = decisions[i]?.benchmark;
        if (p.default_benchmark?.trim()) {
          if (bm?.status === "exact" || (bm?.status === "near" && bmDec !== "new")) {
            benchmarkId = bm.match?.id || "";
            benchmarkName = bm.match?.name || p.default_benchmark.trim();
          } else {
            const created = benchmarkIdByName.get(p.default_benchmark.trim());
            if (created) { benchmarkId = created.id; benchmarkName = created.name; }
            else { benchmarkName = p.default_benchmark.trim(); }
          }
        }

        const payload = {
          name: p.name.trim(),
          product_type: p.product_type,
          firm_id: firmId,
          firm_name: firmName,
          product_availability_status: p.product_availability_status || "Active",
          product_status: "Not Reviewed",
          asset_class: p.asset_class || undefined,
          inception_date: p.inception_date || undefined,
          evestment_universe: p.evestment_universe?.trim() || undefined,
          default_benchmark_id: benchmarkId || undefined,
          default_benchmark_name: benchmarkName || undefined,
          tenant_id: currentUser?.linked_firm_id,
        };
        try {
          await base44.entities.Product.create(payload);
          createdCount++;
        } catch (e) {
          toast({ title: `Failed to create "${p.name.trim()}"`, description: e?.message, variant: "destructive" });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["products", firmId] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: `✅ ${createdCount} product${createdCount > 1 ? "s" : ""} created`, description: `Associated with ${firmName}.` });
      onClose();
    } catch (err) {
      toast({ title: "Create failed", description: err?.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="w-5 h-5 text-indigo-600" />
            Paste & Scrub Products
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 pr-1 space-y-4">
          {!products ? (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-600">Paste a product list</Label>
                <Textarea
                  autoFocus
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={"Paste one product per line, or a table/free-form block…\n\nExample:\nAcme Emerging Markets Equity — Equity, Active, Inception 2015-03-31, Benchmark: MSCI Emerging Markets Index, eVestment Universe: EM Equity Core\nAcme US Large Cap Value — Equity, Value, Closed, Inception 2010-06-30, Benchmark: Russell 1000 Value, eVestment Universe: US Large Cap Value"}
                  className="min-h-[200px] text-sm"
                />
                <p className="text-[11px] text-gray-400">
                  The system will extract product name, type, asset class, inception date, availability, eVestment Universe, and default benchmark — then validate benchmarks and eVestment Universe against existing master lists to prevent duplicates.
                </p>
              </div>
              <div className="flex justify-end">
                <Button type="button" onClick={handleScrub} disabled={scrubbing} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
                  {scrubbing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  {scrubbing ? "Scrubbing…" : "Scrub & Review"}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {duplicateProductNames.size > 0 && (
                <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    Some extracted product names already exist for this firm and will be skipped. Rename them or remove them to proceed: <strong>{[...duplicateProductNames].join(", ")}</strong>
                  </div>
                </div>
              )}
              {products.map((p, i) => {
                const bm = matchInfo[i]?.benchmark;
                const un = matchInfo[i]?.universe;
                const bmDec = decisions[i]?.benchmark;
                const unDec = decisions[i]?.universe;
                const isDup = duplicateProductNames.has(p.name.trim().toLowerCase());
                return (
                  <div key={i} className={`rounded-lg border p-3 space-y-2.5 ${isDup ? "border-red-200 bg-red-50/30" : "border-gray-200 bg-white"}`}>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                      <Package className="w-3.5 h-3.5 text-indigo-500" /> Product {i + 1}
                      {isDup && <span className="ml-auto text-red-600 font-medium">Already exists for this firm</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <SmallField label="Product Name *" value={p.name} onChange={(v) => updateProduct(i, { name: v })} />
                      <div className="space-y-1">
                        <Label className="text-[11px] text-gray-500">Product Type</Label>
                        <Select value={p.product_type} onValueChange={(v) => updateProduct(i, { product_type: v })}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>{PRODUCT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <SmallField label="Asset Class" value={p.asset_class} onChange={(v) => updateProduct(i, { asset_class: v })} />
                      <SmallField label="Inception Date" value={p.inception_date} onChange={(v) => updateProduct(i, { inception_date: v })} placeholder="YYYY-MM-DD" />
                      <div className="space-y-1">
                        <Label className="text-[11px] text-gray-500">Availability Status</Label>
                        <Select value={p.product_availability_status} onValueChange={(v) => updateProduct(i, { product_availability_status: v })}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>{AVAILABILITY_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] text-gray-500">eVestment Universe</Label>
                      <input
                        value={p.evestment_universe}
                        onChange={(e) => updateProduct(i, { evestment_universe: e.target.value })}
                        className="w-full h-8 rounded-md border border-gray-200 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                      <MatchBadge status={un?.status} match={un?.match} decision={unDec} onDecision={(v) => setDecision(i, "universe", v)} label="universe" />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] text-gray-500">Default Benchmark</Label>
                      <input
                        value={p.default_benchmark}
                        onChange={(e) => updateProduct(i, { default_benchmark: e.target.value })}
                        className="w-full h-8 rounded-md border border-gray-200 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                      <MatchBadge status={bm?.status} match={bm?.match} decision={bmDec} onDecision={(v) => setDecision(i, "benchmark", v)} label="benchmark" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {products && (
            <Button onClick={handleCreate} disabled={!canCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {creating ? "Creating…" : `Create ${validProducts.length} Product${validProducts.length !== 1 ? "s" : ""}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SmallField({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-gray-500">{label}</Label>
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-8 rounded-md border border-gray-200 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
      />
    </div>
  );
}

function MatchBadge({ status, match, decision, onDecision, label }) {
  if (!status || status === "new") {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-blue-600">
        <Plus className="w-3 h-3" /> New {label} — will be created
      </div>
    );
  }
  if (status === "exact") {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-emerald-600">
        <CheckCircle2 className="w-3 h-3" /> Exact match: <strong>{match?.name}</strong> (linked)
      </div>
    );
  }
  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 px-2 py-1.5 space-y-1">
      <div className="flex items-center gap-1.5 text-[11px] text-amber-700">
        <AlertTriangle className="w-3 h-3" /> Near match: <strong>{match?.name}</strong>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onDecision("merge")}
          className={`text-[11px] px-2 py-0.5 rounded-md ${decision === "merge" ? "bg-amber-600 text-white" : "bg-white text-amber-700 border border-amber-300"}`}
        >
          Accept merge
        </button>
        <button
          type="button"
          onClick={() => onDecision("new")}
          className={`text-[11px] px-2 py-0.5 rounded-md ${decision === "new" ? "bg-indigo-600 text-white" : "bg-white text-indigo-700 border border-indigo-300"}`}
        >
          Reject (create new)
        </button>
      </div>
    </div>
  );
}