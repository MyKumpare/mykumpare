import React from "react";
import { Play, Pencil, Trash2, User, Tag, BookOpen, Check, Link2, Building } from "lucide-react";

/**
 * VideoCard — displays a single video in the library grid (YouTube-style).
 *
 * Props:
 *   video — VideoLibraryItem record
 *   tags — array of VideoTag records (for resolving tag names)
 *   onPlay — () => void
 *   onEdit — () => void
 *   onDelete — () => void
 *   onTrainingManual — () => void
 *   onLink — () => void  (opens the link-to-firms/DD dialog)
 *   selected — boolean
 *   onToggleSelect — (id) => void
 */
export default function VideoCard({ video, tags = [], onPlay, onEdit, onDelete, onTrainingManual, onLink, selected, onToggleSelect }) {
  const videoTags = (video.tag_names || []).map((name) => tags.find((t) => t.name === name)).filter(Boolean);
  const linkedCount = (video.linked_firm_ids?.length || 0) + (video.linked_dd_ids?.length || 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
      {/* Thumbnail — 16:9 aspect ratio (YouTube-style) */}
      <div
        className="relative aspect-video bg-gradient-to-br from-indigo-100 to-violet-100 cursor-pointer flex items-center justify-center"
        onClick={onPlay}
      >
        {onToggleSelect && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect(video.id); }}
            className={`absolute top-2 left-2 z-10 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              selected ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white/80 border-gray-300 hover:border-indigo-400"
            }`}
            title={selected ? "Deselect" : "Select for bulk actions"}
          >
            {selected && <Check className="w-3 h-3" />}
          </button>
        )}
        {video.thumbnail_url ? (
          <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-indigo-500/80 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Play className="w-6 h-6 text-white" fill="white" />
          </div>
        )}
        {video.duration_label && (
          <span className="absolute bottom-2 right-2 text-[11px] px-1.5 py-0.5 rounded bg-black/80 text-white font-medium">
            {video.duration_label}
          </span>
        )}
        {/* Hover overlay actions — edit/delete only (link is always visible below) */}
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(video); }}
              className="w-7 h-7 rounded-full bg-white/90 text-gray-600 hover:bg-white hover:text-indigo-600 flex items-center justify-center transition-colors"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(video); }}
              className="w-7 h-7 rounded-full bg-white/90 text-gray-600 hover:bg-white hover:text-red-500 flex items-center justify-center transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content — YouTube-style: title, metadata, tags */}
      <div className="p-3">
        <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 mb-1 leading-snug">{video.title}</h3>

        {/* Metadata row */}
        <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-1.5">
          <span className="inline-flex items-center gap-1">
            <User className="w-3 h-3" />
            {video.uploaded_by_name || "Unknown"}
          </span>
          <span className="text-gray-300">•</span>
          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium text-[10px]">
            {video.category}
          </span>
        </div>

        {video.description && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-2">{video.description}</p>
        )}

        {/* Tags */}
        {videoTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {videoTags.slice(0, 4).map((t) => (
              <span
                key={t.id}
                className="text-[10px] px-1.5 py-0.5 rounded-full text-white"
                style={{ backgroundColor: t.color || "#6366f1" }}
              >
                {t.name}
              </span>
            ))}
            {videoTags.length > 4 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                +{videoTags.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Linked firms/DDs badge */}
        {linkedCount > 0 && (
          <div className="flex items-center gap-1 mb-2 text-[10px] text-indigo-600">
            <Building className="w-3 h-3" />
            <span>Linked to {linkedCount} {linkedCount === 1 ? "project" : "projects"}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          {onLink && (
            <button
              onClick={() => onLink(video)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                linkedCount > 0
                  ? "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200"
                  : "bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200"
              }`}
              title={linkedCount > 0 ? `Linked to ${linkedCount} firm/DD` : "Link to firms or due diligence"}
            >
              <Link2 className="w-3.5 h-3.5" />
              {linkedCount > 0 ? `${linkedCount} Linked` : "Link"}
            </button>
          )}
          {onTrainingManual && (
            <button
              onClick={onTrainingManual}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-medium transition-colors border border-emerald-200"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Manual
            </button>
          )}
        </div>
      </div>
    </div>
  );
}