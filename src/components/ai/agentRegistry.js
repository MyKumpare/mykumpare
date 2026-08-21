import { Bot, FlaskConical, Search } from "lucide-react";

// Central registry of every AI agent available in the app. Add new agents
// here and they automatically appear in both the AI Agents page and the
// floating-button picker. `type: "inline"` agents open an in-app chat;
// `type: "route"` agents navigate to their `to` route.
export const AI_AGENTS = [
  {
    id: "mykumpare_assistant",
    name: "MyKumpare Assistant",
    description:
      "Browse all data, analyze & summarize, visualize results as tables or charts, and populate firms from their public websites.",
    icon: Bot,
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
    accent: "from-indigo-500 to-purple-600",
    type: "inline",
    to: "/",
  },
  {
    id: "research_assistant",
    name: "Research Assistant",
    description:
      "Comparative research and benchmarking assistant. Generates analyses, peer comparisons, and custom reports for firms, products, portfolios, and benchmarks.",
    icon: FlaskConical,
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    accent: "from-violet-500 to-indigo-600",
    type: "route",
    to: "/ResearchAssistant",
  },
  {
    id: "search_assistant",
    name: "Search Assistant",
    description:
      "Search across every entity in the application — firms, contacts, products, portfolios, due diligence, news, activities, tasks, and more — and synthesize findings into structured reports.",
    icon: Search,
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    accent: "from-emerald-500 to-teal-600",
    type: "route",
    to: "/SearchReport",
  },
];

export const DEFAULT_AGENT_ORDER = AI_AGENTS.map((a) => a.id);