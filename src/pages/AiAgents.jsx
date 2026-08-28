import React from "react";
import { useNavigate } from "react-router-dom";
import { Bot } from "lucide-react";
import SectionPageHeader, { SectionStatusCard } from "@/components/shared/SectionPageHeader";
import SectionModuleGrid from "@/components/shared/SectionModuleGrid";
import { AI_AGENTS } from "@/components/ai/agentRegistry";

/**
 * AI Agents section, restructured to the Monitor format: colored banner +
 * status card + categorized draggable module grid. Each agent is a module
 * card that navigates to its chat route on click.
 */
// Build module metadata from the central agent registry.
const AGENT_MODULES = AI_AGENTS.map((a) => ({
  key: a.id,
  label: a.name,
  icon: a.icon,
  color: a.iconColor,
  bg: a.iconBg,
  border: "border-gray-200",
  to: a.to,
}));
const AGENT_MODULE_MAP = Object.fromEntries(AGENT_MODULES.map((m) => [m.key, m]));
const AGENT_DEFAULT_CATEGORIES = [
  { id: "agents", name: "AI Agents", items: AGENT_MODULES.map((m) => m.key) },
];

export default function AiAgents() {
  const navigate = useNavigate();

  const handleSelect = (key) => {
    const mod = AGENT_MODULE_MAP[key];
    if (mod?.to) navigate(mod.to);
  };

  return (
    <div className="min-h-screen bg-gray-50/80">
      <SectionPageHeader
        icon={Bot}
        title="AI Agents"
        gradient="from-indigo-600 via-violet-700 to-purple-800"
      />

      <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 pt-4 pb-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <SectionStatusCard label="Available Agents" value={AGENT_MODULES.length} icon={Bot} color="bg-violet-500" />
        </div>

        <SectionModuleGrid
          modules={AGENT_MODULES}
          moduleMap={AGENT_MODULE_MAP}
          defaultCategories={AGENT_DEFAULT_CATEGORIES}
          storageKey="aiagents_layout_v1"
          onSelect={handleSelect}
          accentRing="ring-violet-300"
        />
      </div>
    </div>
  );
}