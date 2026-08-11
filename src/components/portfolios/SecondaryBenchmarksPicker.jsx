import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, X, ChevronDown, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { findBenchmarkDuplicates } from "./benchmarkNameSimilarity";

const ASSET_CLASSES = ["Equity", "Fixed Income", "Commodities", "Real Estate", "Alternatives"];

/**
 * Multi-select picker for secondary benchmarks.
 * Shows selected benchmarks as chips with remove buttons, and an "Add" trigger
 * that opens a searchable popover with inline creation + duplicate detection.
 *
 * Props:
 *  - value: array of { benchmark_id, benchmark_name }
 *  - onChange: (array) => void
 *  - excludeIds: array of benchmark ids to exclude (e.g. primary benchmark id)
 */
export default function SecondaryBenchmarksPicker({ value = [], onChange, excludeIds = [] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [pendingName, setPendingName] = useState("");
  const [dupMatches, setDupMatches] = useState([]);
  const [showDupReview, setShowDupReview] = useState(false);

  const { data: benchmarks = [] } = useQuery({
    queryKey: ["benchmarks"],
    queryFn: () => base44.entities.Benchmark.list("-created_date", 500),
  });

  const selectedIds = useMemo(() => new Set(value.map((v) => v.benchmark_id)), [value]);
  const excludeSet = useMemo(() => new Set([...excludeIds, ...selectedIds]), [excludeIds, selectedIds]);

  const filtered = useMemo(
    () => benchmarks
      .filter((b) => !excludeSet.has(b.id))
      .filter((b) => b.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [benchmarks, search, excludeSet]
  );

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Benchmark.create(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["benchmarks"] });
      onChange([...value, { benchmark_id: created.id, benchmark_name: created.name }]);
      setShowAddDialog(false);
      setOpen(false);
      setSearch("");
      setPendingName("");
    },
  });

  const handleAdd = (benchmark) => {
    if (selectedIds.has(benchmark.id)) return;
    onChange([...value, { benchmark_id: benchmark.id, benchmark_name: benchmark.name }]);
    setOpen(false);
    setSearch("");
  };

  const handleRemove = (id) => {
    onChange(value.filter((v) => v.benchmark_id !== id));
  };

  const handleStartAdd = () => {
    setPendingName(search.trim());
    const matches = findBenchmarkDuplicates(search.trim(), benchmarks);
    if (matches.length > 0) {
      setDupMatches(matches);
      setShowDupReview(true);
    } else {
      setShowAddDialog(true);
    }
  };

  const handleAcceptDuplicate = (dup) => {
    handleAdd({ id: dup.id, name: dup.name });
    setShowDupReview(false);
    setDupMatches([]);
    setPendingName("");
  };

  const handleRejectDuplicate = () => {
    setShowDupReview(false);
    setShowAddDialog(true);
  };

  return (
    <>
      <div className="space-y-2">
        {value.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {value.map((b) => (
              <span key={b.benchmark_id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-xs font-medium text-indigo-700">
                {b.benchmark_name}
                <button
                  type="button"
                  onClick={() => handleRemove(b.benchmark_id)}
                  className="text-indigo-400 hover:text-indigo-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between h-9 text-sm font-normal" type="button">
              <span className="text-gray-400 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Add secondary benchmark...
              </span>
              <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[340px] p-0" align="start">
            <div className="p-2 border-b">
              <Input
                placeholder="Search benchmarks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm"
                autoFocus
              />
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-400 italic">No benchmarks found</div>
              )}
              {filtered.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 flex items-center gap-2"
                  onClick={() => handleAdd(b)}
                >
                  <Plus className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
                  <span className="truncate">{b.name}</span>
                  {b.asset_class && <span className="text-xs text-gray-400 ml-auto">{b.asset_class}</span>}
                </button>
              ))}
            </div>
            <div className="border-t p-1">
              <button
                type="button"
                disabled={!search.trim()}
                className="w-full text-left px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 flex items-center gap-1.5 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={handleStartAdd}
              >
                <Plus className="w-3.5 h-3.5" />
                Add new benchmark "{search.trim()}"...
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Duplicate review dialog */}
      <Dialog open={showDupReview} onOpenChange={(o) => { if (!o) { setShowDupReview(false); setDupMatches([]); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Possible Duplicate Benchmark
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            A similar benchmark already exists in the system. Please review the match{dupMatches.length > 1 ? "es" : ""} below. You can use the existing benchmark or create a new one anyway.
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {dupMatches.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-2 rounded-md border bg-gray-50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                  <p className="text-xs text-gray-500">{Math.round(m.score * 100)}% match</p>
                </div>
                <Button size="sm" onClick={() => handleAcceptDuplicate(m)}>Use this</Button>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => { setShowDupReview(false); setDupMatches([]); }}>Cancel</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleRejectDuplicate}>
              Create "{pendingName}" anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add new benchmark dialog */}
      <AddBenchmarkInline
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        defaultName={pendingName}
        benchmarks={benchmarks}
        onCreated={(created) => {
          queryClient.invalidateQueries({ queryKey: ["benchmarks"] });
          onChange([...value, { benchmark_id: created.id, benchmark_name: created.name }]);
          setShowAddDialog(false);
          setOpen(false);
          setSearch("");
          setPendingName("");
        }}
        createMutation={createMutation}
      />
    </>
  );
}

