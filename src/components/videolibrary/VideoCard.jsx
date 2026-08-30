import React from "react";
import { Play, Pencil, Trash2, User, Clock, Tag, BookOpen } from "lucide-react";

/**
 * VideoCard — displays a single video in the library grid.
 *
 * Props:
 *   video — VideoLibraryItem record
 *   tags — array of VideoTag records (for resolving tag names)
 *   onPlay — () => void
 *   onEdit — () => void
 *   onDelete — () => void
 */
export default function VideoCard({ video, tags = [], onPlay, onEdit, onDelete, onTrainingManual }) {
  const videoTags = (video.tag_names || []).map((name) => tags.find((t) => t.name === name)).filter(Boolean);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
      {/* Thumbnail */}
      <div
        className="relative h-32 bg-gradient-to-br from-indigo-100 to-violet-100 cursor-pointer flex items-center justify-center"
        onClick={onPlay}
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
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-sm font-semibold text-gray-800 line-clamp-1">{video.title}</h3>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button onClick={onEdit} className="p-1 text-gray-400 hover:text-indigo-600" title="Edit">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500" title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {video.description && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-2">{video.description}</p>
        )}

        {/* Category badge */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
            {video.category}
          </span>
        </div>

        {/* Tags */}
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

        {/* Training Manual button */}
        {onTrainingManual && (
          <button
            onClick={onTrainingManual}
            className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-medium transition-colors border border-emerald-200"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Training Manual
          </button>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-50">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {video.uploaded_by_name || "Unknown"}
          </span>
        </div>
      </div>
    </div>
  );
}