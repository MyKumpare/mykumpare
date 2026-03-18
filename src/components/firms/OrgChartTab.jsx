import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Plus, X, ChevronDown, ChevronRight, GripVertical, Edit2, Check, Printer, Download, ZoomIn, ZoomOut, Maximize2, CheckCircle2, Loader2, Users, Layers, UserMinus, Search } from "lucide-react";
import AddContactDialog from "@/components/contacts/AddContactDialog";

function getMaxDepth(nodes, rootIds) {
  const calc = (id, depth) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return depth;
    const children = node.children || [];
    if (children.length === 0) return depth;
    return Math.max(...children.map(cid => calc(cid, depth + 1)));
  };
  if (rootIds.length === 0) return 0;
  return Math.max(...rootIds.map(id => calc(id, 1)));
}

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

function OrgNode({ node, contacts, onAddChild, onRemove, onDrop, onTitleChange, onViewContact, depth = 0, searchQuery = "" }) {
  const contact = contacts.find(c => c.id === node.contact_id);
  const [collapsed, setCollapsed] = useState(false);

  const isMatch = searchQuery.trim() !== "" && (() => {
    const q = searchQuery.toLowerCase();
    const name = getContactName(contact).toLowerCase();
    const title = (node.title_override || contact?.title || "").toLowerCase();
    return name.includes(q) || title.includes(q);
  })();
  const isDimmed = searchQuery.trim() !== "" && !isMatch;
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
    if (nodeId && nodeId !== node.id) onDrop({ type: "move", parentId: node.id, nodeId, targetId: node.id });
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e) => {
    e.dataTransfer.setData("node_id", node.id);
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
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
        onDragEnd={handleDragEnd}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative group flex flex-col items-center p-3 rounded-xl border-2 bg-white shadow-sm transition-all select-none
          ${isDragging ? "opacity-40 scale-95" : ""}
          ${dragOver ? "border-indigo-500 bg-indigo-50 scale-105 shadow-lg ring-2 ring-indigo-300" : `${depthColor} hover:shadow-md`}
          cursor-grab active:cursor-grabbing`}
        style={{ width: 164, minHeight: 148 }}
      >
        {/* Drag handle */}
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-40 transition-opacity no-print">
          <GripVertical className="w-3.5 h-3.5 text-gray-500 rotate-90" />
        </div>

        {/* Drop overlay */}
        {dragOver && (
          <div className="absolute inset-0 rounded-xl bg-indigo-100/60 flex items-center justify-center pointer-events-none z-20 no-print">
            <span className="text-xs font-semibold text-indigo-600">Drop here</span>
          </div>
        )}

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

function buildPrintTree(nodes, rootIds, contacts, depth = 0, photoCache = {}) {
  return rootIds.map(id => {
    const node = nodes.find(n => n.id === id);
    if (!node) return "";
    const contact = contacts.find(c => c.id === node.contact_id);
    const name = contact ? [contact.salutation, contact.first_name, contact.last_name].filter(Boolean).join(" ") : "Unknown";
    const title = node.title_override || contact?.title || "";
    const photoSrc = contact?.photo_url ? (photoCache[contact.photo_url] || contact.photo_url) : null;
    const photoHtml = photoSrc
      ? `<img src="${photoSrc}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid #e0e7ff;" />`
      : `<div style="width:48px;height:48px;border-radius:50%;background:#e0e7ff;display:flex;align-items:center;justify-content:center;font-size:18px;color:#6366f1;">👤</div>`;
    const childrenHtml = (node.children || []).length > 0
      ? buildPrintTree(nodes, node.children, contacts, depth + 1, photoCache)
      : [];

    const depthColors = ["#eef2ff", "#eff6ff", "#f5f3ff", "#f0fdfa"];
    const depthBorders = ["#a5b4fc", "#93c5fd", "#c4b5fd", "#5eead4"];
    const bg = depthColors[depth % depthColors.length];
    const border = depthBorders[depth % depthBorders.length];

    const cardHtml = `
      <div style="display:flex;flex-direction:column;align-items:center;min-width:160px;">
        <div style="background:${bg};border:2px solid ${border};border-radius:12px;padding:12px;width:160px;min-height:148px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
          <div style="display:flex;justify-content:center;margin-bottom:8px;">${photoHtml}</div>
          <div style="font-size:12px;font-weight:700;color:#1e293b;line-height:1.3;">${name}</div>
          ${title ? `<div style="font-size:11px;color:#64748b;margin-top:4px;line-height:1.3;">${title}</div>` : ""}
        </div>
        ${childrenHtml.length > 0 ? `
          <div style="width:2px;height:20px;background:#d1d5db;"></div>
          <div style="position:relative;display:flex;align-items:flex-start;gap:24px;">
            ${childrenHtml.length > 1 ? `<div style="position:absolute;top:0;left:50%;transform:translateX(-50%);height:2px;width:calc(100% - 80px);background:#d1d5db;"></div>` : ""}
            ${childrenHtml.map(ch => `
              <div style="display:flex;flex-direction:column;align-items:center;">
                <div style="width:2px;height:20px;background:#d1d5db;"></div>
                ${ch}
              </div>`).join("")}
          </div>
        ` : ""}
      </div>`;
    return cardHtml;
  });
}

export default function OrgChartTab({ firmId, firmName = "" }) {
  const queryClient = useQueryClient();
  const [pendingAdd, setPendingAdd] = useState(null);
  const [zoom, setZoom] = useState(1);
  const chartRef = useRef(null);
  const chartContainerRef = useRef(null);
  const [viewingContact, setViewingContact] = useState(null);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "saved"

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
    onMutate: () => setSaveStatus("saving"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgchart", firmId] });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 2500);
    },
    onError: () => setSaveStatus(null),
  });

  const save = useCallback((newNodes, newRootIds) => {
    setNodes(newNodes);
    setRootIds(newRootIds);
    saveMutation.mutate({ nodes: newNodes, rootIds: newRootIds });
  }, [saveMutation]);

  const handleDrop = ({ type, parentId, contactId, nodeId, targetId }) => {
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
      if (nodeId === targetId) return;

      // Find the current parent of the dragged node
      const currentParent = nodes.find(n => (n.children || []).includes(nodeId));
      const targetParent = nodes.find(n => (n.children || []).includes(targetId));

      // If dragged node and target node share the same parent → reorder siblings
      const draggedInRoots = rootIds.includes(nodeId);
      const targetInRoots = rootIds.includes(targetId);

      if (
        (currentParent && targetParent && currentParent.id === targetParent.id) ||
        (draggedInRoots && targetInRoots)
      ) {
        // Reorder within the same parent
        if (draggedInRoots) {
          const newRootIds = [...rootIds];
          const fromIdx = newRootIds.indexOf(nodeId);
          const toIdx = newRootIds.indexOf(targetId);
          newRootIds.splice(fromIdx, 1);
          newRootIds.splice(toIdx, 0, nodeId);
          save(nodes, newRootIds);
        } else {
          const updatedNodes = nodes.map(n => {
            if (n.id !== currentParent.id) return n;
            const siblings = [...(n.children || [])];
            const fromIdx = siblings.indexOf(nodeId);
            const toIdx = siblings.indexOf(targetId);
            siblings.splice(fromIdx, 1);
            siblings.splice(toIdx, 0, nodeId);
            return { ...n, children: siblings };
          });
          save(updatedNodes, rootIds);
        }
        return;
      }

      // Otherwise → reparent: move nodeId under targetId's parent (drop onto target = become sibling before target)
      // Actually keep existing behavior: drop onto a node = become its child
      const descendants = getAllDescendants(nodes, nodeId);
      if (descendants.includes(targetId)) return;

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
    if (nodes.length === 0) return;
    const reportDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const treeHtml = buildPrintTree(nodes, rootIds, firmContacts).join("");
    const w = window.open("", "_blank");
    w.document.write(`
      <html>
      <head>
        <title>Org Chart – ${firmName}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; background: white; padding: 32px; color: #1e293b; }
          .header { margin-bottom: 28px; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; }
          .firm-name { font-size: 22px; font-weight: 800; color: #1e293b; }
          .report-meta { font-size: 12px; color: #64748b; margin-top: 4px; }
          .chart-wrap { display: flex; justify-content: center; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="firm-name">${firmName || "Organization Chart"}</div>
          <div class="report-meta">Organizational Chart &nbsp;·&nbsp; Report Date: ${reportDate}</div>
        </div>
        <div class="chart-wrap">${treeHtml}</div>
      </body>
      </html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 800);
  };

  const handleExportPNG = async () => {
    if (nodes.length === 0) return;
    const reportDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    // Pre-fetch all contact photos as base64 to avoid cross-origin canvas issues
    const photoCache = {};
    const photoUrls = firmContacts.map(c => c.photo_url).filter(Boolean);
    await Promise.all(photoUrls.map(async (url) => {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        photoCache[url] = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      } catch {
        // ignore failed photos
      }
    }));

    const treeHtml = buildPrintTree(nodes, rootIds, firmContacts, 0, photoCache).join("");

    // Build an off-screen iframe with the same styled HTML as the print view
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1200px;height:2000px;border:none;visibility:hidden;";
    document.body.appendChild(iframe);

    iframe.contentDocument.write(`
      <html>
      <head>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; background: white; padding: 32px; color: #1e293b; }
          .header { margin-bottom: 28px; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; }
          .firm-name { font-size: 22px; font-weight: 800; color: #1e293b; }
          .report-meta { font-size: 12px; color: #64748b; margin-top: 4px; }
          .chart-wrap { display: flex; justify-content: center; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="firm-name">${firmName || "Organization Chart"}</div>
          <div class="report-meta">Organizational Chart &nbsp;·&nbsp; Report Date: ${reportDate}</div>
        </div>
        <div class="chart-wrap">${treeHtml}</div>
      </body>
      </html>
    `);
    iframe.contentDocument.close();

    // Wait for images to load inside the iframe
    const imgs = Array.from(iframe.contentDocument.querySelectorAll("img"));
    await Promise.all(imgs.map(img => new Promise(resolve => {
      if (img.complete) return resolve();
      img.onload = resolve;
      img.onerror = resolve;
    })));

    // Measure actual content height
    const body = iframe.contentDocument.body;
    const contentH = body.scrollHeight + 40;
    iframe.style.height = `${contentH}px`;

    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(iframe.contentDocument.body, {
      backgroundColor: "#ffffff",
      scale: 2,
      width: 1200,
      height: contentH,
      windowWidth: 1200,
      windowHeight: contentH,
      useCORS: true,
      allowTaint: false,
    });

    document.body.removeChild(iframe);

    const link = document.createElement("a");
    link.download = `org-chart-${firmName || "export"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleFit = () => {
    if (!chartRef.current || !chartContainerRef.current) { setZoom(1); return; }
    const containerW = chartContainerRef.current.clientWidth - 32;
    const containerH = chartContainerRef.current.clientHeight - 32;
    const contentW = chartRef.current.scrollWidth;
    const contentH = chartRef.current.scrollHeight;
    if (contentW === 0 || contentH === 0) { setZoom(1); return; }
    const fitZoom = Math.min(containerW / contentW, containerH / contentH, 1.5);
    setZoom(Math.max(0.2, parseFloat(fitZoom.toFixed(2))));
  };

  const tree = buildTree(nodes, rootIds);
  const usedContactIds = new Set(nodes.map(n => n.contact_id));
  const availableContacts = firmContacts.filter(c => !usedContactIds.has(c.id));
  const levels = getMaxDepth(nodes, rootIds);
  const unassignedCount = availableContacts.length;

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setZoom(z => Math.max(0.2, z - 0.1))}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs text-gray-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setZoom(z => Math.min(2, z + 0.1))}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 ml-1" onClick={handleFit}>
            <Maximize2 className="w-3.5 h-3.5" /> Fit
          </Button>
        </div>

        {/* Save status */}
        <div className="flex items-center gap-1.5 min-w-[80px]">
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved
            </span>
          )}
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

      {/* Stats panel */}
      {nodes.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-semibold text-gray-800">{nodes.length}</span> placed
          </div>
          <div className="w-px h-3 bg-gray-200" />
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-semibold text-gray-800">{levels}</span> {levels === 1 ? "level" : "levels"}
          </div>
          <div className="w-px h-3 bg-gray-200" />
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <UserMinus className="w-3.5 h-3.5 text-orange-400" />
            <span className="font-semibold text-gray-800">{unassignedCount}</span> unassigned
          </div>
        </div>
      )}

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
        <div ref={chartContainerRef} className="flex-1 overflow-auto rounded-xl border border-gray-100 bg-gray-50/50 p-4">
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