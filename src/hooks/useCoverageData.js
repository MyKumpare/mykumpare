import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Lifecycle stages used for the coverage tracker filters. Each DD record is
// classified into exactly one (priority order) so counts never double-count.
export const LIFECYCLE_STAGES = [
  "Pipeline",
  "Under Due Diligence",
  "Approved",
  "Funded",
  "Rejected",
];

// Resolve the active primary/secondary analyst for a DD record. Active means an
// analyst_history entry with no end_date; fall back to the denormalized fields
// on the record (older records without history).
export function getActiveAnalysts(dd) {
  const history = (dd.analyst_history || []).filter((e) => !e.end_date && e.contact_id);
  const primaryHist = history.find((e) => e.analyst_type === "primary");
  const secondaryHist = history.find((e) => e.analyst_type === "secondary");
  return {
    primary: primaryHist
      ? { id: primaryHist.contact_id, name: primaryHist.contact_name }
      : dd.primary_analyst_contact_id
        ? { id: dd.primary_analyst_contact_id, name: dd.primary_analyst_name || "" }
        : null,
    secondary: secondaryHist
      ? { id: secondaryHist.contact_id, name: secondaryHist.contact_name }
      : dd.secondary_analyst_contact_id
        ? { id: dd.secondary_analyst_contact_id, name: dd.secondary_analyst_name || "" }
        : null,
  };
}

// Single lifecycle classification per DD record (priority order).
export function getLifecycleStage(dd, product) {
  if (product?.funding_status === "Funded") return "Funded";
  if (product?.product_status === "Approved" || dd.status === "Buy List") return "Approved";
  if (dd.process_status === "In-process") return "Under Due Diligence";
  if (dd.status === "Rejected") return "Rejected";
  return "Pipeline";
}

export function getCurrentStageName(dd) {
  const stages = dd.stages || [];
  const idx = dd.current_stage_index ?? 0;
  return stages[idx]?.name || "";
}

/**
 * Loads due diligence, firms, products, and contacts and computes per-firm
 * and per-analyst coverage summaries. Shared by the CoverageTracker (analyst
 * personal view) and CoverageManagement (management overview) pages.
 */
