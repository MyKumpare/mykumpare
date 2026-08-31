import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Video, Play, BookOpen, Search, X, ExternalLink, Tag as TagIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import VideoPlayerDialog from "@/components/videolibrary/VideoPlayerDialog";
import TrainingManualDialog from "@/components/videolibrary/TrainingManualDialog";

/**
 * FirmTrainingVideosTab — shows VideoLibraryItem records linked to this firm
 * (via linked_firm_ids), so users can see relevant training right from the
 * firm summary page.
 *
 * Props:
 *   firmId — string
 *   firmName — string
 */
export default function FirmTrainingVideosTab({ firmId, firmName }) {
  const [search, setSearch] = useState("");
  const [playerVideo, setPlayerVideo] = useState(null);
  const [trainingManualVideo, setTrainingManualVideo] = useState(null);

  const { data: allVideos = [], isLoading } = useQuery({
    queryKey: ["video_library_items"],
    queryFn: () => base44.entities.VideoLibraryItem.list("-created_date", 500),
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["video_tags"],
    queryFn: () => base44.entities.VideoTag.list("-created_date", 500),
  });

  const linkedVideos = useMemo(() => {
    return allVideos.filter((v) => (v.linked_firm_ids || []).includes(firmId));
  }, [allVideos, firmId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return linkedVideos;
    return linkedVideos.filter((v) => {
      const tagNames = (v.tag_names || []).join(" ").toLowerCase();
      return (
        (v.title || "").toLowerCase().includes(q) ||
        (v.description || "").toLowerCase().includes(q) ||
        tagNames.includes(q)
      );
    });
  }, [linkedVideos, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-3 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search training videos by name or tag..."
          className="pl-9 pr-9 h-9"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
          <Video className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            {linkedVideos.length === 0
              ? `No training videos linked to ${firmName || "this firm"} yet.`
              : "No videos match your search."}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Link videos to this firm from the Video Library using the link icon on each video card.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((video) => {
            const videoTags = (video.tag_names || []).map((name) => tags.find((t) => t.name === name)).filter(Boolean);
            return (
              <div key={video.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
                {/* Thumbnail */}
                <div
                  className="relative aspect-video bg-gradient-to-br from-indigo-100 to-violet-100 cursor-pointer flex items-center justify-center"
                  onClick={() => setPlayerVideo(video)}
                >
                  {video.thumbnail_url ? (
                    <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-indigo-500/80 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 text-white" fill="white" />
                    </div>
                  )}
                  {video.duration_label && (
                    <span className="absolute bottom-1.5 right-1.5 text-[10px] px-1.5 py-0.5 rounded bg-black/70 text-white font-medium">
                      {video.duration_label}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 mb-1">{video.title}</h3>
                  {video.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 mb-2">{video.description}</p>
                  )}

                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                      {video.category}
                    </span>
                  </div>

                  {videoTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {videoTags.map((t) => (
                        <span
                          key={t.id}
                          className="text-[10px] px-1.5 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: t.color || "#6366f1" }}
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setTrainingManualVideo(video)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-medium transition-colors border border-emerald-200"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Training Manual
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <VideoPlayerDialog video={playerVideo} tags={tags} onClose={() => setPlayerVideo(null)} />
      <TrainingManualDialog video={trainingManualVideo} onClose={() => setTrainingManualVideo(null)} />
    </div>
  );
}