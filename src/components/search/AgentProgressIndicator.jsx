import React, { useState, useEffect } from "react";
import { Loader2, CheckCircle2, Circle } from "lucide-react";

const RUNNING = ["pending", "running", "in_progress"];
const DONE = ["completed", "success", "done"];

const ACCENTS = {
  violet: { bg: "bg-violet-100", text: "text-violet-600", border: "border-violet-200", ink: "text-violet-700", spin: "text-violet-500" },
  indigo: { bg: "bg-indigo-100", text: "text-indigo-600", border: "border-indigo-200", ink: "text-indigo-700", spin: "text-indigo-500" },
};

const DEFAULT_PHASES = ["Understanding your request", "Searching your data", "Analyzing results", "Writing report"];

function Step({ label, state, accent }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
        state === "done" ? "bg-green-100 text-green-600"
        : state === "active" ? `${accent.bg} ${accent.text}`
        : "bg-gray-100 text-gray-300"
      }`}>
        {state === "done" ? <CheckCircle2 className="w-3 h-3" />
         : state === "active" ? <Loader2 className="w-3 h-3 animate-spin" />
         : <Circle className="w-2.5 h-2.5" />}
      </div>
      <span className={`text-xs ${state === "pending" ? "text-gray-400" : "text-gray-700"}`}>{label}</span>
    </div>
  );
}

export default function AgentProgressIndicator({ messages, accent = "violet", phases }) {
  const a = ACCENTS[accent] || ACCENTS.violet;
  const phaseLabels = phases || DEFAULT_PHASES;

  // Timed phase progression gives visible feedback even when the agent
  // exposes no granular tool-call events (e.g. the inline InvokeLLM assistant).
  const [phaseIdx, setPhaseIdx] = useState(0);
  useEffect(() => {
    setPhaseIdx(0);
    const id = setInterval(() => {
      setPhaseIdx((p) => (p < phaseLabels.length - 1 ? p + 1 : p));
    }, 1500);
    return () => clearInterval(id);
  }, [phaseLabels.length]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const toolCalls = lastAssistant?.tool_calls || [];
  const hasSearched = toolCalls.length > 0;
  const hasText = lastAssistant?.content && String(lastAssistant.content).trim().length > 0;
  const runningCalls = toolCalls.filter((tc) => RUNNING.includes(tc.status || ""));

  let phaseLabel;
  if (runningCalls.length > 0) phaseLabel = "Running search...";
  else if (hasSearched && !hasText) phaseLabel = "Preparing report...";
  else phaseLabel = phaseLabels[phaseIdx] || "Working...";

  return (
    <div className="flex justify-start">
      <div className={`bg-white border ${a.border} rounded-2xl rounded-bl-md px-4 py-3 w-full max-w-md shadow-sm`}>
        <div className={`flex items-center gap-2 ${a.ink} font-medium text-sm mb-2.5`}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{phaseLabel}</span>
        </div>
        <div className="space-y-1.5">
          {phaseLabels.map((label, i) => {
            let state = "pending";
            if (i < phaseIdx) state = "done";
            else if (i === phaseIdx) state = "active";
            // Real signals override the timer when available
            if (label === "Searching your data" && hasSearched) state = "done";
            if (label === "Writing report" && hasText) state = "done";
            return <Step key={i} label={label} state={state} accent={a} />;
          })}
          {toolCalls.length > 0 && (
            <div className="ml-2.5 pl-2.5 space-y-1 border-l border-gray-100">
              {toolCalls.map((tc, i) => {
                const running = RUNNING.includes(tc.status || "");
                const done = DONE.includes(tc.status || "");
                const proj = tc.display_projection || {};
                const label = proj.label || tc.name || "tool";
                return (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    {done ? <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                     : running ? <Loader2 className={`w-3 h-3 animate-spin ${a.spin} shrink-0`} />
                     : <Circle className="w-2.5 h-2.5 text-gray-300 shrink-0" />}
                    <span className={`truncate ${running ? "text-gray-700" : "text-gray-400"}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}