export function useCoverageData() {
  const { data: ddRecords = [], isLoading: ddLoading } = useQuery({
    queryKey: ["due-diligence-all"],
    queryFn: () => base44.entities.DueDiligence.list("-created_date", 5000),
  });
  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date"),
  });
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });
  const { data: portfolios = [] } = useQuery({
    queryKey: ["portfolios"],
    queryFn: () => base44.entities.Portfolio.list("-created_date", 5000),
  });

  const activeDD = useMemo(() => ddRecords.filter((r) => !r.deleted_at), [ddRecords]);
  const activeFirms = useMemo(() => firms.filter((f) => !f.deleted_at), [firms]);
  const activeProducts = useMemo(() => products.filter((p) => !p.deleted_at), [products]);
  const activeContacts = useMemo(() => contacts.filter((c) => !c.deleted_at), [contacts]);
  const activePortfolios = useMemo(() => portfolios.filter((p) => !p.deleted_at), [portfolios]);

  const productById = useMemo(() => new Map(activeProducts.map((p) => [p.id, p])), [activeProducts]);
  const contactById = useMemo(() => new Map(activeContacts.map((c) => [c.id, c])), [activeContacts]);

  // Per-DD enriched records with resolved analysts, lifecycle, and current stage.
  const enrichedDD = useMemo(() => {
    return activeDD.map((dd) => {
      const product = productById.get(dd.product_id);
      const analysts = getActiveAnalysts(dd);
      return {
        ...dd,
        product,
        primaryAnalyst: analysts.primary,
        secondaryAnalyst: analysts.secondary,
        lifecycle: getLifecycleStage(dd, product),
        currentStage: getCurrentStageName(dd),
      };
    });
  }, [activeDD, productById]);

  // Per-firm coverage summary.
  const firmCoverage = useMemo(() => {
    const map = new Map();
    for (const f of activeFirms) {
      map.set(f.id, {
        firm: f,
        ddRecords: [],
        primaryAnalystIds: new Set(),
        secondaryAnalystIds: new Set(),
        hasCoverage: false,
        lifecycleCounts: { Pipeline: 0, "Under Due Diligence": 0, Approved: 0, Funded: 0, Rejected: 0 },
      });
    }
    for (const dd of enrichedDD) {
      const entry = map.get(dd.firm_id);
      if (!entry) continue;
      entry.ddRecords.push(dd);
      if (dd.primaryAnalyst) { entry.primaryAnalystIds.add(dd.primaryAnalyst.id); entry.hasCoverage = true; }
      if (dd.secondaryAnalyst) { entry.secondaryAnalystIds.add(dd.secondaryAnalyst.id); entry.hasCoverage = true; }
      entry.lifecycleCounts[dd.lifecycle] = (entry.lifecycleCounts[dd.lifecycle] || 0) + 1;
    }
    return map;
  }, [activeFirms, enrichedDD]);

  const uncoveredFirms = useMemo(
    () => activeFirms.filter((f) => !firmCoverage.get(f.id)?.hasCoverage),
    [activeFirms, firmCoverage]
  );

  // Per-analyst summary (one entry per analyst contact with active assignments).
  const analysts = useMemo(() => {
    const map = new Map();
    const ensure = (id, name) => {
      if (!id) return null;
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: name || "—",
          contact: contactById.get(id) || null,
          primaryFirms: new Set(),
          secondaryFirms: new Set(),
          primaryProducts: new Set(),
          secondaryProducts: new Set(),
          assignments: [],
        });
      }
      return map.get(id);
    };
    for (const dd of enrichedDD) {
      if (dd.primaryAnalyst) {
        const a = ensure(dd.primaryAnalyst.id, dd.primaryAnalyst.name);
        a.primaryFirms.add(dd.firm_id);
        a.primaryProducts.add(dd.product_id);
        a.assignments.push({ dd, role: "primary" });
      }
      if (dd.secondaryAnalyst) {
        const a = ensure(dd.secondaryAnalyst.id, dd.secondaryAnalyst.name);
        a.secondaryFirms.add(dd.firm_id);
        a.secondaryProducts.add(dd.product_id);
        a.assignments.push({ dd, role: "secondary" });
      }
    }
    return Array.from(map.values());
  }, [enrichedDD, contactById]);

  // Comprehensive per-analyst coverage burden across ALL assignment surfaces:
  // Xponance contact assignments on firms, products, portfolios, plus due
  // diligence primary/secondary analyst assignments. Each analyst entry holds
  // sets of primary/secondary assignments per entity type and a total burden
  // count, so the Coverage Management summary can show a full breakdown.
  const analystBurden = useMemo(() => {
    const map = new Map();
    const ensure = (id, name) => {
      if (!id) return null;
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: name || "—",
          contact: contactById.get(id) || null,
          firms: { primary: new Set(), secondary: new Set() },
          products: { primary: new Set(), secondary: new Set() },
          portfolios: { primary: new Set(), secondary: new Set() },
          dueDiligence: { primary: new Set(), secondary: new Set() },
        });
      }
      return map.get(id);
    };

    // Firm-level Xponance contact assignments.
    for (const f of activeFirms) {
      if (f.primary_xponance_contact_id) {
        const a = ensure(f.primary_xponance_contact_id, f.primary_xponance_contact_name);
        if (a) a.firms.primary.add(f.id);
      }
      if (f.secondary_xponance_contact_id) {
        const a = ensure(f.secondary_xponance_contact_id, f.secondary_xponance_contact_name);
        if (a) a.firms.secondary.add(f.id);
      }
    }
    // Product-level Xponance contact assignments.
    for (const p of activeProducts) {
      if (p.primary_xponance_contact_id) {
        const a = ensure(p.primary_xponance_contact_id, p.primary_xponance_contact_name);
        if (a) a.products.primary.add(p.id);
      }
      if (p.secondary_xponance_contact_id) {
        const a = ensure(p.secondary_xponance_contact_id, p.secondary_xponance_contact_name);
        if (a) a.products.secondary.add(p.id);
      }
    }
    // Portfolio-level Xponance contact assignments.
    for (const p of activePortfolios) {
      if (p.primary_xponance_contact_id) {
        const a = ensure(p.primary_xponance_contact_id, p.primary_xponance_contact_name);
        if (a) a.portfolios.primary.add(p.id);
      }
      if (p.secondary_xponance_contact_id) {
        const a = ensure(p.secondary_xponance_contact_id, p.secondary_xponance_contact_name);
        if (a) a.portfolios.secondary.add(p.id);
      }
    }
    // Due diligence primary/secondary analyst assignments.
    for (const dd of enrichedDD) {
      if (dd.primaryAnalyst) {
        const a = ensure(dd.primaryAnalyst.id, dd.primaryAnalyst.name);
        if (a) a.dueDiligence.primary.add(dd.id);
      }
      if (dd.secondaryAnalyst) {
        const a = ensure(dd.secondaryAnalyst.id, dd.secondaryAnalyst.name);
        if (a) a.dueDiligence.secondary.add(dd.id);
      }
    }

    return Array.from(map.values())
      .map((a) => ({
        ...a,
        firmsPrimary: a.firms.primary.size,
        firmsSecondary: a.firms.secondary.size,
        productsPrimary: a.products.primary.size,
        productsSecondary: a.products.secondary.size,
        portfoliosPrimary: a.portfolios.primary.size,
        portfoliosSecondary: a.portfolios.secondary.size,
        ddPrimary: a.dueDiligence.primary.size,
        ddSecondary: a.dueDiligence.secondary.size,
        total:
          a.firms.primary.size + a.firms.secondary.size +
          a.products.primary.size + a.products.secondary.size +
          a.portfolios.primary.size + a.portfolios.secondary.size +
          a.dueDiligence.primary.size + a.dueDiligence.secondary.size,
      }))
      .sort((a, b) => b.total - a.total);
  }, [activeFirms, activeProducts, activePortfolios, enrichedDD, contactById]);

  return {
    isLoading: ddLoading,
    ddRecords: enrichedDD,
    firms: activeFirms,
    products: activeProducts,
    contacts: activeContacts,
    portfolios: activePortfolios,
    firmCoverage,
    uncoveredFirms,
    analysts,
    analystBurden,
  };
}