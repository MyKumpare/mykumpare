import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Share2, Loader2, Building, User, Filter, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import ContactNetworkGraph from "@/components/network/ContactNetworkGraph";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const FIRM_TYPE_COLORS = {
  "Investment Manager": "#6366f1",
  "Allocator": "#10b981",
  "Investment Consultant": "#f59e0b",
  "Securities Brokerage": "#ef4444",
  "Trade Organizations": "#14b8a6",
};

function formatContactName(c) {
  return [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");
}

function getFirmTypes(f) {
  return f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];
}

export default function ContactNetwork() {
  const [search, setSearch] = useState("");
  const [minConnections, setMinConnections] = useState(2);
  const [firmTypeFilter, setFirmTypeFilter] = useState("All");
  const [selectedId, setSelectedId] = useState(null);
  const [resetKey, setResetKey] = useState(0);

  const { data: firms = [], isFetching: firmsLoading } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 2000),
  });

  const { data: contacts = [], isFetching: contactsLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });

  // Build the graph: only contacts with >= minConnections firms, filtered by firm type and search.
  const { nodes, edges, stats } = useMemo(() => {
    const activeFirms = firms.filter((f) => !f.deleted_at);
    const activeContacts = contacts.filter((c) => !c.deleted_at && c.firm_ids?.length);

    const firmMap = new Map(activeFirms.map((f) => [f.id, f]));

    // Filter firms by type
    const firmIdSet = new Set(
      firmTypeFilter === "All"
        ? activeFirms.map((f) => f.id)
        : activeFirms.filter((f) => getFirmTypes(f).includes(firmTypeFilter)).map((f) => f.id)
    );

    // Contacts with connections to visible firms
    let relevantContacts = activeContacts
      .map((c) => {
        const visibleFirmIds = (c.firm_ids || []).filter((id) => firmIdSet.has(id));
        return { ...c, _visibleFirmIds: visibleFirmIds };
      })
      .filter((c) => c._visibleFirmIds.length >= minConnections);

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchingFirmIds = new Set(
        activeFirms
          .filter((f) => firmIdSet.has(f.id) && f.name.toLowerCase().includes(q))
          .map((f) => f.id)
      );
      relevantContacts = relevantContacts.filter((c) => {
        const fullName = formatContactName(c).toLowerCase();
        return fullName.includes(q) || (c.title || "").toLowerCase().includes(q) || c._visibleFirmIds.some((id) => matchingFirmIds.has(id));
      });
    }

    // Limit to most-connected contacts for performance
    if (relevantContacts.length > 250) {
      relevantContacts.sort((a, b) => b._visibleFirmIds.length - a._visibleFirmIds.length);
      relevantContacts = relevantContacts.slice(0, 250);
    }

    // Collect firm IDs that are actually used
    const usedFirmIds = new Set();
    relevantContacts.forEach((c) => c._visibleFirmIds.forEach((id) => usedFirmIds.add(id)));

    // Build nodes
    const firmNodes = Array.from(usedFirmIds).map((id) => {
      const f = firmMap.get(id);
      if (!f) return null;
      const types = getFirmTypes(f);
      const color = FIRM_TYPE_COLORS[types[0]] || "#6366f1";
      return {
        id: `firm-${f.id}`,
        label: f.name,
        type: "firm",
        color,
        radius: 18,
        degree: 0,
        _entity: f,
        _entityType: "firm",
      };
    }).filter(Boolean);

    const contactNodes = relevantContacts.map((c) => {
      const initials = [c.first_name?.[0], c.last_name?.[0]].filter(Boolean).join("").toUpperCase();
      return {
        id: `contact-${c.id}`,
        label: formatContactName(c),
        sublabel: c.title,
        type: "contact",
        color: "#ec4899",
        radius: 12,
        image: c.photo_url,
        initials,
        degree: c._visibleFirmIds.length,
        _entity: c,
        _entityType: "contact",
      };
    });

    // Build edges
    const allEdges = [];
    contactNodes.forEach((cn) => {
      const c = cn._entity;
      c._visibleFirmIds.forEach((fid) => {
        allEdges.push({ source: cn.id, target: `firm-${fid}` });
      });
    });

    // Compute firm degrees
    const firmDegreeMap = {};
    allEdges.forEach((e) => {
      firmDegreeMap[e.target] = (firmDegreeMap[e.target] || 0) + 1;
    });
    firmNodes.forEach((fn) => { fn.degree = firmDegreeMap[fn.id] || 0; });

    return {
      nodes: [...firmNodes, ...contactNodes],
      edges: allEdges,
      stats: {
        firmCount: firmNodes.length,
        contactCount: contactNodes.length,
        edgeCount: allEdges.length,
        multiFirmContacts: relevantContacts.filter((c) => c._visibleFirmIds.length >= 3).length,
      },
    };
  }, [firms, contacts, minConnections, firmTypeFilter, search, resetKey]);

  const handleNodeClick = (node) => {
    setSelectedId(node.id);
  };

  const selectedNode = nodes.find((n) => n.id === selectedId);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md">
        <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Share2 className="w-6 h-6 flex-shrink-0" />
          <div>
            <h1 className="text-lg font-bold">Contact Network</h1>
            <p className="text-xs text-white/70">Visualize how contacts connect across firms and boards</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by contact or firm name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">Min firms:</label>
            <select
              value={minConnections}
              onChange={(e) => setMinConnections(Number(e.target.value))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value={1}>1+</option>
              <option value={2}>2+</option>
              <option value={3}>3+</option>
              <option value={4}>4+</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">Firm type:</label>
            <select
              value={firmTypeFilter}
              onChange={(e) => setFirmTypeFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="All">All Types</option>
              {Object.entries(FIRM_TYPE_COLORS).map(([type, color]) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setResetKey((k) => k + 1); setSelectedId(null); }}
          >
            <Maximize2 className="w-4 h-4 mr-1" /> Re-center
          </Button>
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap items-center gap-3 mb-3 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-medium">
            <Building className="w-3.5 h-3.5" /> {stats.firmCount} firms
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-pink-50 text-pink-700 font-medium">
            <User className="w-3.5 h-3.5" /> {stats.contactCount} contacts
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 font-medium">
            <Share2 className="w-3.5 h-3.5" /> {stats.edgeCount} connections
          </span>
          {stats.multiFirmContacts > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 font-medium">
              {stats.multiFirmContacts} contacts on 3+ boards
            </span>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 mb-3 text-xs text-gray-600">
          <span className="font-medium">Legend:</span>
          {Object.entries(FIRM_TYPE_COLORS).map(([type, color]) => (
            <span key={type} className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ background: color }} />
              {type}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-pink-500" />
            Contact
          </span>
        </div>

        {/* Graph canvas */}
        <div className="relative border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden" style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}>
          {firmsLoading || contactsLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : nodes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
              No contacts match the current filters. Try lowering the minimum connections.
            </div>
          ) : (
            <ContactNetworkGraph
              key={resetKey}
              nodes={nodes}
              edges={edges}
              onNodeClick={handleNodeClick}
              highlightId={selectedId}
            />
          )}

          {/* Selected node info card */}
          {selectedNode && (
            <div className="absolute bottom-3 left-3 max-w-xs bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10">
              <div className="flex items-start gap-3">
                {selectedNode.image ? (
                  <img src={selectedNode.image} alt={selectedNode.label} className="w-12 h-12 rounded-full object-cover border border-gray-200" />
                ) : (
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
                    style={{ background: selectedNode.color }}
                  >
                    {selectedNode.initials || <Building className="w-6 h-6" />}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-gray-800 truncate">{selectedNode.label}</p>
                  {selectedNode.sublabel && <p className="text-xs text-gray-500 truncate">{selectedNode.sublabel}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedNode.type === "firm" ? "Firm" : "Contact"} · {selectedNode.degree} connection{selectedNode.degree !== 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-gray-400 hover:text-gray-600 text-sm"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Help hint */}
          <div className="absolute top-3 right-3 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded-md border border-gray-200">
            Drag nodes · Scroll to zoom · Hover to highlight
          </div>
        </div>
      </div>
    </div>
  );
}