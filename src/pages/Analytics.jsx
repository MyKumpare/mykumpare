import React from "react";
import { LineChart } from "lucide-react";

export default function Analytics() {
  return (
    <div className="min-h-screen bg-gray-50/80 flex flex-col items-center justify-center gap-3 text-gray-400">
      <LineChart className="w-10 h-10 opacity-30" />
      <p className="text-sm font-medium">Analytics coming soon.</p>
    </div>
  );
}