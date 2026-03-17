import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Plus, X, ChevronDown, ChevronRight, GripVertical, Trash2, Edit2, Check } from "lucide-react";

// --- Entity: OrgChart stored as a single record per firm ---
// We store the chart as a tree in the OrgChart entity: { firm_id, nodes: [...] }
// Node shape: { id, contact_id, title_override, children: [node_id, ...] }

function buildTree(nodes, rootIds) {
  return rootIds.map(id => {
    const node = nodes.find(n => n.id === id);
    if (!node) return null;
    return { ...node, children: buildTree(nodes, node.children || []) };
  }).filter(Boolean);
}

function flattenTree(treeNodes, parentId = null, result = []) {
  treeNodes.forEach(node => {
    result.push({ id: node.id, contact_id: node.contact_id, title_override: node.title_override, children: (node.children || []).map(c => c.id), parentId });
    flattenTree(node.children || [], node.id, result);
  });
  return result;
}

function ContactAvatar({ contact, size = "sm" }) {
  const sz = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  const icon = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  return (
    <div className={`${sz} rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-white`}>
      {contact?.photo_url
        ? <img src={contact.photo_url} alt="" className="w-full h-full object-cover" />
        : <User className={`${icon} text-indigo-500`} />}
    </div>
  );
}

function getContactName(contact) {
  if (!contact) return "Unknown";
  return [contact.salutation, contact.first_name, contact.last_name].filter(Boolean).join(" ");
}

// Draggable contact chip from the sidebar
function ContactChip({ contact, onDragStart }) {
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("contact_id", contact.id); onDragStart?.(); }}
      className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 cursor-grab hover:border-indigo-300 hover:bg-indigo-50 transition-colors select-none"
    >
      <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
      <ContactAvatar contact={contact} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-gray-800 truncate">{getContactName(contact)}</div>
        {contact.title && <div className="text-xs text-gray-400 truncate">{contact.title}</div>}
      </div>
    </div>
  );
}

