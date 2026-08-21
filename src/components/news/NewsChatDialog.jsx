import React, { useState, useEffect, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle, Send, Loader2, X, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ReactMarkdown from "react-markdown";

// Reusable chat agent for asking follow-up questions about news articles.
// props:
//   open, onOpenChange
//   items: FirmNews[] in context
//   summaryText: optional pre-generated summary string (chatting "from the summary")
//   contextLabel: short label shown in the header (e.g. "this article", "3 selected articles", "summary")
function buildContext(items, summaryText) {
  const parts = [];
  if (summaryText) {
    parts.push(`Generated summary:\n${summaryText}`);
  }
  if (items && items.length) {
    const arts = items.slice(0, 50).map((it, i) => {
      const lines = [`Article ${i + 1}:`];
      lines.push(`Date: ${it.news_date || "—"}`);
      lines.push(`Headline: ${it.headline || ""}`);
      if (it.summary) lines.push(`Summary: ${it.summary}`);
      lines.push(`Alert: ${it.alert_status || "Low"} | Sentiment: ${it.news_status || "Neutral"}`);
      if (it.firm_name) lines.push(`Firm: ${it.firm_name}`);
      if (it.source_type !== "firm" && it.source_name) lines.push(`${it.source_type}: ${it.source_name}`);
      if (it.article_url) lines.push(`URL: ${it.article_url}`);
      if (it.notes) {
        const tmp = it.notes.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (tmp) lines.push(`Notes: ${tmp.slice(0, 500)}`);
      }
      return lines.join("\n");
    }).join("\n\n");
    parts.push(`News articles in context (${items.length}):\n${arts}`);
  }
  return parts.join("\n\n");
}

export default function NewsChatDialog({ open, onOpenChange, items, summaryText, contextLabel }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  const contextStr = buildContext(items, summaryText);

  useEffect(() => {
    if (open) setMessages([]);
    setInput("");
  }, [open, items, summaryText]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const handleSend = async () => {
    const q = input.trim();
    if (!q || loading) return;
    const userMsg = { role: "user", content: q };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const convo = next.map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");
      const prompt = `You are a news research assistant. Answer the user's follow-up questions based ONLY on the news context below. If the answer isn't in the context, say you don't have enough information. Be concise and reference which article(s) you're drawing from.

${contextStr}

Conversation:
${convo}

Assistant:`;
      const res = await base44.integrations.Core.InvokeLLM({ prompt });
      const answer = typeof res === "string" ? res : (res?.output || res?.response || JSON.stringify(res));
      setMessages([...next, { role: "assistant", content: answer }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `Error: ${e.message}` }]);
    }
    setLoading(false);
  };

  const handleClose = () => {
    setMessages([]);
    setInput("");
    onOpenChange(false);
  };

  const count = (items?.length) || 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-3.5 border-b border-gray-100 flex-row items-center justify-between space-y-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <div className="font-bold text-gray-800">News Chat</div>
              <div className="text-xs font-normal text-gray-400">
                Ask follow-up questions about {contextLabel || `${count} article${count !== 1 ? "s" : ""}`}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-[300px]">
          {messages.length === 0 && (
            <div className="text-center py-10">
              <Sparkles className="w-6 h-6 text-indigo-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">Ask anything about {contextLabel || "these articles"}</p>
              <p className="text-xs text-gray-400 mt-1">
                e.g. "What's the overall sentiment?", "Summarize the high-impact items", "Are there any risks mentioned?"
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                m.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-800"
              }`}>
                {m.role === "assistant"
                  ? <div className="prose prose-sm max-w-none"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                  : <p className="whitespace-pre-wrap">{m.content}</p>}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-3.5 py-2.5">
                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask a follow-up question..."
              className="flex-1 h-9 text-sm rounded-lg border border-gray-200 bg-white px-3 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <Button size="sm" onClick={handleSend} disabled={loading || !input.trim()} className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send
            </Button>
            <Button size="sm" variant="ghost" onClick={handleClose} className="gap-1">
              <X className="w-3.5 h-3.5" /> Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}