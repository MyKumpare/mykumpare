import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { Search, Send, Loader2, MessageSquare, Plus, ChevronDown, ChevronRight, X } from "lucide-react";
import AgentProgressIndicator from "@/components/search/AgentProgressIndicator";

const AGENT_NAME = "search_report";

function FunctionDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const status = toolCall.status || "completed";
  const failed = ["failed", "error"].includes(status) ||
    (toolCall.results && /error|failed/i.test(String(toolCall.results)));
  const proj = toolCall.display_projection || {};
  const hideDetails = proj.hide_details && proj.details_redacted;

  const label = proj.label || toolCall.name || "Tool call";
  const statusText = failed
    ? (proj.error_label || "failed")
    : ["pending", "running", "in_progress"].includes(status)
      ? (proj.active_label || "running...")
      : (proj.label || "done");

  let parsedArgs = toolCall.arguments_string;
  try { parsedArgs = JSON.parse(toolCall.arguments_string); } catch { /* keep raw */ }
  let parsedResults = toolCall.results;
  try { if (typeof parsedResults === "string") parsedResults = JSON.parse(parsedResults); } catch { /* keep raw */ }

  return (
    <div className="mt-2 text-xs border border-gray-200 rounded-lg bg-gray-50/80 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left hover:bg-gray-100"
      >
        {expanded ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
        <span className="font-medium text-gray-600">{label}</span>
        <span className={`ml-auto ${failed ? "text-red-500" : "text-gray-400"}`}>{statusText}</span>
      </button>
      {expanded && !hideDetails && (
        <div className="px-2.5 pb-2 pt-1 space-y-1.5">
          {parsedArgs && (
            <div>
              <div className="text-gray-400 mb-0.5">Parameters:</div>
              <pre className="bg-white border border-gray-200 rounded p-1.5 overflow-x-auto text-[11px] text-gray-600">{JSON.stringify(parsedArgs, null, 2)}</pre>
            </div>
          )}
          {parsedResults !== undefined && (
            <div>
              <div className="text-gray-400 mb-0.5">Result:</div>
              <pre className="bg-white border border-gray-200 rounded p-1.5 overflow-x-auto text-[11px] text-gray-600 max-h-48">{JSON.stringify(parsedResults, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div className={`max-w-[85%] ${isUser ? "" : "w-full"}`}>
        {message.content && (isUser ? (
          <div className="bg-violet-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 text-sm">
            <ReactMarkdown className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-table:text-xs prose-th:bg-gray-50 prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-pre:bg-gray-50 prose-pre:text-xs">
              {message.content}
            </ReactMarkdown>
          </div>
        ))}
        {message.tool_calls?.map((tc, i) => <FunctionDisplay key={i} toolCall={tc} />)}
      </div>
    </div>
  );
}

export default function SearchReport() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const scrollRef = useRef(null);
  const navigate = useNavigate();

  const loadConversations = async () => {
    try {
      const list = await base44.agents.listConversations({ agent_name: AGENT_NAME });
      setConversations(list || []);
    } catch { setConversations([]); }
    setLoadingList(false);
  };

  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    if (!activeId) return;
    const unsubscribe = base44.agents.subscribeToConversation(activeId, (data) => {
      setMessages(data.messages || []);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [activeId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const newConversation = async (name) => {
    const conv = await base44.agents.createConversation({
      agent_name: AGENT_NAME,
      metadata: { name: name || "New Search", description: "Data search & report" },
    });
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    setMessages(conv.messages || []);
    return conv;
  };

  const selectConversation = async (id) => {
    setActiveId(id);
    try {
      const conv = await base44.agents.getConversation(id);
      setMessages(conv.messages || []);
    } catch { /* subscription will fill */ }
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    let convId = activeId;
    let conv;
    if (!convId) {
      conv = await newConversation(input.trim().slice(0, 60) || "New Search");
      convId = conv.id;
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

  const active = conversations.find((c) => c.id === activeId);

  return (
    <div className="min-h-screen bg-gray-50/80 flex">
      {/* Conversation sidebar */}
      <div className="w-64 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-3 border-b border-gray-200">
          <button
            onClick={newConversation}
            className="w-full inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg px-3 py-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Search
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingList ? (
            <div className="flex items-center justify-center py-6 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6 px-2">No conversations yet. Start a new search.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => selectConversation(c.id)}
                className={`w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                  c.id === activeId ? "bg-violet-50 text-violet-700" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{c.metadata?.name || "Untitled"}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-gray-200 bg-white px-5 py-3 flex items-center gap-2">
          <Search className="w-4 h-4 text-violet-600" />
          <h1 className="text-sm font-semibold text-gray-800">Data Search & Report Agent</h1>
          <button
            onClick={() => navigate("/")}
            className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
            title="Close agent"
          >
            <X className="w-4 h-4" />
            Close
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
          {!activeId ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mb-4">
                <Search className="w-7 h-7 text-violet-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1.5">Search your data & build reports</h2>
              <p className="text-sm text-gray-500 mb-5">Ask anything across firms, contacts, products, portfolios, due diligence, news, and more. The agent searches the records and writes a structured report.</p>
              <div className="grid grid-cols-1 gap-2 w-full text-left">
                {[
                  "List all Investment Manager firms and their total AUM",
                  "Show contacts who are CIOs at Allocator firms",
                  "Summarize all high-impact news from this quarter",
                  "Which products have funding status Funded?",
                ].map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setInput(ex)}
                    className="text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 hover:border-violet-200 transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
              {loading && <AgentProgressIndicator messages={messages} />}
            </>
          )}
        </div>

        <div className="border-t border-gray-200 bg-white px-4 sm:px-6 py-3">
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={activeId ? "Ask the agent to search and report..." : "Start a new search to begin..."}
              rows={1}
              className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 max-h-32"
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-violet-600 text-white disabled:opacity-40 hover:bg-violet-700 transition-colors shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}