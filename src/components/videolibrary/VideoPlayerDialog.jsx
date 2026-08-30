import React from "react";
import { X, Tag, User, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";

/**
 * VideoPlayerDialog — modal that plays a video and shows its metadata.
 *
 * Props:
 *   video — VideoLibraryItem record
 *   tags — array of VideoTag records
 *   onClose — () => void
 */
export default function VideoPlayerDialog({ video, tags = [], onClose }) {
  if (!video) return null;

  const videoTags = (video.tag_names || []).map((name) => tags.find((t) => t.name === name)).filter(Boolean);
  const isYouTube = video.video_url?.includes("youtube.com") || video.video_url?.includes("youtu.be");
  const youtubeEmbed = isYouTube ? getYouTubeEmbedUrl(video.video_url) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800 truncate">{video.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video player */}
        <div className="bg-black flex items-center justify-center" style={{ minHeight: "300px" }}>
          {youtubeEmbed ? (
            <iframe
              src={youtubeEmbed}
              className="w-full"
              style={{ height: "400px" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video src={video.video_url} controls autoPlay className="w-full max-h-[400px]" />
          )}
        </div>

        {/* Details */}
        <div className="px-5 py-4 overflow-y-auto">
          {video.description && (
            <p className="text-sm text-gray-600 mb-3">{video.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-3">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> {video.uploaded_by_name || "Unknown"}
            </span>
            {video.created_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {format(parseISO(video.created_date), "MMM d, yyyy")}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
              {video.category}
            </span>
          </div>

          {videoTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-gray-400" />
              {videoTags.map((t) => (
                <span
                  key={t.id}
                  className="text-xs px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: t.color || "#6366f1" }}
                >
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getYouTubeEmbedUrl(url) {
  const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\?]+)/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}