import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Plus, X, ChevronDown, ChevronRight, GripVertical, Edit2, Check, Printer, Download, ZoomIn, ZoomOut, Maximize2, CheckCircle2, Loader2, Users, Layers, UserMinus } from "lucide-react";
import AddContactDialog from "@/components/contacts/AddContactDialog";

function buildTree(nodes, rootIds) {
  return rootIds.map(id => {
    const node = nodes.find(n => n.id === id);
    if (!node) return null;
    return { ...node, children: buildTree(nodes, node.children || []) };
  }).filter(Boolean);
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

function ContactChip({ contact }) {
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("contact_id", contact.id); }}
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

// SVG connector lines between parent and children
function ConnectorLines({ childCount }) {
  if (childCount === 0) return null;
  return (
    <div className="flex flex-col items-center">
      <div className="w-px h-6 bg-gray-300" />
    </div>
  );
}

function OrgNode({ node, contacts, onAddChild, onRemove, onDrop, onTitleChange, onViewContact, depth = 0 }) {
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

  const depthColors = [
    "border-indigo-300 bg-indigo-50",
    "border-blue-300 bg-blue-50",
    "border-purple-300 bg-purple-50",
    "border-teal-300 bg-teal-50",
  ];
  const depthColor = depthColors[depth % depthColors.length];

  return (
    <div className="flex flex-col items-center" style={{ minWidth: 164 }}>
      {/* Node card */}
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative group flex flex-col items-center p-3 rounded-xl border-2 bg-white shadow-sm transition-all cursor-grab select-none
          ${dragOver ? "border-indigo-500 bg-indigo-50 scale-105 shadow-md" : `${depthColor} hover:shadow-md`}`}
        style={{ width: 164 }}
      >
        <button
          type="button"
          onClick={() => onRemove(node.id)}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-100 text-red-500 hover:bg-red-200 items-center justify-center hidden group-hover:flex z-10 no-print"
        >
          <X className="w-3 h-3" />
        </button>

        <ContactAvatar contact={contact} size="md" />

        <div className="mt-1.5 text-center w-full">
          {/* Clickable name */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onViewContact(contact); }}
            className="text-xs font-semibold text-gray-800 hover:text-indigo-600 hover:underline w-full text-center leading-tight break-words whitespace-normal cursor-pointer transition-colors"
            style={{ wordBreak: "break-word" }}
          >
            {getContactName(contact)}
          </button>

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
              className="text-xs text-gray-500 w-full text-center mt-0.5 cursor-pointer hover:text-indigo-500 flex items-center justify-center gap-0.5 group/title leading-tight"
              style={{ wordBreak: "break-word", whiteSpace: "normal" }}
              onClick={() => { setTitleVal(node.title_override || contact?.title || ""); setEditingTitle(true); }}
            >
              <span>{node.title_override || contact?.title || <span className="italic text-gray-300">Add title…</span>}</span>
              <Edit2 className="w-2.5 h-2.5 flex-shrink-0 opacity-0 group-hover/title:opacity-100 no-print" />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onAddChild(node.id)}
          className="mt-2 flex items-center gap-0.5 text-xs text-indigo-500 hover:text-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity no-print"
        >
          <Plus className="w-3 h-3" /> Add report
        </button>

        {hasChildren && (
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="mt-1 text-gray-400 hover:text-gray-600 no-print"
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Children */}
      {hasChildren && !collapsed && (
        <div className="flex flex-col items-center">
          <div className="w-px h-6 bg-gray-300" />
          {/* Horizontal bar across children */}
          {node.children.length > 1 && (
            <div style={{ display: "flex", alignItems: "flex-start", position: "relative" }}>
              <div style={{
                position: "absolute",
                top: 0,
                left: "50%",
                transform: "translateX(-50%)",
                height: "1px",
                width: `calc(100% - 74px)`,
                background: "#d1d5db",
              }} />
            </div>
          )}
          <div className="flex gap-8 items-start">
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="w-px h-5 bg-gray-300" />
                <OrgNode
                  node={child}
                  contacts={contacts}
                  onAddChild={onAddChild}
                  onRemove={onRemove}
                  onDrop={onDrop}
                  onTitleChange={onTitleChange}
                  onViewContact={onViewContact}
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
      className={`transition-all rounded-xl border-2 border-dashed flex items-center justify-center text-sm no-print
        ${dragOver ? "border-indigo-400 bg-indigo-50 text-indigo-600" : "border-gray-200 text-gray-400"}
        ${hasNodes ? "mt-4 py-3 px-6" : "py-12 px-8 w-full"}`}
    >
      {dragOver ? "Drop here to add to chart" : hasNodes ? "+ Drop contact to add root node" : "Drag contacts here to build the org chart"}
    </div>
  );
}

export default function OrgChartTab({ firmId }) {
  const queryClient = useQueryClient();
  const [pendingAdd, setPendingAdd] = useState(null);
  const [zoom, setZoom] = useState(1);
  const chartRef = useRef(null);
  const [viewingContact, setViewingContact] = useState(null);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);

  const handleViewContact = (contact) => {
    if (!contact) return;
    setViewingContact(contact);
    setContactDialogOpen(true);
  };

  const { data: allContacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date"),
  });
  const firmContacts = allContacts.filter(c => c.firm_ids?.includes(firmId));

  const { data: orgCharts = [] } = useQuery({
    queryKey: ["orgchart", firmId],
    queryFn: () => base44.entities.OrgChart.filter({ firm_id: firmId }),
    enabled: !!firmId,
  });
  const orgChart = orgCharts[0] || null;

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
      if (nodes.some(n => n.contact_id === contactId)) return;
      const newNode = { id: crypto.randomUUID(), contact_id: contactId, title_override: "", children: [] };
      const updatedNodes = [...nodes, newNode];
      let updatedRootIds = [...rootIds];
      if (!parentId) {
        updatedRootIds = [...updatedRootIds, newNode.id];
      } else {
        const idx = updatedNodes.findIndex(n => n.id === parentId);
        if (idx !== -1) updatedNodes[idx] = { ...updatedNodes[idx], children: [...(updatedNodes[idx].children || []), newNode.id] };
      }
      save(updatedNodes, updatedRootIds);
    } else if (type === "move") {
      if (nodeId === parentId) return;
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

  const handleAddChild = (parentId) => setPendingAdd({ parentId });

  const handlePendingContactPick = (contactId) => {
    setPendingAdd(null);
    handleDrop({ type: "new", parentId: pendingAdd.parentId, contactId });
  };

  const handleRemove = (nodeId) => {
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

  const handlePrint = () => {
    const printContent = chartRef.current?.innerHTML;
    if (!printContent) return;
    const w = window.open("", "_blank");
    w.document.write(`
      <html><head><title>Org Chart</title>
      <style>
        body { font-family: sans-serif; padding: 20px; background: white; }
        * { box-sizing: border-box; }
        .no-print { display: none !important; }
        img { max-width: 100%; }
      </style>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2/dist/tailwind.min.css" rel="stylesheet"/>
      </head><body>${printContent}</body></html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 600);
  };

  const handleExportPNG = async () => {
    if (!chartRef.current) return;
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(chartRef.current, { backgroundColor: "#ffffff", scale: 2 });
    const link = document.createElement("a");
    link.download = "org-chart.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const tree = buildTree(nodes, rootIds);
  const usedContactIds = new Set(nodes.map(n => n.contact_id));
  const availableContacts = firmContacts.filter(c => !usedContactIds.has(c.id));

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setZoom(z => Math.max(0.4, z - 0.1))}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs text-gray-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setZoom(z => Math.min(2, z + 0.1))}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 ml-1" onClick={() => setZoom(1)}>
            <Maximize2 className="w-3.5 h-3.5" /> Fit
          </Button>
        </div>
        {nodes.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs gap-1.5" onClick={handlePrint}>
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs gap-1.5" onClick={handleExportPNG}>
              <Download className="w-3.5 h-3.5" /> Export PNG
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-4" style={{ minHeight: 380 }}>
        {/* Sidebar */}
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

          {pendingAdd && (
            <div className="mt-3 p-2 rounded-lg border-2 border-indigo-300 bg-indigo-50 space-y-1.5">
              <div className="text-xs font-medium text-indigo-700">Pick a contact:</div>
              {availableContacts.length === 0 ? (
                <div className="text-xs text-gray-400 italic">No more contacts available</div>
              ) : (
                availableContacts.map(c => (
                  <button key={c.id} type="button"
                    onClick={() => handlePendingContactPick(c.id)}
                    className="w-full text-left flex items-center gap-2 p-1.5 rounded-md hover:bg-indigo-100 text-xs"
                  >
                    <ContactAvatar contact={c} size="sm" />
                    <span className="truncate">{getContactName(c)}</span>
                  </button>
                ))
              )}
              <button type="button" onClick={() => setPendingAdd(null)} className="text-xs text-gray-400 hover:text-gray-600 w-full text-center mt-1">Cancel</button>
            </div>
          )}
        </div>

        {/* Chart canvas */}
        <div className="flex-1 overflow-auto rounded-xl border border-gray-100 bg-gray-50/50 p-4">
          <div
            ref={chartRef}
            style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.15s ease" }}
          >
            {tree.length === 0 ? (
              <RootDropZone onDrop={handleDrop} hasNodes={false} />
            ) : (
              <div className="flex flex-col items-center">
                <div className="flex gap-10 items-start justify-center flex-wrap">
                  {tree.map(node => (
                    <OrgNode
                      key={node.id}
                      node={node}
                      contacts={firmContacts}
                      onAddChild={handleAddChild}
                      onRemove={handleRemove}
                      onDrop={handleDrop}
                      onTitleChange={handleTitleChange}
                      onViewContact={handleViewContact}
                    />
                  ))}
                </div>
                <RootDropZone onDrop={handleDrop} hasNodes={true} />
              </div>
            )}
          </div>
        </div>
      </div>

      {viewingContact && (
        <AddContactDialog
          open={contactDialogOpen}
          onOpenChange={(v) => { setContactDialogOpen(v); if (!v) setViewingContact(null); }}
          editingContact={viewingContact}
          viewMode={true}
          firms={[]}
        />
      )}
    </div>
  );
}