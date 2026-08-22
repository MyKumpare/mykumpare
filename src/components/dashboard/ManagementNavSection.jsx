import React, { useState, useRef, useImperativeHandle } from "react";
import { Briefcase, ChevronRight, ChevronDown } from "lucide-react";

/**
 * Management navigation section.
 * Groups the Activity Timeline, Analyst Coverage, and Firm Coverage dashboard
 * sections under a single expandable "Management" parent. Each sub-item scrolls
 * to its corresponding section. Exposes scrollToSection(index) via ref so the
 * header "Management" dropdown can jump to a specific function.
 */
const ManagementNavSection = React.forwardRef(({ forceExpanded, sections = [] }, ref) => {
  const [expanded, setExpanded] = useState(false);
  const isExpanded = forceExpanded || expanded;
  const sectionRefs = useRef([]);

  const scrollTo = (i) => {
    setExpanded(true);
    setTimeout(() => {
      sectionRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  useImperativeHandle(ref, () => ({
    scrollToSection: scrollTo,
  }));

  return (
    <div className="mb-6">
      {/* Parent row: Management */}
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center group"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded
              ? <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
              : <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />}
          </button>
          <button onClick={() => scrollTo(0)} className="flex items-center gap-2 group">
            <Briefcase className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">Management</span>
            <span className="text-xs text-gray-400 font-normal">({sections.length})</span>
          </button>
        </div>
      </div>

      {/* Sub-items + sections — kept mounted (hidden) so child queries/refs stay alive */}
      <div className={`ml-6 mt-1 border-l border-gray-200 pl-3 ${isExpanded ? "" : "hidden"}`}>
        <div className="space-y-1 mb-2">
          {sections.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex items-center px-1 py-1 rounded-lg hover:bg-gray-50">
                <button onClick={() => scrollTo(i)} className="flex items-center gap-2 group flex-1">
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                  <Icon className={`w-4 h-4 ${s.iconColor}`} />
                  <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900">{s.label}</span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="space-y-4">
          {sections.map((s, i) => (
            <div key={s.label} ref={(el) => (sectionRefs.current[i] = el)}>
              {s.element}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

ManagementNavSection.displayName = "ManagementNavSection";
export default ManagementNavSection;