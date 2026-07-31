import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Send, MessageSquare, Plus, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

const AGENT_NAME = "research_assistant";

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
        isUser
          ? "bg-indigo-600 text-white"
          : "bg-white border border-gray-200 text-gray-800"
      }`}>
        {message.content && (
          isUser
            ? <p className="whitespace-pre-wrap">{message.content}</p>
            : <ReactMarkdown className="prose prose-sm max-w-none">{message.content}</ReactMarkdown>
        )}
        {message.tool_calls?.map((tc, idx) => (
          <ToolCallDisplay key={idx} toolCall={tc} isUser={isUser} />
        ))}
      </div>
    </div>
  );
}

function ToolCallDisplay({ toolCall, isUser }) {
  const [expanded, setExpanded] = useState(false);
  const status = tcStatus(toolCall);
  let parsedArgs = null;
  let parsedResults = null;
  try { parsedArgs = toolCall.arguments_string ? JSON.parse(toolCall.arguments_string) : null; } catch { parsedArgs = toolCall.arguments_string; }
  try { parsedResults = toolCall.results ? (typeof toolCall.results === "string" ? JSON.parse(toolCall.results) : toolCall.results) : null; } catch { parsedResults = toolCall.results; }
  const projection = toolCall.display_projection;
  const hideDetails = projection?.hide_details && projection?.details_redacted;

  return (
    <div className={`mt-2 text-xs border-t ${isUser ? "border-white/20" : "border-gray-100"} pt-2`}>
      <button
        onClick={() => !hideDetails && setExpanded(!expanded)}
        className={`flex items-center gap-1.5 ${isUser ? "text-white/80" : "text-gray-500"} ${hideDetails ? "" : "hover:text-gray-700"}`}
      >
        {!hideDetails && (expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}
        <span className="font-medium">{toolCall.name || "tool"}</span>
        <span className={`px-1.5 py-0.5 rounded ${status === "success" ? "bg-green-100 text-green-700" : status === "failed" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
          {status}
        </span>
      </button>
      {!hideDetails && expanded && (
        <div className={`mt-1.5 space-y-1 ${isUser ? "text-white/70" : "text-gray-600"}`}>
          {parsedArgs && (
            <div>
              <span className="opacity-60">Parameters:</span>
              <pre className="mt-0.5 p-1.5 rounded bg-black/10 overflow-auto text-[10px] max-h-32">{JSON.stringify(parsedArgs, null, 2)}</pre>
            </div>
          )}
          {parsedResults && (
            <div>
              <span className="opacity-60">Result:</span>
              <pre className="mt-0.5 p-1.5 rounded bg-black/10 overflow-auto text-[10px] max-h-40">{typeof parsedResults === "string" ? parsedResults : JSON.stringify(parsedResults, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function tcStatus(tc) {
  const s = tc.status;
  if (s === "failed" || s === "error") return "failed";
  if (s === "completed" || s === "success") return "success";
  return "running";
}

export default function ResearchAssistantChat() {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const convs = await base44.agents.listConversations({ agent_name: AGENT_NAME });
      setConversations(convs || []);
      if (convs && convs.length > 0 && !activeConversationId) {
        setActiveConversationId(convs[0].id);
      }
    } catch {
      setConversations([]);
    } finally {
      setLoadingConvs(false);
    }
  }, [activeConversationId]);

  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const conv = await base44.agents.getConversation(activeConversationId);
        if (!cancelled) setMessages(conv?.messages || []);
      } catch {
        if (!cancelled) setMessages([]);
      }
    })();
    const unsubscribe = base44.agents.subscribeToConversation(activeConversationId, (data) => {
      if (!cancelled) {
        setMessages(data?.messages || []);
        setLoading(false);
      }
    });
    return () => { cancelled = true; unsubscribe && unsubscribe(); };
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNewConversation = async () => {
    try {
      const conv = await base44.agents.createConversation({
        agent_name: AGENT_NAME,
        metadata: { name: "New Research Session", description: "Comparative research & benchmarking" },
      });
      setConversations((prev) => [conv, ...prev]);
      setActiveConversationId(conv.id);
      setMessages([]);
      setShowSidebar(false);
      setTimeout(() => inputRef.current?.focus(), 200);
    } catch (e) {
      console.error("Failed to create conversation", e);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    let convId = activeConversationId;
    let conv;
    if (!convId) {
      conv = await base44.agents.createConversation({
        agent_name: AGENT_NAME,
        metadata: { name: "New Research Session", description: "Comparative research & benchmarking" },
      });
      convId = conv.id;
      setConversations((prev) => [conv, ...prev]);
      setActiveConversationId(convId);
    } else {
      conv = conversations.find((c) => c.id === convId);
    }
    const userMsg = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      await base44.agents.addMessage({ ...conv, id: convId, messages: [...messages, userMsg] }, userMsg);
    } catch (e) {
      setLoading(false);
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${e?.message || "Failed to send message"}` }]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
      {/* Sidebar */}
      <div className={`bg-white border-r border-gray-200 flex-shrink-0 transition-all duration-200 ${showSidebar ? "w-64" : "w-0"} overflow-hidden`}>
        <div className="w-64 h-full flex flex-col">
          <div className="p-3 border-b border-gray-200">
            <button
              onClick={handleNewConversation}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Session
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingConvs ? (
              <div className="text-center py-4 text-gray-400 text-xs">Loading…</div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-4 text-gray-400 text-xs">No sessions yet</div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => { setActiveConversationId(conv.id); setShowSidebar(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    conv.id === activeConversationId ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <MessageSquare className="w-3 h-3 inline mr-1.5 opacity-50" />
                  {conv.metadata?.name || "Research Session"}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-white">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            title="Toggle sessions"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-800 truncate">Research & Benchmarking Assistant</h3>
            <p className="text-xs text-gray-400 truncate">Compare firms, products, and benchmarks with AI-powered analysis</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center mb-3">
                <MessageSquare className="w-7 h-7 text-indigo-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Start a Comparative Research Session</h3>
              <p className="text-xs text-gray-500 max-w-sm mb-4">
                Ask me to compare investment firms, benchmark product performance, analyze peer groups, or generate benchmarking reports.
              </p>
              <div className="space-y-1.5 w-full max-w-md">
                {[
                  "Compare the top 3 investment manager firms by type and team size",
                  "Benchmark a product's returns against its benchmark over the last 3 years",
                  "Generate a peer group analysis of all equity products",
                  "Compare ownership structures across investment manager firms",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 50); }}
                    className="block w-full text-left px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, idx) => (
            <MessageBubble key={idx} message={msg} />
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl px-4 py-2.5">
                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 bg-white p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Ask for a comparison, benchmarking report, or peer analysis…"
              className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 max-h-32"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}