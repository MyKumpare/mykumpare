import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bot, FlaskConical, ArrowRight } from "lucide-react";

const AI_AGENTS = [
  {
    id: "research_assistant",
    name: "Research Assistant",
    description:
      "Comparative research and benchmarking assistant. Generates analyses, peer comparisons, and custom reports for firms, products, portfolios, and benchmarks.",
    icon: FlaskConical,
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    accent: "from-violet-500 to-indigo-600",
    to: "/ResearchAssistant",
  },
];

export default function AiAgents() {
  return (
    <div className="min-h-screen bg-gray-50/80">
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="h-5 w-px bg-white/30" />
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Bot className="w-5 h-5" />
            AI Agents
          </h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <p className="text-sm text-gray-500 mb-6">
          All AI agents available in your workspace. Click an agent to launch its chat.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {AI_AGENTS.map((agent) => {
            const Icon = agent.icon;
            return (
              <Link
                key={agent.id}
                to={agent.to}
                className="group block bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all p-5"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-lg ${agent.iconBg} flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon className={`w-6 h-6 ${agent.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                      {agent.name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-3">
                      {agent.description}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-end">
                  <span
                    className={`inline-flex items-center gap-1 text-sm font-medium bg-gradient-to-r ${agent.accent} bg-clip-text text-transparent`}
                  >
                    Launch
                    <ArrowRight className="w-4 h-4 text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}