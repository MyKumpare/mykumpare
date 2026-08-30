import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { X, Upload, AlertCircle, Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VideoTagMultiSelect from "./VideoTagMultiSelect";

/**
 * AddVideoDialog — create or edit a VideoLibraryItem.
 * Validates no duplicate titles (case-insensitive, trimmed).
 *
 * Props:
 *   open — boolean
 *   onClose — () => void
 *   editingVideo — VideoLibraryItem record (null = create mode)
 *   onOpenTagManager — () => void
 */
export default function AddVideoDialog({ open, onClose, editingVideo = null, onOpenTagManager }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [category, setCategory] = useState("How To Use");
  const [tagIds, setTagIds] = useState([]);
  const [durationLabel, setDurationLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const { data: existingVideos = [] } = useQuery({
    queryKey: ["video_library_items"],
    queryFn: () => base44.entities.VideoLibraryItem.list("-created_date", 500),
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["video_tags"],
    queryFn: () => base44.entities.VideoTag.list("-created_date", 500),
  });
  const sortedTags = [...tags].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  useEffect(() => {
    if (editingVideo) {
      setTitle(editingVideo.title || "");
      setDescription(editingVideo.description || "");
      setVideoUrl(editingVideo.video_url || "");
      setThumbnailUrl(editingVideo.thumbnail_url || "");
      setCategory(editingVideo.category || "How To Use");
      setTagIds(editingVideo.tag_ids || []);
      setDurationLabel(editingVideo.duration_label || "");
    } else {
      setTitle(""); setDescription(""); setVideoUrl(""); setThumbnailUrl("");
      setCategory("How To Use"); setTagIds([]); setDurationLabel("");
    }
    setError("");
  }, [editingVideo, open]);

  const isDuplicateTitle = (val) => {
    const trimmed = val.trim().toLowerCase();
    return existingVideos.some(
      (v) => v.title.trim().toLowerCase() === trimmed && v.id !== editingVideo?.id
    );
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.VideoLibraryItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video_library_items"] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VideoLibraryItem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video_library_items"] });
      onClose();
    },
  });

  const handleFileUpload = async (file, isVideo = true) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (isVideo) setVideoUrl(file_url);
      else setThumbnailUrl(file_url);
    } catch (e) {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!title.trim()) { setError("Title is required."); return; }
    if (!videoUrl.trim()) { setError("Video URL is required."); return; }
    if (isDuplicateTitle(title)) {
      setError(`A video titled "${title.trim()}" already exists.`);
      return;
    }

    const tagNames = tagIds.map((id) => tags.find((t) => t.id === id)?.name).filter(Boolean);
    const payload = {
      title: title.trim(),
      description: description.trim(),
      video_url: videoUrl.trim(),
      thumbnail_url: thumbnailUrl.trim(),
      category: category.trim(),
      tag_ids: tagIds,
      tag_names: tagNames,
      duration_label: durationLabel.trim(),
      uploaded_by_name: user?.full_name || user?.email || "Unknown",
    };

    if (editingVideo) {
      updateMutation.mutate({ id: editingVideo.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-semibold text-gray-800">
              {editingVideo ? "Edit Video" : "Add Video"}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Title *</label>
            <Input
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(""); }}
              placeholder="e.g. How to Create a Due Diligence Process"
              className="h-8 text-sm"
            />
          </div>

          {/* Video URL + upload */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Video URL or File *</label>
            <div className="flex items-center gap-2">
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://... or upload a file"
                className="h-8 text-sm flex-1"
              />
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files[0], true)}
                />
                <span className="inline-flex items-center gap-1 h-8 px-3 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100">
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Upload
                </span>
              </label>
            </div>
          </div>

          {/* Thumbnail URL */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Thumbnail URL (optional)</label>
            <div className="flex items-center gap-2">
              <Input
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://..."
                className="h-8 text-sm flex-1"
              />
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files[0], false)}
                />
                <span className="inline-flex items-center gap-1 h-8 px-3 text-xs font-medium bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100">
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Upload
                </span>
              </label>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Category *</label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="How To Use"
              className="h-8 text-sm"
            />
          </div>

          {/* Tags */}
          <VideoTagMultiSelect
            tags={sortedTags}
            selectedIds={tagIds}
            onChange={setTagIds}
            onOpenManager={onOpenTagManager}
          />

          {/* Duration */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Duration (optional)</label>
            <Input
              value={durationLabel}
              onChange={(e) => setDurationLabel(e.target.value)}
              placeholder="e.g. 3:45"
              className="h-8 text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will the viewer learn?"
              className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 min-h-[60px]"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
            {editingVideo ? "Save Changes" : "Add Video"}
          </Button>
        </div>
      </div>
    </div>
  );
}