import React from "react";
import { CheckCircle2, AlertCircle, Loader2, FileText, X } from "lucide-react";

export const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const accentStyles = {
  teal: { border: "border-teal-200", bg: "bg-teal-50/50", icon: "text-teal-600" },
  cyan: { border: "border-cyan-200", bg: "bg-cyan-50/50", icon: "text-cyan-600" },
};

/**
 * Reusable upload status card showing the file name, upload progress, and
 * success/error state so the user knows exactly what they are uploading and
 * whether it finished successfully.
 *
 * Props:
 *  - fileName: file name string
 *  - fileSize: formatted file size string (optional)
 *  - status: "uploading" | "success" | "error"
 *  - error: error message (when status === "error")
 *  - onRemove: callback for the remove/dismiss button (optional)
 *  - accent: "teal" | "cyan" (optional, defaults to teal)
 */
export default function UploadStatusCard({ fileName, fileSize, status, error, onRemove, accent = "teal" }) {
  const a = accentStyles[accent] || accentStyles.teal;

  if (status === "uploading") {
    return (
      <div className={`flex items-center gap-2 rounded-md border ${a.border} ${a.bg} px-3 py-2`}>
        <Loader2 className={`w-4 h-4 ${a.icon} shrink-0 animate-spin`} />
        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-800 truncate">{fileName}</div>
          <div className="text-xs text-gray-500">{fileSize ? `${fileSize} · ` : ""}Uploading...</div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50/50 px-3 py-2">
        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-800 truncate">{fileName}</div>
          <div className="text-xs text-red-600">{fileSize ? `${fileSize} · ` : ""}{error || "Upload failed"}</div>
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} className="p-1 text-gray-400 hover:text-red-500 shrink-0" title="Dismiss">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  // success
  return (
    <div className={`flex items-center gap-2 rounded-md border ${a.border} ${a.bg} px-3 py-2`}>
      <CheckCircle2 className={`w-4 h-4 ${a.icon} shrink-0`} />
      <FileText className="w-4 h-4 text-gray-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800 truncate">{fileName}</div>
        <div className="text-xs text-gray-500">{fileSize ? `${fileSize} · ` : ""}Uploaded successfully</div>
      </div>
      {onRemove && (
        <button type="button" onClick={onRemove} className="p-1 text-gray-400 hover:text-red-500 shrink-0" title="Remove">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}