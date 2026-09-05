import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Loader2, Info, RotateCcw, Filter } from "lucide-react";
import ContactNetworkGraph from "@/components/network/ContactNetworkGraph";
import { Button } from "@/components/ui/button";

const FIRM_TYPE_COLORS = {
  "Investment Manager": "#6366f1",
  Allocator: "#10b981",
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

const NODE_COLORS = {
  firm: "#6366f1",
  product: "#8b5cf6",
  portfolio: "#10b981",
  advisorPortfolio: "#0ea5e9",
  consultantFirm: "#f59e0b",
  consultantContact: "#ec4899",
  contact: "#3b82f6",
  subManager: "#64748b",
};

const FILTER_GROUPS = [
  { key: "products", label: "Products", nodeType: "product" },
  { key: "portfolios", label: "Portfolios (Allocator)", nodeType: "portfolio" },
  { key: "advisorPortfolios", label: "Portfolios (Advisor)", nodeType: "advisorPortfolio" },
  { key: "consultants", label: "Consultants", nodeType: "consultantFirm" },
  { key: "contacts", label: "Key Contacts", nodeType: "contact" },
];

/**
 * Unified visual relationship viewer for a firm. Maps out ALL connected
 * entities — products, portfolios (as allocator and/or advisor), investment
 * consultant firms and their contacts, and key personnel — in a single
 * force-directed graph so the user can see the full network structure at a
 * glance. Edges to consultant firms are labeled with the consultant's role(s).
 */
export default function FirmRelationshipViewer({ firmId, onContactClick, onFirmClick, onProductClick, onPortfolioClick }) {
  const [selectedId, setSelectedId] = useState(null);
  const [resetKey, setResetKey] = useState(0);
  const [filters, setFilters] = useState({
    products: true,
    portfolios: true,
    advisorPortfolios: true,
    consultants: true,
    contacts: true,
  });

  const { data: firm } = useQuery({
    queryKey: ["firm", firmId],
    queryFn: () => base44.entities.Firm.get(firmId),
    enabled: !!firmId,
  });

  const { data: allFirms = [], isLoading: firmsLoading } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date", 5000),
    select: (d) => d.filter((p) => !p.deleted_at),
  });

  const { data: portfolios = [] } = useQuery({
    queryKey: ["portfolios"],
    queryFn: () => base44.entities.Portfolio.list("-created_date", 5000),
    select: (d) => d.filter((p) => !p.deleted_at),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
    select: (d) => d.filter((c) => !c.deleted_at),
  });

  const { data: consultants = [] } = useQuery({
    queryKey: ["firm-consultants", firmId],
    queryFn: () => base44.entities.FirmConsultant.filter({ firm_id: firmId }, "-created_date", 200),
    enabled: !!firmId,
  });

  const { nodes, edges, stats } = useMemo(() => {
    if (!firm) return { nodes: [], edges: [], stats: {} };

    const firmMap = new Map(allFirms.filter((f) => !f.deleted_at).map((f) => [f.id, f]));
    const nodes = [];
    const edges = [];
    const stats = { products: 0, portfolios: 0, advisorPortfolios: 0, consultantFirms: 0, contacts: 0 };

    // Central firm node
    const firmTypes = getFirmTypes(firm);
    const firmColor = FIRM_TYPE_COLORS[firmTypes[0]] || "#6366f1";
    nodes.push({
      id: `firm-${firm.id}`,
      label: firm.name,
      sublabel: firmTypes.join(", "),
      type: "firm",
      color: firmColor,
      radius: 26,
      isCenter: true,
    });

    // Products
    if (filters.products) {
      const firmProducts = products.filter((p) => p.firm_id === firmId);
      stats.products = firmProducts.length;
      firmProducts.forEach((p) => {
        const nid = `product-${p.id}`;
        nodes.push({
          id: nid,
          label: p.name,
          sublabel: p.product_type,
          type: "product",
          color: NODE_COLORS.product,
          radius: 12,
        });
        edges.push({ source: `firm-${firm.id}`, target: nid });
      });
    }

    // Portfolios where this firm is the allocator
    if (filters.portfolios) {
      const allocPortfolios = portfolios.filter((p) => p.firm_id === firmId);
      stats.portfolios = allocPortfolios.length;
      allocPortfolios.forEach((p) => {
        const nid = `portfolio-${p.id}`;
        nodes.push({
          id: nid,
          label: p.portfolio_name,
          sublabel: p.advisor_firm_name || "—",
          type: "portfolio",
          color: NODE_COLORS.portfolio,
          radius: 12,
        });
        edges.push({ source: `firm-${firm.id}`, target: nid });
        // Link to advisor firm if it exists
        if (p.advisor_firm_id && firmMap.has(p.advisor_firm_id)) {
          const advId = `firm-${p.advisor_firm_id}`;
          if (!nodes.find((n) => n.id === advId)) {
            const advFirm = firmMap.get(p.advisor_firm_id);
            const advTypes = getFirmTypes(advFirm);
            nodes.push({
              id: advId,
              label: advFirm.name,
              sublabel: advTypes.join(", "),
              type: "advisorFirm",
              color: FIRM_TYPE_COLORS[advTypes[0]] || "#0ea5e9",
              radius: 16,
            });
          }
          edges.push({ source: nid, target: advId, label: "advised by" });
        }
      });
    }

    // Portfolios where this firm is the advisor (IM)
    if (filters.advisorPortfolios) {
      const advPortfolios = portfolios.filter((p) => p.advisor_firm_id === firmId);
      stats.advisorPortfolios = advPortfolios.length;
      advPortfolios.forEach((p) => {
        const nid = `advportfolio-${p.id}`;
        nodes.push({
          id: nid,
          label: p.portfolio_name,
          sublabel: p.allocator_name || "—",
          type: "advisorPortfolio",
          color: NODE_COLORS.advisorPortfolio,
          radius: 12,
        });
        edges.push({ source: `firm-${firm.id}`, target: nid });
        // Link to allocator firm
        if (p.firm_id && firmMap.has(p.firm_id)) {
          const allocId = `firm-${p.firm_id}`;
          if (!nodes.find((n) => n.id === allocId)) {
            const allocFirm = firmMap.get(p.firm_id);
            const allocTypes = getFirmTypes(allocFirm);
            nodes.push({
              id: allocId,
              label: allocFirm.name,
              sublabel: allocTypes.join(", "),
              type: "allocatorFirm",
              color: FIRM_TYPE_COLORS[allocTypes[0]] || "#10b981",
              radius: 16,
            });
          }
          edges.push({ source: nid, target: allocId, label: "allocator" });
        }
      });
    }

    // Investment consultants and their contacts
    if (filters.consultants) {
      const consultantFirmIds = new Set();
      consultants.forEach((fc) => {
        if (fc.consultant_firm_id) consultantFirmIds.add(fc.consultant_firm_id);
      });
      stats.consultantFirms = consultantFirmIds.size;

      consultantFirmIds.forEach((cfId) => {
        const cf = firmMap.get(cfId);
        if (!cf) return;
        const cfNode = `consultantfirm-${cfId}`;
        const cfTypes = getFirmTypes(cf);
        nodes.push({
          id: cfNode,
          label: cf.name,
          sublabel: cfTypes.join(", "),
          type: "consultantFirm",
          color: NODE_COLORS.consultantFirm,
          radius: 16,
        });

        // Edge from firm to consultant firm, labeled with roles
        const fcRecord = consultants.find((fc) => fc.consultant_firm_id === cfId);
        const roleLabel = fcRecord?.roles?.length ? fcRecord.roles.join(", ") : "Consultant";
        edges.push({ source: `firm-${firm.id}`, target: cfNode, label: roleLabel });

        // Consultant contacts
        const fcContacts = fcRecord?.contacts || [];
        fcContacts.forEach((cc) => {
          const ccNode = `consultantcontact-${cc.id}`;
          nodes.push({
            id: ccNode,
            label: cc.contact_name || "—",
            sublabel: cc.contact_role,
            type: "consultantContact",
            color: NODE_COLORS.consultantContact,
            radius: 10,
          });
          edges.push({ source: cfNode, target: ccNode, label: cc.contact_role });
        });
      });
    }

    // Key contacts at this firm (decision makers + influencers)
    if (filters.contacts) {
      const firmContacts = contacts.filter(
        (c) => (c.firm_ids || []).includes(firmId) && (c.decision_role || c.influence_level === "Final Decision Maker" || c.influence_level === "Decision Maker")
      );
      stats.contacts = firmContacts.length;
      firmContacts.slice(0, 20).forEach((c) => {
        const nid = `contact-${c.id}`;
        nodes.push({
          id: nid,
          label: formatContactName(c),
          sublabel: c.title || c.decision_role,
          type: "contact",
          color: NODE_COLORS.contact,
          radius: 11,
          image: c.photo_url,
          initials: [c.first_name?.[0], c.last_name?.[0]].filter(Boolean).join("").toUpperCase(),
        });
        edges.push({ source: `firm-${firm.id}`, target: nid });
      });
    }

    return { nodes, edges, stats };
  }, [firm, firmId, allFirms, products, portfolios, contacts, consultants, filters]);

  const handleNodeClick = (node) => {
    setSelectedId(node.id);
    if (node.id.startsWith("contact-") || node.id.startsWith("consultantcontact-")) {
      const contactId = node.id.replace("consultantcontact-", "").replace("contact-", "");
      onContactClick?.(contacts.find((c) => c.id === contactId));
    } else if (node.id.startsWith("product-")) {
      const productId = node.id.replace("product-", "");
      onProductClick?.(products.find((p) => p.id === productId));
    } else if (node.id.startsWith("portfolio-") || node.id.startsWith("advportfolio-")) {
      const portfolioId = node.id.replace("advportfolio-", "").replace("portfolio-", "");
      onPortfolioClick?.(portfolios.find((p) => p.id === portfolioId));
    } else if (node.id.startsWith("firm-") && node.id !== `firm-${firmId}`) {
      const firmIdMatch = node.id.replace("firm-", "");
      onFirmClick?.(allFirms.find((f) => f.id === firmIdMatch));
    }
  };

  if (firmsLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading relationship data...
      </div>
    );
  }

  if (!firm) {
    return (
      <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl">
        Firm data not available.
      </div>
    );
  }

  const totalNodes = nodes.length - 1; // exclude center firm
  const hasData = totalNodes > 0;

  return (
    <div className="space-y-3">
      {/* Filter toggles + stats */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mr-1">
          <Filter className="w-3.5 h-3.5" />
          <span>Show:</span>
        </div>
        {FILTER_GROUPS.map((g) => (
          <button
            key={g.key}
            onClick={() => setFilters((prev) => ({ ...prev, [g.key]: !prev[g.key] }))}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              filters[g.key]
                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                : "bg-gray-50 border-gray-200 text-gray-400"
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: NODE_COLORS[g.nodeType] }}
            />
            {g.label}
            <span className="text-[10px] font-bold ml-0.5">{stats[g.key] || 0}</span>
          </button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 ml-auto text-xs text-gray-500 hover:text-gray-700"
          onClick={() => setResetKey((k) => k + 1)}
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          Reset Layout
        </Button>
      </div>

      {/* Graph */}
      {hasData ? (
        <div className="border border-gray-200 rounded-xl bg-gradient-to-b from-gray-50 to-white overflow-hidden" style={{ height: "500px" }}>
          <ContactNetworkGraph
            key={resetKey}
            nodes={nodes}
            edges={edges}
            onNodeClick={handleNodeClick}
            highlightId={selectedId}
          />
        </div>
      ) : (
        <div className="text-sm text-gray-400 italic py-8 text-center border border-dashed border-gray-200 rounded-xl">
          No connected entities found. Enable filters above or add products, portfolios, or consultants to this firm.
        </div>
      )}

      {/* Legend */}
      {hasData && (
        <div className="flex flex-wrap items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Info className="w-3.5 h-3.5" />
            <span className="font-medium">Legend:</span>
          </div>
          <LegendItem color={NODE_COLORS.firm} label="This Firm" />
          <LegendItem color={NODE_COLORS.product} label="Product" />
          <LegendItem color={NODE_COLORS.portfolio} label="Portfolio (Allocator)" />
          <LegendItem color={NODE_COLORS.advisorPortfolio} label="Portfolio (Advisor)" />
          <LegendItem color={NODE_COLORS.consultantFirm} label="Consultant Firm" />
          <LegendItem color={NODE_COLORS.consultantContact} label="Consultant Contact" />
          <LegendItem color={NODE_COLORS.contact} label="Key Contact" />
        </div>
      )}
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  );
}