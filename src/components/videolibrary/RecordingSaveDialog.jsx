import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { X, Loader2, Upload, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";

/**
 * Save dialog for a screen recording. Lets the user name and tag the
 * recording, then either save it as-is to the Video Library or generate
 * an AI-narrated training video from it (analyze → script → generate
 * video with sound → save to library).
 */
export default function RecordingSaveDialog({ blob, onClose }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [busy, setBusy] = useState(false); // "save" | "ai" | null
  const [progress, setProgress] = useState("");
  const [videoUrl, setVideoUrl] = useState(null);

  useEffect(() => {
    if (blob) {
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [blob]);

  const { data: tags = [] } = useQuery({
    queryKey: ["video_tags"],
    queryFn: () => base44.entities.VideoTag.list("-created_date", 500),
  });

  const toggleTag = (tagId) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const resolveTagNames = () =>
    (tags || []).filter((t) => selectedTagIds.includes(t.id)).map((t) => t.name);

  const handleSaveRaw = async () => {
    if (!title.trim()) return;
    setBusy("save");
    try {
      const file = new File([blob], `recording-${Date.now()}.webm`, { type: blob.type || "video/webm" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.VideoLibraryItem.create({
        title: title.trim(),
        video_url: file_url,
        category: "How To Use",
        tag_ids: selectedTagIds,
        tag_names: resolveTagNames(),
      });
      queryClient.invalidateQueries({ queryKey: ["video_library_items"] });
      toast({ title: "✅ Recording saved", description: `"${title}" has been saved to the library.` });
      onClose();
    } catch (err) {
      toast({ title: "Failed to save", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const handleGenerateAi = async () => {
    if (!title.trim()) return;
    setBusy("ai");
    try {
      // 1. Upload the raw recording so the LLM can analyze it.
      setProgress("Uploading recording…");
      const file = new File([blob], `recording-${Date.now()}.webm`, { type: blob.type || "video/webm" });
      const { file_url: recordingUrl } = await base44.integrations.Core.UploadFile({ file });

      // 2. Ask the LLM to analyze the recording and write a training script.
      let script = "";
      let visualPrompt = "";
      try {
        setProgress("Analyzing recording and writing script…");
        const llmResponse = await base44.integrations.Core.InvokeLLM({
          prompt:
            "Analyze this screen recording of a user performing tasks in the MyKumpare investment management application. " +
            "Generate a clear, step-by-step training script with narration that explains how to perform these tasks. " +
            "Also provide a visual description for generating an AI training video. " +
            'Return JSON with fields: "script" (the full narration text), "visual_prompt" (visual style description).',
          file_urls: [recordingUrl],
          response_json_schema: {
            type: "object",
            properties: {
              script: { type: "string" },
              visual_prompt: { type: "string" },
            },
          },
        });
        script = llmResponse?.script || "";
        visualPrompt = llmResponse?.visual_prompt || "";
      } catch {
        // Fallback: if the LLM can't analyze the video, generate a generic
        // script from the title the user provided.
        script = `Step-by-step training: ${title}. This video demonstrates how to perform the task in the MyKumpare application, walking through each step with clear narration.`;
        visualPrompt = "Professional software tutorial screen recording style with clear UI elements and step annotations.";
      }

      // 3. Generate an AI video with narration (sound) from the script.
      setProgress("Generating AI training video with sound (30–60s)…");
      const videoResponse = await base44.integrations.Core.GenerateVideo({
        prompt: `${script}\n\nVisual style: ${visualPrompt}`,
        generate_audio: true,
      });

      // 4. Save the AI-generated video to the library.
      setProgress("Saving to library…");
      await base44.entities.VideoLibraryItem.create({
        title: title.trim(),
        description: (script || "").slice(0, 500),
        video_url: videoResponse.url,
        category: "Training",
        tag_ids: selectedTagIds,
        tag_names: resolveTagNames(),
      });
      queryClient.invalidateQueries({ queryKey: ["video_library_items"] });
      toast({ title: "✅ AI training video created", description: `"${title}" has been saved to the library.` });
      onClose();
    } catch (err) {
      toast({ title: "Failed to generate AI video", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusy(null);
      setProgress("");
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">Save Recording</h2>
          <button
            onClick={onClose}
            disabled={!!busy}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Video preview */}
          {videoUrl && (
            <video src={videoUrl} controls className="w-full rounded-lg border border-gray-200 bg-black max-h-48" />
          )}

          {/* Title */}
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Video Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a name for this training video…"
              autoFocus
              disabled={!!busy}
            />
          </div>

          {/* Tags */}
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Tags</Label>
            <div className="flex flex-wrap gap-2">
              {(tags || []).map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => !busy && toggleTag(tag.id)}
                  disabled={!!busy}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-50 ${
                    selectedTagIds.includes(tag.id)
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {tag.name}
                </button>
              ))}
              {tags.length === 0 && (
                <span className="text-sm text-gray-400">No tags yet — create tags in the Video Library.</span>
              )}
            </div>
          </div>

          {/* AI info note */}
          <p className="text-xs text-gray-400 bg-indigo-50/50 border border-indigo-100 rounded-lg px-3 py-2">
            <Sparkles className="w-3 h-3 inline mr-1 text-indigo-400" />
            "Generate AI Training Video" analyzes your recording, writes a narration script, and produces a new AI-generated video with sound (~30–60s).
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t bg-gray-50">
          {busy ? (
            <div className="flex items-center gap-2 text-sm text-indigo-600 w-full">
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              <span>{progress || "Working…"}</span>
            </div>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleSaveRaw}
                disabled={!title.trim()}
              >
                <Upload className="w-4 h-4" /> Save Recording
              </Button>
              <Button
                onClick={handleGenerateAi}
                disabled={!title.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Sparkles className="w-4 h-4" /> Generate AI Training Video
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}