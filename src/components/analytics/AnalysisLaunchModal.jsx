import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, FolderOpen } from "lucide-react";

/**
 * First modal: asks user to start a new analysis or open an existing one.
 */
export default function AnalysisLaunchModal({ open, onOpenChange, onNew, onViewExisting }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-gray-800">Analytics</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 -mt-1 mb-4">What would you like to do?</p>
        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={onNew}
            className="flex items-center gap-3 p-4 border-2 border-dashed border-indigo-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
              <Plus className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-800">New Analysis</p>
              <p className="text-xs text-gray-500">Start fresh with selected products</p>
            </div>
          </button>
          <button
            onClick={onViewExisting}
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
              <FolderOpen className="w-4 h-4 text-gray-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-800">View / Edit Existing</p>
              <p className="text-xs text-gray-500">Open a previously saved analysis</p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}