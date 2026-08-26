import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Share2, Loader2, Info } from "lucide-react";
import ContactNetworkGraph from "@/components/network/ContactNetworkGraph";

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

/**
 * Shows how a firm's contacts are connected to each other through other shared firms.
 * Each contact is a node; contacts who also work together at another firm are linked
 * by that firm's node — revealing the internal network and bridge contacts.
 */
export default function FirmContactRelationshipMap({ firmId, onContactClick }) {
  const [selectedId, setSelectedId] = useState(null);
  const [resetKey, setResetKey] = useState(0);

  const { data: allContacts = [], isFetching: contactsLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });

  const { data: allFirms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 2000),
  });

  const { nodes, edges, stats, sharedFirmNames } = useMemo(() => {
    const firmMap = new Map(allFirms.filter(f => !f.deleted_at).map(f => [f.id, f]));
    const firmContacts = allContacts.filter(c => !c.deleted_at && c.firm_ids?.includes(firmId));

    // Find other firms shared between contacts of this firm
    const otherFirmIds = new Set();
    firmContacts.forEach(c => {
      (c.firm_ids || []).forEach(fid => { if (fid !== firmId) otherFirmIds.add(fid); });
    });

    // Only include shared firms that at least 2 contacts belong to
    const sharedFirmCounts = {};
    firmContacts.forEach(c => {
      (c.firm_ids || []).forEach(fid => {
        if (fid !== firmId && otherFirmIds.has(fid)) {
          sharedFirmCounts[fid] = (sharedFirmCounts[fid] || 0) + 1;
        }
      });
    });
    const sharedFirmIds = Object.entries(sharedFirmCounts)
      .filter(([, count]) => count >= 2)
      .map(([id]) => id);

    const sharedFirmNames = {};
    sharedFirmIds.forEach(id => {
      const f = firmMap.get(id);
      if (f) sharedFirmNames[id] = f.name;
    });

    // Build contact nodes
    const contactNodes = firmContacts.map(c => ({
      id: `contact-${c.id}`,
      label: formatContactName(c),
      sublabel: c.title,
      type: "contact",
      color: "#ec4899",
      radius: 14,
      image: c.photo_url,
      initials: [c.first_name?.[0], c.last_name?.[0]].filter(Boolean).join("").toUpperCase(),
      degree: (c.firm_ids || []).filter(fid => sharedFirmIds.includes(fid)).length,
      _entity: c,
      _entityType: "contact",
    }));

    // Build shared-firm nodes
    const firmNodes = sharedFirmIds.map(id => {
      const f = firmMap.get(id);
      if (!f) return null;
      const types = getFirmTypes(f);
      return {
        id: `firm-${id}`,
        label: f.name,
        type: "firm",
        color: FIRM_TYPE_COLORS[types[0]] || "#6366f1",
        radius: 12,
        degree: sharedFirmCounts[id],
        _entity: f,
        _entityType: "firm",
      };
    }).filter(Boolean);

    // Build edges: contact → shared firm
    const allEdges = [];
    const contactFirmMap = new Map(); // contactId -> Set of shared firm ids
    firmContacts.forEach(c => {
      const cShared = (c.firm_ids || []).filter(fid => sharedFirmIds.includes(fid));
      contactFirmMap.set(c.id, new Set(cShared));
      cShared.forEach(fid => {
        allEdges.push({ source: `contact-${c.id}`, target: `firm-${fid}` });
      });
    });

    // Count how many contact-to-contact connections exist (pairs sharing a firm)
    let pairCount = 0;
    for (let i = 0; i < firmContacts.length; i++) {
      for (let j = i + 1; j < firmContacts.length; j++) {
        const a = contactFirmMap.get(firmContacts[i].id);
        const b = contactFirmMap.get(firmContacts[j].id);
        if (a && b && [...a].some(id => b.has(id))) pairCount++;
      }
    }

    return {
      nodes: [...firmNodes, ...contactNodes],
      edges: allEdges,
      stats: {
        contactCount: firmContacts.length,
        sharedFirmCount: sharedFirmIds.length,
        pairCount,
      },
      sharedFirmNames,
    };
  }, [allContacts, allFirms, firmId]);

  const selectedNode = nodes.find(n => n.id === selectedId);

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-pink-100 text-pink-700 font-medium">
          {stats.contactCount} contact{stats.contactCount !== 1 ? "s" : ""}
        </span>
        {stats.sharedFirmCount > 0 ? (
          <>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-100 text-indigo-700 font-medium">
              {stats.sharedFirmCount} shared firm{stats.sharedFirmCount !== 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-100 text-amber-700 font-medium">
              {stats.pairCount} connection{stats.pairCount !== 1 ? "s" : ""}
            </span>
          </>
        ) : (
          <span className="text-gray-400 italic">No shared firm connections found</span>
        )}
      </div>

      {stats.sharedFirmCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-gray-200 rounded-xl">
          <Share2 className="w-8 h-8 text-gray-300 mb-2" />
          <p className="text-sm text-gray-500 font-medium">No cross-firm connections yet</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs">
            Connections appear when contacts at this firm also share another firm in common.
          </p>
        </div>
      ) : (
        <div className="relative border border-gray-200 rounded-xl bg-white overflow-hidden" style={{ height: "420px" }}>
          {contactsLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ) : (
            <ContactNetworkGraph
              key={resetKey}
              nodes={nodes}
              edges={edges}
              onNodeClick={(n) => {
                if (n._entityType === "contact" && onContactClick) {
                  onContactClick(n._entity);
                } else {
                  setSelectedId(n.id);
                }
              }}
              highlightId={selectedId}
            />
          )}

          {selectedNode && (
            <div className="absolute bottom-3 left-3 max-w-xs bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10">
              <div className="flex items-start gap-3">
                {selectedNode.image ? (
                  <img src={selectedNode.image} alt={selectedNode.label} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm" style={{ background: selectedNode.color }}>
                    {selectedNode.initials || <Share2 className="w-5 h-5" />}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-gray-800 truncate">{selectedNode.label}</p>
                  {selectedNode.sublabel && <p className="text-xs text-gray-500 truncate">{selectedNode.sublabel}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedNode.type === "firm" ? "Shared firm" : "Contact"} · {selectedNode.degree} connection{selectedNode.degree !== 1 ? "s" : ""}
                  </p>
                </div>
                <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
              </div>
            </div>
          )}

          <div className="absolute top-3 right-3 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded-md border border-gray-200 flex items-center gap-1">
            <Info className="w-3 h-3" /> Contacts linked through shared firms
          </div>
        </div>
      )}
    </div>
  );
}