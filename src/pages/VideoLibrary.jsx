import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Video, Plus, Tag, Search, X, Sparkles, Settings2,
  Filter, Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VideoCard from "@/components/videolibrary/VideoCard";
import VideoPlayerDialog from "@/components/videolibrary/VideoPlayerDialog";
import AddVideoDialog from "@/components/videolibrary/AddVideoDialog";
import VideoTagManager from "@/components/videolibrary/VideoTagManager";
import VideoCreationAssistant from "@/components/videolibrary/VideoCreationAssistant";
import TrainingManualDialog from "@/components/videolibrary/TrainingManualDialog";

export default function VideoLibrary() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [tagFilter, setTagFilter] = useState(null); // tag id or null
  const [playerVideo, setPlayerVideo] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [trainingManualVideo, setTrainingManualVideo] = useState(null);

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
      result = result.filter(
        (v) =>
          (v.title || "").toLowerCase().includes(q) ||
          (v.description || "").toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [videos, categoryFilter, tagFilter, search]);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.VideoLibraryItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["video_library_items"] }),
  });

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
              size="sm"
              onClick={() => { setEditingVideo(null); setAddOpen(true); }}
              className="bg-white text-indigo-700 hover:bg-indigo-50"
            >
              <Plus className="w-4 h-4" /> Add Video
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
              placeholder="Search videos..."
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
              {sortedTags.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>

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
    </div>
  );
}