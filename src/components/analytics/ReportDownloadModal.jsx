import React, { useState, useEffect, useRef } from "react";
import { X, GripVertical, CheckSquare, Square, Download, Eye, ArrowLeft, Layers } from "lucide-react";

// Group items into singles and table+chart pairs based on matching meta keys
function groupItems(items) {
  const groups = [];
  const used = new Set();

  items.forEach((item, idx) => {
    if (used.has(idx)) return;
    const meta = item.meta || {};
    const key = `${meta.category}||${meta.periodLabel}||${meta.productName}`;

    // Look for a sibling with same key but different block content (table vs chart)
    const pairIdx = items.findIndex((other, oi) =>
      oi !== idx &&
      !used.has(oi) &&
      (() => {
        const om = other.meta || {};
        return (
          om.category === meta.category &&
          om.periodLabel === meta.periodLabel &&
          om.productName === meta.productName &&
          other.block !== item.block
        );
      })()
    );

    if (pairIdx !== -1) {
      used.add(idx);
      used.add(pairIdx);
      groups.push({ type: "pair", items: [item, items[pairIdx]], combined: false, id: item.id });
    } else {
      used.add(idx);
      groups.push({ type: "single", items: [item], id: item.id });
    }
  });

  return groups;
}

export default function ReportDownloadModal({ isOpen, onClose, sections, onDownload }) {
  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [step, setStep] = useState("select");
  const [previewIdx, setPreviewIdx] = useState(0);
  const dragIdx = useRef(null);
  const dragOverIdx = useRef(null);

  useEffect(() => {
    if (isOpen && sections.length > 0) {
      const mapped = sections.map((s, i) => ({ ...s, id: i, selected: true }));
      setItems(mapped);
      setGroups(groupItems(mapped));
      setStep("select");
      setPreviewIdx(0);
    }
  }, [isOpen, sections]);

  if (!isOpen) return null;

  // Flatten groups back to ordered items for download
  const flatSelectedItems = groups.flatMap(g => {
    const selected = g.items.filter(it => it.selected);
    if (!selected.length) return [];
    if (g.type === "pair" && g.combined) {
      // Return both items tagged as combined so the download handler can merge them
      return [{ ...selected[0], combinedWith: selected[1] || null }];
    }
    return selected;
  });

  const selectedCount = flatSelectedItems.length;

  const toggleItem = (id) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, selected: !it.selected } : it));
    setGroups(prev => prev.map(g => ({
      ...g,
      items: g.items.map(it => it.id === id ? { ...it, selected: !it.selected } : it),
    })));
  };

  const toggleGroup = (groupId) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      const anySelected = g.items.some(it => it.selected);
      return { ...g, items: g.items.map(it => ({ ...it, selected: !anySelected })) };
    }));
  };

  const toggleCombine = (groupId) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, combined: !g.combined } : g));
  };

  const toggleAll = () => {
    const anySelected = groups.some(g => g.items.some(it => it.selected));
    setGroups(prev => prev.map(g => ({ ...g, items: g.items.map(it => ({ ...it, selected: !anySelected })) })));
  };

  const allSelected = groups.every(g => g.items.every(it => it.selected));

  // Drag-to-reorder (operates on groups)
  const onDragStart = (e, idx) => { dragIdx.current = idx; e.dataTransfer.effectAllowed = "move"; };
  const onDragOver = (e, idx) => { e.preventDefault(); dragOverIdx.current = idx; };
  const onDrop = () => {
    const from = dragIdx.current;
    const to = dragOverIdx.current;
    if (from === null || to === null || from === to) return;
    setGroups(prev => {
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
    onDownload(flatSelectedItems);
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
    const attrs = meta.attributes?.length
      ? meta.attributes.slice(0, 3).join(', ') + (meta.attributes.length > 3 ? '…' : '')
      : '';
    return { periodDisplay, attrs };
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
              <p className="text-xs text-gray-500 mt-0.5">Select, reorder, and configure sections for the PDF</p>
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
            <span className="text-xs text-gray-500">{selectedCount} of {groups.length} sections selected</span>
          </div>

          {/* Group list */}
          <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1.5">
            {groups.map((group, idx) => {
              const meta = group.items[0]?.meta || {};
              const { periodDisplay, attrs } = getLabel(meta);
              const groupSelected = group.items.some(it => it.selected);
              const isPair = group.type === "pair";

              return (
                <div
                  key={group.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, idx)}
                  onDragOver={(e) => onDragOver(e, idx)}
                  onDrop={onDrop}
                  className={`rounded-xl border transition-colors cursor-grab active:cursor-grabbing ${groupSelected ? "border-indigo-200 bg-indigo-50/40" : "border-gray-200 bg-white opacity-60"}`}
                >
                  {/* Main row */}
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    <button onClick={() => isPair ? toggleGroup(group.id) : toggleItem(group.items[0].id)} className="flex-shrink-0">
                      {groupSelected ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4 text-gray-300" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {meta.category && <span className="text-xs font-semibold text-gray-700">{meta.category}</span>}
                        {periodDisplay && <span className="text-xs text-indigo-600 font-medium">{periodDisplay}</span>}
                        {isPair && (
                          <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                            Table + Chart
                          </span>
                        )}
                      </div>
                      {attrs && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{attrs}</p>}
                    </div>
                    {/* Preview */}
                    <button
                      onClick={() => {
                        // Find the flat index in selectedItems to preview
                        const flatIdx = flatSelectedItems.findIndex(it => it.id === group.items[0].id);
                        setPreviewIdx(Math.max(0, flatIdx));
                        setStep("preview");
                      }}
                      title="Preview this section"
                      className="p-1.5 rounded-lg text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors flex-shrink-0"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 w-8 text-right">p. {idx + 2}</span>
                  </div>

                  {/* Combine toggle — only for pairs */}
                  {isPair && groupSelected && (
                    <div className="flex items-center gap-2 px-10 pb-2.5">
                      <button
                        onClick={() => toggleCombine(group.id)}
                        className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${group.combined ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"}`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        {group.combined ? "Combined on one page ✓" : "Combine table + chart on one page"}
                      </button>
                    </div>
                  )}
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
  const previewItem = flatSelectedItems[previewIdx];
  const totalPreview = flatSelectedItems.length;

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
            <span className="text-sm font-bold text-gray-800">Preview</span>
            <span className="text-xs text-gray-400">Section {previewIdx + 1} of {totalPreview}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Section nav tabs */}
        {totalPreview > 1 && (
          <div className="flex gap-1 px-6 py-2 border-b border-gray-100 overflow-x-auto bg-gray-50">
            {flatSelectedItems.map((item, idx) => {
              const { periodDisplay } = getLabel(item.meta || {});
              const label = item.meta?.category
                ? `${item.meta.category}${periodDisplay ? ` · ${periodDisplay}` : ''}`
                : periodDisplay || `Section ${idx + 1}`;
              return (
                <button key={item.id} onClick={() => setPreviewIdx(idx)}
                  className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${previewIdx === idx ? "bg-indigo-600 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-indigo-300"}`}
                >
                  {label}{item.combinedWith ? " (combined)" : ""}
                </button>
              );
            })}
          </div>
        )}

        {/* Preview content */}
        <div className="flex-1 overflow-y-auto p-6">
          {previewItem ? (
            <div key={previewItem.id}>
              {previewItem.meta && (
                <div className="mb-4 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    {previewItem.meta.category && <span className="text-sm font-bold text-gray-700">{previewItem.meta.category}</span>}
                    {(() => { const { periodDisplay } = getLabel(previewItem.meta); return periodDisplay ? <span className="text-sm text-indigo-600 font-medium">{periodDisplay}</span> : null; })()}
                    {previewItem.combinedWith && <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded font-medium">Table + Chart combined</span>}
                  </div>
                  {previewItem.meta.productName && (
                    <p className="text-xs text-gray-400 mt-0.5">{previewItem.meta.productName}{previewItem.meta.firmName ? ` · ${previewItem.meta.firmName}` : ''}</p>
                  )}
                </div>
              )}
              {/* Render block(s) */}
              <div
                className="w-full overflow-x-auto text-sm"
                ref={el => {
                  if (!el) return;
                  el.innerHTML = '';
                  const renderBlock = (block) => {
                    if (!block) return;
                    const clone = block.cloneNode(true);
                    clone.style.cssText = '';
                    clone.querySelectorAll('button').forEach(b => { b.style.display = 'none'; });
                    el.appendChild(clone);
                  };
                  renderBlock(previewItem.block);
                  if (previewItem.combinedWith?.block) {
                    const divider = document.createElement('div');
                    divider.style.cssText = 'border-top: 1px dashed #e5e7eb; margin: 16px 0;';
                    el.appendChild(divider);
                    renderBlock(previewItem.combinedWith.block);
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
            <button onClick={() => setPreviewIdx(i => Math.max(0, i - 1))} disabled={previewIdx === 0}
              className="px-3 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors">
              ← Prev
            </button>
            <button onClick={() => setPreviewIdx(i => Math.min(totalPreview - 1, i + 1))} disabled={previewIdx === totalPreview - 1}
              className="px-3 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors">
              Next →
            </button>
          </div>
          <button onClick={handleDownload} disabled={selectedCount === 0}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors">
            <Download className="w-4 h-4" />
            Download {selectedCount} section{selectedCount !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}