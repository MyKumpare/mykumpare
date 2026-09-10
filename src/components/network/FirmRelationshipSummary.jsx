import React, { useState, useMemo } from "react";
import { Building2, DollarSign, PackageCheck, Users, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";

function formatCurrency(n) {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function latestAum(firm) {
  const hist = firm.aum_history;
  if (!hist || hist.length === 0) return null;
  const sorted = [...hist].sort((a, b) =>
    new Date(b.month_end_date || 0) - new Date(a.month_end_date || 0)
  );
  return sorted[0];
}

export default function FirmRelationshipSummary({ firms, products, contacts }) {
  const [sortKey, setSortKey] = useState("aum");
  const [sortDir, setSortDir] = useState("desc");

  const firmStats = useMemo(() => {
    const activeContactCount = new Map();
    (contacts || []).forEach((c) => {
      if (c.deleted_at) return;
      (c.firm_ids || []).forEach((fid) => {
        activeContactCount.set(fid, (activeContactCount.get(fid) || 0) + 1);
      });
    });

    const activeProductCount = new Map();
    (products || []).forEach((p) => {
      if (p.deleted_at) return;
      if (p.product_availability_status !== "Active") return;
      activeProductCount.set(p.firm_id, (activeProductCount.get(p.firm_id) || 0) + 1);
    });

    return (firms || [])
      .filter((f) => !f.deleted_at)
      .map((f) => {
        const aumPoint = latestAum(f);
        return {
          id: f.id,
          name: f.name,
          firm_type: f.firm_type,
          aum: aumPoint?.firm_aum ?? null,
          aumDate: aumPoint?.month_end_date || null,
          activeProducts: activeProductCount.get(f.id) || 0,
          contacts: activeContactCount.get(f.id) || 0,
        };
      });
  }, [firms, products, contacts]);

  const sorted = useMemo(() => {
    const list = [...firmStats];
    list.sort((a, b) => {
      let av, bv;
      switch (sortKey) {
        case "aum": av = a.aum ?? -1; bv = b.aum ?? -1; break;
        case "products": av = a.activeProducts; bv = b.activeProducts; break;
        case "contacts": av = a.contacts; bv = b.contacts; break;
        case "name": av = a.name.toLowerCase(); bv = b.name.toLowerCase(); break;
        default: av = 0; bv = 0;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [firmStats, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ col }) =>
    sortKey === col ? (sortDir === "asc" ? <ChevronUp className="w-3.5 h-3.5 inline" /> : <ChevronDown className="w-3.5 h-3.5 inline" />) : null;

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="p-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <Building2 className="w-4 h-4 text-indigo-500" /> Firm Relationship Health
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          AUM, active products, and contact coverage per firm — a quick relationship health check.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left font-medium px-4 py-2.5 cursor-pointer select-none" onClick={() => toggleSort("name")}>
                Firm <SortIcon col="name" />
              </th>
              <th className="text-left font-medium px-4 py-2.5">Type</th>
              <th className="text-right font-medium px-4 py-2.5 cursor-pointer select-none" onClick={() => toggleSort("aum")}>
                Total AUM <SortIcon col="aum" />
              </th>
              <th className="text-right font-medium px-4 py-2.5 cursor-pointer select-none" onClick={() => toggleSort("products")}>
                Active Products <SortIcon col="products" />
              </th>
              <th className="text-right font-medium px-4 py-2.5 cursor-pointer select-none" onClick={() => toggleSort("contacts")}>
                Contacts <SortIcon col="contacts" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-400">No firms found.</td>
              </tr>
            ) : (
              sorted.map((f) => {
                const hasContacts = f.contacts > 0;
                const hasProducts = f.activeProducts > 0;
                const hasAum = f.aum != null;
                return (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{f.name}</td>
                    <td className="px-4 py-2.5">
                      {f.firm_type ? (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">{f.firm_type}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-semibold ${hasAum ? "text-gray-800" : "text-gray-400"}`}>
                        {formatCurrency(f.aum)}
                      </span>
                      {f.aumDate && (
                        <div className="text-[10px] text-gray-400">{new Date(f.aumDate).toLocaleDateString()}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`inline-flex items-center gap-1 ${hasProducts ? "text-green-700" : "text-gray-400"}`}>
                        {hasProducts && <PackageCheck className="w-3.5 h-3.5" />}
                        {f.activeProducts}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`inline-flex items-center gap-1 ${hasContacts ? "text-pink-700" : "text-gray-400"}`}>
                        {hasContacts && <Users className="w-3.5 h-3.5" />}
                        {f.contacts}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}