import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Building2 } from "lucide-react";

export default function FirmCard({ firm, onEdit, onDelete }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="group flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all duration-200"
    >
      <button
        className="flex items-center gap-3 min-w-0 flex-1 text-left"
        onClick={() => onEdit(firm)}
      >
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
          <Building2 className="w-4 h-4 text-indigo-600" />
        </div>
        <span className="font-medium text-gray-900 truncate hover:text-indigo-600 transition-colors">{firm.name}</span>
      </button>
    </motion.div>
  );
}