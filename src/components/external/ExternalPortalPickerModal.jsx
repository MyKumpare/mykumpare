import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Search, ExternalLink, X, MapPin, Phone, Globe } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Global picker modal that lists all external firms with portal access.
 * Clicking a firm navigates to that firm's external portal (view-only for main system users).
 */
export default function ExternalPortalPickerModal({ open, onClose }) {
  const [search, setSearch] = useState("");

  const { data: firms = [], isLoading } = useQuery({
    queryKey: ["external_firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
    enabled: open,
  });

  // External firms are those whose tenant_id differs from their own id
  // (i.e., they were created by a different tenant). We also include firms
  // that have at least one external party PendingInvitation.
  const { data: externalInvites = [] } = useQuery({
    queryKey: ["external_party_invites"],
    queryFn: () => base44.entities.PendingInvitation.filter({ invitation_type: "external_party" }, "-created_date", 500),
    enabled: open,
  });

  const externalFirmIds = useMemo(() => {
    const ids = new Set(externalInvites.map((i) => i.firm_id));
    // Also include firms where tenant_id !== id (external firms created by admin)
    firms.forEach((f) => {
      if (f.tenant_id && f.tenant_id !== f.id && !f.deleted_at) {
        ids.add(f.id);
      }
    });
    return ids;
  }, [firms, externalInvites]);

  const externalFirms = useMemo(() => {
    return firms
      .filter((f) => externalFirmIds.has(f.id) && !f.deleted_at)
      .filter((f) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return f.name?.toLowerCase().includes(q);
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [firms, externalFirmIds, search]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[8vh] px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-gray-100 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <Building2 className="w-5 h-5 text-indigo-500" />
          <h2 className="text-sm font-bold text-gray-800">External Firm Portals</h2>
          <span className="text-[11px] text-gray-400">({externalFirms.length})</span>
          <button onClick={onClose} className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              className="h-9 pl-9 text-sm"
              placeholder="Search external firms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {isLoading ? (
            <div className="text-center py-8 text-sm text-gray-400">Loading firms...</div>
          ) : externalFirms.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No external firms with portal access yet.</p>
              <p className="text-[11px] text-gray-400 mt-1">External firms appear here once their registration is approved.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {externalFirms.map((firm) => {
                const firmTypes = firm.firm_types?.length ? firm.firm_types : (firm.firm_type ? [firm.firm_type] : []);
                const hq = firm.addresses?.find((a) => a.is_headquarters) || firm.addresses?.[0];
                const phone = firm.phones?.find((p) => p.is_default) || firm.phones?.[0];
                return (
                  <Link
                    key={firm.id}
                    to={`/ExternalPortal?firmId=${firm.id}`}
                    onClick={onClose}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
                  >
                    {firm.logo_url ? (
                      <img src={firm.logo_url} alt="" className="w-9 h-9 rounded-lg bg-gray-50 object-contain p-0.5 border border-gray-100" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-indigo-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 truncate">{firm.name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400">
                        {firmTypes.slice(0, 2).map((t) => (
                          <span key={t} className="truncate">{t}</span>
                        ))}
                        {hq && (
                          <span className="flex items-center gap-0.5 truncate">
                            <MapPin className="w-2 h-2" /> {hq.city ? `${hq.city}, ${hq.state}` : hq.country}
                          </span>
                        )}
                      </div>
                    </div>
                    {phone && (
                      <span className="flex items-center gap-0.5 text-[10px] text-gray-400 flex-shrink-0">
                        <Phone className="w-2 h-2" /> +{phone.country_code} ({phone.area_code}) {phone.number_mid}-{phone.number_last}
                      </span>
                    )}
                    <ExternalLink className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}