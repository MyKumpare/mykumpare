import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { User, ChevronDown, ChevronRight, Users, AlertTriangle } from "lucide-react";
import { useState } from "react";

function formatName(c) {
  if (!c) return "Unknown";
  return [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");
}

function ContactNode({ contact, children, depth }) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = children.length > 0;

  const depthColors = [
    "border-indigo-300 bg-indigo-50",
    "border-blue-300 bg-blue-50",
    "border-purple-300 bg-purple-50",
    "border-teal-300 bg-teal-50",
  ];
  const color = depthColors[depth % depthColors.length];

  return (
    <div className="flex flex-col items-center" style={{ minWidth: 160 }}>
      <div className={`relative group flex flex-col items-center p-3 rounded-xl border-2 bg-white shadow-sm select-none ${color} hover:shadow-md transition-shadow`} style={{ width: 160, minHeight: 120 }}>
        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-white">
          {contact?.photo_url
            ? <img src={contact.photo_url} alt="" className="w-full h-full object-cover" />
            : <User className="w-5 h-5 text-indigo-500" />}
        </div>
        <div className="mt-1.5 text-center w-full">
          <div className="text-xs font-semibold text-gray-800 leading-tight break-words" style={{ wordBreak: "break-word" }}>
            {formatName(contact)}
          </div>
          {contact?.title && (
            <div className="text-xs text-gray-500 mt-0.5 leading-tight break-words" style={{ wordBreak: "break-word" }}>
              {contact.title}
            </div>
          )}
        </div>
        {hasChildren && (
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="mt-1 text-gray-400 hover:text-gray-600"
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {hasChildren && !collapsed && (
        <div className="flex flex-col items-center">
          <div className="w-px h-5 bg-gray-300" />
          {children.length > 1 && (
            <div style={{ position: "relative", display: "flex", alignItems: "flex-start" }}>
              <div style={{
                position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                height: "1px", width: `calc(100% - 80px)`, background: "#d1d5db",
              }} />
            </div>
          )}
          <div className="flex gap-6 items-start">
            {children.map((child) => (
              <div key={child.contact?.id || child.key} className="flex flex-col items-center">
                <div className="w-px h-5 bg-gray-300" />
                <ContactNode contact={child.contact} children={child.children} depth={depth + 1} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Auto-generated reporting structure tab for the firm profile.
 * Builds a tree from the `reports_to_contact_id` field on each contact.
 * Contacts with no manager link appear as root nodes.
 */
export default function FirmReportingStructureTab({ firmId, firmName = "" }) {
  const { data: allContacts = [], isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });

  const { tree, unlinked, stats } = useMemo(() => {
    const firmContacts = allContacts.filter(
      (c) => !c.deleted_at && (c.firm_ids || []).includes(firmId)
    );

    // Build a map: contact_id → contact object
    const contactMap = new Map(firmContacts.map((c) => [c.id, c]));

    // Build children map: manager_id → [report objects]
    const childrenMap = new Map();
    const linked = new Set();

    for (const c of firmContacts) {
      const mgrId = c.reports_to_contact_id;
      if (mgrId && contactMap.has(mgrId) && mgrId !== c.id) {
        if (!childrenMap.has(mgrId)) childrenMap.set(mgrId, []);
        childrenMap.get(mgrId).push(c);
        linked.add(c.id);
      }
    }

    // Root nodes = contacts that have no reports_to, or whose manager is not in this firm
    const roots = firmContacts.filter((c) => {
      const mgrId = c.reports_to_contact_id;
      return !mgrId || !contactMap.has(mgrId) || mgrId === c.id;
    });

    // Detect circular references
    const hasCircular = (contactId, visited = new Set()) => {
      if (visited.has(contactId)) return true;
      visited.add(contactId);
      const mgrId = contactMap.get(contactId)?.reports_to_contact_id;
      if (!mgrId || !contactMap.has(mgrId)) return false;
      return hasCircular(mgrId, visited);
    };

    const circularIds = new Set(
      firmContacts.filter((c) => c.reports_to_contact_id && hasCircular(c.id)).map((c) => c.id)
    );

    // Build tree recursively
    const buildNode = (contact, depth = 0, ancestorIds = new Set()) => {
      if (ancestorIds.has(contact.id)) return null; // cycle guard
      const nextAncestors = new Set([...ancestorIds, contact.id]);
      const childContacts = (childrenMap.get(contact.id) || [])
        .filter((c) => !c.deleted_at && !c.id === contact.id)
        .sort((a, b) => formatName(a).localeCompare(formatName(b)));
      const childNodes = childContacts
        .map((c) => buildNode(c, depth + 1, nextAncestors))
        .filter(Boolean);
      return { key: contact.id, contact, children: childNodes };
    };

    const treeNodes = roots
      .sort((a, b) => formatName(a).localeCompare(formatName(b)))
      .map((c) => buildNode(c))
      .filter(Boolean);

    const unlinkedContacts = firmContacts.filter(
      (c) => !linked.has(c.id) && !roots.includes(c)
    );

    return {
      tree: treeNodes,
      unlinked: unlinkedContacts,
      stats: {
        total: firmContacts.length,
        linked: linked.size,
        roots: roots.length,
        circular: circularIds.size,
      },
    };
  }, [allContacts, firmId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (stats.total === 0) {
    return (
      <div className="text-sm text-gray-400 italic py-8 text-center border border-dashed border-gray-200 rounded-xl">
        No contacts for this firm yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <Users className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-semibold text-gray-800">{stats.total}</span> contacts
        </div>
        <div className="w-px h-3 bg-gray-200" />
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <span className="font-semibold text-gray-800">{stats.linked}</span> linked
        </div>
        <div className="w-px h-3 bg-gray-200" />
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <span className="font-semibold text-gray-800">{stats.roots}</span> top-level
        </div>
        {stats.circular > 0 && (
          <>
            <div className="w-px h-3 bg-gray-200" />
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="font-semibold">{stats.circular}</span> circular
            </div>
          </>
        )}
      </div>

      {stats.linked === 0 ? (
        <div className="text-sm text-gray-400 italic py-8 text-center border border-dashed border-gray-200 rounded-xl">
          No reporting relationships set yet. Open a contact and use the "Reports To" field to link them to their manager.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-gray-50/50 p-4">
          <div className="flex flex-col items-center min-w-fit">
            <div className="flex gap-8 items-start justify-center flex-wrap">
              {tree.map((node) => (
                <ContactNode key={node.key} contact={node.contact} children={node.children} depth={0} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Unlinked contacts (have a manager but the manager is not in this firm) */}
      {unlinked.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="text-xs font-medium text-amber-700 mb-2">
            {unlinked.length} contact{unlinked.length === 1 ? "" : "s"} with a manager outside this firm:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unlinked.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-white border border-amber-200 text-amber-800">
                <User className="w-3 h-3" />
                {formatName(c)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}