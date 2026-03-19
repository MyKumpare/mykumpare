import React from "react";
import { Building2, User, Package, LayoutList } from "lucide-react";

function getContactFullName(c) {
  return [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix]
    .filter(Boolean).join(" ") +
    (c.designations?.length ? `, ${c.designations.join(", ")}` : "");
}

function ContactAvatar({ contact, size = "sm" }) {
  const sz = size === "sm" ? "w-7 h-7" : "w-8 h-8";
  return (
    <div className={`${sz} rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden flex-shrink-0 border border-indigo-200`}>
      {contact.photo_url ? (
        <img src={contact.photo_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <User className="w-3.5 h-3.5 text-indigo-400" />
      )}
    </div>
  );
}

function FirmLogo({ firm }) {
  return (
    <div className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
      {firm.logo_url ? (
        <img src={firm.logo_url} alt="" className="w-full h-full object-contain p-0.5" />
      ) : (
        <Building2 className="w-3.5 h-3.5 text-gray-400" />
      )}
    </div>
  );
}

export default function SearchResults({ query, firms, products, contacts, portfolios = [], onFirmClick, onContactClick, onProductClick, onPortfolioClick }) {
  const q = query.toLowerCase().trim();
  if (!q) return null;

  // --- Match contacts ---
  const matchedContacts = contacts.filter((c) => {
    const fullName = getContactFullName(c).toLowerCase();
    return (
      fullName.includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.title || "").toLowerCase().includes(q) ||
      (c.designations || []).some(d => d.toLowerCase().includes(q))
    );
  });

  // --- Match firms (by name) ---
  const matchedFirms = firms.filter((f) => f.name.toLowerCase().includes(q));

  // --- Match products ---
  const matchedProducts = products.filter((p) => p.name.toLowerCase().includes(q));

  // For a firm result, gather its contacts
  const firmContacts = (firmId) => contacts.filter(c => (c.firm_ids || []).includes(firmId));

  // For a contact result, gather its firms
  const contactFirms = (contact) => (contact.firm_ids || []).map(id => firms.find(f => f.id === id)).filter(Boolean);

  // For a product result, gather the firm and its contacts
  const productFirm = (product) => firms.find(f => f.id === product.firm_id);
  const productFirmContacts = (product) => {
    const firm = productFirm(product);
    return firm ? firmContacts(firm.id) : [];
  };

  const hasAny = matchedContacts.length > 0 || matchedFirms.length > 0 || matchedProducts.length > 0;
  if (!hasAny) return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-4 text-sm text-gray-400 text-center">
      No results for "{query}"
    </div>
  );

  return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-[70vh] overflow-y-auto divide-y divide-gray-100">

      {/* Contact Results */}
      {matchedContacts.length > 0 && (
        <div>
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> Contacts
          </div>
          {matchedContacts.map((contact) => {
            const assocFirms = contactFirms(contact);
            return (
              <button
                key={contact.id}
                className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors"
                onClick={() => onContactClick(contact)}
              >
                <div className="flex items-start gap-3">
                  <ContactAvatar contact={contact} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {getContactFullName(contact)}
                    </div>
                    {contact.title && <div className="text-xs text-gray-500 truncate">{contact.title}</div>}
                    {assocFirms.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {assocFirms.map(f => (
                          <span key={f.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 rounded-md px-1.5 py-0.5">
                            {f.logo_url ? <img src={f.logo_url} alt="" className="w-3 h-3 object-contain" /> : <Building2 className="w-3 h-3" />}
                            {f.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Firm Results */}
      {matchedFirms.length > 0 && (
        <div>
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Firms
          </div>
          {matchedFirms.map((firm) => {
            const assocContacts = firmContacts(firm.id);
            return (
              <button
                key={firm.id}
                className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors"
                onClick={() => onFirmClick(firm)}
              >
                <div className="flex items-start gap-3">
                  <FirmLogo firm={firm} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{firm.name}</div>
                    <div className="text-xs text-gray-400">{firm.firm_type}</div>
                    {assocContacts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {assocContacts.map(c => (
                          <span key={c.id} className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5">
                            <div className="w-3.5 h-3.5 rounded-full overflow-hidden bg-indigo-200 flex-shrink-0">
                              {c.photo_url
                                ? <img src={c.photo_url} alt="" className="w-full h-full object-cover" />
                                : <User className="w-2.5 h-2.5 text-indigo-400 m-auto" />}
                            </div>
                            {c.first_name} {c.last_name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Product Results */}
      {matchedProducts.length > 0 && (
        <div>
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> Products
          </div>
          {matchedProducts.map((product) => {
            const firm = productFirm(product);
            const assocContacts = productFirmContacts(product);
            return (
              <button
                key={product.id}
                className="w-full text-left px-4 py-3 hover:bg-violet-50 transition-colors"
                onClick={() => onProductClick(product)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg border border-violet-200 bg-violet-50 flex items-center justify-center flex-shrink-0">
                    <Package className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{product.name}</div>
                    {firm && (
                      <div className="flex items-center gap-1 mt-0.5">
                        {firm.logo_url ? <img src={firm.logo_url} alt="" className="w-3 h-3 object-contain" /> : <Building2 className="w-3 h-3 text-gray-400" />}
                        <span className="text-xs text-gray-500">{firm.name}</span>
                      </div>
                    )}
                    {assocContacts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {assocContacts.map(c => (
                          <span key={c.id} className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5">
                            <div className="w-3.5 h-3.5 rounded-full overflow-hidden bg-indigo-200 flex-shrink-0">
                              {c.photo_url
                                ? <img src={c.photo_url} alt="" className="w-full h-full object-cover" />
                                : <User className="w-2.5 h-2.5 text-indigo-400 m-auto" />}
                            </div>
                            {c.first_name} {c.last_name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}