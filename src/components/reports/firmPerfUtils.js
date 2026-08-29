import { FIRM_COLORS } from "@/components/firms/FirmMetricsTable";

export { FIRM_COLORS };

export function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function fmtCurrency(n) {
  if (n === null || n === undefined) return "—";
  const v = Math.round(toNumber(n));
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return v ? `$${v.toLocaleString()}` : "—";
}

export function compactCurrency(v) {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v}`;
}

export function getLatestAum(firm) {
  const hist = firm?.aum_history || [];
  if (!hist.length) return { aum: null, netFlow: null, date: null, gained: null, loss: null };
  const latest = [...hist].sort((a, b) =>
    (b.month_end_date || "").localeCompare(a.month_end_date || "")
  )[0];
  return {
    aum: latest.firm_aum,
    netFlow: latest.net_asset_flows,
    gained: latest.assets_gained,
    loss: latest.assets_loss,
    date: latest.month_end_date,
  };
}

export function getFirstAum(firm) {
  const hist = firm?.aum_history || [];
  if (!hist.length) return { aum: null, date: null };
  const first = [...hist].sort((a, b) =>
    (a.month_end_date || "").localeCompare(b.month_end_date || "")
  )[0];
  return { aum: first.firm_aum, date: first.month_end_date };
}

export function calcGrowthPct(firm) {
  const latest = getLatestAum(firm);
  const first = getFirstAum(firm);
  if (!latest.aum || !first.aum || first.aum === 0) return null;
  return ((latest.aum - first.aum) / first.aum) * 100;
}

export function getFirmProducts(firm, products) {
  return products.filter((p) => p.firm_id === firm.id && !p.deleted_at);
}

export function getFirmContacts(firm, contacts) {
  return contacts.filter((c) => (c.firm_ids || []).includes(firm.id) && !c.deleted_at);
}