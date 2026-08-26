import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { FileText, ChevronDown, Settings2, Check } from "lucide-react";
import { format } from "date-fns";

// Substitutes placeholders in template content with values from the current form.
function substitute(content, vars) {
  return (content || "")
    .replace(/\{\{contact_name\}\}/gi, vars.contactName || "")
    .replace(/\{\{firm_name\}\}/gi, vars.firmName || "")
    .replace(/\{\{date\}\}/gi, vars.date || "");
}

// Dropdown picker for meeting recap templates. Filters templates by the
// currently-selected activity type and inserts the template body into the
// notes field when one is chosen. Includes a shortcut to open the template
// manager dialog.
export default function MeetingRecapTemplatePicker({
  activityType,
  contactName,
  firmName,
  activityDate,
  onInsert,
  onManage,
}) {
  const [open, setOpen] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ["meeting_recap_templates"],
    queryFn: () => base44.entities.MeetingRecapTemplate.list("name", 500),
  });

  const applicable = useMemo(() => {
    return templates.filter(t => {
      const types = t.applicable_types || [];
      return types.length === 0 || (activityType && types.includes(activityType));
    });
  }, [templates, activityType]);

  const handleSelect = (tpl) => {
    const dateStr = activityDate
      ? format(new Date(activityDate + "T00:00:00"), "MMM d, yyyy")
      : format(new Date(), "MMM d, yyyy");
    onInsert?.(substitute(tpl.template_content, { contactName, firmName, date: dateStr }));
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors"
      >
        <FileText className="w-3.5 h-3.5" />
        Recap Template
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 w-72 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
            {applicable.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-xs text-gray-400">
                  No templates for <span className="font-medium">{activityType || "this type"}</span>.
                </p>
                <button
                  type="button"
                  onClick={() => { setOpen(false); onManage?.(); }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-1"
                >
                  Create one →
                </button>
              </div>
            ) : (
              <>
                <div className="px-2 py-1.5 border-b border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                    {activityType ? `${activityType} Templates` : "All Templates"}
                  </p>
                </div>
                {applicable.map(tpl => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleSelect(tpl)}
                    className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                      <span className="text-xs font-semibold text-gray-800 truncate">{tpl.name}</span>
                      {tpl.is_default && (
                        <span className="text-[9px] text-indigo-500 font-bold ml-auto">DEFAULT</span>
                      )}
                    </div>
                    {tpl.description && (
                      <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{tpl.description}</p>
                    )}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => { setOpen(false); onManage?.(); }}
                  className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors border-t border-gray-100"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Manage Templates
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}