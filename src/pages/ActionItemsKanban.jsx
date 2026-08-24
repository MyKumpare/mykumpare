import React from "react";
import ActionItemsKanbanBoard from "@/components/activity/ActionItemsKanbanBoard";

export default function ActionItemsKanban() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 h-screen flex flex-col">
        <ActionItemsKanbanBoard />
      </div>
    </div>
  );
}