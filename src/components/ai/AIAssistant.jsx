import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Sparkles, X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import ReactMarkdown from "react-markdown";

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I'm your MyKumpare AI assistant. I can help you:\n\n- **Search & Browse**: Find firms, contacts, products, portfolios, and benchmarks\n- **Track Activities**: View and create activity logs, follow-up tasks\n- **Manage Data**: Create new records, update statuses, organize your relationships\n- **Analytics**: Access and explain your investment analyses\n\nWhat would you like to do today?",
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const buildSystemPrompt = () => {
    return `You are an AI assistant for MyKumpare, a firm relationship management platform for tracking investment entities.

Available Data Entities:
- **Firms**: Investment managers, allocators, consultants, brokers (types: Investment Manager, Allocator, Investment Consultant, Manager of Managers, Securities Brokerage, Trade Organizations)
- **Contacts**: People at firms with roles, titles, contact info
- **Products**: Investment products managed by firms
- **Portfolios**: Allocator portfolios with sub-managers
- **Benchmarks**: Performance benchmarks by asset class
- **Activities**: Logged interactions (Call, Email, Meeting, Note, Other) with subjects and notes
- **Follow-up Tasks**: Tasks assigned to contacts with individual statuses (Not Started, In-process, Completed, Cancelled)
- **Analytics**: Performance analyses comparing products to benchmarks

Key Business Logic:
- Task status is automatically aggregated from individual assignee statuses:
  - All Completed = Completed
  - All Cancelled = Cancelled  
  - All Not Started = Not Started
  - Any mix = In-process
- Activities can be linked to multiple firms and contacts
- Contacts can be associated with multiple firms

When helping users:
1. Be specific and actionable
2. Offer to show relevant data when asked about entities
3. Suggest next steps (e.g., "Would you like me to create a follow-up task?")
4. Use clear formatting with bullet points for lists
5. Ask clarifying questions when requests are ambiguous

Always be helpful, professional, and concise.`;
  };

  const buildToolContext = async () => {
    try {
      const [firms, contacts, tasks] = await Promise.all([
        base44.entities.Firm.list().then(f => f.filter(f => !f.deleted_at).slice(0, 10)),
        base44.entities.Contact.list().then(c => c.filter(c => !c.deleted_at).slice(0, 10)),
        base44.entities.FollowUpTask.list().then(t => t.filter(t => !t.deleted_at && t.status !== "Completed").slice(0, 5))
      ]);

      return `\nCurrent Context (sample of recent data):
- Total Firms: ${firms.length} shown (e.g., ${firms.slice(0, 3).map(f => f.name).join(", ")})
- Total Contacts: ${contacts.length} shown
- Active Tasks: ${tasks.length} pending`;
    } catch {
      return "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const toolContext = await buildToolContext();
      
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `${buildSystemPrompt()}\n\n${toolContext}\n\nUser Question: ${userMessage}\n\nProvide a helpful, detailed response. If the user asks about specific data, explain what information you can access and offer to help them find it.`,
        add_context_from_internet: false,
        model: "automatic"
      });

      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: typeof response === 'string' ? response : JSON.stringify(response, null, 2)
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: `I apologize, but I encountered an error: ${error.message}. Please try again.`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
        >
          <Bot className="w-7 h-7" />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <div>
                <h3 className="text-sm font-semibold">MyKumpare Assistant</h3>
                <p className="text-[10px] text-indigo-200">Powered by AI</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((message, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 ${
                  message.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.role === "user"
                      ? "bg-indigo-100 text-indigo-600"
                      : "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
                  }`}
                >
                  {message.role === "user" ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    message.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-md"
                      : "bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-gray-200 p-3 bg-white"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything about your firms, contacts, tasks..."
                className="flex-1 h-10 px-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                className="h-10 w-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={isLoading || !input.trim()}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 text-center">
              AI can make mistakes. Verify important information.
            </p>
          </form>
        </div>
      )}
    </>
  );
}