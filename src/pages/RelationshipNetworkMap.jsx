import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Network, Loader2, User, Filter, Maximize2, X } from "lucide-react";
import ContactNetworkGraph from "@/components/network/ContactNetworkGraph";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const RELATIONSHIP_COLORS = {
  Mentor: "#f59e0b",
  Mentee: "#14b8a6",
  "Former Colleague": "#3b82f6",
  Client: "#6366f1",
  "Service Provider": "#06b6d4",
  "Business Partner": "#a855f7",
  "Referral Source": "#f43f5e",
  Friend: "#10b981",
  "Family Member": "#ec4899",
  Other: "#9ca3af",
};

const TIER_COLORS = {
  "Primary Decision Maker": "#dc2626",
  "Board Member": "#7c3aed",
  "Key Influencer": "#ea580c",
  "Secondary Contact": "#0891b2",
  Other: "#6b7280",
};

function formatContactName(c) {
  if (!c) return "";
  return [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");
}

export default function RelationshipNetworkMap() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [selectedId, setSelectedId] = useState(null);
  const [resetKey, setResetKey] = useState(0);

  const { data: relationships = [], isLoading: relsLoading } = useQuery({
    queryKey: ["all_contact_relationships"],
    queryFn: () => base44.entities.ContactRelationship.list("-created_date", 2000),
  });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });

  const { nodes, edges, stats } = useMemo(() => {
    const activeContacts = contacts.filter((c) => !c.deleted_at);
    const contactMap = new Map(activeContacts.map((c) => [c.id, c]));

    // Filter by relationship type
    let rels = typeFilter === "All" ? relationships : relationships.filter((r) => r.relationship_type === typeFilter);

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      rels = rels.filter((r) => {
        const a = contactMap.get(r.contact_a_id);
        const b = contactMap.get(r.contact_b_id);
        const nameA = a ? formatContactName(a).toLowerCase() : (r.contact_a_name || "").toLowerCase();
        const nameB = b ? formatContactName(b).toLowerCase() : (r.contact_b_name || "").toLowerCase();
        return nameA.includes(q) || nameB.includes(q);
      });
    }

    // Collect unique contact IDs
    const contactIds = new Set();
    rels.forEach((r) => {
      contactIds.add(r.contact_a_id);
      contactIds.add(r.contact_b_id);
    });

    // Build nodes
    const contactNodes = Array.from(contactIds).map((id) => {
      const c = contactMap.get(id);
      const fallbackName =
        relationships.find((r) => r.contact_a_id === id)?.contact_a_name ||
        relationships.find((r) => r.contact_b_id === id)?.contact_b_name ||
        "Unknown";
      const name = c ? formatContactName(c) : fallbackName;
      const initials = c ? [c.first_name?.[0], c.last_name?.[0]].filter(Boolean).join("").toUpperCase() : "?";
      const tier = c?.decision_role || "Other";
      return {
        id: `contact-${id}`,
        entityId: id,
        label: name,
        sublabel: c?.title,
        type: "contact",
        color: TIER_COLORS[tier] || "#ec4899",
        radius: 14,
        image: c?.photo_url,
        initials,
        degree: 0,
        tier,
        _entity: c,
      };
    });

    // Build edges with relationship-type colors
    const allEdges = rels.map((r) => ({
      source: `contact-${r.contact_a_id}`,
      target: `contact-${r.contact_b_id}`,
      color: RELATIONSHIP_COLORS[r.relationship_type] || "#cbd5e1",
      width: 2,
      relationshipType: r.relationship_type,
    }));

    // Compute degrees
    const degreeMap = {};
    allEdges.forEach((e) => {
      degreeMap[e.source] = (degreeMap[e.source] || 0) + 1;
      degreeMap[e.target] = (degreeMap[e.target] || 0) + 1;
    });
    contactNodes.forEach((n) => { n.degree = degreeMap[n.id] || 0; });

    // Type distribution
    const typeCounts = {};
    rels.forEach((r) => {
      typeCounts[r.relationship_type] = (typeCounts[r.relationship_type] || 0) + 1;
    });

    return {
      nodes: contactNodes,
      edges: allEdges,
      stats: { contactCount: contactNodes.length, edgeCount: allEdges.length, typeCounts },
    };
  }, [relationships, contacts, typeFilter, search, resetKey]);

  const handleNodeClick = (node) => setSelectedId(node.id);
  const selectedNode = nodes.find((n) => n.id === selectedId);
  const selectedEdges = selectedId ? edges.filter((e) => e.source === selectedId || e.target === selectedId) : [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md">
        <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Network className="w-6 h-6 flex-shrink-0" />
          <div>
            <h1 className="text-lg font-bold">Relationship Network Map</h1>
            <p className="text-xs text-white/70">Visualize the relationships you've defined between your contacts</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(-1)}
            className="ml-auto bg-white/15 hover:bg-white/25 text-white border-none"
          >
            <X className="w-4 h-4" /> Close
          </Button>
        </div>
      </div>

      <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by contact name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">Relationship:</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="All">All Types</option>
              {Object.entries(RELATIONSHIP_COLORS).map(([type]) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setResetKey((k) => k + 1); setSelectedId(null); }}>
            <Maximize2 className="w-4 h-4 mr-1" /> Re-center
          </Button>
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap items-center gap-3 mb-3 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-pink-50 text-pink-700 font-medium">
            <User className="w-3.5 h-3.5" /> {stats.contactCount} contacts
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-medium">
            <Network className="w-3.5 h-3.5" /> {stats.edgeCount} relationships
          </span>
        </div>

        {/* Relationship type legend */}
        <div className="flex flex-wrap items-center gap-3 mb-3 text-xs text-gray-600">
          <span className="font-medium">Relationship types:</span>
          {Object.entries(RELATIONSHIP_COLORS).map(([type, color]) => {
            const count = stats.typeCounts?.[type] || 0;
            if (count === 0 && typeFilter !== "All" && typeFilter !== type) return null;
            return (
              <span key={type} className="inline-flex items-center gap-1.5">
                <span className="w-4 h-0.5 rounded" style={{ background: color }} />
                {type} {count > 0 && <span className="text-gray-400">({count})</span>}
              </span>
            );
          })}
        </div>

        {/* Tier legend */}
        <div className="flex flex-wrap items-center gap-3 mb-3 text-xs text-gray-600">
          <span className="font-medium">Contact tiers:</span>
          {Object.entries(TIER_COLORS).map(([tier, color]) => (
            <span key={tier} className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ background: color }} />
              {tier}
            </span>
          ))}
        </div>

        {/* Graph canvas */}
        <div className="relative border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden" style={{ height: "calc(100vh - 340px)", minHeight: "500px" }}>
          {relsLoading || contactsLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : nodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
              <Network className="w-8 h-8 text-gray-300" />
              <p>No relationships defined yet.</p>
              <p className="text-xs">Open a contact's profile and use the Relationships tab to link contacts together.</p>
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
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: selectedNode.color }}>
                    {selectedNode.initials || <User className="w-6 h-6" />}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-gray-800 truncate">{selectedNode.label}</p>
                  {selectedNode.sublabel && <p className="text-xs text-gray-500 truncate">{selectedNode.sublabel}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedNode.tier} · {selectedNode.degree} relationship{selectedNode.degree !== 1 ? "s" : ""}
                  </p>
                  {selectedEdges.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {selectedEdges.map((e, i) => {
                        const otherId = e.source === selectedNode.id ? e.target : e.source;
                        const otherNode = nodes.find((n) => n.id === otherId);
                        return (
                          <div key={i} className="text-[11px] flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
                            <span className="text-gray-700 font-medium truncate">{otherNode?.label || "Unknown"}</span>
                            <span className="text-gray-400 truncate">· {e.relationshipType}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600 text-sm">
                  <X className="w-4 h-4" />
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