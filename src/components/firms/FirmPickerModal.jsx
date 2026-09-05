import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { X, Building, Plus, Search, ChevronRight, ChevronDown, Globe, MapPin, List, Users, Download, GitCompare, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { exportFirmsToCsv } from "./firmListCsvExport";
import { base44 } from "@/api/base44Client";

const HEADER_ORDER_KEY = "firmPicker_headerOrder";
const DEFAULT_HEADER_IDS = ["list", "map", "compareFirms", "firmCoverage", "exportCsv"];

function useHeaderOrder() {
  const [order, setOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(HEADER_ORDER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure all current items are present (handles new items added later)
        const merged = [...parsed];
        for (const id of DEFAULT_HEADER_IDS) {
          if (!merged.includes(id)) merged.push(id);
        }
        return merged.filter((id) => DEFAULT_HEADER_IDS.includes(id));
      }
    } catch { /* ignore */ }
    return DEFAULT_HEADER_IDS;
  });

  const updateOrder = (newOrder) => {
    setOrder(newOrder);
    try { localStorage.setItem(HEADER_ORDER_KEY, JSON.stringify(newOrder)); } catch { /* ignore */ }
  };

  return [order, updateOrder];
}
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { COUNTRIES, getStatesForCountry, getCitiesForState } from "./geoData";

const FIRM_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

import { getFirmTypes } from "./firmTypeUtils";

