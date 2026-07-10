import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import AIAssistantMessage from "./AIAssistantMessage";
import { buildSystemPrompt, buildToolContext } from "./aiContextBuilder";
import {
  detectEnrichmentIntent,
  findFirmByName,
  enrichFirmFromWeb,
  mergeEnrichmentData,
  enrichmentToTable,
  createFirmFromEnrichment,
} from "./firmEnrichment";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string", description: "Markdown text response with explanations, summaries, and answers" },
    tables: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          headers: { type: "array", items: { type: "string" } },
          rows: { type: "array", items: { type: "array", items: { type: "string" } } },
        },
        required: ["headers", "rows"],
      },
    },
    charts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          chart_type: { type: "string", enum: ["bar", "line", "pie", "area"] },
          data: { type: "array", items: { type: "object", additionalProperties: true } },
          x_key: { type: "string" },
          y_key: { type: "string" },
        },
        required: ["chart_type", "data", "x_key", "y_key"],
      },
    },
  },
  required: ["text"],
};

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I'm your MyKumpare AI assistant. I can help you:\n\n- **Browse All Data**: View firms, contacts, products, portfolios, benchmarks, activities, and tasks\n- **Analyze & Summarize**: Get counts, distributions, performance metrics, and custom computations\n- **Visualize Results**: See data as **tables**, **charts**, or **text** — or all three at once — plus populate firms from their public websites\n\nTry asking:\n- \"Show all firms\"\n- \"Chart of firms by type\"\n- \"Summarize the entire database\"\n- \"Populate a firm from their website\"\n- \"Show performance data for all products\"\n\nWhat would you like to see?",
    },
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

  const handleFirmEnrichment = async (firmName) => {
    try {
      const firm = await findFirmByName(firmName);

      if (!firm) {
        const enrichedData = await enrichFirmFromWeb(firmName, null);
        const hasData =
          enrichedData &&
          (enrichedData.description || enrichedData.website || enrichedData.addresses?.length || enrichedData.phones?.length);

        if (!hasData) {
          return {
            role: "assistant",
            content: `I couldn't find a firm named "**${firmName}**" in your database, and I wasn't able to find enough public information about them online. Could you verify the firm name or provide their website URL?`,
          };
        }

        const createdFirm = await createFirmFromEnrichment(enrichedData);
        const table = enrichmentToTable(enrichedData, null);

        return {
          role: "assistant",
          content: `I couldn't find **${firmName}** in your database, so I searched the web and created a new firm record with the following information:\n\n✅ **Firm created successfully**\n\nYou can review and edit the details in the Firms section.`,
          tables: [table],
        };
      }

      const enrichedData = await enrichFirmFromWeb(firm.name, firm.website);
      const hasData =
        enrichedData &&
        (enrichedData.description ||
          enrichedData.addresses?.length ||
          enrichedData.phones?.length ||
          enrichedData.linkedin_url ||
          enrichedData.year_founded);

      if (!hasData) {
        return {
          role: "assistant",
          content: `I found **${firm.name}** in your database, but I wasn't able to extract additional information from their public website.${firm.website ? `\n\n**Website on file:** ${firm.website}` : "\n\nNo website is on file for this firm. You can add one in the Firms section and try again."}`,
        };
      }

      const { updates, updatedFields } = mergeEnrichmentData(firm, enrichedData);

      let summary = `I found **${firm.name}** in your database and searched their public website for information.\n\n`;

      if (Object.keys(updates).length > 0) {
        await base44.entities.Firm.update(firm.id, updates);
        summary += `✅ **Populated ${updatedFields.length} field(s):** ${updatedFields.join(", ")}`;
      } else {
        summary += `ℹ️ All fields are already populated — no updates were needed.`;
      }

      const table = enrichmentToTable(enrichedData, updatedFields);

      return {
        role: "assistant",
        content: summary,
        tables: [table],
      };
    } catch (error) {
      return {
        role: "assistant",
        content: `I encountered an error while searching the web for firm data: ${error.message}. Please try again.`,
      };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const enrichmentIntent = detectEnrichmentIntent(userMessage);
      if (enrichmentIntent.isEnrichment) {
        const result = await handleFirmEnrichment(enrichmentIntent.firmName);
        setMessages((prev) => [...prev, result]);
        return;
      }

      const toolContext = await buildToolContext(userMessage);
      const systemPrompt = buildSystemPrompt();

      const conversationHistory = messages
        .slice(-10)
        .map((m) => {
          let text = `${m.role === "user" ? "User" : "Assistant"}: ${m.content || ""}`;
          if (m.tables?.length) text += ` [${m.tables.length} table(s) shown]`;
          if (m.charts?.length) text += ` [${m.charts.length} chart(s) shown]`;
          return text;
        })
        .join("\n\n");

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `${systemPrompt}\n\n${toolContext}\n\n=== CONVERSATION HISTORY ===\n${conversationHistory}\n\nUser: ${userMessage}\n\nRespond using the JSON schema. Use tables for lists of data, charts for distributions and trends, and text for explanations. All cell values in tables must be strings. Convert all numbers to strings in table cells.`,
        response_json_schema: RESPONSE_SCHEMA,
        add_context_from_internet: false,
        model: "automatic",
      });

      // Handle response (could be object or string depending on model)
      let text = "";
      let tables = [];
      let charts = [];

      if (typeof response === "string") {
        try {
          const parsed = JSON.parse(response);
          text = parsed.text || response;
          tables = parsed.tables || [];
          charts = parsed.charts || [];
        } catch {
          text = response;
        }
      } else if (typeof response === "object" && response !== null) {
        const data = response.data && typeof response.data === "object" ? response.data : response;
        text = data.text || "";
        tables = data.tables || [];
        charts = data.charts || [];
      }

      setMessages((prev) => [...prev, { role: "assistant", content: text, tables, charts }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `I apologize, but I encountered an error: ${error.message}. Please try again.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
        >
          <Bot className="w-7 h-7" />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <div>
                <h3 className="text-sm font-semibold">MyKumpare Assistant</h3>
                <p className="text-[10px] text-indigo-200">Tables · Charts · Analytics</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((message, idx) => (
              <AIAssistantMessage key={idx} message={message} />
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

          <form onSubmit={handleSubmit} className="border-t border-gray-200 p-3 bg-white">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything... (try 'show all firms' or 'chart of tasks by status')"
                className="flex-1 h-10 px-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                className="h-10 w-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={isLoading || !input.trim()}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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