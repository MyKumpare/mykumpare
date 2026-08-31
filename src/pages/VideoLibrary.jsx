import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePersistentState } from "@/hooks/usePersistentState";
import {
  Video, Plus, Tag, Search, X, Sparkles, Settings2,
  Filter, Play, FileText, Camera, Check, Loader2, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VideoCard from "@/components/videolibrary/VideoCard";
import VideoPlayerDialog from "@/components/videolibrary/VideoPlayerDialog";
import AddVideoDialog from "@/components/videolibrary/AddVideoDialog";
import VideoTagManager from "@/components/videolibrary/VideoTagManager";
import BulkEditVideosDialog from "@/components/videolibrary/BulkEditVideosDialog";
import VideoCreationAssistant from "@/components/videolibrary/VideoCreationAssistant";
import TrainingManualDialog from "@/components/videolibrary/TrainingManualDialog";
import LinkVideoDialog from "@/components/videolibrary/LinkVideoDialog";
import ManualToVideoDialog from "@/components/videolibrary/ManualToVideoDialog";
import { setCaptureToolOpen, useScreenshots } from "@/components/videolibrary/screenshotStore";

export default function VideoLibrary() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = usePersistentState("vl_search", "");
  const [categoryFilter, setCategoryFilter] = usePersistentState("vl_category", "All");
  const [tagFilter, setTagFilter] = usePersistentState("vl_tagFilter", null);
  const [playerVideo, setPlayerVideo] = usePersistentState("vl_playerVideo", null);
  const [addOpen, setAddOpen] = usePersistentState("vl_addOpen", false);
  const [editingVideo, setEditingVideo] = usePersistentState("vl_editingVideo", null);
  const [tagManagerOpen, setTagManagerOpen] = usePersistentState("vl_tagManagerOpen", false);
  const [assistantOpen, setAssistantOpen] = usePersistentState("vl_assistantOpen", false);
  const [trainingManualVideo, setTrainingManualVideo] = usePersistentState("vl_trainingManualVideo", null);
  const [linkVideo, setLinkVideo] = usePersistentState("vl_linkVideo", null);
  const [manualToVideoOpen, setManualToVideoOpen] = usePersistentState("vl_manualToVideoOpen", false);
  const [bulkEditOpen, setBulkEditOpen] = usePersistentState("vl_bulkEditOpen", false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const screenshots = useScreenshots();

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["video_library_items"],
    queryFn: () => base44.entities.VideoLibraryItem.list("-created_date", 500),
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["video_tags"],
    queryFn: () => base44.entities.VideoTag.list("-created_date", 500),
  });
  const sortedTags = [...tags].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const categories = useMemo(() => {
    const cats = new Set(videos.map((v) => v.category).filter(Boolean));
    return ["All", ...Array.from(cats).sort()];
  }, [videos]);

  const filtered = useMemo(() => {
    let result = videos;
    if (categoryFilter !== "All") {
      result = result.filter((v) => v.category === categoryFilter);
    }
    if (tagFilter) {
      result = result.filter((v) => (v.tag_ids || []).includes(tagFilter));
    }
    const q = search.toLowerCase().trim();
    if (q) {
      const tagNameSet = new Set(
        sortedTags.filter((t) => (t.name || "").toLowerCase().includes(q)).map((t) => t.id)
      );
      result = result.filter(
        (v) =>
          (v.title || "").toLowerCase().includes(q) ||
          (v.description || "").toLowerCase().includes(q) ||
          (v.tag_names || []).some((name) => name.toLowerCase().includes(q)) ||
          (v.tag_ids || []).some((id) => tagNameSet.has(id))
      );
    }
    return [...result].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [videos, categoryFilter, tagFilter, search]);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.VideoLibraryItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["video_library_items"] }),
  });

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filtered.map((v) => v.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkExport = async () => {
    const selected = videos.filter((v) => selectedIds.has(v.id));
    if (selected.length === 0) return;
    setExporting(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      let added = 0;
      for (const video of selected) {
        setExportProgress(`Downloading "${video.title}"… (${added + 1}/${selected.length})`);
        try {
          const response = await fetch(video.video_url);
          if (!response.ok) continue;
          const blob = await response.blob();
          const ext = (video.video_url.match(/\.(mp4|webm|mov|avi|mkv|m4v)$/i)?.[0] || ".mp4").toLowerCase();
          const filename = `${(video.title || "video").replace(/[^a-zA-Z0-9]/g, "_")}${ext}`;
          zip.file(filename, blob);
          added++;
        } catch { /* skip CORS-blocked files */ }
      }
      if (added === 0) {
        alert("Could not download any video files. They may be protected against cross-origin requests.");
        return;
      }
      setExportProgress("Creating ZIP file…");
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `video_library_export_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      clearSelection();
    } catch (err) {
      alert("Failed to export: " + (err?.message || "Unknown error"));
    } finally {
      setExporting(false);
      setExportProgress("");
    }
  };

  const handleEdit = (video) => {
    setEditingVideo(video);
    setAddOpen(true);
  };

  const handleDelete = (video) => {
    if (window.confirm(`Delete "${video.title}"? This cannot be undone.`)) {
      deleteMutation.mutate(video.id);
    }
  };

  const handleCloseAdd = () => {
    setAddOpen(false);
    setEditingVideo(null);
  };

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Video className="w-7 h-7 text-white" />
            <div>
              <h1 className="text-xl font-bold text-white">Video Library</h1>
              <p className="text-sm text-indigo-100">Tutorials, training, and how-to videos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAssistantOpen(true)}
              className="bg-white/20 text-white hover:bg-white/30 border-0"
            >
              <Sparkles className="w-4 h-4" /> AI Assistant
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setTagManagerOpen(true)}
              className="bg-white/20 text-white hover:bg-white/30 border-0"
            >
              <Settings2 className="w-4 h-4" /> Manage Tags
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setManualToVideoOpen(true)}
              className="bg-white/20 text-white hover:bg-white/30 border-0"
            >
              <FileText className="w-4 h-4" /> Upload Manual
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCaptureToolOpen(true)}
              className="bg-white/20 text-white hover:bg-white/30 border-0"
            >
              <Camera className="w-4 h-4" /> Screenshots
              {screenshots.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/30 text-[10px] font-bold">{screenshots.length}</span>
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => { setEditingVideo(null); setAddOpen(true); }}
              className="bg-white text-indigo-700 hover:bg-indigo-50"
            >
              <Plus className="w-4 h-4" /> Add Video
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/")}
              className="bg-white/20 text-white hover:bg-white/30 border-0"
              title="Close Video Library"
            >
              <X className="w-4 h-4" /> Close
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, description, or tag..."
              className="pl-9 pr-9"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-gray-400" />
            <div className="flex flex-wrap gap-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                    categoryFilter === cat
                      ? "bg-indigo-600 text-white"
                      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Tag filter */}
          {sortedTags.length > 0 && (
            <select
              value={tagFilter || ""}
              onChange={(e) => setTagFilter(e.target.value || null)}
              className="h-9 px-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              <option value="">All tags</option>
              {["Topic", "Department", "Software Process", "General"].map((cat) => {
                const catTags = sortedTags.filter((t) => (t.category || "General") === cat);
                if (catTags.length === 0) return null;
                return (
                  <optgroup key={cat} label={cat}>
                    {catTags.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          )}
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between gap-3 mb-4 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-indigo-700">{selectedIds.size} selected</span>
              <button onClick={selectAll} className="text-xs text-indigo-600 hover:text-indigo-800 underline">
                Select all filtered
              </button>
              <button onClick={clearSelection} className="text-xs text-gray-500 hover:text-gray-700 underline">
                Clear
              </button>
            </div>
            {exporting ? (
              <div className="flex items-center gap-2 text-sm text-indigo-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                {exportProgress || "Exporting…"}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setBulkEditOpen(true)} className="border-indigo-300 text-indigo-700 hover:bg-indigo-50">
                  <Tag className="w-4 h-4" /> Bulk Edit
                </Button>
                <Button size="sm" onClick={handleBulkExport} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Package className="w-4 h-4" /> Export {selectedIds.size} as ZIP
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Video grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Video className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 mb-3">
              {videos.length === 0 ? "No videos yet. Add your first video!" : "No videos match your filters."}
            </p>
            {videos.length === 0 && (
              <Button size="sm" onClick={() => { setEditingVideo(null); setAddOpen(true); }}>
                <Plus className="w-4 h-4" /> Add Video
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                tags={sortedTags}
                onPlay={() => setPlayerVideo(video)}
                onEdit={() => handleEdit(video)}
                onDelete={() => handleDelete(video)}
                onTrainingManual={() => setTrainingManualVideo(video)}
                onLink={(v) => setLinkVideo(v)}
                selected={selectedIds.has(video.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <VideoPlayerDialog video={playerVideo} tags={sortedTags} onClose={() => setPlayerVideo(null)} />
      <AddVideoDialog
        open={addOpen}
        onClose={handleCloseAdd}
        editingVideo={editingVideo}
        onOpenTagManager={() => setTagManagerOpen(true)}
      />
      <VideoTagManager open={tagManagerOpen} onClose={() => setTagManagerOpen(false)} />
      <VideoCreationAssistant open={assistantOpen} onClose={() => setAssistantOpen(false)} />
      <TrainingManualDialog video={trainingManualVideo} onClose={() => setTrainingManualVideo(null)} />
      <LinkVideoDialog video={linkVideo} onClose={() => setLinkVideo(null)} />
      <ManualToVideoDialog open={manualToVideoOpen} onClose={() => setManualToVideoOpen(false)} />
      <BulkEditVideosDialog
        open={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        selectedVideos={videos.filter((v) => selectedIds.has(v.id))}
        tags={sortedTags}
        existingCategories={categories.filter((c) => c !== "All")}
        onOpenTagManager={() => setTagManagerOpen(true)}
      />
    </div>
  );
}