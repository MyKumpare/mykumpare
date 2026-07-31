import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FlaskConical } from "lucide-react";
import ResearchAssistantChat from "@/components/research/ResearchAssistantChat";

export default function ResearchAssistant() {
  return (
    <div className="min-h-screen bg-gray-50/80">
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="h-5 w-px bg-white/30" />
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <FlaskConical className="w-5 h-5" />
            Research Assistant
          </h1>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <ResearchAssistantChat />
      </div>
    </div>
  );
}