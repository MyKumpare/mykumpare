import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import FirmCard from "./FirmCard";

const TYPE_ICONS = {
  "Manager of Managers": "bg-violet-100 text-violet-700",
  "Investment Manager": "bg-blue-100 text-blue-700",
  "Allocator": "bg-emerald-100 text-emerald-700",
  "Investment Consultant": "bg-amber-100 text-amber-700",
  "Securities Brokerage": "bg-rose-100 text-rose-700",
  "Trade Organizations": "bg-cyan-100 text-cyan-700",
};

export default function FirmTypeSection({ type, firms, onEdit, onDelete, onAddToType }) {
  const [expanded, setExpanded] = useState(true);
  const colorClass = TYPE_ICONS[type] || "bg-gray-100 text-gray-700";

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 mb-3 group cursor-pointer"
      >
        <div className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider ${colorClass}`}>
          {type}
        </div>
        <div className="h-px flex-1 bg-gray-100" />
        <span className="text-xs text-gray-400 font-medium">{firms.length}</span>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 pl-1">
              <AnimatePresence>
                {firms.map((firm) => (
                  <FirmCard
                    key={firm.id}
                    firm={firm}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}