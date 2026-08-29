import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  GripVertical, X, Plus, RotateCcw, Settings2, Loader2, LayoutDashboard,
} from "lucide-react";
import {
  MODULE_REGISTRY, DEFAULT_MODULE_ORDER, loadModuleOrder, saveModuleOrder,
} from "./execDashboardModules";

const WIDTH_CLASSES = {
  half: "w-full lg:w-[calc(50%-8px)]",
  full: "w-full",
};

export default function ExecDashboardLayout({ data, loading, hasData }) {
  const [moduleOrder, setModuleOrder] = useState(loadModuleOrder);
  const [showCustomizer, setShowCustomizer] = useState(false);

  useEffect(() => {
    saveModuleOrder(moduleOrder);
  }, [moduleOrder]);

  const onDragEnd = (result) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;
    const newOrder = [...moduleOrder];
    const [moved] = newOrder.splice(result.source.index, 1);
    newOrder.splice(result.destination.index, 0, moved);
    setModuleOrder(newOrder);
  };

  const addModule = (id) => {
    if (moduleOrder.includes(id)) return;
    setModuleOrder([...moduleOrder, id]);
  };

  const removeModule = (id) => {
    setModuleOrder(moduleOrder.filter((m) => m !== id));
  };

  const resetLayout = () => {
    setModuleOrder(DEFAULT_MODULE_ORDER);
  };

  const availableToAdd = Object.keys(MODULE_REGISTRY).filter((id) => !moduleOrder.includes(id));
  const categories = [...new Set(Object.values(MODULE_REGISTRY).map((m) => m.category))];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
        <LayoutDashboard className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500 font-medium">No exposure data available yet.</p>
        <p className="text-xs text-gray-400 mt-1">Add AUM history to your firms and products to see exposure summaries here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Customize bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {moduleOrder.length} module{moduleOrder.length === 1 ? "" : "s"} shown · drag the grip handle to reorder
        </p>
        <button
          onClick={() => setShowCustomizer(!showCustomizer)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            showCustomizer
              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          Customize
        </button>
      </div>

      {/* Customizer panel */}
      {showCustomizer && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Dashboard Modules</h3>
            <button
              onClick={resetLayout}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Default
            </button>
          </div>

          {categories.map((cat) => {
            const catModules = Object.values(MODULE_REGISTRY).filter((m) => m.category === cat);
            return (
              <div key={cat}>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{cat}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {catModules.map((mod) => {
                    const isVisible = moduleOrder.includes(mod.id);
                    return (
                      <button
                        key={mod.id}
                        onClick={() => (isVisible ? removeModule(mod.id) : addModule(mod.id))}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-colors ${
                          isVisible
                            ? "border-indigo-200 bg-indigo-50/50"
                            : "border-gray-200 bg-gray-50/50 hover:bg-gray-100"
                        }`}
                      >
                        <mod.icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isVisible ? "text-indigo-600" : "text-gray-400"}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium ${isVisible ? "text-gray-800" : "text-gray-500"}`}>
                            {mod.title}
                          </p>
                          <p className="text-[10px] text-gray-400 truncate">{mod.description}</p>
                        </div>
                        <div className={`flex-shrink-0 mt-0.5 ${isVisible ? "text-indigo-600" : "text-gray-300"}`}>
                          {isVisible ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {availableToAdd.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">All available modules are already on the dashboard.</p>
          )}
        </div>
      )}

      {/* Drag-and-drop module grid */}
      {moduleOrder.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-500 font-medium">No modules on the dashboard.</p>
          <p className="text-xs text-gray-400 mt-1">Click "Customize" to add modules.</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="exec-dashboard" direction="vertical">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex flex-wrap gap-4"
              >
                {moduleOrder.map((moduleId, index) => {
                  const mod = MODULE_REGISTRY[moduleId];
                  if (!mod) return null;
                  return (
                    <Draggable key={moduleId} draggableId={moduleId} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`${WIDTH_CLASSES[mod.width] || "w-full"} ${snapshot.isDragging ? "z-50" : ""}`}
                          style={{
                            ...provided.draggableProps.style,
                            ...(snapshot.isDragging ? { opacity: 0.9 } : {}),
                          }}
                        >
                          <div className="relative group h-full">
                            {/* Hover toolbar */}
                            <div className="absolute top-2 right-2 z-20 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                {...provided.dragHandleProps}
                                className="p-1 rounded-md bg-white/90 hover:bg-gray-100 cursor-grab active:cursor-grabbing shadow-sm border border-gray-200"
                                title="Drag to reorder"
                              >
                                <GripVertical className="w-3.5 h-3.5 text-gray-500" />
                              </button>
                              <button
                                onClick={() => removeModule(moduleId)}
                                className="p-1 rounded-md bg-white/90 hover:bg-red-50 hover:text-red-500 shadow-sm border border-gray-200 text-gray-500"
                                title="Remove module"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {mod.render(data)}
                          </div>
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
      )}
    </div>
  );
}