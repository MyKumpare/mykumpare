import React from "react";
import { Loader2, CheckCircle2, Circle } from "lucide-react";

const RUNNING = ["pending", "running", "in_progress"];
const DONE = ["completed", "success", "done"];

function Step({ label, state }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
        state === "done" ? "bg-green-100 text-green-600"
        : state === "active" ? "bg-violet-100 text-violet-600"
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

export default function AgentProgressIndicator({ messages }) {
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const toolCalls = lastAssistant?.tool_calls || [];
  const hasSearched = toolCalls.length > 0;
  const hasText = lastAssistant?.content && String(lastAssistant.content).trim().length > 0;
  const runningCalls = toolCalls.filter((tc) => RUNNING.includes(tc.status || ""));

  const phaseLabel = runningCalls.length > 0
    ? "Running search..."
    : hasSearched && !hasText
      ? "Preparing report..."
      : "Thinking...";

  return (
    <div className="flex justify-start">
      <div className="bg-white border border-violet-200 rounded-2xl rounded-bl-md px-4 py-3 w-full max-w-md shadow-sm">
        <div className="flex items-center gap-2 text-violet-700 font-medium text-sm mb-2.5">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{phaseLabel}</span>
        </div>
        <div className="space-y-1.5">
          <Step label="Searching your data" state={hasSearched ? "done" : "active"} />
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
                     : running ? <Loader2 className="w-3 h-3 animate-spin text-violet-500 shrink-0" />
                     : <Circle className="w-2.5 h-2.5 text-gray-300 shrink-0" />}
                    <span className={`truncate ${running ? "text-gray-700" : "text-gray-400"}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          )}
          <Step label="Writing report" state={hasText ? "done" : (hasSearched ? "active" : "pending")} />
        </div>
      </div>
    </div>
  );
}