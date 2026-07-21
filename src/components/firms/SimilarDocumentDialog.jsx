import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "MM/dd/yyyy");
  } catch {
    return iso || "—";
  }
};

// Alerts the user that a document with the same name (plus its details) already
// exists, letting them accept (create anyway) or reject (discard the upload).
export default function SimilarDocumentDialog({
  open,
  newDoc,
  matches,
  onAccept,
  onReject,
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onReject()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Possible Duplicate Document
          </DialogTitle>
          <DialogDescription>
            A document with the same name already exists for this firm. Review
            the details below and choose whether to add it anyway.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
            <p className="text-xs font-semibold text-indigo-700 mb-1">New document</p>
            <p className="text-sm font-medium text-gray-800">{newDoc?.file_name}</p>
            <p className="text-xs text-gray-500">
              Entry: {fmtDate(newDoc?.entry_date)}
              {newDoc?.document_as_of_date
                ? ` · As of: ${fmtDate(newDoc.document_as_of_date)}`
                : ""}
            </p>
            {newDoc?.categories?.length > 0 && (
              <p className="text-xs text-gray-500">
                Categories: {newDoc.categories.join(", ")}
              </p>
            )}
            {newDoc?.sub_categories?.length > 0 && (
              <p className="text-xs text-gray-500">
                Sub-categories: {newDoc.sub_categories.join(", ")}
              </p>
            )}
          </div>

          <p className="text-xs font-semibold text-gray-600">
            Existing document{matches?.length > 1 ? "s" : ""} with the same name:
          </p>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {matches?.map((m) => (
              <div
                key={m.id}
                className="rounded-lg border border-amber-200 bg-amber-50 p-3"
              >
                <p className="text-sm font-medium text-gray-800">{m.file_name}</p>
                <p className="text-xs text-gray-500">
                  Entry: {fmtDate(m.entry_date)}
                  {m.document_as_of_date
                    ? ` · As of: ${fmtDate(m.document_as_of_date)}`
                    : ""}
                </p>
                {m.categories?.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Categories: {m.categories.join(", ")}
                  </p>
                )}
                {m.sub_categories?.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Sub-categories: {m.sub_categories.join(", ")}
                  </p>
                )}
                {m.description && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {m.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onReject}>
            Reject (discard)
          </Button>
          <Button
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={onAccept}
          >
            Accept & Add anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}