import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Network, X } from "lucide-react";
import FirmNetworkMap from "./FirmNetworkMap";

/**
 * Full-screen modal wrapper around FirmNetworkMap, giving the firm-to-firm
 * relationship map a larger canvas for easier exploration of how firms are
 * connected through shared contacts, sub-managers, and consultants.
 */
export default function FirmNetworkMapModal({ open, onOpenChange, firmId, firmName, onFirmClick }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-3 border-b border-gray-200 flex-row items-center justify-between space-y-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Network className="w-4 h-4 text-indigo-600" />
            Firm Network Map
            {firmName && <span className="text-gray-400 font-normal">— {firmName}</span>}
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:text-gray-600"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-5">
          {firmId ? (
            <FirmNetworkMap
              firmId={firmId}
              onFirmClick={onFirmClick ? (f) => { onOpenChange(false); onFirmClick(f); } : undefined}
            />
          ) : (
            <div className="text-sm text-gray-400 italic py-8 text-center">
              Save the firm first to view the network map.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}