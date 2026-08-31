import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { X, Tag, FolderEdit, FileText, Loader2, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VideoTagMultiSelect from "./VideoTagMultiSelect";

/**
 * BulkEditVideosDialog — apply tag/category/description changes to multiple
 * VideoLibraryItem records at once.
 *
 * Props:
 *   open — boolean
 *   onClose — () => void
 *   selectedVideos — array of VideoLibraryItem records to edit
 *   tags — sorted array of VideoTag records
 *   existingCategories — array of category strings (for the datalist)
 *   onOpenTagManager — () => void
 */
export default function BulkEditVideosDialog({
  open,
  onClose,
  selectedVideos = [],
  tags = [],
  existingCategories = [],
  onOpenTagManager,
}) {
  const queryClient = useQueryClient();
  const [editTags, setEditTags] = useState(true);
  const [tagMode, setTagMode] = useState("add"); // add | remove | replace
  const [tagIds, setTagIds] = useState([]);
  const [editCategory, setEditCategory] = useState(false);
  const [category, setCategory] = useState("");
  const [editDescription, setEditDescription] = useState(false);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const tagIdToName = (id) => tags.find((t) => t.id === id)?.name || "";

  const handleApply = async () => {
    if (selectedVideos.length === 0) return;
    if (!editTags && !editCategory && !editDescription) {
      setError("Select at least one field to update.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updates = selectedVideos.map((video) => {
        const patch = {};
        if (editTags) {
          let newTagIds;
          if (tagMode === "add") {
            newTagIds = [...new Set([...(video.tag_ids || []), ...tagIds])];
          } else if (tagMode === "remove") {
            newTagIds = (video.tag_ids || []).filter((id) => !tagIds.includes(id));
          } else {
            newTagIds = [...tagIds];
          }
          patch.tag_ids = newTagIds;
          patch.tag_names = newTagIds.map(tagIdToName).filter(Boolean);
        }
        if (editCategory) {
          patch.category = category;
        }
        if (editDescription) {
          patch.description = description;
        }
        return { id: video.id, ...patch };
      });

      await base44.entities.VideoLibraryItem.bulkUpdate(updates);
      queryClient.invalidateQueries({ queryKey: ["video_library_items"] });
      handleClose();
    } catch (err) {
      setError(err?.message || "Failed to update videos.");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setEditTags(true);
    setTagMode("add");
    setTagIds([]);
    setEditCategory(false);
    setCategory("");
    setEditDescription(false);
    setDescription("");
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={handleClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FolderEdit className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-semibold text-gray-800">Bulk Edit Videos</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
              {selectedVideos.length} selected
            </span>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Tags section */}
          <div className={`rounded-lg border p-3 ${editTags ? "border-indigo-200 bg-indigo-50/30" : "border-gray-200"}`}>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={editTags}
                onChange={(e) => setEditTags(e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-600"
              />
              <Tag className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">Tags</span>
            </label>
            {editTags && (
              <>
                <div className="flex gap-1 mb-3">
                  {[
                    { val: "add", label: "Add to existing" },
                    { val: "remove", label: "Remove from existing" },
                    { val: "replace", label: "Replace all" },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => setTagMode(opt.val)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                        tagMode === opt.val
                          ? "bg-indigo-600 text-white"
                          : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <VideoTagMultiSelect
                  tags={tags}
                  selectedIds={tagIds}
                  onChange={setTagIds}
                  onOpenManager={onOpenTagManager}
                />
                {tagMode === "replace" && (
                  <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> This will overwrite all existing tags on the selected videos.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Category section */}
          <div className={`rounded-lg border p-3 ${editCategory ? "border-indigo-200 bg-indigo-50/30" : "border-gray-200"}`}>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={editCategory}
                onChange={(e) => setEditCategory(e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-600"
              />
              <FolderEdit className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">Category</span>
            </label>
            {editCategory && (
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. How To Use, Training, Best Practices"
                list="bulk-edit-categories"
                className="h-9 text-sm"
              />
            )}
            {editCategory && existingCategories.length > 0 && (
              <datalist id="bulk-edit-categories">
                {existingCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            )}
          </div>

          {/* Description section */}
          <div className={`rounded-lg border p-3 ${editDescription ? "border-indigo-200 bg-indigo-50/30" : "border-gray-200"}`}>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={editDescription}
                onChange={(e) => setEditDescription(e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-600"
              />
              <FileText className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">Description</span>
            </label>
            {editDescription && (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="New description for all selected videos…"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
              />
            )}
          </div>

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleApply} disabled={saving || (!editTags && !editCategory && !editDescription)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {saving ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Applying…</>
            ) : (
              <><Check className="w-3.5 h-3.5" /> Apply to {selectedVideos.length} video{selectedVideos.length !== 1 ? "s" : ""}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}