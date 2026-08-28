import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shared colored header banner for Monitor-style section landing pages.
 * Mirrors the Monitor page header: title + icon on the left, action buttons
 * in the middle, and a close (back to Home) button on the right.
 *
 * Props:
 *  - icon: lucide icon component
 *  - title: section name
 *  - gradient: tailwind gradient classes for the banner background
 *  - actions: optional React node rendered before the close button
 */
export default function SectionPageHeader({ icon: Icon, title, gradient, actions }) {
  const navigate = useNavigate();
  return (
    <div className={`bg-gradient-to-r ${gradient} text-white shadow-md sticky top-0 z-30`}>
      <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5" />}
          <h1 className="text-base font-bold">{title}</h1>
        </div>
        <div className="flex items-center gap-1">
          {actions}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/15"
            onClick={() => navigate("/")}
            title={`Close ${title}`}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Shared "Back to <section>" button shown above inline module content.
 */
export function SectionBackButton({ label, onClick }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <ChevronLeft className="w-4 h-4" /> Back to {label}
    </Button>
  );
}

/**
 * Shared summary status card for section landing pages. Mirrors the compact
 * stat cards used on the Monitor / Overview dashboards.
 */
export function SectionStatusCard({ label, value, icon: Icon, color = "bg-indigo-500", loading }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        {loading ? (
          <div className="w-12 h-6 bg-gray-100 rounded animate-pulse" />
        ) : (
          <p className="text-xl font-bold text-gray-900 leading-none">{value}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}