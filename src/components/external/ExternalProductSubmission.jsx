import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Package, Send, AlertCircle, CheckCircle2, Loader2, Plus } from "lucide-react";
import { format, parseISO } from "date-fns";

const ASSET_CLASSES = ["Equity", "Fixed Income", "Other"];
const GEOGRAPHIES = ["Global", "Non-US", "Developed Non-US", "Emerging Markets", "Frontier Markets", "US"];
const INVESTMENT_APPROACHES = ["Active", "Passive"];
const DIVERSIFICATIONS = ["Diversified", "Concentrated"];
const VEHICLE_OFFERINGS = ["Separate Account", "ETF", "Mutual Fund", "Other Commingled Structure"];

export default function ExternalProductSubmission({ firmId, firmName, firmTypes = [], contactId, contactName, readOnly = false }) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    product_name: "", asset_class: "", geography: "",
    investment_approach: "", diversification_classification: "",
    vehicle_offerings: [], inception_date: "", description: "",
  });

  // Auto-set product type from firm type
  const isIMFirm = firmTypes.some(t => t === "Investment Manager");
  const productType = isIMFirm ? "Investment Manager Product" : "Multi-Manager Product";

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));
  const toggleVehicle = (v) => {
    setForm((f) => ({
      ...f,
      vehicle_offerings: f.vehicle_offerings.includes(v)
        ? f.vehicle_offerings.filter((x) => x !== v)
        : [...f.vehicle_offerings, v],
    }));
  };

  const { data: submissions = [], isLoading } = useQueryExternalSubmissions(firmId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.product_name.trim()) {
      toast({ title: "Product name is required", variant: "destructive" });
      return;
    }
    if (!form.asset_class) {
      toast({ title: "Asset class is required", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const isFixedIncome = form.asset_class === "Fixed Income";

      await base44.entities.ExternalProductSubmission.create({
        firm_id: firmId,
        firm_name: firmName,
        submitter_contact_id: contactId,
        submitter_name: contactName,
        product_name: form.product_name.trim(),
        product_type: productType,
        asset_class: form.asset_class,
        geography: form.asset_class === "Equity" ? form.geography : undefined,
        investment_approach: form.asset_class === "Equity" ? form.investment_approach : undefined,
        diversification_classification: form.asset_class === "Equity" ? form.diversification_classification : undefined,
        vehicle_offerings: form.asset_class === "Equity" ? form.vehicle_offerings : [],
        inception_date: form.inception_date || undefined,
        description: form.description || undefined,
        fixed_income_notice: isFixedIncome,
        status: "pending",
      });

      toast({
        title: "Product submitted",
        description: isFixedIncome
          ? "Thank you. We are not currently researching fixed income products, but your submission has been saved. We will notify you if our needs change."
          : `"${form.product_name}" has been submitted for review.`,
      });

      setForm({
        product_name: "", asset_class: "", geography: "",
        investment_approach: "", diversification_classification: "",
        vehicle_offerings: [], inception_date: "", description: "",
      });
      setShowForm(false);
    } catch (err) {
      toast({ title: "Submission failed", description: err?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
          <Package className="w-4 h-4 text-indigo-500" /> Product Submissions
        </h2>
        {!readOnly && (
          <Button size="sm" className="h-8 text-xs" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-3.5 h-3.5" /> Submit Product
          </Button>
        )}
      </div>

      {/* Submission form */}
      {showForm && !readOnly && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 space-y-4">
          <div>
            <Label className="text-xs font-medium text-gray-600">Product Name *</Label>
            <Input className="h-9 mt-1" placeholder="Enter product name"
              value={form.product_name} onChange={(e) => set("product_name", e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-gray-600">Product Type</Label>
              <div className="h-9 mt-1 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-700">
                {productType}
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">Auto-set from your firm type</p>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600">Asset Class *</Label>
              <Select value={form.asset_class} onValueChange={(v) => set("asset_class", v)}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {ASSET_CLASSES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fixed income notice */}
          {form.asset_class === "Fixed Income" && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>We are not currently researching fixed income products. Your submission will still be saved, and we will notify you if our needs change.</span>
            </div>
          )}

          {/* Equity-specific fields */}
          {form.asset_class === "Equity" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-gray-600">Geography</Label>
                  <Select value={form.geography} onValueChange={(v) => set("geography", v)}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {GEOGRAPHIES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600">Investment Approach</Label>
                  <Select value={form.investment_approach} onValueChange={(v) => set("investment_approach", v)}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {INVESTMENT_APPROACHES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-gray-600">Diversification Classification</Label>
                  <Select value={form.diversification_classification} onValueChange={(v) => set("diversification_classification", v)}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {DIVERSIFICATIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600">Inception Date</Label>
                  <Input className="h-9 mt-1" type="date" value={form.inception_date}
                    onChange={(e) => set("inception_date", e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Vehicle Offerings</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {VEHICLE_OFFERINGS.map((v) => (
                    <button key={v} type="button" onClick={() => toggleVehicle(v)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        form.vehicle_offerings.includes(v)
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                      }`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs font-medium text-gray-600">Description (optional)</Label>
            <Input className="h-9 mt-1" placeholder="Brief product description"
              value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" size="sm" className="h-8 text-xs" disabled={submitting}>
              {submitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...</> : <><Send className="w-3.5 h-3.5" /> Submit</>}
            </Button>
          </div>
        </form>
      )}

      {/* List of submitted products */}
      {isLoading ? (
        <div className="text-center py-6 text-sm text-gray-400">Loading submissions...</div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-8 rounded-xl border border-dashed border-gray-200">
          <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No products submitted yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {submissions.map((sub) => (
            <div key={sub.id} className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 truncate">{sub.product_name}</p>
                  <p className="text-[10px] text-gray-400">
                    {sub.product_type} · {sub.asset_class}
                    {sub.inception_date && ` · Inception: ${format(parseISO(sub.inception_date), "MM/dd/yyyy")}`}
                  </p>
                  {sub.fixed_income_notice && (
                    <p className="text-[10px] text-amber-600 mt-0.5">
                      <AlertCircle className="w-2.5 h-2.5 inline mr-0.5" />
                      Fixed Income — not currently being researched
                    </p>
                  )}
                </div>
                <Badge variant="outline" className={`text-[9px] flex-shrink-0 ${
                  sub.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  sub.status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-200" :
                  "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  {sub.status === "approved" && <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />}
                  {sub.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Inline query hook
function useQueryExternalSubmissions(firmId) {
  return useQuery({
    queryKey: ["external_product_submissions", firmId],
    queryFn: () => base44.entities.ExternalProductSubmission.filter({ firm_id: firmId }, "-created_date", 200),
    enabled: !!firmId,
  });
}