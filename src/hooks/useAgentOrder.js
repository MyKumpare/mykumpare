import { useState, useEffect, useCallback } from "react";
import { DEFAULT_AGENT_ORDER } from "@/components/ai/agentRegistry";

const STORAGE_KEY = "ai_agent_order";

// Persisted, user-controlled ordering of AI agents (shared by the AI Agents
// page and the floating-button picker). Any agent missing from the saved
// order (e.g. a newly added one) is appended at the end.
export function useAgentOrder() {
  const [order, setOrder] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(saved) && saved.length) {
        const known = new Set(DEFAULT_AGENT_ORDER);
        const valid = saved.filter((id) => known.has(id));
        const included = new Set(valid);
        return [...valid, ...DEFAULT_AGENT_ORDER.filter((id) => !included.has(id))];
      }
    } catch {}
    return DEFAULT_AGENT_ORDER;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    } catch {}
  }, [order]);

  const move = useCallback((from, to) => {
    setOrder((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  return { order, setOrder, move };
}