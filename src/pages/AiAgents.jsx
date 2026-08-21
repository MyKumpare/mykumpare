import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bot, ArrowRight, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { AI_AGENTS } from "@/components/ai/agentRegistry";
import { useAgentOrder } from "@/hooks/useAgentOrder";

export default function AiAgents() {
  const { order, move } = useAgentOrder();
  const byId = Object.fromEntries(AI_AGENTS.map((a) => [a.id, a]));
  const ordered = order.map((id) => byId[id]).filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50/80">
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="h-5 w-px bg-white/30" />
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Bot className="w-5 h-5" />
            AI Agents
          </h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <p className="text-sm text-gray-500 mb-1">
          All AI agents available in your workspace. Click an agent to launch its chat.
        </p>
        <p className="text-xs text-gray-400 mb-6 flex items-center gap-1.5">
          <GripVertical className="w-3.5 h-3.5" />
          Drag the cards to reorder them — your order is saved and used by the floating assistant button.
        </p>

        <DragDropContext
          onDragEnd={(res) => {
            if (res.destination && res.destination.index !== res.source.index) {
              move(res.source.index, res.destination.index);
            }
          }}
        >
          <Droppable droppableId="agents">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {ordered.map((agent, index) => {
                  const Icon = agent.icon;
                  return (
                    <Draggable key={agent.id} draggableId={agent.id} index={index}>
                      {(prov, snapshot) => (
                        <div
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          className={`group relative bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all p-5 ${
                            snapshot.isDragging ? "shadow-xl ring-2 ring-indigo-300 z-10" : ""
                          }`}
                        >
                          <div
                            {...prov.dragHandleProps}
                            className="absolute top-3 right-3 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing p-1"
                            title="Drag to reorder"
                          >
                            <GripVertical className="w-4 h-4" />
                          </div>
                          <Link to={agent.to} className="block">
                            <div className="flex items-start gap-4 pr-6">
                              <div
                                className={`w-12 h-12 rounded-lg ${agent.iconBg} flex items-center justify-center flex-shrink-0`}
                              >
                                <Icon className={`w-6 h-6 ${agent.iconColor}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                                  {agent.name}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1 line-clamp-3">
                                  {agent.description}
                                </p>
                              </div>
                            </div>
                            <div className="mt-4 flex items-center justify-end">
                              <span
                                className={`inline-flex items-center gap-1 text-sm font-medium bg-gradient-to-r ${agent.accent} bg-clip-text text-transparent`}
                              >
                                Launch
                                <ArrowRight className="w-4 h-4 text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
                              </span>
                            </div>
                          </Link>
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
    </div>
  );
}