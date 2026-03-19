import React, { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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
}) {
  const queryClient = useQueryClient();
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

  useEffect(() => {
    if (!open) {
      setAssetClass("");
      setName("");
      setDescription("");
      setRegion("");
      setMarketCap("");
      setStyle("");
      setNewRegion("");
      setNewMarketCap("");
      setNewStyle("");
      setShowNewRegion(false);
      setShowNewMarketCap(false);
      setShowNewStyle(false);
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Benchmark.create(data),
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
        b.asset_class === assetClass
    );

  const isValid =
    assetClass &&
    name.trim() &&
    !isDuplicate &&
    (assetClass !== "Equity" ||
      (region && marketCap && style));

  const handleSubmit = () => {
    if (!isValid) return;

    const data = {
      asset_class: assetClass,
      name: name.trim(),
      description: description.trim(),
    };

    if (assetClass === "Equity") {
      data.region = showNewRegion ? newRegion : region;
      data.market_capitalization = showNewMarketCap ? newMarketCap : marketCap;
      data.style = showNewStyle ? newStyle : style;
    }

    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Benchmark</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Asset Class */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Asset Class *
            </Label>
            <Select value={assetClass} onValueChange={setAssetClass}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select asset class..." />
              </SelectTrigger>
              <SelectContent>
                {ASSET_CLASSES.map((ac) => (
                  <SelectItem key={ac} value={ac}>
                    {ac}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Benchmark Name *
            </Label>
            <Input
              placeholder="e.g. S&P 500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`h-9 ${isDuplicate ? "border-red-400 focus-visible:ring-red-400" : ""}`}
            />
            {isDuplicate && (
              <p className="text-xs text-red-500">
                This benchmark already exists.
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Description
            </Label>
            <Textarea
              placeholder="Brief description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-16 text-sm"
            />
          </div>

          {/* Equity-specific fields */}
          {assetClass === "Equity" && (
            <>
              {/* Region */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  Region *
                </Label>
                {!showNewRegion ? (
                  <div className="flex gap-2">
                    <Select value={region} onValueChange={setRegion}>
                      <SelectTrigger className="h-9 flex-1">
                        <SelectValue placeholder="Select region..." />
                      </SelectTrigger>
                      <SelectContent>
                        {EQUITY_REGIONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() => setShowNewRegion(true)}
                    >
                      +
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter new region..."
                      value={newRegion}
                      onChange={(e) => setNewRegion(e.target.value)}
                      className="h-9"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() => {
                        setShowNewRegion(false);
                        setNewRegion("");
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Market Capitalization */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  Market Capitalization *
                </Label>
                {!showNewMarketCap ? (
                  <div className="flex gap-2">
                    <Select
                      value={marketCap}
                      onValueChange={setMarketCap}
                    >
                      <SelectTrigger className="h-9 flex-1">
                        <SelectValue placeholder="Select market cap..." />
                      </SelectTrigger>
                      <SelectContent>
                        {EQUITY_MARKET_CAPS.map((mc) => (
                          <SelectItem key={mc} value={mc}>
                            {mc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() => setShowNewMarketCap(true)}
                    >
                      +
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter new market cap..."
                      value={newMarketCap}
                      onChange={(e) => setNewMarketCap(e.target.value)}
                      className="h-9"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() => {
                        setShowNewMarketCap(false);
                        setNewMarketCap("");
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Style */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  Style *
                </Label>
                {!showNewStyle ? (
                  <div className="flex gap-2">
                    <Select value={style} onValueChange={setStyle}>
                      <SelectTrigger className="h-9 flex-1">
                        <SelectValue placeholder="Select style..." />
                      </SelectTrigger>
                      <SelectContent>
                        {EQUITY_STYLES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() => setShowNewStyle(true)}
                    >
                      +
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter new style..."
                      value={newStyle}
                      onChange={(e) => setNewStyle(e.target.value)}
                      className="h-9"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() => {
                        setShowNewStyle(false);
                        setNewStyle("");
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || createMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {createMutation.isPending ? "Adding..." : "Add Benchmark"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}