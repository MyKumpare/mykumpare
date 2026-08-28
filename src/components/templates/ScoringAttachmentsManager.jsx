import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Trash2, FileText, Download, Loader2 } from "lucide-react";
import UploadStatusCard, { formatFileSize } from "@/components/common/UploadStatusCard";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";

let _attId = 0;
const nextAttId = () => `att_${Date.now()}_${++_attId}`;

/**
 * Manages supporting document/analysis attachments for a scoring matrix score.
 * Attachments are scoped either to the overall matrix (scope="overall") or to
 * an individual scoring item (scope=criterion id).
 *
 * Props:
 *  - attachments: full attachments array from the ScoringMatrixScore record
 *  - scope: "overall" or a criterion id
 *  - canEdit: whether the user may add/remove attachments
 *  - onUpdate: (newAttachments) => void  — receives the FULL attachments array
 *  - compact: when true, renders a single paperclip button (for table rows)
 *  - userName: name to record as uploaded_by_name (optional)
 */
export default function ScoringAttachmentsManager({ attachments, scope, canEdit, onUpdate, compact, userName }) {
  const [uploading, setUploading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [addingNote, setAddingNote] = useState(null);
  const [noteText, setNoteText] = useState("");
  const fileRef = useRef(null);

  const all = attachments || [];
  const scoped = all.filter((a) => (a.scope || "overall") === scope);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadingFile(file);
    setUploadError("");
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const newAtt = {
        id: nextAttId(),
        name: file.name,
        file_url,
        file_type: file.type || (file.name.split(".").pop() || ""),
        uploaded_at: new Date().toISOString(),
        uploaded_by_name: userName || "",
        scope,
        criterion_id: scope === "overall" ? "" : scope,
        notes: ""
      };
      onUpdate([...all, newAtt]);
      toast({ title: "Attachment added", description: file.name });
    } catch (err) {
      setUploadError(err?.message || "Upload failed");
      toast({ title: "Upload failed", description: err?.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadingFile(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAttachment = (id) => {
    onUpdate(all.filter((a) => a.id !== id));
  };

  const updateNote = (id, notes) => {
    onUpdate(all.map((a) => (a.id === id ? { ...a, notes } : a)));
  };

  if (compact) {
    return (
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={!canEdit || uploading}
          className="p-1 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-40"
          title={uploading && uploadingFile ? `Uploading ${uploadingFile.name}...` : (scoped.length ? `${scoped.length} attachment(s) — add more` : "Attach supporting document")}
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Paperclip className={`w-3.5 h-3.5 ${scoped.length ? "text-cyan-600" : ""}`} />
          )}
        </button>
        {scoped.length > 0 && <span className="text-[10px] text-gray-500">{scoped.length}</span>}
        <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={!canEdit || uploading}
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
          Add Attachment
        </Button>
        <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
      </div>

      {uploading && uploadingFile && (
        <UploadStatusCard
          fileName={uploadingFile.name}
          fileSize={formatFileSize(uploadingFile.size)}
          status="uploading"
          accent="cyan"
        />
      )}
      {!uploading && uploadError && (
        <UploadStatusCard
          fileName={uploadingFile?.name || "File"}
          status="error"
          error={uploadError}
          onRemove={() => { setUploadError(""); setUploadingFile(null); }}
          accent="cyan"
        />
      )}

      {scoped.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No supporting documents attached yet.</p>
      ) : (
        <div className="space-y-1.5">
          {scoped.map((att) => (
            <div key={att.id} className="flex items-start gap-2 border border-gray-200 rounded-md p-2 bg-white">
              <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <a
                  href={att.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-blue-600 hover:underline truncate block"
                >
                  {att.name}
                </a>
                <div className="text-[10px] text-gray-400">
                  {att.uploaded_at ? format(new Date(att.uploaded_at), "MMM d, yyyy") : ""}
                  {att.uploaded_by_name ? ` · ${att.uploaded_by_name}` : ""}
                </div>
                {addingNote === att.id ? (
                  <div className="mt-1 space-y-1">
                    <Textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      className="text-xs min-h-[40px]"
                      placeholder="Why is this document relevant?"
                    />
                    <div className="flex gap-1">
                      <Button size="sm" className="h-6 text-xs" onClick={() => { updateNote(att.id, noteText); setAddingNote(null); }}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setAddingNote(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-0.5">
                    {att.notes ? (
                      <span className="text-xs text-gray-600">{att.notes}</span>
                    ) : (
                      canEdit && (
                        <button
                          onClick={() => { setAddingNote(att.id); setNoteText(att.notes || ""); }}
                          className="text-[10px] text-gray-400 hover:text-gray-600 italic"
                        >
                          Add note...
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={att.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 rounded hover:bg-gray-100 text-gray-500"
                  title="Open"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
                {canEdit && (
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="p-1 rounded hover:bg-red-100 text-red-500"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}