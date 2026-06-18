import React, { useState, useEffect, useRef } from "react";
import { X, GripVertical, CheckSquare, Square, Download, Eye, ArrowLeft } from "lucide-react";

export default function ReportDownloadModal({ isOpen, onClose, sections, onDownload }) {
  const [items, setItems] = useState([]);
  const [step, setStep] = useState("select"); // "select" | "preview"
  const [previewIdx, setPreviewIdx] = useState(0); // which selected item is being previewed
  const previewRef = useRef(null);
  const dragIdx = useRef(null);
  const dragOverIdx = useRef(null);

  // Sync items when modal opens
  useEffect(() => {
    if (isOpen && sections.length > 0) {
      setItems(sections.map((s, i) => ({ ...s, id: i, selected: true })));
      setStep("select");
      setPreviewIdx(0);
    }
  }, [isOpen, sections]);

  if (!isOpen) return null;

  const selectedItems = items.filter(it => it.selected);
  const selectedCount = selectedItems.length;
  const allSelected = selectedCount === items.length;

  const toggleItem = (id) => setItems(prev => prev.map(it => it.id === id ? { ...it, selected: !it.selected } : it));
  const toggleAll = () => {
    if (allSelected) setItems(prev => prev.map(it => ({ ...it, selected: false })));
    else setItems(prev => prev.map(it => ({ ...it, selected: true })));
  };

  // Drag-to-reorder
  const onDragStart = (e, idx) => { dragIdx.current = idx; e.dataTransfer.effectAllowed = "move"; };
  const onDragOver = (e, idx) => { e.preventDefault(); dragOverIdx.current = idx; };
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
    if (!selectedCount) return;
    onDownload(selectedItems);
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

  const getLabel = (meta) => {
    const periodType = getPeriodType(meta.periodLabel || '');
    const periodDisplay = periodType ? `${periodType}: ${meta.periodLabel}` : (meta.periodLabel || '');
    return { periodDisplay, attrs: meta.attributes?.slice(0, 3).join(', ') + (meta.attributes?.length > 3 ? '…' : '') };
  };

  // Inject the actual block HTML into the preview container
  const renderPreviewBlock = (item) => {
    if (!item?.block) return null;
    const clone = item.block.cloneNode(true);
    // Hide PDF download buttons inside
    clone.querySelectorAll('button').forEach(b => { b.style.display = 'none'; });
    return (
      <div
        className="w-full overflow-x-auto"
        ref={el => { if (el && el.children.length === 0) el.appendChild(clone); }}
      />
    );
  };

  // ── SELECT STEP ──
  if (step === "select") {
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

          {/* Toolbar */}
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
              const { periodDisplay, attrs } = getLabel(item.meta || {});
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
                    {item.selected ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4 text-gray-300" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.meta?.category && <span className="text-xs font-semibold text-gray-700">{item.meta.category}</span>}
                      {periodDisplay && <span className="text-xs text-indigo-600 font-medium">{periodDisplay}</span>}
                    </div>
                    {attrs && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{attrs}</p>}
                  </div>
                  {/* Preview eye icon */}
                  <button
                    onClick={() => { setPreviewIdx(idx); setStep("preview"); }}
                    title="Preview this section"
                    className="p-1.5 rounded-lg text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors flex-shrink-0"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <span className="text-[10px] text-gray-400 flex-shrink-0 w-8 text-right">p. {idx + 2}</span>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setPreviewIdx(0); setStep("preview"); }}
                disabled={selectedCount === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Eye className="w-4 h-4" /> Preview All
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
      </div>
    );
  }

  // ── PREVIEW STEP ──
  const previewItem = selectedItems[previewIdx];
  const totalPreview = selectedItems.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col" style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep("select")} className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-indigo-600 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to selection
            </button>
            <span className="text-gray-300">|</span>
            <div>
              <span className="text-sm font-bold text-gray-800">Preview</span>
              <span className="text-xs text-gray-400 ml-2">Section {previewIdx + 1} of {totalPreview}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Section nav tabs */}
        {totalPreview > 1 && (
          <div className="flex gap-1 px-6 py-2 border-b border-gray-100 overflow-x-auto bg-gray-50">
            {selectedItems.map((item, idx) => {
              const { periodDisplay } = getLabel(item.meta || {});
              const label = item.meta?.category ? `${item.meta.category}${periodDisplay ? ` · ${periodDisplay}` : ''}` : periodDisplay || `Section ${idx + 1}`;
              return (
                <button
                  key={item.id}
                  onClick={() => setPreviewIdx(idx)}
                  className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${previewIdx === idx ? "bg-indigo-600 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-indigo-300"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Preview content */}
        <div className="flex-1 overflow-y-auto p-6">
          {previewItem ? (
            <div key={previewItem.id}>
              {/* Section title */}
              {previewItem.meta && (
                <div className="mb-4 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    {previewItem.meta.category && <span className="text-sm font-bold text-gray-700">{previewItem.meta.category}</span>}
                    {(() => { const { periodDisplay } = getLabel(previewItem.meta); return periodDisplay ? <span className="text-sm text-indigo-600 font-medium">{periodDisplay}</span> : null; })()}
                  </div>
                  {previewItem.meta.productName && (
                    <p className="text-xs text-gray-400 mt-0.5">{previewItem.meta.productName}{previewItem.meta.firmName ? ` · ${previewItem.meta.firmName}` : ''}</p>
                  )}
                </div>
              )}
              {/* Render the actual block */}
              <div
                className="w-full overflow-x-auto text-sm"
                ref={el => {
                  if (el && previewItem.block) {
                    el.innerHTML = '';
                    const clone = previewItem.block.cloneNode(true);
                    clone.style.cssText = '';
                    clone.querySelectorAll('button').forEach(b => { b.style.display = 'none'; });
                    el.appendChild(clone);
                  }
                }}
              />
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No section selected.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreviewIdx(i => Math.max(0, i - 1))}
              disabled={previewIdx === 0}
              className="px-3 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPreviewIdx(i => Math.min(totalPreview - 1, i + 1))}
              disabled={previewIdx === totalPreview - 1}
              className="px-3 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Next →
            </button>
          </div>
          <button
            onClick={handleDownload}
            disabled={selectedCount === 0}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download {selectedCount} section{selectedCount !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}