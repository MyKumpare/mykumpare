import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"];
const PDF_EXTS = ["pdf"];

function getExt(name) {
  const parts = (name || "").split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

function isImage(url, name, fileType) {
  if (fileType && fileType.startsWith("image/")) return true;
  return IMAGE_EXTS.includes(getExt(name));
}

function isPdf(url, name, fileType) {
  if (fileType === "application/pdf") return true;
  return PDF_EXTS.includes(getExt(name));
}

/**
 * In-app document preview dialog.
 * Renders images inline, PDFs in an iframe, and a fallback info card
 * with a download link for unsupported types.
 *
 * Props:
 *  - attachment: { name, file_url, file_type, uploaded_at, uploaded_by_name } | null
 *  - open: boolean
 *  - onOpenChange: (open) => void
 */
export default function DocumentPreviewDialog({ attachment, open, onOpenChange }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && attachment) {
      setLoading(true);
    }
  }, [open, attachment?.id]);

  if (!attachment) return null;

  const { name, file_url, file_type } = attachment;
  const image = isImage(file_url, name, file_type);
  const pdf = isPdf(file_url, name, file_type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <FileText className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="truncate">{name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 pb-2 border-b">
          <a href={file_url} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline">
              <ExternalLink className="w-3.5 h-3.5" />
              Open in new tab
            </Button>
          </a>
          <a href={file_url} download={name}>
            <Button size="sm" variant="outline">
              <Download className="w-3.5 h-3.5" />
              Download
            </Button>
          </a>
        </div>

        <div className="flex-1 overflow-auto min-h-[300px] flex items-center justify-center bg-gray-50 rounded-md border">
          {loading && (
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-xs">Loading preview...</span>
            </div>
          )}

          {image && (
            <img
              src={file_url}
              alt={name}
              className={`max-w-full max-h-[70vh] object-contain ${loading ? "hidden" : ""}`}
              onLoad={() => setLoading(false)}
              onError={() => setLoading(false)}
            />
          )}

          {pdf && (
            <iframe
              src={file_url}
              title={name}
              className={`w-full h-[70vh] border-0 ${loading ? "hidden" : ""}`}
              onLoad={() => setLoading(false)}
            />
          )}

          {!image && !pdf && (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <FileText className="w-12 h-12 text-gray-300" />
              <div>
                <p className="text-sm font-medium text-gray-700">{name}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Preview not available for this file type.
                </p>
              </div>
              <a href={file_url} target="_blank" rel="noreferrer">
                <Button size="sm">
                  <Download className="w-3.5 h-3.5" />
                  Download to view
                </Button>
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}