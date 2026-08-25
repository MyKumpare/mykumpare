import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, Loader2, X, History, Trash2, Plus, MessageSquare, Mic, ArrowRight, GripVertical, FileDown } from "lucide-react";
import { exportAgentConversationPdf } from "./agentReportPdf";
import AgentProgressIndicator from "@/components/search/AgentProgressIndicator";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useChatHistory } from "@/hooks/useChatHistory";
import { useVoiceSearch } from "@/hooks/useVoiceSearch";
import { AI_AGENTS } from "./agentRegistry";
import { useAgentOrder } from "@/hooks/useAgentOrder";

import AIAssistantMessage from "./AIAssistantMessage";

const INITIAL_GREETING = {
  role: "assistant",
  content: "Hello! I'm your MyKumpare AI assistant. I can help you:\n\n- **Browse All Data**: View firms, contacts, products, portfolios, benchmarks, activities, and tasks\n- **Analyze & Summarize**: Get counts, distributions, performance metrics, and custom computations\n- **Visualize Results**: See data as **tables**, **charts**, or **text** — or all three at once — plus populate firms from their public websites\n\nTry asking:\n- \"Show all firms\"\n- \"Chart of firms by type\"\n- \"Summarize the entire database\"\n- \"Populate a firm from their website\"\n- \"Show performance data for all products\"\n\nWhat would you like to see?",
};
import { buildSystemPrompt, buildToolContext } from "./aiContextBuilder";
import {
  detectEnrichmentIntent,
  findFirmByName,
  enrichFirmFromWeb,
  mergeEnrichmentData,
  mergeContactEnrichment,
  enrichmentToTable,
  createFirmFromEnrichment,
  validateFirmData,
} from "./firmEnrichment";
import { detectAddressIntent, searchFirmAddresses } from "./firmAddressSearch";
import { addressesAreExact } from "@/components/addressDuplicateCheck";

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
  const [messages, setMessages] = useState([INITIAL_GREETING]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { order, move } = useAgentOrder();
  const byId = Object.fromEntries(AI_AGENTS.map((a) => [a.id, a]));
  const orderedAgents = order.map((id) => byId[id]).filter(Boolean);

  const handleSelectAgent = (agent) => {
    setShowPicker(false);
    if (agent.type === "inline") {
      setIsOpen(true);
    } else {
      navigate(agent.to);
    }
  };

  const { conversations, loading: loadingConvs, createConversation, updateConversation, deleteConversation } = useChatHistory("ai_assistant");
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const activeConvRef = useRef(null);
  const skipPersistRef = useRef(false);
  useEffect(() => { activeConvRef.current = activeConversationId; }, [activeConversationId]);

  // Voice input — speak to the assistant instead of typing.
  const handleVoiceResult = (transcript) => {
    const text = transcript.trim();
    if (!text) return;
    handleSubmit(null, text);
  };
  const handleVoiceError = () => {
    setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't hear you. Please try again or type your question." }]);
  };
  const { listening: voiceListening, supported: voiceSupported, start: startVoice, stop: stopVoice } = useVoiceSearch({ onResult: handleVoiceResult, onError: handleVoiceError });
  const handleMicClick = () => {
    if (!voiceSupported) return;
    if (voiceListening) stopVoice();
    else startVoice();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Persist messages to the ChatConversation entity whenever they change.
  // Creates a conversation on the first user message, then updates on subsequent turns.
  useEffect(() => {
    if (skipPersistRef.current) { skipPersistRef.current = false; return; }
    if (!messages.some((m) => m.role === "user")) return; // don't persist greeting-only state
    let cancelled = false;
    (async () => {
      try {
        if (activeConvRef.current) {
          await updateConversation(activeConvRef.current, { messages });
        } else {
          const firstUser = messages.find((m) => m.role === "user");
          const title = (firstUser?.content || "New Chat").slice(0, 60);
          const conv = await createConversation(title, messages);
          if (!cancelled) setActiveConversationId(conv.id);
        }
      } catch {
        // persistence failures shouldn't break the chat
      }
    })();
    return () => { cancelled = true; };
  }, [messages, createConversation, updateConversation]);

  const loadConversation = (conv) => {
    skipPersistRef.current = true;
    setActiveConversationId(conv.id);
    setMessages(conv.messages?.length ? conv.messages : [INITIAL_GREETING]);
    setShowHistory(false);
  };

  const handleNewChat = () => {
    skipPersistRef.current = true;
    setActiveConversationId(null);
    setMessages([INITIAL_GREETING]);
    setShowHistory(false);
  };

  const handleDeleteConv = async (id) => {
    await deleteConversation(id);
    if (id === activeConversationId) {
      skipPersistRef.current = true;
      setActiveConversationId(null);
      setMessages([INITIAL_GREETING]);
    }
  };

  const handleFirmEnrichment = async (firmName, { skipAlternates = false } = {}) => {
    try {
      const firm = await findFirmByName(firmName);

      if (!firm) {
        let enrichedData = null;
        let enrichmentError = null;
        try {
          enrichedData = await enrichFirmFromWeb(firmName, null);
        } catch (err) {
          enrichmentError = err.message;
        }

        const hasData =
          enrichedData &&
          (enrichedData.description || enrichedData.website || enrichedData.addresses?.length || enrichedData.phones?.length);

        if (!hasData) {
          return {
            role: "assistant",
            content: `I couldn't find public information for **${firmName}**.${enrichmentError ? " The web search encountered an issue." : ""} Would you like me to create a minimal firm record with just the name? You can add details manually in the Firms section later.`,
            pending_creation: { type: "create_firm", data: { name: firmName } },
          };
        }

        const alternates = !skipAlternates
          ? (enrichedData.alternate_names || [])
              .filter((n) => n && n.trim())
              .filter((n) => n.toLowerCase().trim() !== firmName.toLowerCase().trim())
          : [];

        if (alternates.length > 0) {
          const uniqueAlternates = [...new Set([firmName, ...alternates])];
          return {
            role: "assistant",
            content: `I searched the web for "**${firmName}**" but the exact name doesn't match what's publicly available. I found these similar firms — which one did you mean?`,
            options: uniqueAlternates,
          };
        }

        const table = enrichmentToTable(enrichedData, null);
        const validation = validateFirmData(enrichedData);

        return {
          role: "assistant",
          content: `I searched the web and found the following information for **${firmName}**. Please review and confirm if you'd like me to create this firm.${validation.issues.length ? `\n\n⚠️ **Validation notes:**\n${validation.issues.map((i) => `- ${i}`).join("\n")}` : ""}`,
          tables: [table],
          pending_creation: { type: "create_firm", data: enrichedData },
        };
      }

      const enrichedData = await enrichFirmFromWeb(firm.name, firm.website);
      const hasData =
        enrichedData &&
        (enrichedData.description ||
          enrichedData.website ||
          enrichedData.addresses?.length ||
          enrichedData.phones?.length ||
          enrichedData.linkedin_url ||
          enrichedData.year_founded ||
          enrichedData.email ||
          enrichedData.logo_url ||
          enrichedData.firm_types?.length ||
          enrichedData.people?.length);

      if (!hasData) {
        return {
          role: "assistant",
          content: `I found **${firm.name}** in your database, but I wasn't able to extract additional information from their public website.${firm.website ? `\n\n**Website on file:** ${firm.website}` : "\n\nNo website is on file for this firm. You can add one in the Firms section and try again."}`,
        };
      }

      const { updates, updatedFields, similarAddresses, conflicts } = mergeEnrichmentData(firm, enrichedData);

      // Also check for contact updates — match enriched people against existing contacts
      let contactUpdates = [];
      let newPeople = [];
      let contactUpdatedFields = [];
      if (enrichedData.people?.length > 0) {
        const allContacts = await base44.entities.Contact.list(null, 500);
        // Only match against contacts already linked to THIS firm — a
        // same-named person at a different firm must not receive this
        // firm's biography (or any field update) from the enrichment.
        const firmContacts = allContacts.filter((c) => !c.deleted_at && (c.firm_ids || []).includes(firm.id));
        const contactResult = mergeContactEnrichment(enrichedData.people, firmContacts, firm.id);
        contactUpdates = contactResult.contactUpdates;
        newPeople = contactResult.newPeople;
        contactUpdatedFields = contactResult.allUpdatedFields;
      }

      const allUpdatedFields = [...updatedFields, ...contactUpdatedFields];
      const table = enrichmentToTable(enrichedData, allUpdatedFields);

      const hasConflicts = conflicts && conflicts.length > 0;
      const hasContactConflicts = contactUpdates.some((cu) => cu.conflicts?.length > 0);
      if (Object.keys(updates).length === 0 && contactUpdates.length === 0 && newPeople.length === 0 && !hasConflicts && !hasContactConflicts) {
        return {
          role: "assistant",
          content: `I found **${firm.name}** in your database and searched their public website. All fields are already populated — no updates were needed.`,
          tables: [table],
        };
      }

      const validation = validateFirmData(enrichedData);

      const summaryParts = [];
      if (updatedFields.length > 0) summaryParts.push(`${updatedFields.length} firm field(s): ${updatedFields.join(", ")}`);
      if (contactUpdates.length > 0) {
        const parts = contactUpdates.map((c) => {
          const fields = [...(c.updatedFields || [])];
          if (c.conflicts?.length > 0) fields.push(...c.conflicts.map((cf) => `${cf.label} (review)`));
          return `${c.contactName} (${fields.join(", ") || "—"})`;
        });
        summaryParts.push(`${contactUpdates.length} contact(s) updated: ${parts.join("; ")}`);
      }
      if (newPeople.length > 0) summaryParts.push(`${newPeople.length} new contact(s) to create`);
      if (similarAddresses?.length > 0) {
        const fmt = (a) => [a.address_line1, a.address_line2, a.city, a.state, a.postal_code, a.country].filter(Boolean).join(", ");
        const lines = similarAddresses.map((s) => `  • New: ${fmt(s.incoming)}\n     Existing: ${fmt(s.existing)}`);
        summaryParts.push(`⚠️ ${similarAddresses.length} similar address(es) that may duplicate existing ones (held back — use "Add similar address(es)" to include):\n${lines.join("\n")}`);
      }
      if (hasConflicts) {
        const fmtVal = (v) => {
          if (Array.isArray(v)) return v.join(", ");
          if (typeof v === "number") return String(v);
          const s = String(v || "");
          return s.length > 120 ? s.substring(0, 120) + "…" : s;
        };
        const lines = conflicts.map((c) => `  • ${c.label}${c.additive ? " (add)" : " (replace)"}:\n     Current: ${fmtVal(c.existing)}\n     From web: ${fmtVal(c.incoming)}`);
        summaryParts.push(`ℹ️ ${conflicts.length} firm field(s) already have data that differ from the web. Review and select which to update below before applying:\n${lines.join("\n")}`);
      }
      if (hasContactConflicts) {
        const contactsWithConflicts = contactUpdates.filter((cu) => cu.conflicts?.length > 0);
        summaryParts.push(`ℹ️ ${contactsWithConflicts.length} contact(s) have fields with differing data — review and select which to update in the panels below.`);
      }

      return {
        role: "assistant",
        content: `I found **${firm.name}** in your database and searched their public website. I can update:\n\n${summaryParts.map((s) => `- ${s}`).join("\n")}${validation.issues.length ? `\n\n⚠️ **Validation notes:**\n${validation.issues.map((i) => `- ${i}`).join("\n")}` : ""}\n\nPlease confirm to apply these updates.`,
        tables: [table],
        pending_creation: { type: "update_firm", firmId: firm.id, updates, updatedFields, contactUpdates, newPeople, similarAddresses: similarAddresses || [], conflicts: conflicts || [] },
      };
    } catch (error) {
      return {
        role: "assistant",
        content: `I encountered an error while searching the web for firm data: ${error.message}. Please try again.`,
      };
    }
  };

  const handleConfirmCreation = async (pendingCreation, opts = {}) => {
    setMessages((prev) => [...prev, { role: "user", content: pendingCreation.type === "update_firm" ? "Yes, apply updates" : "Yes, create it" }]);
    setIsLoading(true);
    try {
      if (pendingCreation.type === "create_firm") {
        const createdFirm = await createFirmFromEnrichment(pendingCreation.data, user?.linked_firm_id);
        queryClient.invalidateQueries({ queryKey: ["firms"] });
        queryClient.invalidateQueries({ queryKey: ["contacts"] });
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: `✅ **Firm "${createdFirm.name}" created successfully.** You can review and edit the details in the Firms section.`,
        }]);
      } else if (pendingCreation.type === "update_firm") {
        // Build the final firm update: auto-fill (empty) fields + any field the
        // user explicitly opted into from the conflicts list. firm_types is
        // additive (union); every other approved conflict overwrites.
        const finalUpdates = { ...(pendingCreation.updates || {}) };
        const approvedFields = opts.approvedConflicts || [];
        for (const c of (pendingCreation.conflicts || [])) {
          if (!approvedFields.includes(c.field)) continue;
          if (c.additive) {
            const existing = new Set((finalUpdates.firm_types || []).map((t) => String(t).toLowerCase()));
            finalUpdates.firm_types = [...(pendingCreation.updates.firm_types || []), ...(c.incoming || []).filter((t) => !existing.has(String(t).toLowerCase()))];
            if (finalUpdates.firm_types.length === 0) delete finalUpdates.firm_types;
          } else {
            finalUpdates[c.field] = c.incoming;
          }
        }
        if (Object.keys(finalUpdates).length > 0) {
          await base44.entities.Firm.update(pendingCreation.firmId, finalUpdates);
        }
        // Similar addresses are held back from the auto-apply batch and only
        // added when the user explicitly opts in ("Add similar address(es)").
        // Double-check against the firm's current addresses so a duplicate
        // can't sneak in if the record changed since the preview was built.
        if (opts.includeSimilarAddresses && pendingCreation.similarAddresses?.length > 0) {
          try {
            const current = await base44.entities.Firm.get(pendingCreation.firmId);
            const currentAddrs = current.addresses || [];
            const toAdd = pendingCreation.similarAddresses
              .map((s) => s.incoming)
              .filter((a) => a.address_line1 || a.city)
              .filter((a) => !currentAddrs.some((ex) => addressesAreExact(a, ex)))
              .map((a) => ({ ...a, id: crypto.randomUUID() }));
            if (toAdd.length > 0) {
              await base44.entities.Firm.update(pendingCreation.firmId, {
                addresses: [...currentAddrs, ...toAdd],
              });
            }
          } catch {}
        }
        // Update existing contacts: apply auto-fills + any user-approved conflicts.
        // Apply each field individually so a failure on one field (e.g. an
        // overly-long biography) doesn't silently block the others — and
        // surface any errors so the user can see why a field didn't update.
        const approvedContactConflicts = opts.approvedContactConflicts || {};
        let contactsUpdated = 0;
        const contactErrors = [];
        for (const cu of (pendingCreation.contactUpdates || [])) {
          const finalContactUpdates = { ...(cu.updates || {}) };
          const approvedFields = approvedContactConflicts[cu.id] || [];
          for (const c of (cu.conflicts || [])) {
            if (approvedFields.includes(c.field)) {
              finalContactUpdates[c.field] = c.incoming;
            }
          }
          if (Object.keys(finalContactUpdates).length === 0) continue;
          // Try the full update first; if it fails, fall back to per-field updates
          // so a single problematic field doesn't prevent the biography (or
          // other fields) from being saved.
          try {
            await base44.entities.Contact.update(cu.id, finalContactUpdates);
            contactsUpdated++;
          } catch (bulkErr) {
            let anyFieldSaved = false;
            for (const [field, value] of Object.entries(finalContactUpdates)) {
              try {
                await base44.entities.Contact.update(cu.id, { [field]: value });
                anyFieldSaved = true;
              } catch (fieldErr) {
                contactErrors.push(`${cu.contactName} → ${field}: ${fieldErr.message || fieldErr}`);
              }
            }
            if (anyFieldSaved) contactsUpdated++;
          }
        }
        // Create new contacts that didn't match any existing ones
        let contactsCreated = 0;
        for (const person of (pendingCreation.newPeople || [])) {
          try {
            const contactData = {
              tenant_id: user?.linked_firm_id,
              first_name: person.first_name || "",
              last_name: person.last_name || "",
              title: person.title || "",
              email: person.email || "",
              linkedin_url: person.linkedin_url || "",
              biography: person.biography || "",
              photo_url: person.photo_url || "",
              firm_ids: [pendingCreation.firmId],
              employee_status: "Employee",
            };
            await base44.entities.Contact.create(contactData);
            contactsCreated++;
          } catch {}
        }
        const parts = [];
        if (pendingCreation.updatedFields?.length > 0) parts.push(`${pendingCreation.updatedFields.length} firm field(s)`);
        if (contactsUpdated > 0) parts.push(`${contactsUpdated} contact(s) updated`);
        if (contactsCreated > 0) parts.push(`${contactsCreated} new contact(s) created`);
        let resultContent = `✅ **Updates applied:** ${parts.join(", ") || "no changes needed"}`;
        if (contactErrors.length > 0) {
          resultContent += `\n\n⚠️ **Some fields could not be updated:**\n${contactErrors.map((e) => `- ${e}`).join("\n")}`;
        }
        queryClient.invalidateQueries({ queryKey: ["firms"] });
        queryClient.invalidateQueries({ queryKey: ["contacts"] });
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: resultContent,
        }]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: `I encountered an error: ${error.message}. Please try again.`,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelCreation = () => {
    setMessages((prev) => [...prev, { role: "user", content: "Cancel" }]);
    setMessages((prev) => [...prev, {
      role: "assistant",
      content: "Creation cancelled. Let me know if you'd like to try something else.",
    }]);
  };

  const handleSelectFirmOption = async (selectedName) => {
    setMessages((prev) => [...prev, { role: "user", content: selectedName }]);
    setIsLoading(true);
    try {
      const result = await handleFirmEnrichment(selectedName, { skipAlternates: true });
      setMessages((prev) => [...prev, result]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `I encountered an error: ${error.message}. Please try again.` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e, overrideMessage) => {
    if (e) e.preventDefault();
    const userMessage = (overrideMessage ?? input).trim();
    if (!userMessage || isLoading) return;
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

      // Address lookup: return ALL partial firm-name matches with their addresses
      // so the user can decide which one they want to see.
      const addressIntent = detectAddressIntent(userMessage);
      if (addressIntent.isAddressSearch) {
        const result = await searchFirmAddresses(addressIntent);
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
      {!isOpen && !showPicker && (
        <button
          onClick={() => setShowPicker(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
          title="AI Agents"
        >
          <Bot className="w-7 h-7" />
        </button>
      )}

      {showPicker && (
        <div className="fixed bottom-6 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary to-primary/80 text-white">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <h3 className="text-sm font-semibold">AI Agents</h3>
            </div>
            <button
              onClick={() => setShowPicker(false)}
              className="text-white/80 hover:text-white transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-3 py-1.5 text-[10px] text-gray-400 flex items-center gap-1">
            <GripVertical className="w-3 h-3" />
            Drag to reorder — your order is saved.
          </div>
          <DragDropContext
            onDragEnd={(res) => {
              if (res.destination && res.destination.index !== res.source.index) {
                move(res.source.index, res.destination.index);
              }
            }}
          >
            <Droppable droppableId="agent-picker">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="p-2 overflow-y-auto max-h-[55vh]"
                >
                  {orderedAgents.map((agent, index) => {
                    const Icon = agent.icon;
                    return (
                      <Draggable key={agent.id} draggableId={agent.id} index={index}>
                        {(prov, snapshot) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            className={`flex items-start gap-1.5 p-2 rounded-xl transition-colors group ${
                              snapshot.isDragging ? "bg-primary/10 shadow-md ring-1 ring-primary/30" : "hover:bg-primary/10"
                            }`}
                          >
                            <div
                              {...prov.dragHandleProps}
                              className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 pt-2 flex-shrink-0"
                              title="Drag to reorder"
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <button
                              onClick={() => handleSelectAgent(agent)}
                              className="flex-1 flex items-start gap-3 text-left min-w-0"
                            >
                              <div className={`w-10 h-10 rounded-lg ${agent.iconBg} flex items-center justify-center flex-shrink-0`}>
                                <Icon className={`w-5 h-5 ${agent.iconColor}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-gray-900 group-hover:text-primary transition-colors">
                                  {agent.name}
                                </div>
                                <div className="text-xs text-gray-500 line-clamp-2">
                                  {agent.description}
                                </div>
                              </div>
                              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-primary mt-1 flex-shrink-0" />
                            </button>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          <div className="px-3 py-2 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => { setShowPicker(false); navigate("/AiAgents"); }}
              className="w-full text-center text-xs text-primary hover:text-primary font-medium py-1"
            >
              Manage & reorder agents
            </button>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary to-primary/80 text-white">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <div>
                <h3 className="text-sm font-semibold">MyKumpare Assistant</h3>
                <p className="text-[10px] text-primary-foreground/70">Tables · Charts · Analytics</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => exportAgentConversationPdf({ title: messages.find((m) => m.role === "user")?.content?.slice(0, 60) || "MyKumpare Assistant", agentName: "MyKumpare Assistant", messages })}
                disabled={!messages.some((m) => m.role === "user")}
                className="p-1 rounded transition-colors text-white/80 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                title="Export chat as PDF"
              >
                <FileDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowHistory((s) => !s)}
                className={`p-1 rounded transition-colors ${showHistory ? "text-white bg-white/20" : "text-white/80 hover:text-white"}`}
                title="Chat history"
              >
                <History className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {showHistory ? (
            <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
              <div className="p-3 border-b border-gray-200 bg-white flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">Chat History</span>
                <button onClick={handleNewChat} className="flex items-center gap-1 text-xs text-primary hover:text-primary font-medium">
                  <Plus className="w-3.5 h-3.5" /> New Chat
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {loadingConvs ? (
                  <div className="text-center py-4 text-gray-400 text-xs">Loading…</div>
                ) : conversations.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-xs">No saved chats yet</div>
                ) : (
                  conversations.map((conv) => (
                    <div key={conv.id} className={`group flex items-center gap-1 px-2 py-2 rounded-lg text-xs ${conv.id === activeConversationId ? "bg-primary/10 text-primary" : "text-gray-600 hover:bg-gray-100"}`}>
                      <button onClick={() => loadConversation(conv)} className="flex-1 text-left truncate">
                        <MessageSquare className="w-3 h-3 inline mr-1.5 opacity-50" />
                        {conv.title || "Untitled"}
                      </button>
                      <button onClick={() => handleDeleteConv(conv.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {messages.map((message, idx) => (
                  <AIAssistantMessage key={idx} message={message} onSelectOption={handleSelectFirmOption} onConfirmCreation={handleConfirmCreation} onCancelCreation={handleCancelCreation} isLoading={isLoading} />
                ))}
                {isLoading && (
                  <AgentProgressIndicator
                    messages={messages}
                    accent="indigo"
                    phases={["Understanding your request", "Analyzing your data", "Generating response"]}
                  />
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
                    className="flex-1 h-10 px-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={handleMicClick}
                    disabled={isLoading || !voiceSupported}
                    className={`h-10 w-10 rounded-xl border border-gray-300 ${voiceListening ? "text-red-500 border-red-300 animate-pulse" : "text-primary hover:bg-primary/10"}`}
                    title={voiceListening ? "Stop listening" : "Speak to the assistant"}
                  >
                    <Mic className="w-4 h-4" />
                  </Button>
                  <Button
                    type="submit"
                    size="icon"
                    className="h-10 w-10 rounded-xl bg-primary hover:bg-primary/90 text-white"
                    disabled={isLoading || !input.trim()}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-gray-400 mt-2 text-center">
                  AI can make mistakes. Verify important information.
                </p>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}