import React, { useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Download, X } from "lucide-react";

/**
 * Reusable full-size image viewer used to validate contact photos and firm
 * logos. Clicking the small thumbnail opens this dialog with the image at a
 * much larger size.
 */
export default function ImageZoomDialog({ open, onOpenChange, src, alt = "Image", caption }) {
  // Close on Escape is handled by the Dialog primitive already.
  const handleDownload = () => {
    if (!src) return;
    const a = document.createElement("a");
    a.href = src;
    a.download = alt || "image";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <div className="relative bg-gray-900 flex items-center justify-center">
          {src ? (
            <img
              src={src}
              alt={alt}
              className="max-h-[80vh] max-w-full object-contain"
            />
          ) : (
            <div className="text-gray-400 py-20">No image available</div>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          {src && (
            <button
              type="button"
              onClick={handleDownload}
              className="absolute top-2 left-2 h-8 px-3 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center gap-1.5 text-xs font-medium transition-colors"
              title="Download image"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          )}
          {caption && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-2 text-center text-sm text-white font-medium">
              {caption}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}