function makeFirmIcon(highlighted) {
  const size = highlighted ? 32 : 24;
  const inner = highlighted ? 16 : 12;
  return L.divIcon({
    className: "map-search-marker",
    html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;${highlighted ? "animation:map-bounce 0.5s ease infinite alternate;" : ""}"><div style="width:${inner}px;height:${inner}px;border-radius:50%;background:#4f46e5;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function MapInitializer() {
  const map = useMap();
  React.useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

// Auto-fits the map to the filtered firms' positions whenever the
// geographic drill-down or text search changes.
function MapAutoFit({ positions }) {
  const map = useMap();
  React.useEffect(() => {
    if (!positions || positions.length === 0) {
      map.setView([39.8283, -98.5795], 4);
      return;
    }
    if (positions.length === 1) {
      map.setView(positions[0], 8);
      return;
    }
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
  }, [positions, map]);
  return null;
}

function firmPosition(firm) {
  const addrs = firm.addresses || [];
  const hq = addrs.find((a) => a.is_headquarters && a.latitude != null && a.longitude != null);
  if (hq) return [hq.latitude, hq.longitude];
  const any = addrs.find((a) => a.latitude != null && a.longitude != null);
  if (any) return [any.latitude, any.longitude];
  return null;
}

export default function FirmPickerModal({ open, onClose, firms, onFirmClick, onAddFirm }) {
  const navigate = useNavigate();
  const [view, setView] = useState("list"); // "list" | "map"
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [allocatorTypeFilter, setAllocatorTypeFilter] = useState(new Set());
  const [allocatorTypeOptions, setAllocatorTypeOptions] = useState([]);
  const [collapsedTypes, setCollapsedTypes] = useState({});

  // Fetch AllocatorType master list so the sub-filter shows all available types
  React.useEffect(() => {
    let cancelled = false;
    base44.entities.AllocatorType.list()
      .then((rows) => { if (!cancelled) setAllocatorTypeOptions(rows.map((r) => r.name)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Clear the allocator_type sub-filter when Allocator is deselected
  React.useEffect(() => {
    if (typeFilter !== "Allocator" && allocatorTypeFilter.size > 0) {
      setAllocatorTypeFilter(new Set());
    }
  }, [typeFilter]);
  // Geographic drill-down
  const [geoCountry, setGeoCountry] = useState("");
  const [geoState, setGeoState] = useState("");
  const [geoCity, setGeoCity] = useState("");
  const [geoTypeFilter, setGeoTypeFilter] = useState("");
  const [geoSearch, setGeoSearch] = useState("");
  const [hoveredFirmId, setHoveredFirmId] = useState(null);
  const [headerOrder, setHeaderOrder] = useHeaderOrder();

  const toggleType = (type) => setCollapsedTypes(prev => ({ ...prev, [type]: !prev[type] }));
  const collapseAll = () => setCollapsedTypes(Object.fromEntries(types.map(t => [t, true])));
  const expandAll = () => setCollapsedTypes({});

  const q = search.toLowerCase();

  const activeFirms = useMemo(() =>
    firms.filter(f => !f.deleted_at), [firms]);

  // ── Geographic drill-down + global search: firms matching selected country/state/city and/or text search ──
  const geoFirms = useMemo(() => {
    const gq = geoSearch.trim().toLowerCase();
    return activeFirms.filter((f) => {
      // Firm type filter
      if (geoTypeFilter && !getFirmTypes(f).includes(geoTypeFilter)) return false;
      // Drill-down filter (country/state/city)
      const matchesDrill = (!geoCountry && !geoState && !geoCity) || (f.addresses || []).some((a) => {
        if (geoCountry && a.country !== geoCountry) return false;
        if (geoState && a.state !== geoState) return false;
        if (geoCity && (a.city || "").toLowerCase() !== geoCity.toLowerCase()) return false;
        return true;
      });
      if (!matchesDrill) return false;
      // Global text search across firm name, region, country, state, city
      if (!gq) return true;
      if ((f.name || "").toLowerCase().includes(gq)) return true;
      if ((f.geographic_region || "").toLowerCase().includes(gq)) return true;
      return (f.addresses || []).some((a) =>
        (a.country || "").toLowerCase().includes(gq) ||
        (a.state || "").toLowerCase().includes(gq) ||
        (a.city || "").toLowerCase().includes(gq)
      );
    });
  }, [activeFirms, geoCountry, geoState, geoCity, geoTypeFilter, geoSearch]);

  // Cities available for the selected country+state (from firm addresses + geoData)
  const geoCityOptions = useMemo(() => {
    const fromData = getCitiesForState(geoState);
    const fromFirms = new Set(
      activeFirms
        .flatMap((f) => f.addresses || [])
        .filter((a) => (!geoCountry || a.country === geoCountry) && (!geoState || a.state === geoState))
        .map((a) => a.city)
        .filter(Boolean)
    );
    const merged = Array.from(new Set([...fromData, ...fromFirms]));
    return merged.sort((a, b) => a.localeCompare(b));
  }, [activeFirms, geoCountry, geoState]);

  const geoMapPoints = useMemo(() =>
    geoFirms.map((f) => ({ firm: f, pos: firmPosition(f) })).filter((p) => p.pos),
    [geoFirms]);

  const filtered = useMemo(() =>
    activeFirms.filter(f => {
      const matchesSearch = !q ||
        (f.name || "").toLowerCase().includes(q) ||
        (f.firm_type || "").toLowerCase().includes(q) ||
        (f.firm_types || []).some(t => t.toLowerCase().includes(q));
      const matchesType = !typeFilter || getFirmTypes(f).includes(typeFilter);
      const matchesAllocatorType = allocatorTypeFilter.size === 0 ||
        (allocatorTypeFilter.has("__no_type__") && (!f.allocator_types || f.allocator_types.length === 0)) ||
        (f.allocator_types || []).some(at => allocatorTypeFilter.has(at));
      return matchesSearch && matchesType && matchesAllocatorType;
    }), [activeFirms, q, typeFilter, allocatorTypeFilter]);

  // Allocator type counts — from all Allocator firms (before sub-filter), merged with master list
  const allocatorTypeCounts = useMemo(() => {
    const counts = {};
    allocatorTypeOptions.forEach((at) => { counts[at] = 0; });
    activeFirms
      .filter(f => getFirmTypes(f).includes("Allocator"))
      .forEach(f => (f.allocator_types || []).forEach(at => { counts[at] = (counts[at] || 0) + 1; }));
    return counts;
  }, [activeFirms, allocatorTypeOptions]);

  // Count of Allocator firms with no allocator type assigned
  const allocatorNoTypeCount = useMemo(() =>
    activeFirms.filter(f => getFirmTypes(f).includes("Allocator") && (!f.allocator_types || f.allocator_types.length === 0)).length,
    [activeFirms]
  );

  const grouped = useMemo(() => {
    const result = {};
    const seen = {};
    // When a type filter is active, only group firms under the selected type
    // so multi-type firms don't bleed into other sections.
    const typesToGroup = typeFilter ? [typeFilter] : FIRM_TYPES;
    typesToGroup.forEach(type => {
      const typeFirms = filtered
        .filter(f => getFirmTypes(f).includes(type))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (typeFirms.length > 0) {
        result[type] = typeFirms;
        typeFirms.forEach(f => { seen[f.id] = true; });
      }
    });
    if (!typeFilter) {
      const other = filtered.filter(f => !seen[f.id]).sort((a, b) => a.name.localeCompare(b.name));
      if (other.length > 0) result["Other"] = other;
    }
    return result;
  }, [filtered, typeFilter]);

  // Type counts computed from ALL active firms (not the filtered list) so the
  // filter pills always show every available type, even when one is selected.
  const typeCounts = useMemo(() => {
    const counts = {};
    FIRM_TYPES.forEach(type => { counts[type] = 0; });
    counts["Other"] = 0;
    activeFirms.forEach(f => {
      const types = getFirmTypes(f);
      types.forEach(type => {
        if (counts[type] != null) counts[type]++;
        else counts["Other"]++;
      });
    });
    return counts;
  }, [activeFirms]);

  if (!open) return null;

  const types = Object.keys(grouped);

  const handleGeoFirmClick = (firm) => {
    onFirmClick(firm);
    onClose();
  };

  const resetGeo = () => {
    setGeoCountry("");
    setGeoState("");
    setGeoCity("");
    setGeoTypeFilter("");
    setGeoSearch("");
  };

  const statesForGeoCountry = getStatesForCountry(geoCountry);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${view === "map" ? "max-w-6xl" : "max-w-4xl"} max-h-[82vh] overflow-hidden flex flex-col`}>

        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-100">
         {/* Row 1: title + close */}
         <div className="flex items-center justify-between">
           <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
             <Building className="w-4 h-4 text-indigo-600" />
             Firms
             <span className="text-xs text-gray-400 font-normal">
               ({view === "map" ? geoFirms.length : filtered.length})
             </span>
           </h2>
           <button type="button" onClick={onClose}>
             <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
           </button>
         </div>
         {/* Row 2: all header functions in one unified drag-and-drop row */}
         <DragDropContext
           onDragEnd={(result) => {
             if (!result.destination) return;
             const newOrder = [...headerOrder];
             const [moved] = newOrder.splice(result.source.index, 1);
             newOrder.splice(result.destination.index, 0, moved);
             setHeaderOrder(newOrder);
           }}
         >
           <Droppable droppableId="header-functions" direction="horizontal">
             {(provided) => (
               <div
                 ref={provided.innerRef}
                 {...provided.droppableProps}
                 className="flex items-center gap-1.5 mt-2.5 flex-wrap"
               >
                 {headerOrder.map((itemId, index) => {
                   const isListView = itemId === "list";
                   const isMapView = itemId === "map";
                   const isView = isListView || isMapView;
                   const isExport = itemId === "exportCsv";
                   const isCoverage = itemId === "firmCoverage";
                   const isCompare = itemId === "compareFirms";
                   const isActiveView = isView && ((isListView && view === "list") || (isMapView && view === "map"));
                   const buttonClasses = isActiveView
                     ? "bg-indigo-50 text-indigo-700"
                     : isExport
                       ? "text-gray-600 hover:bg-gray-100"
                       : "text-indigo-600 hover:bg-indigo-50";
                   return (
                     <Draggable key={itemId} draggableId={itemId} index={index}>
                       {(dragProvided, snapshot) => (
                         <div
                           ref={dragProvided.innerRef}
                           {...dragProvided.draggableProps}
                           className={`flex items-center gap-0.5 rounded-md transition-shadow ${snapshot.isDragging ? "shadow-md ring-1 ring-indigo-200 bg-white" : ""}`}
                         >
                           <span
                             {...dragProvided.dragHandleProps}
                             className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex items-center pr-0.5"
                             title="Drag to reorder"
                           >
                             <GripVertical className="w-3 h-3" />
                           </span>
                           {isListView && (
                             <button
                               onClick={() => setView("list")}
                               className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${buttonClasses}`}
                             >
                               <List className="w-3.5 h-3.5" /> List
                             </button>
                           )}
                           {isMapView && (
                             <button
                               onClick={() => setView("map")}
                               className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${buttonClasses}`}
                             >
                               <Globe className="w-3.5 h-3.5" /> Geographic Map
                             </button>
                           )}
                           {isExport && (
                             <button
                               type="button"
                               onClick={() => exportFirmsToCsv(view === "map" ? geoFirms : filtered, "firm-picker-export.csv")}
                               disabled={(view === "map" ? geoFirms : filtered).length === 0}
                               className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${buttonClasses} disabled:opacity-40 disabled:cursor-not-allowed`}
                               title="Export filtered firms to CSV"
                             >
                               <Download className="w-3.5 h-3.5" /> Export CSV
                             </button>
                           )}
                           {isCoverage && (
                             <button
                               type="button"
                               onClick={() => { onClose(); navigate("/XponanceDashboard"); }}
                               className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${buttonClasses}`}
                               title="Firm Coverage"
                             >
                               <Users className="w-3.5 h-3.5" /> Firm Coverage
                             </button>
                           )}
                           {isCompare && (
                             <button
                               type="button"
                               onClick={() => { onClose(); navigate("/FirmComparison"); }}
                               className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${buttonClasses}`}
                               title="Compare Firms"
                             >
                               <GitCompare className="w-3.5 h-3.5" /> Compare Firms
                             </button>
                           )}
                         </div>
                       )}
                     </Draggable>
                   );
                 })}
                 {provided.placeholder}
               </div>
             )}
           </Droppable>
         </DragDropContext>
        </div>

        {view === "list" ? (
          <>
            {/* Search */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by firm name or type..."
                  className="w-full h-9 pl-9 pr-8 text-sm rounded-lg border border-gray-200 outline-none focus:border-indigo-400 bg-gray-50"
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setTypeFilter("")}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors border ${
                    !typeFilter
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  All ({activeFirms.length})
                </button>
                {FIRM_TYPES.map(type => {
                  const count = typeCounts[type] || 0;
                  if (count === 0 && typeFilter !== type) return null;
                  const active = typeFilter === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTypeFilter(active ? "" : type)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors border ${
                        active
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {type} ({count})
                    </button>
                  );
                })}
                {typeCounts["Other"] > 0 && (
                  <button
                    type="button"
                    onClick={() => setTypeFilter(typeFilter === "Other" ? "" : "Other")}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors border ${
                      typeFilter === "Other"
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    Other ({typeCounts["Other"]})
                  </button>
                )}
              </div>

              {/* Allocator sub-type filter pills — drill-down shown only when Allocator is selected */}
              {typeFilter === "Allocator" && (
                <div className="flex items-center gap-1.5 flex-wrap mt-2 pl-1">
                  <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mr-0.5">Allocator Type:</span>
                  <button
                    type="button"
                    onClick={() => setAllocatorTypeFilter(new Set())}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors border ${
                      allocatorTypeFilter.size === 0
                        ? "bg-violet-600 text-white border-violet-600"
                        : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    All ({(grouped["Allocator"] || []).length || (typeCounts["Allocator"] || 0)})
                  </button>
                  {allocatorNoTypeCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = new Set(allocatorTypeFilter);
                        if (next.has("__no_type__")) next.delete("__no_type__");
                        else next.add("__no_type__");
                        setAllocatorTypeFilter(next);
                      }}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors border ${
                        allocatorTypeFilter.has("__no_type__")
                          ? "bg-violet-600 text-white border-violet-600"
                          : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      No Type ({allocatorNoTypeCount})
                    </button>
                  )}
                  {Object.entries(allocatorTypeCounts)
                    .filter(([, count]) => count > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([at, count]) => {
                      const active = allocatorTypeFilter.has(at);
                      return (
                        <button
                          key={at}
                          type="button"
                          onClick={() => {
                            const next = new Set(allocatorTypeFilter);
                            if (next.has(at)) next.delete(at);
                            else next.add(at);
                            setAllocatorTypeFilter(next);
                          }}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors border ${
                            active
                              ? "bg-violet-600 text-white border-violet-600"
                              : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          {at} ({count})
                        </button>
                      );
                    })}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 mt-1.5">
                <button
                  type="button"
                  onClick={expandAll}
                  className="text-[11px] text-gray-500 hover:text-indigo-600 font-medium"
                >
                  Expand All
                </button>
                <span className="text-gray-300 text-[11px]">|</span>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="text-[11px] text-gray-500 hover:text-indigo-600 font-medium"
                >
                  Collapse All
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-8">
                  {search ? "No firms match your search." : "No firms yet."}
                </p>
              ) : (
                <div className="space-y-0.5">
                  {types.map(type => {
                    const isCollapsed = collapsedTypes[type];
                    const firmList = grouped[type];
                    return (
                      <div key={type}>
                        <button
                          type="button"
                          onClick={() => toggleType(type)}
                          className="w-full flex items-center gap-2 px-4 py-1.5 hover:bg-gray-50 transition-colors"
                        >
                          {isCollapsed
                            ? <ChevronRight className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                            : <ChevronDown className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                          }
                          <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">{type}</span>
                          <span className="text-[10px] text-gray-400 ml-auto">{firmList.length}</span>
                        </button>
                        {!isCollapsed && (
                          <div className="px-4 pb-1 space-y-0.5">
                            {firmList.map(firm => (
                              <button
                                key={firm.id}
                                type="button"
                                onClick={() => { onFirmClick(firm); onClose(); }}
                                className="w-full text-left flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl hover:bg-indigo-50 transition-all group"
                              >
                                {firm.logo_url ? (
                                  <img src={firm.logo_url} alt={firm.name} className="w-7 h-7 rounded-md object-cover flex-shrink-0 border border-gray-100" />
                                ) : (
                                  <div className="w-7 h-7 rounded-md flex-shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-gray-800 truncate group-hover:text-indigo-700">
                                    {firm.name}
                                  </p>
                                  {firm.website && (
                                    <p className="text-xs text-gray-400 truncate">{firm.website}</p>
                                  )}
                                </div>
                                <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 flex-shrink-0" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Geographic drill-down + global search */}
            <div className="px-4 py-3 border-b border-gray-100 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={geoSearch}
                  onChange={e => setGeoSearch(e.target.value)}
                  placeholder="Search by firm, region, country, state/province, or city..."
                  className="w-full h-9 pl-9 pr-8 text-sm rounded-lg border border-gray-200 outline-none focus:border-indigo-400 bg-gray-50"
                />
                {geoSearch && (
                  <button type="button" onClick={() => setGeoSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                <span className="font-medium">Drill down: Country → State/Province → City</span>
                {(geoCountry || geoState || geoCity || geoTypeFilter || geoSearch) && (
                  <button type="button" onClick={resetGeo} className="ml-auto text-indigo-600 hover:text-indigo-800 font-medium">
                    Reset
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <select
                  value={geoCountry}
                  onChange={(e) => { setGeoCountry(e.target.value); setGeoState(""); setGeoCity(""); }}
                  className="h-8 text-xs rounded-lg border border-gray-200 bg-gray-50 px-2 outline-none focus:border-indigo-400 cursor-pointer"
                >
                  <option value="">All Countries</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
                <select
                  value={geoState}
                  onChange={(e) => { setGeoState(e.target.value); setGeoCity(""); }}
                  disabled={!geoCountry}
                  className="h-8 text-xs rounded-lg border border-gray-200 bg-gray-50 px-2 outline-none focus:border-indigo-400 cursor-pointer disabled:opacity-50"
                >
                  <option value="">All States</option>
                  {statesForGeoCountry.map((s) => (
                    <option key={s.code} value={s.code}>{s.name}</option>
                  ))}
                </select>
                <select
                  value={geoCity}
                  onChange={(e) => setGeoCity(e.target.value)}
                  disabled={!geoState}
                  className="h-8 text-xs rounded-lg border border-gray-200 bg-gray-50 px-2 outline-none focus:border-indigo-400 cursor-pointer disabled:opacity-50"
                >
                  <option value="">All Cities</option>
                  {geoCityOptions.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
                <select
                  value={geoTypeFilter}
                  onChange={(e) => setGeoTypeFilter(e.target.value)}
                  className="h-8 text-xs rounded-lg border border-gray-200 bg-gray-50 px-2 outline-none focus:border-indigo-400 cursor-pointer"
                >
                  <option value="">All Firm Types</option>
                  {FIRM_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Map + firm list */}
            <div className="flex-1 flex flex-col sm:flex-row min-h-0">
              <div className="flex-1 min-h-[240px] relative">
                <MapContainer
                  center={[39.8283, -98.5795]}
                  zoom={4}
                  className="w-full h-full"
                  style={{ background: "#e5e7eb" }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <MapInitializer />
                  <MapAutoFit positions={geoMapPoints.map((p) => p.pos)} />
                  {geoMapPoints.map(({ firm, pos }) => (
                    <Marker
                      key={firm.id}
                      position={pos}
                      icon={makeFirmIcon(hoveredFirmId === firm.id)}
                      zIndexOffset={hoveredFirmId === firm.id ? 1000 : 0}
                      eventHandlers={{
                        click: () => handleGeoFirmClick(firm),
                        mouseover: () => setHoveredFirmId(firm.id),
                        mouseout: () => setHoveredFirmId(null),
                      }}
                    >
                      <Tooltip direction="top" offset={[0, -12]} opacity={1}>
                        <div className="text-sm">
                          <div className="font-semibold">{firm.name}</div>
                          <div className="text-gray-500 text-xs">{getFirmTypes(firm).join(", ")}</div>
                          <div className="text-indigo-600 text-xs mt-1 font-medium">Click to open</div>
                        </div>
                      </Tooltip>
                    </Marker>
                  ))}
                </MapContainer>
              </div>

              <div className="w-full sm:w-[240px] sm:border-l border-t sm:border-t-0 border-gray-200 flex flex-col min-h-0 max-h-[35vh] sm:max-h-none">
                <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                  <span className="text-xs font-semibold text-gray-700">
                    {geoFirms.length} firm{geoFirms.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {geoFirms.length === 0 ? (
                    <p className="text-xs text-gray-400 italic text-center py-6">
                      No firms match the selected location.
                    </p>
                  ) : (
                    geoFirms
                      .slice()
                      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                      .map((firm) => (
                        <button
                          key={firm.id}
                          type="button"
                          onClick={() => handleGeoFirmClick(firm)}
                          onMouseEnter={() => setHoveredFirmId(firm.id)}
                          onMouseLeave={() => setHoveredFirmId(null)}
                          className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${hoveredFirmId === firm.id ? "bg-indigo-50" : "hover:bg-gray-50"}`}
                        >
                          {firm.logo_url ? (
                            <img src={firm.logo_url} alt={firm.name} className="w-6 h-6 rounded-md object-cover flex-shrink-0 border border-gray-100" />
                          ) : (
                            <div className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center flex-shrink-0">
                              <Building className="w-3 h-3 text-indigo-400" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-800 truncate">{firm.name}</p>
                            <p className="text-[10px] text-gray-400 truncate">
                              {(firm.addresses || []).find((a) => (!geoCountry || a.country === geoCountry) && (!geoState || a.state === geoState) && (!geoCity || (a.city || "").toLowerCase() === geoCity.toLowerCase()))?.city}
                            </p>
                          </div>
                        </button>
                      ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100">
          <button
            type="button"
            onClick={() => { onAddFirm(); onClose(); }}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Firm
          </button>
        </div>
      </div>
    </div>
  );
}