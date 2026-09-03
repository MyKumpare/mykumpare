import React from "react";
import { Link } from "react-router-dom";
import { UserCircle2 } from "lucide-react";
import XponanceAssignmentCell from "@/components/xponance/XponanceAssignmentCell";

const getContactName = (c) =>
  [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");

/**
 * Shared contacts table for the Contacts view of coverage dashboards.
 * Renders non-Xponance contacts with inline primary/secondary Xponance assignment cells.
 *
 * Props:
 *  - contacts: pre-filtered list of non-Xponance contacts to display
 *  - firms: all firms (for firm-name lookup)
 *  - xponanceContacts: Xponance (tenant) contacts to pick from
 *  - onSaved: () => void — called after a successful assignment persist
 *  - rowHoverClass: literal tailwind hover class for rows (theme-matched)
 *  - linkClass: literal tailwind class for the contact name link (theme-matched)
 */
export default function CoverageContactsTable({
  contacts,
  firms,
  xponanceContacts,
  onSaved,
  rowHoverClass = "hover:bg-indigo-50/30",
  linkClass = "text-indigo-600 hover:text-indigo-800",
}) {
  const firmMap = Object.fromEntries((firms || []).map((f) => [f.id, f]));

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap w-[28%]">Contact</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap w-[20%]">Firm</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap w-[26%]">Primary Xponance Contact</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap w-[26%]">Secondary Xponance Contact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-12 text-sm text-gray-400 italic">
                  No contacts match your filters.
                </td>
              </tr>
            ) : (
              contacts.map((contact) => {
                const firmName = (contact.firm_ids || [])
                  .map((fid) => firmMap[fid]?.name)
                  .filter(Boolean)
                  .join(", ");
                return (
                  <tr key={contact.id} className={`${rowHoverClass} transition-colors`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {contact.photo_url ? (
                          <img src={contact.photo_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
                            <UserCircle2 className="w-4 h-4 text-pink-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <Link
                            to={`/Home?openContact=${contact.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className={`text-sm font-medium ${linkClass} hover:underline truncate`}
                          >
                            {getContactName(contact)}
                          </Link>
                          {contact.title && <p className="text-xs text-gray-400 truncate">{contact.title}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{firmName || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <XponanceAssignmentCell
                        entityType="Contact"
                        entityId={contact.id}
                        role="primary"
                        value={{ contact_id: contact.primary_xponance_contact_id, contact_name: contact.primary_xponance_contact_name }}
                        excludeId={contact.secondary_xponance_contact_id}
                        xponanceContacts={xponanceContacts}
                        onSaved={onSaved}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <XponanceAssignmentCell
                        entityType="Contact"
                        entityId={contact.id}
                        role="secondary"
                        value={{ contact_id: contact.secondary_xponance_contact_id, contact_name: contact.secondary_xponance_contact_name }}
                        excludeId={contact.primary_xponance_contact_id}
                        xponanceContacts={xponanceContacts}
                        onSaved={onSaved}
                      />
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