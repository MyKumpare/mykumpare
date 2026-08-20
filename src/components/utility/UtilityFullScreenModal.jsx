import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { X, Wrench } from "lucide-react";
import UtilitySection from "./UtilitySection";

export default function UtilityFullScreenModal({ open, onClose, deletedCount = 0, onFirmClick, defaultView }) {
  const [forceKey, setForceKey] = useState(0);

  // Reset the UtilitySection to its selection menu each time the modal opens
  useEffect(() => {
    if (open) setForceKey((k) => k + 1);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-none w-screen h-screen sm:rounded-none p-0 gap-0 flex flex-col overflow-hidden [&>button]:!hidden">
        <DialogTitle className="sr-only">Utilities</DialogTitle>
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 text-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            <span className="text-base font-bold">Utilities</span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/15 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto bg-gray-50/80 px-4 sm:px-6 py-4">
          <div className="max-w-3xl mx-auto">
            <UtilitySection key={forceKey} deletedCount={deletedCount} forceExpanded={true} onFirmClick={onFirmClick} defaultView={defaultView} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}