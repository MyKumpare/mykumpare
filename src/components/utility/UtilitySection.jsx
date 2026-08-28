import React, { useState, useMemo, useEffect } from "react";
// Utility section — tools for cleanup, imports, and validation
import { ChevronDown, ChevronRight, Plus, Gauge, Wrench, Search, ArrowLeft, Users, Sparkles, ScrollText, ShieldCheck, Ghost, Upload, Download, Eraser, Tag, UserX, Briefcase, Building, Package, Activity, Newspaper,   ArrowRightLeft, ExternalLink, ClipboardCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import AddBenchmarkDialog from "./AddBenchmarkDialog";
import DuplicateContactsReview from "@/components/contacts/DuplicateContactsReview";
import BulkMergeContacts from "./BulkMergeContacts";
import EnrichmentLogsView from "./EnrichmentLogsView";
import OrphanRecordCleanup from "./OrphanRecordCleanup";
import OrphanedContactsCleanup from "./OrphanedContactsCleanup";
import DueDiligenceCleanup from "./DueDiligenceCleanup";
import CsvContactImport from "./CsvContactImport";
import CsvFirmImport from "./CsvFirmImport";
import FirmImportWizard from "./FirmImportWizard";
import BenchmarkTemplateDialog from "./BenchmarkTemplateDialog";
import BenchmarkBulkReturnsToolbar from "./BenchmarkBulkReturnsToolbar";
import { downloadBenchmarkTemplate } from "./benchmarkTemplate";
import CsvProductImport from "./CsvProductImport";
import PlaceholderCleanup from "./PlaceholderCleanup";
import FirmTypeValidation from "./FirmTypeValidation";
import ExperienceOptionCleanup from "./ExperienceOptionCleanup";
import ImportJobsDashboard from "./ImportJobsDashboard";
import NewsScrubSettings from "./NewsScrubSettings";
import DashboardTimelineSection from "@/components/dashboard/DashboardTimelineSection";
import DashboardAnalystCoverageSection from "@/components/dashboard/DashboardAnalystCoverageSection";
import DashboardFirmCoverageSection from "@/components/dashboard/DashboardFirmCoverageSection";
import { TrendingUp, Network, ArrowRight } from "lucide-react";
import UtilityModuleGrid from "./UtilityModuleGrid";
import { getActiveUtilityModules, buildDefaultUtilityCategories, UTILITY_MODULE_MAP } from "./utilityModules";

function BenchmarkItem({ b, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-white hover:bg-gray-50 text-sm cursor-pointer text-left"
    >
      <Gauge className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-800 truncate">{b.name}</p>
        {(b.region || b.market_capitalization || b.style || b.asset_class) && (
          <p className="text-[11px] text-gray-400 truncate">
            {[b.asset_class, b.region, b.market_capitalization, b.style].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </button>
  );
}

function CollapsibleGroup({ label, labelClass = "text-xs font-semibold text-indigo-600 uppercase tracking-wide", indent = 0, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ paddingLeft: indent * 8 }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 w-full text-left mb-1 group"
      >
        {open
          ? <ChevronDown className="w-3 h-3 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
          : <ChevronRight className="w-3 h-3 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
        }
        <span className={labelClass}>{label}</span>
      </button>
      {open && children}
    </div>
  );
}

export default function UtilitySection({ deletedCount, forceExpanded = false, onFirmClick, defaultView, onOpenExternalPortal, onActivityClick, onContactClick, onProductClick, firms = [], products = [], activeContacts = [] }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isManagement = user?.is_management;
  const [expanded, setExpanded] = useState(false);
  // null = categorized selection grid; a tool key = that tool's view.
  // "import-firms" is special: it opens the wizard dialog, not an inline view,
  // so it must not initialize `view` (which would render an empty "Back to selection" panel).
  const [view, setView] = useState(defaultView === "import-firms" ? null : (defaultView || null));
  const [benchmarkDialogOpen, setBenchmarkDialogOpen] = useState(false);
  const [selectedBenchmark, setSelectedBenchmark] = useState(null);
  const [benchmarkQuery, setBenchmarkQuery] = useState("");
  const [cleanupStarted, setCleanupStarted] = useState(false);
  const [firmWizardOpen, setFirmWizardOpen] = useState(false);
  const [benchmarkTemplateOpen, setBenchmarkTemplateOpen] = useState(false);

  // When opened from the header dropdown with defaultView="import-firms",
  // open the wizard dialog directly instead of showing an inline view.
  useEffect(() => {
    if (defaultView === "import-firms") {
      setFirmWizardOpen(true);
    }
  }, [defaultView]);

  // Role-filtered module list + default categorization for the draggable grid
  const activeModules = useMemo(
    () => getActiveUtilityModules({ isAdmin, isManagement }),
    [isAdmin, isManagement]
  );
  const defaultCategories = useMemo(
    () => buildDefaultUtilityCategories({ isAdmin, isManagement }),
    [isAdmin, isManagement]
  );

  // Open a utility module from the grid: navigate, run a special action, or switch to the tool view
  const handleModuleSelect = (key) => {
    const mod = UTILITY_MODULE_MAP[key];
    if (!mod) return;
    if (mod.to) { navigate(mod.to); return; }
    if (mod.action === "ext-portal") { onOpenExternalPortal?.(); return; }
    // The firm import opens as a step-by-step wizard dialog.
    if (key === "import-firms") { setFirmWizardOpen(true); return; }
    setView(key);
    setCleanupStarted(false);
  };

  // Expand + reset to selection grid when the parent requests it (e.g. clicking the Utilities header icon),
  // while still letting the user collapse it manually afterwards.
  useEffect(() => {
    if (forceExpanded !== undefined) setExpanded(forceExpanded);
    if (forceExpanded && !defaultView) {
      setView(null);
      setCleanupStarted(false);
    }
  }, [forceExpanded]);

  const { data: benchmarks = [] } = useQuery({
    queryKey: ["benchmarks"],
    queryFn: () => base44.entities.Benchmark.list("-created_date"),
  });

  const filteredBenchmarks = useMemo(() => {
    const q = benchmarkQuery.trim().toLowerCase();
    if (!q) return benchmarks;
    return benchmarks.filter(b =>
      (b.name || "").toLowerCase().includes(q) ||
      (b.asset_class || "").toLowerCase().includes(q) ||
      (b.region || "").toLowerCase().includes(q) ||
      (b.market_capitalization || "").toLowerCase().includes(q) ||
      (b.style || "").toLowerCase().includes(q)
    );
  }, [benchmarks, benchmarkQuery]);

  const groupedBenchmarks = useMemo(() => {
    const equityBenchmarks = filteredBenchmarks
      .filter(b => b.asset_class === "Equity")
      .sort((a, b) =>
        (a.region || "").localeCompare(b.region || "") ||
        (a.market_capitalization || "").localeCompare(b.market_capitalization || "") ||
        (a.style || "").localeCompare(b.style || "") ||
        a.name.localeCompare(b.name)
      );

    const equityGroups = {};
    for (const b of equityBenchmarks) {
      const r = b.region || "—";
      const mc = b.market_capitalization || "—";
      const s = b.style || "—";
      if (!equityGroups[r]) equityGroups[r] = {};
      if (!equityGroups[r][mc]) equityGroups[r][mc] = {};
      if (!equityGroups[r][mc][s]) equityGroups[r][mc][s] = [];
      equityGroups[r][mc][s].push(b);
    }

    const nonEquity = filteredBenchmarks
      .filter(b => b.asset_class !== "Equity")
      .sort((a, b) => (a.asset_class || "").localeCompare(b.asset_class || "") || a.name.localeCompare(b.name));

    const nonEquityGroups = {};
    for (const b of nonEquity) {
      const ac = b.asset_class || "Other";
      if (!nonEquityGroups[ac]) nonEquityGroups[ac] = [];
      nonEquityGroups[ac].push(b);
    }

    return { equityGroups, nonEquityGroups, hasEquity: equityBenchmarks.length > 0, hasNonEquity: nonEquity.length > 0 };
  }, [filteredBenchmarks]);

  const openBenchmark = (b) => {
    setSelectedBenchmark(b);
    setBenchmarkDialogOpen(true);
  };

  const searching = benchmarkQuery.trim().length > 0;

  return (
    <div className="mb-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 group"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          )}
          <Wrench className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
            Utility
          </span>
        </button>
      </div>

      {expanded && (
        <div className="pl-2 border-l-2 border-gray-100">
          {/* Sub-view navigation */}
          {view !== null && (
            <button
              onClick={() => { setView(null); setCleanupStarted(false); }}
              className="flex items-center gap-1 mb-2 text-xs text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-3 h-3" />
              Back to selection
            </button>
          )}

          {/* Selection grid (categorized, draggable — mirrors Monitor) */}
          {view === null && (
            <UtilityModuleGrid
              modules={activeModules}
              defaultCategories={defaultCategories}
              onSelect={handleModuleSelect}
            />
          )}

          {/* Benchmark view */}
          {view === "benchmark" && (
            <div className="space-y-2">
              <div className="flex items-center justify-end gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
                  onClick={() => { setSelectedBenchmark(null); setBenchmarkDialogOpen(true); }}
                >
                  <Plus className="w-3 h-3" />
                  Add Benchmark
                </Button>
              </div>

              <BenchmarkBulkReturnsToolbar
                benchmarks={filteredBenchmarks}
                onUploadTemplate={() => setBenchmarkTemplateOpen(true)}
              />

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={benchmarkQuery}
                  onChange={(e) => setBenchmarkQuery(e.target.value)}
                  placeholder="Search by name, region, cap, style..."
                  className="w-full pl-8 pr-3 h-8 rounded-lg bg-white border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                />
              </div>

              {filteredBenchmarks.length === 0 ? (
                <p className="text-xs text-gray-400 px-1 py-2">
                  {searching ? "No benchmarks match your search." : "No benchmarks yet."}
                </p>
              ) : (
                <div className="space-y-1">
                  {groupedBenchmarks.hasEquity && Object.entries(groupedBenchmarks.equityGroups)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([region, byMc]) => (
                      <CollapsibleGroup key={region} label={region} defaultOpen={true} labelClass="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <div className="space-y-1">
                          {Object.entries(byMc)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([mc, byStyle]) => (
                              <CollapsibleGroup key={mc} label={mc} defaultOpen={true} indent={1} labelClass="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                                <div className="space-y-1">
                                  {Object.entries(byStyle)
                                    .sort(([a], [b]) => a.localeCompare(b))
                                    .map(([style, items]) => (
                                      <CollapsibleGroup key={style} label={style} defaultOpen={true} indent={2} labelClass="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                                        <div className="space-y-1">
                                          {items.map(b => (
                                            <BenchmarkItem key={b.id} b={b} onClick={() => openBenchmark(b)} />
                                          ))}
                                        </div>
                                      </CollapsibleGroup>
                                    ))}
                                </div>
                              </CollapsibleGroup>
                            ))}
                        </div>
                      </CollapsibleGroup>
                    ))}

                  {groupedBenchmarks.hasNonEquity && Object.entries(groupedBenchmarks.nonEquityGroups)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([ac, items]) => (
                      <CollapsibleGroup key={ac} label={ac} defaultOpen={true} labelClass="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <div className="space-y-1">
                          {items.map(b => (
                            <BenchmarkItem key={b.id} b={b} onClick={() => openBenchmark(b)} />
                          ))}
                        </div>
                      </CollapsibleGroup>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Contact cleanup view */}
          {view === "cleanup" && (
            <div className="space-y-3 py-1">
              {!cleanupStarted ? (
                <div className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-dashed border-gray-200 bg-white text-center">
                  <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Contact Cleanup</p>
                    <p className="text-xs text-gray-400 mt-1">Find and merge duplicate contact records.</p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setCleanupStarted(true)}
                    className="bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    Start Contact Cleanup
                  </Button>
                </div>
              ) : (
                <DuplicateContactsReview />
              )}
            </div>
          )}

          {/* Bulk merge view */}
          {view === "bulk-merge" && (
            <BulkMergeContacts />
          )}

          {/* Enrichment logs view */}
          {view === "enrichment-logs" && (
            <EnrichmentLogsView />
          )}

          {/* Orphan record cleanup view */}
          {view === "orphans" && (
            <OrphanRecordCleanup />
          )}

          {/* Due diligence integrity cleanup view */}
          {view === "dd-cleanup" && (
            <DueDiligenceCleanup />
          )}

          {/* CSV contact import view */}
          {view === "import-contacts" && (
            <CsvContactImport />
          )}

          {/* CSV product import view */}
          {view === "import-products" && (
            <CsvProductImport />
          )}

          {/* Placeholder cleanup view */}
          {view === "placeholder-cleanup" && (
            <PlaceholderCleanup />
          )}

          {/* Firm type validation view */}
          {view === "firm-type-validation" && (
            <FirmTypeValidation onFirmClick={onFirmClick} />
          )}

          {/* Company / Title option cleanup view */}
          {view === "experience-option-cleanup" && (
            <ExperienceOptionCleanup />
          )}

          {/* Orphaned contacts cleanup view */}
          {view === "orphaned-contacts" && (
            <OrphanedContactsCleanup onFirmClick={onFirmClick} />
          )}

          {/* Import jobs status dashboard */}
          {view === "import-jobs" && (
            <ImportJobsDashboard />
          )}

          {/* News scrub settings (admin) */}
          {view === "news-scrub-settings" && (
            <NewsScrubSettings />
          )}

          {/* Management: Activity Timeline */}
          {view === "mgmt-timeline" && (
            <DashboardTimelineSection
              forceExpanded={forceExpanded}
              onActivityClick={onActivityClick}
            />
          )}

          {/* Management: Analyst Coverage */}
          {view === "mgmt-analyst-coverage" && (
            <DashboardAnalystCoverageSection
              forceExpanded={forceExpanded}
              onFirmClick={(firmId) => {
                const f = firms.find((x) => x.id === firmId);
                if (f) onFirmClick?.(f);
              }}
            />
          )}

          {/* Management: Firm Coverage */}
          {view === "mgmt-firm-coverage" && (
            <DashboardFirmCoverageSection
              forceExpanded={forceExpanded}
              onFirmClick={(firmId) => {
                const f = firms.find((x) => x.id === firmId);
                if (f) onFirmClick?.(f);
              }}
              onProductClick={(productId) => {
                const p = products.find((x) => x.id === productId);
                if (p) onProductClick?.(p);
              }}
            />
          )}
        </div>
      )}

      <AddBenchmarkDialog
        open={benchmarkDialogOpen}
        onOpenChange={(v) => { setBenchmarkDialogOpen(v); if (!v) setSelectedBenchmark(null); }}
        benchmarks={benchmarks}
        editingBenchmark={selectedBenchmark}
      />

      <FirmImportWizard open={firmWizardOpen} onOpenChange={setFirmWizardOpen} />

      <BenchmarkTemplateDialog
        open={benchmarkTemplateOpen}
        onOpenChange={setBenchmarkTemplateOpen}
        existingBenchmarks={benchmarks}
      />
    </div>
  );
}