// Org chart node (recursive)
function OrgNode({ node, contacts, onAddChild, onRemove, onDrop, onTitleChange, depth = 0 }) {
  const contact = contacts.find(c => c.id === node.contact_id);
  const [collapsed, setCollapsed] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(node.title_override || contact?.title || "");
  const hasChildren = node.children?.length > 0;

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const contactId = e.dataTransfer.getData("contact_id");
    const nodeId = e.dataTransfer.getData("node_id");
    if (contactId) onDrop({ type: "new", parentId: node.id, contactId });
    if (nodeId && nodeId !== node.id) onDrop({ type: "move", parentId: node.id, nodeId });
  };

  const handleDragStart = (e) => {
    e.dataTransfer.setData("node_id", node.id);
    e.stopPropagation();
  };

  const handleTitleSave = () => {
    setEditingTitle(false);
    onTitleChange(node.id, titleVal);
  };

  return (
    <div className={`flex flex-col items-center`} style={{ minWidth: 160 }}>
      {/* Node card */}
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative group flex flex-col items-center p-3 rounded-xl border-2 bg-white shadow-sm transition-all cursor-grab select-none
          ${dragOver ? "border-indigo-400 bg-indigo-50 scale-105 shadow-md" : "border-gray-200 hover:border-indigo-300 hover:shadow-md"}`}
        style={{ width: 148 }}
      >
        {/* Remove btn */}
        <button
          type="button"
          onClick={() => onRemove(node.id)}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-100 text-red-500 hover:bg-red-200 items-center justify-center hidden group-hover:flex z-10"
        >
          <X className="w-3 h-3" />
        </button>

        <ContactAvatar contact={contact} size="md" />

        <div className="mt-1.5 text-center w-full">
          <div className="text-xs font-semibold text-gray-800 truncate w-full text-center">
            {getContactName(contact)}
          </div>

          {/* Title override */}
          {editingTitle ? (
            <div className="flex items-center gap-1 mt-1">
              <Input
                autoFocus
                value={titleVal}
                onChange={e => setTitleVal(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleTitleSave(); if (e.key === "Escape") setEditingTitle(false); }}
                className="h-5 text-xs px-1 py-0 border-indigo-300"
              />
              <button type="button" onClick={handleTitleSave} className="text-indigo-600 hover:text-indigo-800">
                <Check className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div
              className="text-xs text-gray-400 truncate w-full text-center mt-0.5 cursor-pointer hover:text-indigo-500 flex items-center justify-center gap-0.5 group/title"
              onClick={() => { setTitleVal(node.title_override || contact?.title || ""); setEditingTitle(true); }}
            >
              <span>{node.title_override || contact?.title || <span className="italic">Add title…</span>}</span>
              <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover/title:opacity-100" />
            </div>
          )}
        </div>

        {/* Add child button */}
        <button
          type="button"
          onClick={() => onAddChild(node.id)}
          className="mt-2 flex items-center gap-0.5 text-xs text-indigo-500 hover:text-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Plus className="w-3 h-3" /> Add report
        </button>

        {/* Collapse toggle */}
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

      {/* Children */}
      {hasChildren && !collapsed && (
        <div className="flex flex-col items-center">
          {/* Connector line down */}
          <div className="w-px h-6 bg-gray-300" />
          <div className="flex gap-6 items-start">
            {node.children.map((child, idx) => (
              <div key={child.id} className="flex flex-col items-center">
                {/* Horizontal connector */}
                <div className="flex items-center">
                  {idx > 0 && <div className="h-px w-3 bg-gray-300" />}
                  <div className="w-px h-4 bg-gray-300" />
                  {idx < node.children.length - 1 && <div className="h-px w-3 bg-gray-300" />}
                </div>
                <OrgNode
                  node={child}
                  contacts={contacts}
                  onAddChild={onAddChild}
                  onRemove={onRemove}
                  onDrop={onDrop}
                  onTitleChange={onTitleChange}
                  depth={depth + 1}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Drop zone for root-level drops
function RootDropZone({ onDrop, hasNodes }) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const contactId = e.dataTransfer.getData("contact_id");
    const nodeId = e.dataTransfer.getData("node_id");
    if (contactId) onDrop({ type: "new", parentId: null, contactId });
    if (nodeId) onDrop({ type: "move", parentId: null, nodeId });
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`transition-all rounded-xl border-2 border-dashed flex items-center justify-center text-sm
        ${dragOver ? "border-indigo-400 bg-indigo-50 text-indigo-600" : "border-gray-200 text-gray-400"}
        ${hasNodes ? "mt-4 py-3 px-6" : "py-12 px-8"}`}
    >
      {dragOver ? "Drop here to add to chart" : hasNodes ? "+ Drop contact to add root node" : "Drag contacts here to build the org chart"}
    </div>
  );
}

export default function OrgChartTab({ firmId }) {
  const queryClient = useQueryClient();
  const [pendingAdd, setPendingAdd] = useState(null); // { parentId } — waiting for contact pick

  // Fetch contacts for this firm
  const { data: allContacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date"),
  });
  const firmContacts = allContacts.filter(c => c.firm_ids?.includes(firmId));

  // Fetch org chart record
  const { data: orgCharts = [] } = useQuery({
    queryKey: ["orgchart", firmId],
    queryFn: () => base44.entities.OrgChart.filter({ firm_id: firmId }),
    enabled: !!firmId,
  });
  const orgChart = orgCharts[0] || null;

  // nodes: flat array; rootIds: top-level node ids
  const [nodes, setNodes] = useState([]);
  const [rootIds, setRootIds] = useState([]);

  useEffect(() => {
    if (orgChart) {
      setNodes(orgChart.nodes || []);
      setRootIds(orgChart.root_ids || []);
    } else {
      setNodes([]);
      setRootIds([]);
    }
  }, [orgChart]);

  const saveMutation = useMutation({
    mutationFn: async ({ nodes, rootIds }) => {
      const data = { firm_id: firmId, nodes, root_ids: rootIds };
      if (orgChart) return base44.entities.OrgChart.update(orgChart.id, data);
      return base44.entities.OrgChart.create(data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orgchart", firmId] }),
  });

  const save = useCallback((newNodes, newRootIds) => {
    setNodes(newNodes);
    setRootIds(newRootIds);
    saveMutation.mutate({ nodes: newNodes, rootIds: newRootIds });
  }, [saveMutation]);

  const handleDrop = ({ type, parentId, contactId, nodeId }) => {
    if (type === "new") {
      // Check if contact already in chart
      if (nodes.some(n => n.contact_id === contactId)) return;
      const newNode = { id: crypto.randomUUID(), contact_id: contactId, title_override: "", children: [] };
      const updatedNodes = [...nodes, newNode];
      let updatedRootIds = [...rootIds];
      if (!parentId) {
        updatedRootIds = [...updatedRootIds, newNode.id];
      } else {
        // Add as child of parent node
        const idx = updatedNodes.findIndex(n => n.id === parentId);
        if (idx !== -1) updatedNodes[idx] = { ...updatedNodes[idx], children: [...(updatedNodes[idx].children || []), newNode.id] };
      }
      save(updatedNodes, updatedRootIds);
    } else if (type === "move") {
      if (nodeId === parentId) return;
      // Remove nodeId from current parent's children and from rootIds
      const updatedNodes = nodes.map(n => ({
        ...n,
        children: (n.children || []).filter(cid => cid !== nodeId),
      }));
      let updatedRootIds = rootIds.filter(id => id !== nodeId);
      if (!parentId) {
        updatedRootIds = [...updatedRootIds, nodeId];
      } else {
        const idx = updatedNodes.findIndex(n => n.id === parentId);
        if (idx !== -1) {
          // Prevent cycles: don't allow dropping on own descendant
          const descendants = getAllDescendants(nodes, nodeId);
          if (descendants.includes(parentId)) return;
          updatedNodes[idx] = { ...updatedNodes[idx], children: [...(updatedNodes[idx].children || []), nodeId] };
        }
      }
      save(updatedNodes, updatedRootIds);
    }
  };

  const getAllDescendants = (nodes, nodeId) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return [];
    const children = node.children || [];
    return [...children, ...children.flatMap(cid => getAllDescendants(nodes, cid))];
  };

  const handleAddChild = (parentId) => {
    setPendingAdd({ parentId });
  };

  const handlePendingContactPick = (contactId) => {
    setPendingAdd(null);
    handleDrop({ type: "new", parentId: pendingAdd.parentId, contactId });
  };

  const handleRemove = (nodeId) => {
    // Move children up to parent
    const node = nodes.find(n => n.id === nodeId);
    const childIds = node?.children || [];
    let updatedNodes = nodes
      .filter(n => n.id !== nodeId)
      .map(n => {
        if ((n.children || []).includes(nodeId)) {
          return { ...n, children: [...n.children.filter(c => c !== nodeId), ...childIds] };
        }
        return n;
      });
    let updatedRootIds = rootIds.filter(id => id !== nodeId);
    if (rootIds.includes(nodeId)) updatedRootIds = [...updatedRootIds, ...childIds];
    save(updatedNodes, updatedRootIds);
  };

  const handleTitleChange = (nodeId, title) => {
    const updatedNodes = nodes.map(n => n.id === nodeId ? { ...n, title_override: title } : n);
    save(updatedNodes, rootIds);
  };

  const tree = buildTree(nodes, rootIds);
  const usedContactIds = new Set(nodes.map(n => n.contact_id));
  const availableContacts = firmContacts.filter(c => !usedContactIds.has(c.id));

  return (
    <div className="flex gap-4" style={{ minHeight: 400 }}>
      {/* Sidebar: contacts to drag */}
      <div className="w-44 flex-shrink-0">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contacts</div>
        {firmContacts.length === 0 ? (
          <div className="text-xs text-gray-400 italic">No contacts for this firm</div>
        ) : availableContacts.length === 0 ? (
          <div className="text-xs text-gray-400 italic">All contacts placed</div>
        ) : (
          <div className="space-y-1.5">
            {availableContacts.map(c => (
              <ContactChip key={c.id} contact={c} />
            ))}
          </div>
        )}

        {/* Pending add picker */}
        {pendingAdd && (
          <div className="mt-3 p-2 rounded-lg border-2 border-indigo-300 bg-indigo-50 space-y-1.5">
            <div className="text-xs font-medium text-indigo-700">Pick a contact to add as report:</div>
            {availableContacts.map(c => (
              <button key={c.id} type="button"
                onClick={() => handlePendingContactPick(c.id)}
                className="w-full text-left flex items-center gap-2 p-1.5 rounded-md hover:bg-indigo-100 text-xs"
              >
                <ContactAvatar contact={c} size="sm" />
                <span className="truncate">{getContactName(c)}</span>
              </button>
            ))}
            <button type="button" onClick={() => setPendingAdd(null)} className="text-xs text-gray-400 hover:text-gray-600 w-full text-center mt-1">Cancel</button>
          </div>
        )}
      </div>

      {/* Chart area */}
      <div className="flex-1 overflow-auto">
        {tree.length === 0 ? (
          <RootDropZone onDrop={handleDrop} hasNodes={false} />
        ) : (
          <div className="flex flex-col items-start">
            <div className="flex gap-8 items-start flex-wrap">
              {tree.map(node => (
                <OrgNode
                  key={node.id}
                  node={node}
                  contacts={firmContacts}
                  onAddChild={handleAddChild}
                  onRemove={handleRemove}
                  onDrop={handleDrop}
                  onTitleChange={handleTitleChange}
                />
              ))}
            </div>
            <RootDropZone onDrop={handleDrop} hasNodes={true} />
          </div>
        )}
      </div>
    </div>
  );
}