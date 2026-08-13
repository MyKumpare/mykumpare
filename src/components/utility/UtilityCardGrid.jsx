import React, { useState, useMemo } from "react";
import { GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { getOrderedCards, saveCardOrder } from "./utilityCards";

/**
 * Draggable 2-column grid of Utility function cards. Users can grab the handle
 * on any card to re-order; the custom order persists in localStorage and is
 * restored on reload. Clicking a card (not the handle) opens its view.
 */
export default function UtilityCardGrid({ isAdmin, onSelect, onAdminNavigate }) {
  const [orderedIds, setOrderedIds] = useState(() => {
    // Compute once from storage; subsequent reorders live in state.
    const cards = getOrderedCards(isAdmin);
    return cards.map((c) => c.id);
  });

  const cardsById = useMemo(() => {
    const map = new Map();
    // Re-read the full card metadata each render so admin-only filtering stays live.
    for (const c of getOrderedCards(isAdmin)) map.set(c.id, c);
    return map;
  }, [isAdmin]);

  const visibleCards = orderedIds
    .map((id) => cardsById.get(id))
    .filter(Boolean);

  const handleDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    setOrderedIds((prev) => {
      const next = [...prev];
      const [moved] = next.splice(result.source.index, 1);
      next.splice(result.destination.index, 0, moved);
      saveCardOrder(next);
      return next;
    });
  };

  const handleClick = (card) => {
    if (card.view === null) {
      onAdminNavigate?.();
    } else {
      onSelect(card.view);
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="utility-cards" direction="horizontal">
        {(droppableProvided) => (
          <div
            ref={droppableProvided.innerRef}
            {...droppableProvided.droppableProps}
            className="grid grid-cols-2 gap-2 py-1"
          >
            {visibleCards.map((card, index) => (
              <Draggable key={card.id} draggableId={card.id} index={index}>
                {(draggableProvided, snapshot) => (
                  <div
                    ref={draggableProvided.innerRef}
                    {...draggableProvided.draggableProps}
                    className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border bg-white text-center transition-shadow ${
                      snapshot.isDragging
                        ? "border-indigo-300 shadow-md ring-2 ring-indigo-100 z-10"
                        : "border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                    }`}
                  >
                    {/* Drag handle — grabbing here reorders the card without triggering the click */}
                    <button
                      type="button"
                      {...draggableProvided.dragHandleProps}
                      className="absolute top-1.5 right-1.5 p-1 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 cursor-grab active:cursor-grabbing"
                      title="Drag to reorder"
                      aria-label={`Drag ${card.title} to reorder`}
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleClick(card)}
                      className="flex flex-col items-center justify-center gap-2 w-full text-center"
                    >
                      <div className={`w-9 h-9 rounded-full ${card.iconBg} flex items-center justify-center`}>
                        <card.Icon className={`${card.iconSize} ${card.iconColor}`} />
                      </div>
                      <span className="text-sm font-semibold text-gray-700">{card.title}</span>
                      <span className="text-[11px] text-gray-400">{card.description}</span>
                    </button>
                  </div>
                )}
              </Draggable>
            ))}
            {droppableProvided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}