import React, { useState, useMemo } from "react";
import { Search, Users, Building2, Briefcase } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

function buildFullName(c) {
  const parts = [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean);
  return parts.join(" ").trim() || c.first_name || c.last_name || "Unnamed";
}

export default function ContactNetworkTable({ contacts, firms }) {
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const firmMap = useMemo(() => {
    const m = new Map();
    (firms || []).forEach((f) => m.set(f.id, f));
    return m;
  }, [firms]);

  const firmNameFor = (id) => firmMap.get(id)?.name || "";

  const filtered = useMemo(() => {
    let list = (contacts || []).filter((c) => !c.deleted_at);
    if (!showInactive) list = list.filter((c) => c.contact_status !== "Inactive");

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const name = buildFullName(c).toLowerCase();
        const firmsStr = (c.firm_ids || []).map(firmNameFor).join(" ").toLowerCase();
        return name.includes(q) || firmsStr.includes(q);
      });
    }

    // Sort by first name (ignoring salutation/suffix)
    return [...list].sort((a, b) => {
      const an = (a.first_name || "").toLowerCase();
      const bn = (b.first_name || "").toLowerCase();
      return an.localeCompare(bn);
    });
  }, [contacts, search, showInactive, firmMap]);

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="p-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by contact name or firm…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-gray-300"
          />
          Show inactive
        </label>
        <span className="ml-auto text-xs text-gray-500">{filtered.length} contacts</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Contact</th>
              <th className="text-left font-medium px-4 py-2.5">Firm</th>
              <th className="text-left font-medium px-4 py-2.5">Department</th>
              <th className="text-left font-medium px-4 py-2.5">Title</th>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No contacts match your search.
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const firmNames = (c.firm_ids || []).map(firmNameFor).filter(Boolean);
                const depts = (c.contact_firm_roles || []).join(", ");
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {c.photo_url ? (
                          <img src={c.photo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-pink-100 text-pink-700 text-xs font-semibold flex-shrink-0">
                            {(c.first_name || "?")[0]}
                          </div>
                        )}
                        <span className="font-medium text-gray-800">{buildFullName(c)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {firmNames.length ? (
                        <div className="flex flex-wrap gap-1">
                          {firmNames.map((n, i) => (
                            <span key={i} className="inline-flex items-center gap-1 text-gray-700">
                              <Building2 className="w-3 h-3 text-gray-400" />
                              {n}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">No firm</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {depts ? (
                        <span className="inline-flex items-center gap-1 text-gray-700">
                          <Briefcase className="w-3 h-3 text-gray-400" />
                          {depts}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{c.title || "—"}</td>
                    <td className="px-4 py-2.5">
                      {c.contact_status === "Inactive" ? (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-500">Inactive</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-green-50 text-green-700">Active</Badge>
                      )}
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