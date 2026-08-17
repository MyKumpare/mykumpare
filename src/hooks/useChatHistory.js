import { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Persists AI chat conversations to the ChatConversation entity (per-user via RLS).
 * Used by the floating AIAssistant bot so users can revisit old chats.
 *
 * Transient UI-only fields (pending_creation, options) are stripped from messages
 * before saving, so loading an old chat renders text/tables/charts without
 * re-triggering confirmation or option-selection buttons.
 *
 * @param {string} source - The chat source key (e.g. "ai_assistant")
 */
export function useChatHistory(source) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const all = await base44.entities.ChatConversation.filter({ source }, "-updated_date", 100);
      setConversations(all || []);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    load();
  }, [load]);

  const createConversation = useCallback(
    async (title, messages) => {
      const conv = await base44.entities.ChatConversation.create({
        title: title || "New Chat",
        source,
        messages: stripTransient(messages),
      });
      setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)]);
      return conv;
    },
    [source]
  );

  const updateConversation = useCallback(async (id, { title, messages }) => {
    const data = {};
    if (title !== undefined) data.title = title;
    if (messages !== undefined) data.messages = stripTransient(messages);
    const updated = await base44.entities.ChatConversation.update(id, data);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...data, updated_date: updated?.updated_date || c.updated_date } : c))
    );
    return updated;
  }, []);

  const deleteConversation = useCallback(async (id) => {
    await base44.entities.ChatConversation.delete(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { conversations, loading, createConversation, updateConversation, deleteConversation, reload: load };
}

function stripTransient(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.map((m) => {
    const { pending_creation, options, ...rest } = m || {};
    return rest;
  });
}