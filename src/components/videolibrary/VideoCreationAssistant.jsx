import React, { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Send, Sparkles, X, Loader2, Bot, User as UserIcon, Film, Download, Check, Plus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

const AGENT_NAME = "video_creation_assistant";

/**
 * VideoCreationAssistant — conversation UI for the video creation AI agent.
 * Helps users plan video scripts, suggest tags, and create VideoLibraryItem records.
 *
 * Props:
 *   open — boolean
 *   onClose — () => void
 */
export default function VideoCreationAssistant({ open, onClose }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [savedToLibrary, setSavedToLibrary] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const queryClient = useQueryClient();
  const scrollRef = useRef(null);

  // Create conversation on open
  useEffect(() => {
    if (open && !conversation) {
      setCreating(true);
      base44.agents
        .createConversation({
          agent_name: AGENT_NAME,
          metadata: { name: "Video Creation Assistant", description: "Plan and create video content" },
        })
        .then((conv) => {
          setConversation(conv);
          setMessages(conv.messages || []);
          setCreating(false);
        })
        .catch(() => setCreating(false));
    }
  }, [open]);

  // Subscribe to conversation updates
  useEffect(() => {
    if (!conversation?.id) return;
    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [conversation?.id]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Reset video state when dialog closes
  useEffect(() => {
    if (!open) {
      setGeneratedVideoUrl(null);
      setVideoTitle("");
      setSavedToLibrary(false);
      setVideoError(null);
      setGeneratingVideo(false);
    }
  }, [open]);

  const handleSend = async () => {
    if (!input.trim() || !conversation) return;
    const msg = input.trim();
    setInput("");
    setLoading(true);
    try {
      const updated = await base44.agents.addMessage(conversation, { role: "user", content: msg });
      setConversation(updated);
    } catch {
      setLoading(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (messages.length === 0 || generatingVideo) return;
    try {
      setGeneratingVideo(true);
      setGeneratedVideoUrl(null);
      setSavedToLibrary(false);
      setVideoError(null);

      // Compile script from assistant messages
      const script = messages
        .filter((m) => m.role === "assistant" && m.content)
        .map((m) => m.content)
        .join("\n\n");

      if (!script.trim()) {
        setVideoError("No script found. Ask the assistant to help plan a video first.");
        return;
      }

      // Generate a title and visual prompt from the script
      const scriptResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Based on this video script/plan, create:
1. A concise video title (3-6 words)
2. A detailed visual prompt for an AI video generator (2-3 sentences describing the visual scenes, setting, lighting, and atmosphere for a professional training video)

Script:
${script}

Return as JSON.`,
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            visual_prompt: { type: "string" },
          },
          required: ["title", "visual_prompt"],
        },
      });

      const title = scriptResult.title || "AI Generated Video";
      const visualPrompt = scriptResult.visual_prompt || script.slice(0, 500);
      setVideoTitle(title);

      // Generate the video (takes ~30-60 seconds)
      const videoResult = await base44.integrations.Core.GenerateVideo({
        prompt: visualPrompt,
        duration: 8,
        aspect_ratio: "16:9",
        generate_audio: true,
      });

      setGeneratedVideoUrl(videoResult.url);
    } catch (err) {
      console.error("Video generation failed:", err);
      setVideoError(err?.message || "Failed to generate video. Please try again.");
    } finally {
      setGeneratingVideo(false);
    }
  };

  const handleSaveVideoToLibrary = async () => {
    if (!generatedVideoUrl) return;
    try {
      let userName = "Unknown";
      try {
        const user = await base44.auth.me();
        userName = user?.full_name || "Unknown";
      } catch {}
      await base44.entities.VideoLibraryItem.create({
        title: videoTitle || "AI Generated Video",
        video_url: generatedVideoUrl,
        category: "Training",
        uploaded_by_name: userName,
      });
      await queryClient.invalidateQueries({ queryKey: ["video_library_items"] });
      setSavedToLibrary(true);
    } catch (err) {
      setVideoError("Failed to save to library: " + (err?.message || "Unknown error"));
    }
  };

  const handleDownloadVideo = () => {
    if (!generatedVideoUrl) return;
    const a = document.createElement("a");
    a.href = generatedVideoUrl;
    a.download = `${(videoTitle || "generated-video").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl h-[600px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-violet-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Video Creation Assistant</h2>
              <p className="text-[10px] text-gray-500">AI help for planning and creating videos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateVideo}
              disabled={generatingVideo || messages.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {generatingVideo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Film className="w-3.5 h-3.5" />}
              {generatingVideo ? "Generating…" : "Generate Video"}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50/30">
          {creating ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
              <span className="ml-2 text-sm text-gray-500">Starting conversation...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="w-10 h-10 text-indigo-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 mb-1">Hi! I'm your video creation assistant.</p>
              <p className="text-xs text-gray-400">Ask me to help plan a tutorial, write a script, or create a video entry.</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <MessageBubble key={idx} message={msg} />
            ))
          )}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Assistant is thinking...</span>
            </div>
          )}
          {generatingVideo && (
            <div className="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Generating video from script… (this takes 30-60 seconds)</span>
            </div>
          )}
          {videoError && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {videoError}
            </div>
          )}
        </div>

        {/* Generated video preview */}
        {generatedVideoUrl && (
          <div className="px-5 py-3 border-t border-gray-100 bg-indigo-50/30 space-y-2">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-indigo-600" />
              <p className="text-sm font-medium text-gray-700">{videoTitle || "Generated Video"}</p>
            </div>
            <video src={generatedVideoUrl} controls className="w-full rounded-lg max-h-48" />
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadVideo}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </button>
              {!savedToLibrary ? (
                <button
                  onClick={handleSaveVideoToLibrary}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Save to Library
                </button>
              ) : (
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <Check className="w-3.5 h-3.5" /> Saved to library
                </span>
              )}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask for help with a video..."
            className="flex-1 h-9 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400"
            disabled={loading || creating}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="h-9 w-9 flex items-center justify-center rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div className={cn(
        "max-w-[75%] rounded-lg px-3 py-2 text-sm",
        isUser ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-700"
      )}>
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <ReactMarkdown className="prose prose-sm max-w-none">{message.content || ""}</ReactMarkdown>
        )}
        {message.tool_calls?.map((tc, idx) => (
          <ToolCallDisplay key={idx} toolCall={tc} />
        ))}
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
          <UserIcon className="w-3.5 h-3.5 text-gray-500" />
        </div>
      )}
    </div>
  );
}

function ToolCallDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const status = toolCall.status || "pending";
  const isFailed = status === "failed" || status === "error";
  const name = toolCall.name || "tool";
  const label = toolCall.display_projection?.label || name;

  return (
    <div className="mt-2 text-xs border border-gray-100 rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-1",
          isFailed ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-600"
        )}
      >
        {isFailed ? "❌" : status === "completed" || status === "success" ? "✅" : "⏳"}
        <span className="font-medium">{label}</span>
      </button>
      {expanded && (
        <div className="px-2 py-1.5 bg-gray-50/50">
          {toolCall.arguments_string && (
            <div>
              <p className="text-[10px] text-gray-400 font-medium">Parameters:</p>
              <pre className="text-[10px] text-gray-600 overflow-x-auto">
                {(() => { try { return JSON.stringify(JSON.parse(toolCall.arguments_string), null, 2); } catch { return toolCall.arguments_string; } })()}
              </pre>
            </div>
          )}
          {toolCall.results && (
            <div className="mt-1">
              <p className="text-[10px] text-gray-400 font-medium">Result:</p>
              <pre className="text-[10px] text-gray-600 overflow-x-auto">
                {(() => { try { return JSON.stringify(typeof toolCall.results === "string" ? JSON.parse(toolCall.results) : toolCall.results, null, 2); } catch { return String(toolCall.results); } })()}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}