import React, { useState, useRef } from "react";
import { X, GripVertical, CheckSquare, Square, Download } from "lucide-react";

export default function ReportDownloadModal({ isOpen, onClose, sections, onDownload }) {
  const [items, setItems] = useState(() => sections.map((s, i) => ({ ...s, id: i, selected: true })));
  const dragIdx = useRef(null);
  const dragOverIdx = useRef(null);

  if (!isOpen) return null;

  const selectedCount = items.filter(i => i.selected).length;
  const allSelected = selectedCount === items.length;

  const toggleItem = (id) => setItems(prev => prev.map(it => it.id === id ? { ...it, selected: !it.selected } : it));
  const toggleAll = () => {
    if (allSelected) {
      setItems(prev => prev.map(it => ({ ...it, selected: false })));
    } else {
      setItems(prev => prev.map(it => ({ ...it, selected: true })));
    }
  };

  // Drag-to-reorder
  const onDragStart = (e, idx) => {
    dragIdx.current = idx;
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e, idx) => {
    e.preventDefault();
    dragOverIdx.current = idx;
  };
  const onDrop = () => {
    const from = dragIdx.current;
    const to = dragOverIdx.current;
    if (from === null || to === null || from === to) return;
    setItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    dragIdx.current = null;
    dragOverIdx.current = null;
  };

  const handleDownload = () => {
    const selected = items.filter(it => it.selected);
    if (!selected.length) return;
    onDownload(selected.map(it => it.block));
    onClose();
  };

  const getPeriodType = (periodLabel = '') => {
    if (periodLabel.toLowerCase().includes('rolling')) return 'Rolling';
    if (periodLabel === 'Cumulative') return 'Cumulative';
    if (periodLabel === 'Cross-Period Comparison') return '';
    if (periodLabel === 'YTD' || periodLabel === 'QTD') return 'Trailing';
    if (/^\d/.test(periodLabel) || periodLabel.toLowerCase().includes('year') || periodLabel.toLowerCase().includes('month') || periodLabel.toLowerCase().includes('inception')) return 'Trailing';
    if (periodLabel.toLowerCase().includes('monthly') || periodLabel.toLowerCase().includes('quarterly') || periodLabel.toLowerCase().includes('annual')) return 'Historical';
    return '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 flex flex-col" style={{ maxHeight: "85vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-800">Download Report</h2>
            <p className="text-xs text-gray-500 mt-0.5">Select and reorder sections to include in the PDF</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Select all / Clear */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50">
          <button onClick={toggleAll} className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
            {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {allSelected ? "Deselect All" : "Select All"}
          </button>
          <span className="text-gray-300">|</span>
          <span className="text-xs text-gray-500">{selectedCount} of {items.length} sections selected</span>
        </div>

        {/* Section list */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1.5">
          {items.map((item, idx) => {
            const meta = item.meta || {};
            const periodType = getPeriodType(meta.periodLabel || '');
            const periodDisplay = periodType ? `${periodType}: ${meta.periodLabel}` : (meta.periodLabel || '');
            const attrs = meta.attributes?.slice(0, 3).join(', ') + (meta.attributes?.length > 3 ? '…' : '');

            return (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => onDragStart(e, idx)}
                onDragOver={(e) => onDragOver(e, idx)}
                onDrop={onDrop}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors cursor-grab active:cursor-grabbing ${item.selected ? "border-indigo-200 bg-indigo-50/40" : "border-gray-200 bg-white opacity-60"}`}
              >
                <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <button onClick={() => toggleItem(item.id)} className="flex-shrink-0">
                  {item.selected
                    ? <CheckSquare className="w-4 h-4 text-indigo-600" />
                    : <Square className="w-4 h-4 text-gray-300" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {meta.category && (
                      <span className="text-xs font-semibold text-gray-700">{meta.category}</span>
                    )}
                    {periodDisplay && (
                      <span className="text-xs text-indigo-600 font-medium">{periodDisplay}</span>
                    )}
                  </div>
                  {attrs && (
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">{attrs}</p>
                  )}
                </div>
                <span className="text-[10px] text-gray-400 flex-shrink-0">p. {idx + 2}</span>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={selectedCount === 0}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            Download {selectedCount > 0 ? `${selectedCount} section${selectedCount > 1 ? "s" : ""}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}