function AddBenchmarkInline({ open, onOpenChange, defaultName, benchmarks, onCreated, createMutation }) {
  const [name, setName] = useState("");
  const [assetClass, setAssetClass] = useState("Equity");
  const [description, setDescription] = useState("");
  const [submitMatches, setSubmitMatches] = useState([]);
  const [showSubmitReview, setShowSubmitReview] = useState(false);

  React.useEffect(() => {
    if (open) {
      setName(defaultName || "");
      setAssetClass("Equity");
      setDescription("");
      setSubmitMatches([]);
      setShowSubmitReview(false);
    }
  }, [open, defaultName]);

  const handleValidateAndSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const matches = findBenchmarkDuplicates(trimmed, benchmarks);
    if (matches.length > 0) {
      setSubmitMatches(matches);
      setShowSubmitReview(true);
    } else {
      doCreate();
    }
  };

  const doCreate = () => {
    createMutation.mutate(
      { name: name.trim(), asset_class: assetClass, description: description.trim() || undefined },
      { onSuccess: onCreated }
    );
  };

  const acceptSubmitDup = (dup) => {
    onCreated({ id: dup.id, name: dup.name });
    setShowSubmitReview(false);
  };

  return (
    <>
      <Dialog open={open && !showSubmitReview} onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Benchmark</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Benchmark Name <span className="text-red-400">*</span></Label>
              <Input
                placeholder="Enter benchmark name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 text-sm"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Asset Class <span className="text-red-400">*</span></Label>
              <Select value={assetClass} onValueChange={setAssetClass}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSET_CLASSES.map((ac) => <SelectItem key={ac} value={ac}>{ac}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Description</Label>
              <Input
                placeholder="Optional description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleValidateAndSubmit}
              disabled={!name.trim() || createMutation.isPending}
            >
              Add Benchmark
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSubmitReview} onOpenChange={(o) => { if (!o) setShowSubmitReview(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Possible Duplicate Benchmark
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            The benchmark "<strong>{name.trim()}</strong>" looks similar to existing benchmark{submitMatches.length > 1 ? "s" : ""}. Use the existing one or create a new one anyway.
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {submitMatches.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-2 rounded-md border bg-gray-50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                  <p className="text-xs text-gray-500">{Math.round(m.score * 100)}% match</p>
                </div>
                <Button size="sm" onClick={() => acceptSubmitDup(m)}>Use this</Button>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowSubmitReview(false)}>Cancel</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={doCreate} disabled={createMutation.isPending}>
              Create "{name.trim()}" anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}