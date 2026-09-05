import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Search, FileText, RefreshCw, X, Sparkles } from "lucide-react";

function formatContactName(c) {
  const name = [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");
  return c.designations?.length ? `${name}, ${c.designations.join(", ")}` : name;
}

export default function ContactShortBioDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("missing"); // all | missing | has
  const [hideInactive, setHideInactive] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState(null);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts", "short-bio-dashboard"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });

  const { data: firms = [] } = useQuery({
    queryKey: ["firms", "short-bio-dashboard"],
    queryFn: () => base44.entities.Firm.list("name", 1000),
  });

  const firmMap = useMemo(() => Object.fromEntries(firms.map((f) => [f.id, f])), [firms]);

  const enriched = useMemo(() => {
    return contacts
      .filter((c) => !c.deleted_at)
      .filter((c) => !hideInactive || c.contact_status !== "Inactive")
      .map((c) => {
        const hasBio = !!(c.short_biography && c.short_biography.trim());
        const firmNames = (c.firm_ids || [])
          .map((id) => firmMap[id]?.name)
          .filter(Boolean)
          .join(", ");
        return { ...c, hasBio, firmNames };
      });
  }, [contacts, firmMap, hideInactive]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((c) => {
      if (statusFilter === "missing" && c.hasBio) return false;
      if (statusFilter === "has" && !c.hasBio) return false;
      if (!q) return true;
      const name = formatContactName(c).toLowerCase();
      return name.includes(q) || (c.firmNames || "").toLowerCase().includes(q) || (c.title || "").toLowerCase().includes(q);
    });
  }, [enriched, search, statusFilter]);

  const stats = useMemo(() => {
    const total = enriched.length;
    const withBio = enriched.filter((c) => c.hasBio).length;
    const missing = total - withBio;
    return { total, withBio, missing };
  }, [enriched]);

  const pct = stats.total > 0 ? Math.round((stats.withBio / stats.total) * 100) : 0;

  // IDs of contacts missing a short bio (respecting active/inactive toggle)
  const missingIds = useMemo(
    () => enriched.filter((c) => !c.hasBio).map((c) => c.id),
    [enriched]
  );

  const handleGenerateMissing = async () => {
    if (missingIds.length === 0) return;
    setGenerating(true);
    setGenResult(null);
    try {
      const res = await base44.functions.invoke("generateMissingShortBios", {
        contact_ids: missingIds,
        batch_size: Math.min(missingIds.length, 150),
      });
      setGenResult(res?.data || res);
      await queryClient.invalidateQueries({ queryKey: ["contacts", "short-bio-dashboard"] });
    } catch (err) {
      setGenResult({ error: err.message || "Failed to generate bios" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h1 className="text-xl font-bold text-gray-800">Short Bio Tracker</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
              disabled={generating || missingIds.length === 0}
              onClick={handleGenerateMissing}
              title={missingIds.length === 0 ? "No contacts missing a short bio" : `Generate short bios for ${missingIds.length} contact${missingIds.length === 1 ? "" : "s"} using firm & role info`}
            >
              {generating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate Missing Bios
                </>
              )}
            </Button>
            <button
              onClick={() => navigate("/")}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          Track which contact profiles still need a short biography generated.
        </p>
        {genResult && !genResult.error && (
          <div className="mt-3 flex items-center gap-2 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>
              Generated <strong>{genResult.processed}</strong> short bio{genResult.processed === 1 ? "" : "s"}
              {genResult.remaining > 0 && <> — {genResult.remaining} remaining (run again to continue)</>}
              {genResult.errors?.length > 0 && <> · {genResult.errors.length} skipped</>}
            </span>
            <button onClick={() => setGenResult(null)} className="ml-auto text-green-600 hover:text-green-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {genResult?.error && (
          <div className="mt-3 flex items-center gap-2 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{genResult.error}</span>
            <button onClick={() => setGenResult(null)} className="ml-auto text-red-600 hover:text-red-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Total Contacts</div>
          <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Has Short Bio</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-green-600">{stats.withBio}</span>
            <span className="text-xs text-gray-400">{pct}%</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Missing Short Bio</div>
          <div className="text-2xl font-bold text-amber-600">{stats.missing}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search by name, firm, or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          <Button
            variant={statusFilter === "missing" ? "default" : "outline"}
            size="sm"
            className={statusFilter === "missing" ? "bg-amber-600 hover:bg-amber-700" : ""}
            onClick={() => setStatusFilter("missing")}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Missing ({stats.missing})
          </Button>
          <Button
            variant={statusFilter === "has" ? "default" : "outline"}
            size="sm"
            className={statusFilter === "has" ? "bg-green-600 hover:bg-green-700" : ""}
            onClick={() => setStatusFilter("has")}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Has Bio ({stats.withBio})
          </Button>
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("all")}
          >
            All ({stats.total})
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={hideInactive ? "text-green-700 bg-green-50" : "text-gray-500"}
          onClick={() => setHideInactive((v) => !v)}
        >
          <span className={`w-2 h-2 rounded-full ${hideInactive ? "bg-green-500" : "bg-gray-300"}`} />
          {hideInactive ? "Active Only" : "Show Inactive"}
        </Button>
      </div>

      {/* Contact list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
          {search || statusFilter !== "all"
            ? "No contacts match your filters."
            : "No contacts found."}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <div className="col-span-5">Contact</div>
            <div className="col-span-4">Firm</div>
            <div className="col-span-2">Title</div>
            <div className="col-span-1 text-center">Bio</div>
          </div>
          <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-sm hover:bg-gray-50"
              >
                <div className="col-span-5 font-medium text-gray-800 truncate">
                  {formatContactName(c)}
                </div>
                <div className="col-span-4 text-gray-500 truncate">{c.firmNames || "—"}</div>
                <div className="col-span-2 text-gray-400 truncate text-xs">{c.title || "—"}</div>
                <div className="col-span-1 flex justify-center">
                  {c.hasBio ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0 gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 hover:bg-amber-50 gap-1">
                      <AlertCircle className="w-3 h-3" />
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}