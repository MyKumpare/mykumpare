import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Building2, User as UserIcon, Package, Wallet, ShieldCheck } from "lucide-react";

const ROLE_STYLES = {
  primary: "bg-blue-50 text-blue-700 border-blue-200",
  secondary: "bg-purple-50 text-purple-700 border-purple-200",
};

const TYPE_ICON = {
  Firm: Building2,
  Contact: UserIcon,
  Product: Package,
  Portfolio: Wallet,
};

// Find the date this contact was assigned as the primary/secondary Xponance
// analyst on the given record. Uses the audit_history entry where the
// primary_xponance_contact_id or secondary_xponance_contact_id field changed
// to this contact; falls back to the record's created_date when there is no
// audit entry (e.g. assigned at creation).
function assignmentDate(record, contactId, role) {
  const field = role === "primary" ? "primary_xponance_contact_id" : "secondary_xponance_contact_id";
  const hist = Array.isArray(record.audit_history) ? record.audit_history : [];
  // most recent entry for this field whose new_value is this contact
  for (let i = hist.length - 1; i >= 0; i--) {
    const h = hist[i];
    if (h.field !== field) continue;
    const nv = h.new_value;
    if (nv === contactId || (nv && typeof nv === "object" && nv.id === contactId)) {
      return h.changed_date;
    }
  }
  return record.created_date || record.updated_date || "";
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function contactFullName(c) {
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
  return name || c.email || "—";
}

// Shows every firm, contact, product, and portfolio where this contact is
// assigned as the primary or secondary Xponance analyst.
export default function ContactCoverageTab({ contactId, contactName, firms = [], onFirmClick, onContactClick, onProductClick }) {
  const { data: firmsCov = [], isLoading: lf } = useQuery({
    queryKey: ["coverage-firms", contactId],
    queryFn: () => base44.entities.Firm.filter({ $or: [{ primary_xponance_contact_id: contactId }, { secondary_xponance_contact_id: contactId }] }, "-created_date", 500),
    enabled: !!contactId,
  });
  const { data: contactsCov = [], isLoading: lc } = useQuery({
    queryKey: ["coverage-contacts", contactId],
    queryFn: () => base44.entities.Contact.filter({ $or: [{ primary_xponance_contact_id: contactId }, { secondary_xponance_contact_id: contactId }] }, "-created_date", 5000),
    enabled: !!contactId,
  });
  const { data: productsCov = [], isLoading: lp } = useQuery({
    queryKey: ["coverage-products", contactId],
    queryFn: () => base44.entities.Product.filter({ $or: [{ primary_xponance_contact_id: contactId }, { secondary_xponance_contact_id: contactId }] }, "-created_date", 500),
    enabled: !!contactId,
  });
  const { data: portfoliosCov = [], isLoading: lpo } = useQuery({
    queryKey: ["coverage-portfolios", contactId],
    queryFn: () => base44.entities.Portfolio.filter({ $or: [{ primary_xponance_contact_id: contactId }, { secondary_xponance_contact_id: contactId }] }, "-created_date", 500),
    enabled: !!contactId,
  });

  const rows = useMemo(() => {
    const out = [];
    const push = (type, name, role, date, onClick) => out.push({ type, name, role, date, onClick });

    firmsCov.forEach((f) => {
      if (f.primary_xponance_contact_id === contactId) push("Firm", f.name, "primary", assignmentDate(f, contactId, "primary"), onFirmClick ? () => onFirmClick(f) : null);
      if (f.secondary_xponance_contact_id === contactId) push("Firm", f.name, "secondary", assignmentDate(f, contactId, "secondary"), onFirmClick ? () => onFirmClick(f) : null);
    });
    contactsCov.forEach((c) => {
      if (c.primary_xponance_contact_id === contactId) push("Contact", contactFullName(c), "primary", assignmentDate(c, contactId, "primary"), onContactClick ? () => onContactClick(c) : null);
      if (c.secondary_xponance_contact_id === contactId) push("Contact", contactFullName(c), "secondary", assignmentDate(c, contactId, "secondary"), onContactClick ? () => onContactClick(c) : null);
    });
    productsCov.forEach((p) => {
      if (p.primary_xponance_contact_id === contactId) push("Product", p.name, "primary", assignmentDate(p, contactId, "primary"), onProductClick ? () => onProductClick(p) : null);
      if (p.secondary_xponance_contact_id === contactId) push("Product", p.name, "secondary", assignmentDate(p, contactId, "secondary"), onProductClick ? () => onProductClick(p) : null);
    });
    portfoliosCov.forEach((po) => {
      const firm = firms.find((f) => f.id === po.firm_id);
      const nav = onFirmClick && firm ? () => onFirmClick(firm) : null;
      if (po.primary_xponance_contact_id === contactId) push("Portfolio", po.portfolio_name, "primary", assignmentDate(po, contactId, "primary"), nav);
      if (po.secondary_xponance_contact_id === contactId) push("Portfolio", po.portfolio_name, "secondary", assignmentDate(po, contactId, "secondary"), nav);
    });

    out.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return out;
  }, [firmsCov, contactsCov, productsCov, portfoliosCov, contactId, firms, onFirmClick, onContactClick, onProductClick]);

  const loading = lf || lc || lp || lpo;

  if (!contactId) {
    return <div className="text-sm text-gray-400 italic py-4 text-center">Save the contact to view coverage assignments.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <ShieldCheck className="w-4 h-4 text-blue-500" />
        <span>
          {loading
            ? "Loading coverage assignments…"
            : `${rows.length} coverage assignment${rows.length === 1 ? "" : "s"} for ${contactName || "this contact"}.`}
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-md animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-8 text-center border border-dashed border-gray-200 rounded-md">
          This contact is not assigned as primary or secondary analyst on any firm, contact, product, or portfolio.
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left font-medium px-3 py-2 w-40">Coverage Type</th>
                <th className="text-left font-medium px-3 py-2">Name</th>
                <th className="text-left font-medium px-3 py-2 w-32">Role</th>
                <th className="text-left font-medium px-3 py-2 w-36">Date Assigned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, i) => {
                const Icon = TYPE_ICON[r.type] || ShieldCheck;
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 text-gray-700">
                        <Icon className="w-4 h-4 text-gray-400" />
                        {r.type}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {r.onClick ? (
                        <button
                          type="button"
                          onClick={r.onClick}
                          className="text-blue-600 hover:text-blue-800 hover:underline text-left font-medium"
                        >
                          {r.name || "—"}
                        </button>
                      ) : (
                        <span className="text-gray-700">{r.name || "—"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${ROLE_STYLES[r.role]}`}>
                        {r.role}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{fmtDate(r.date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}