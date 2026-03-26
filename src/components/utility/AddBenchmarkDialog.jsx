import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Pencil, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import BenchmarkReturnsTab from "./BenchmarkReturnsTab";
import { usePersistedOptions } from "@/hooks/usePersistedOptions";

const ASSET_CLASSES = [
  "Equity",
  "Fixed Income",
  "Commodities",
  "Real Estate",
  "Alternatives",
];

const EQUITY_REGIONS = [
  "Global",
  "Global ex US",
  "Non-US Developed Large",
  "Non-US Developed Small",
  "Emerging Markets",
  "Frontier Markets",
];

const EQUITY_MARKET_CAPS = [
  "All Cap",
  "Large Cap",
  "Mid-Large Cap",
  "Mid Cap",
  "Small-Mid Cap",
  "Small Cap",
  "Micro Cap",
];

const EQUITY_STYLES = ["Core", "Value", "Growth"];

export default function AddBenchmarkDialog({
  open,
  onOpenChange,
  benchmarks = [],
  editingBenchmark = null,
}) {
  const queryClient = useQueryClient();

  const [mode, setMode] = useState("add");
  const [assetClass, setAssetClass] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [region, setRegion] = useState("");
  const [marketCap, setMarketCap] = useState("");
  const [style, setStyle] = useState("");
  const [newRegion, setNewRegion] = useState("");
  const [newMarketCap, setNewMarketCap] = useState("");
  const [newStyle, setNewStyle] = useState("");
  const [showNewRegion, setShowNewRegion] = useState(false);
  const [showNewMarketCap, setShowNewMarketCap] = useState(false);
  const [showNewStyle, setShowNewStyle] = useState(false);

  const getOptionWarning = (value, allOptions) => {
    if (!value.trim()) return null;
    const lower = value.trim().toLowerCase();
    const exact = allOptions.find(o => o.toLowerCase() === lower);
    if (exact) return { type: "duplicate", msg: `"${exact}" already exists.` };
    const partial = allOptions.filter(o =>
      o.toLowerCase().includes(lower) || lower.includes(o.toLowerCase())
    );
    if (partial.length > 0) return { type: "partial", msg: `Similar option(s) exist: ${partial.join(", ")}` };
    return null;
  };
  const [customRegions, addCustomRegion] = usePersistedOptions("benchmark_region");
  const [customMarketCaps, addCustomMarketCap] = usePersistedOptions("benchmark_market_cap");
  const [customStyles, addCustomStyle] = usePersistedOptions("benchmark_style");
  const [inceptionDate, setInceptionDate] = useState(null);
  const [inceptionCalOpen, setInceptionCalOpen] = useState(false);
  const [monthlyReturns, setMonthlyReturns] = useState([]);

  const allRegions = [...new Set([...EQUITY_REGIONS, ...customRegions])];
  const allMarketCaps = [...new Set([...EQUITY_MARKET_CAPS, ...customMarketCaps])];
  const allStyles = [...new Set([...EQUITY_STYLES, ...customStyles])];

  const populateFromBenchmark = (b) => {
    setAssetClass(b.asset_class || "");
    setName(b.name || "");
    setDescription(b.description || "");
    setRegion(b.region || "");
    setMarketCap(b.market_capitalization || "");
    setStyle(b.style || "");
    setInceptionDate(b.inception_date ? parseISO(b.inception_date) : null);
    setMonthlyReturns(b.monthly_returns || []);
  };

  useEffect(() => {
    if (!open) {
      setMode("add");
      setAssetClass(""); setName(""); setDescription("");
      setRegion(""); setMarketCap(""); setStyle("");
      setNewRegion(""); setNewMarketCap(""); setNewStyle("");
      setShowNewRegion(false); setShowNewMarketCap(false); setShowNewStyle(false);
      setInceptionDate(null);
      setMonthlyReturns([]);
      return;
    }
    if (editingBenchmark) {
      setMode("view");
      populateFromBenchmark(editingBenchmark);
      if (editingBenchmark.region && !EQUITY_REGIONS.includes(editingBenchmark.region)) {
        addCustomRegion(editingBenchmark.region);
      }
      if (editingBenchmark.market_capitalization && !EQUITY_MARKET_CAPS.includes(editingBenchmark.market_capitalization)) {
        addCustomMarketCap(editingBenchmark.market_capitalization);
      }
      if (editingBenchmark.style && !EQUITY_STYLES.includes(editingBenchmark.style)) {
        addCustomStyle(editingBenchmark.style);
      }
    } else {
      setMode("add");
    }
  }, [open, editingBenchmark]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Benchmark.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["benchmarks"] });
      onOpenChange(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Benchmark.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["benchmarks"] });
      onOpenChange(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Benchmark.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["benchmarks"] });
      onOpenChange(false);
    },
  });

  const isDuplicate =
    name.trim() &&
    benchmarks.some(
      (b) =>
        b.name.toLowerCase() === name.trim().toLowerCase() &&
        b.asset_class === assetClass &&
        b.id !== editingBenchmark?.id
    );

  const isValid =
    assetClass &&
    name.trim() &&
    !isDuplicate &&
    (assetClass !== "Equity" || (region && marketCap && style));

  const buildData = () => {
    const data = {
      asset_class: assetClass,
      name: name.trim(),
      description: description.trim(),
      monthly_returns: monthlyReturns,
    };
    if (assetClass === "Equity") {
      data.region = region;
      data.market_capitalization = marketCap;
      data.style = style;
    }
    if (inceptionDate) data.inception_date = format(inceptionDate, "yyyy-MM-dd");
    return data;
  };

  const handleSubmit = () => {
    if (!isValid) return;
    if (mode === "edit" && editingBenchmark) {
      updateMutation.mutate({ id: editingBenchmark.id, data: buildData() });
    } else {
      createMutation.mutate(buildData());
    }
  };

  const handleCancelEdit = () => {
    populateFromBenchmark(editingBenchmark);
    setMode("view");
  };

  const isEditable = mode === "add" || mode === "edit";

  const renderField = (label, value, editContent) => (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      {!isEditable ? (
        <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-800">
          {value || <span className="text-gray-400">—</span>}
        </div>
      ) : editContent}
    </div>
  );

  const titleMap = { add: "Add Benchmark", view: "Benchmark Details", edit: "Edit Benchmark" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle>{titleMap[mode]}</DialogTitle>
            {mode === "view" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1.5"
                onClick={() => setMode("edit")}
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex flex-col flex-1 min-h-0">
          <TabsList className="w-full shrink-0">
            <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
            <TabsTrigger value="returns" className="flex-1">Returns</TabsTrigger>
          </TabsList>

          {/* ── Details Tab ── */}
          <TabsContent value="details" className="flex-1 overflow-y-auto">
            <div className="space-y-4 py-4">
              {/* Asset Class */}
              {renderField(
                "Asset Class *",
                assetClass,
                <Select value={assetClass} onValueChange={setAssetClass}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select asset class..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_CLASSES.map((ac) => (
                      <SelectItem key={ac} value={ac}>{ac}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Benchmark Name *</Label>
                {!isEditable ? (
                  <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-800 font-medium">
                    {name}
                  </div>
                ) : (
                  <>
                    <Input
                      placeholder="e.g. S&P 500"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={`h-9 ${isDuplicate ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                    />
                    {isDuplicate && <p className="text-xs text-red-500">This benchmark already exists.</p>}
                  </>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Description</Label>
                {!isEditable ? (
                  <div className="min-h-9 px-3 py-2 rounded-md border bg-gray-50 text-sm text-gray-700 whitespace-pre-wrap">
                    {description || <span className="text-gray-400">—</span>}
                  </div>
                ) : (
                  <Textarea
                    placeholder="Brief description..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-16 text-sm"
                  />
                )}
              </div>

              {/* Equity-specific fields */}
              {assetClass === "Equity" && (
                <>
                  {/* Region */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">Region *</Label>
                    {!isEditable ? (
                      <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-800">
                        {region || <span className="text-gray-400">—</span>}
                      </div>
                    ) : !showNewRegion ? (
                      <div className="flex gap-2">
                        <Select value={region} onValueChange={setRegion}>
                          <SelectTrigger className="h-9 flex-1">
                            <SelectValue placeholder="Select region..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allRegions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setShowNewRegion(true)}>+</Button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex gap-2">
                          <Input placeholder="Enter new region..." value={newRegion} onChange={(e) => setNewRegion(e.target.value)} className="h-9" autoFocus />
                          <Button type="button" variant="outline" size="sm" className="h-9 bg-green-50 border-green-200 hover:bg-green-100 text-green-700"
                            disabled={!newRegion.trim() || getOptionWarning(newRegion, allRegions)?.type === "duplicate"}
                            onClick={() => {
                              const trimmed = newRegion.trim();
                              setRegion(trimmed);
                              addCustomRegion(trimmed);
                              setShowNewRegion(false); setNewRegion("");
                            }}>✓</Button>
                          <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => { setShowNewRegion(false); setNewRegion(""); }}><X className="w-4 h-4" /></Button>
                        </div>
                        {(() => { const w = getOptionWarning(newRegion, allRegions); return w ? (
                          <p className={`text-xs ${w.type === "duplicate" ? "text-red-500" : "text-amber-600"}`}>{w.msg}</p>
                        ) : null; })()}
                      </div>
                    )}
                  </div>

                  {/* Market Capitalization */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">Market Capitalization *</Label>
                    {!isEditable ? (
                      <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-800">
                        {marketCap || <span className="text-gray-400">—</span>}
                      </div>
                    ) : !showNewMarketCap ? (
                      <div className="flex gap-2">
                        <Select value={marketCap} onValueChange={setMarketCap}>
                          <SelectTrigger className="h-9 flex-1">
                            <SelectValue placeholder="Select market cap..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allMarketCaps.map((mc) => <SelectItem key={mc} value={mc}>{mc}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setShowNewMarketCap(true)}>+</Button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex gap-2">
                          <Input placeholder="Enter new market cap..." value={newMarketCap} onChange={(e) => setNewMarketCap(e.target.value)} className="h-9" autoFocus />
                          <Button type="button" variant="outline" size="sm" className="h-9 bg-green-50 border-green-200 hover:bg-green-100 text-green-700"
                            disabled={!newMarketCap.trim() || getOptionWarning(newMarketCap, allMarketCaps)?.type === "duplicate"}
                            onClick={() => {
                              const trimmed = newMarketCap.trim();
                              setMarketCap(trimmed);
                              addCustomMarketCap(trimmed);
                              setShowNewMarketCap(false); setNewMarketCap("");
                            }}>✓</Button>
                          <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => { setShowNewMarketCap(false); setNewMarketCap(""); }}><X className="w-4 h-4" /></Button>
                        </div>
                        {(() => { const w = getOptionWarning(newMarketCap, allMarketCaps); return w ? (
                          <p className={`text-xs ${w.type === "duplicate" ? "text-red-500" : "text-amber-600"}`}>{w.msg}</p>
                        ) : null; })()}
                      </div>
                    )}
                  </div>

                  {/* Style */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">Style *</Label>
                    {!isEditable ? (
                      <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-800">
                        {style || <span className="text-gray-400">—</span>}
                      </div>
                    ) : !showNewStyle ? (
                      <div className="flex gap-2">
                        <Select value={style} onValueChange={setStyle}>
                          <SelectTrigger className="h-9 flex-1">
                            <SelectValue placeholder="Select style..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allStyles.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setShowNewStyle(true)}>+</Button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex gap-2">
                          <Input placeholder="Enter new style..." value={newStyle} onChange={(e) => setNewStyle(e.target.value)} className="h-9" autoFocus />
                          <Button type="button" variant="outline" size="sm" className="h-9 bg-green-50 border-green-200 hover:bg-green-100 text-green-700"
                            disabled={!newStyle.trim() || getOptionWarning(newStyle, allStyles)?.type === "duplicate"}
                            onClick={() => {
                              const trimmed = newStyle.trim();
                              setStyle(trimmed);
                              addCustomStyle(trimmed);
                              setShowNewStyle(false); setNewStyle("");
                            }}>✓</Button>
                          <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => { setShowNewStyle(false); setNewStyle(""); }}><X className="w-4 h-4" /></Button>
                        </div>
                        {(() => { const w = getOptionWarning(newStyle, allStyles); return w ? (
                          <p className={`text-xs ${w.type === "duplicate" ? "text-red-500" : "text-amber-600"}`}>{w.msg}</p>
                        ) : null; })()}
                      </div>
                    )}
                  </div>

                  {/* Inception Date */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">Inception Date</Label>
                    {!isEditable ? (
                      <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-800">
                        {inceptionDate ? format(inceptionDate, "MM/dd/yyyy") : <span className="text-gray-400">—</span>}
                      </div>
                    ) : (
                      <Popover open={inceptionCalOpen} onOpenChange={setInceptionCalOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="h-9 w-full justify-start text-left font-normal text-sm">
                            <CalendarIcon className="mr-2 h-3.5 w-3.5 text-gray-400" />
                            {inceptionDate ? format(inceptionDate, "MM/dd/yyyy") : <span className="text-gray-400">Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={inceptionDate}
                            onSelect={(d) => { setInceptionDate(d); setInceptionCalOpen(false); }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* ── Returns Tab ── */}
          <TabsContent value="returns" className="flex-1 overflow-y-auto py-4">
            <BenchmarkReturnsTab
              returns={monthlyReturns}
              onChange={setMonthlyReturns}
              isEditing={isEditable}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2 border-t">
          <div>
            {mode === "view" && editingBenchmark && (
              <Button
                variant="ghost"
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => deleteMutation.mutate(editingBenchmark.id)}
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            {mode === "view" ? (
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            ) : mode === "edit" ? (
              <>
                <Button variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={!isValid || updateMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={!isValid || createMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  {createMutation.isPending ? "Adding..." : "Add Benchmark"}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}