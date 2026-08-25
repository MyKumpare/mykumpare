import React, { useState, useMemo } from "react";
import { BarChart2, TrendingUp, LayoutList, AlignVerticalJustifyStart, AlignHorizontalJustifyStart, Printer } from "lucide-react";
import { runAnalysis } from "./analyticsCalculations";
import { CATEGORY_LABELS, PRODUCT_COLORS } from "./AnalysisResultsShared";
import { MultiProductResults, SingleProductResult } from "./MultiProductResults";
import ReportDownloadModal from "./ReportDownloadModal";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import ReportBrandingFooter from "@/components/reports/ReportBrandingFooter";
import { drawMyKumpareBranding } from "@/components/reports/reportBranding";

function defaultChartType(pr) {
  if (pr.isRolling) return "line";
  return "bar";
}

export default function AnalysisResults({ analysis, products, benchmarks, returnSeries }) {
  const savedViewMode = analysis?.measurement_type?.view_mode || "table";
  const [viewMode, setViewMode] = useState(savedViewMode);
  const [chartTypes, setChartTypes] = useState({});
  const [tableOrientation, setTableOrientation] = useState("vertical");
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [downloadSections, setDownloadSections] = useState([]);

  const isMultiProduct = (analysis?.product_configs?.length ?? 0) > 1;
  const [useProductDefaultBenchmark, setUseProductDefaultBenchmark] = useState(false);

  const handleOpenDownloadModal = () => {
    const sections = Array.from(document.querySelectorAll('[data-pdf-meta]'))
      .filter(b => { try { const m = JSON.parse(b.getAttribute('data-pdf-meta') || '{}'); return !!m.productName || !!m.category || !!m.periodLabel; } catch(e) { return false; } })
      .map(block => { let meta = {}; try { meta = JSON.parse(block.getAttribute('data-pdf-meta') || '{}'); } catch(e) {} return { block, meta }; });
    setDownloadSections(sections);
    setDownloadModalOpen(true);
  };

  const handleDownload = async (selectedItems) => {
    if (!selectedItems.length) return;
    document.body.style.cursor = 'wait';
    const safe = (v) => v ? String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : '';
    const renderW = 900, margin = 28;

    const coverProductLines = (analysis?.product_configs || []).map(cfg =>
      `${safe(cfg.product_name || '')}${cfg.firm_name ? ` <span style="color:#94a3b8">(${safe(cfg.firm_name)})</span>` : ''}${cfg.return_type ? ` &middot; <span style="color:#6366f1;font-weight:600">${safe(cfg.return_type.charAt(0).toUpperCase()+cfg.return_type.slice(1))}</span>` : ''}`
    );
    const coverBmLines = [...new Set((analysis?.product_configs || []).flatMap(cfg => cfg.benchmark_names || []).filter(Boolean))];
    const coverCategories = (analysis?.categories_config || []).map(c => CATEGORY_LABELS[c.category] || c.category);
    const totalPages = selectedItems.length + 1;

    const tocEntries = selectedItems.map((item, i) => {
      let m = {}; try { m = JSON.parse(item.block?.getAttribute('data-pdf-meta') || '{}'); } catch(e) {}
      const pl = m.periodLabel || '';
      let pt = '';
      if (pl.toLowerCase().includes('rolling')) pt = 'Rolling';
      else if (pl === 'Cumulative') pt = 'Cumulative';
      else if (pl === 'YTD' || pl === 'QTD') pt = 'Trailing';
      else if (/^\d/.test(pl) || ['year','month','inception'].some(k => pl.toLowerCase().includes(k))) pt = 'Trailing';
      else if (['monthly','quarterly','annual'].some(k => pl.toLowerCase().includes(k))) pt = 'Historical';
      return { category: m.category || '', period: pt ? `${pt}: ${pl}` : pl, attributes: m.attributes ? m.attributes.slice(0,3).join(', ') + (m.attributes.length > 3 ? '…' : '') : '', page: i + 2 };
    });

    const coverEl = document.createElement('div');
    coverEl.style.cssText = `width:${renderW}px;min-height:500px;background:#fff;font-family:sans-serif;padding:60px 70px;box-sizing:border-box;`;
    coverEl.innerHTML = `
      <div style="border-bottom:3px solid #4f46e5;padding-bottom:24px;margin-bottom:32px;">
        <div style="font-size:28px;font-weight:800;color:#1e293b;line-height:1.2;margin-bottom:8px;">${safe(analysis?.name || 'Analysis')}</div>
        <div style="font-size:13px;color:#64748b;">Generated ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-bottom:36px;">
        <div><div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Analysis Period</div><div style="font-size:15px;font-weight:600;color:#1e293b;">${safe(analysis?.period_start || '')} → ${safe(analysis?.period_end || '')}</div></div>
        <div><div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Report Pages</div><div style="font-size:15px;font-weight:600;color:#1e293b;">${selectedItems.length} section${selectedItems.length !== 1 ? 's' : ''}</div></div>
      </div>
      ${coverProductLines.length ? `<div style="margin-bottom:28px;"><div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Products</div>${coverProductLines.map(p => `<div style="font-size:13px;color:#1e293b;margin-bottom:5px;padding:8px 12px;background:#f8fafc;border-left:3px solid #4f46e5;border-radius:0 6px 6px 0;">${p}</div>`).join('')}</div>` : ''}
      ${coverBmLines.length ? `<div style="margin-bottom:28px;"><div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Benchmarks</div>${coverBmLines.map(b => `<div style="font-size:13px;color:#1e293b;margin-bottom:5px;padding:8px 12px;background:#f8fafc;border-left:3px solid #94a3b8;border-radius:0 6px 6px 0;">${safe(b)}</div>`).join('')}</div>` : ''}
      ${coverCategories.length ? `<div style="margin-bottom:36px;"><div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Analysis Types</div><div style="display:flex;flex-wrap:wrap;gap:8px;">${coverCategories.map(c => `<span style="font-size:12px;font-weight:600;color:#4f46e5;background:#eef2ff;padding:5px 14px;border-radius:20px;border:1px solid #c7d2fe;">${safe(c)}</span>`).join('')}</div></div>` : ''}
      ${tocEntries.length ? `<div style="border-top:2px solid #e2e8f0;padding-top:28px;"><div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">Table of Contents</div><table style="width:100%;border-collapse:collapse;"><thead><tr style="border-bottom:1px solid #e2e8f0;"><th style="text-align:left;font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;padding:0 0 7px 0;width:18%;">Analysis Type</th><th style="text-align:left;font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;padding:0 0 7px 8px;width:22%;">Reporting Period</th><th style="text-align:left;font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;padding:0 0 7px 8px;">Attributes</th><th style="text-align:right;font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;padding:0 0 7px 0;width:60px;">Page</th></tr></thead><tbody>${tocEntries.map((e, i) => `<tr style="background:${i%2===0?'#fff':'#f8fafc'};"><td style="font-size:12px;color:#1e293b;font-weight:600;padding:8px 0;">${safe(e.category)}</td><td style="font-size:12px;color:#4f46e5;font-weight:500;padding:8px 0 8px 8px;">${safe(e.period)}</td><td style="font-size:11px;color:#64748b;padding:8px 0 8px 8px;">${safe(e.attributes)}</td><td style="font-size:12px;color:#4f46e5;font-weight:700;text-align:right;padding:8px 0;">p. ${e.page}</td></tr>`).join('')}</tbody></table></div>` : ''}
    `;
    const cw = document.createElement('div');
    cw.style.cssText = `position:fixed;top:-99999px;left:-99999px;width:${renderW}px;overflow:visible;background:#fff;`;
    cw.appendChild(coverEl);
    document.body.appendChild(cw);
    await new Promise(r => setTimeout(r, 200));
    const coverCanvas = await html2canvas(cw, { scale: 2, useCORS: true, backgroundColor: '#ffffff', width: renderW, windowWidth: renderW, logging: false });
    document.body.removeChild(cw);

    const cloneBlock = (src, w) => {
      const c = src.cloneNode(true);
      c.style.cssText = `width:${w}px;overflow:visible;`;
      c.querySelectorAll('*').forEach(d => { d.style.overflow = 'visible'; d.style.overflowX = 'visible'; d.style.overflowY = 'visible'; d.style.maxHeight = 'none'; });
      c.querySelectorAll('button').forEach(b => { b.style.display = 'none'; });
      c.querySelectorAll('.recharts-responsive-container').forEach(svg => { svg.style.width = `${w}px`; svg.style.minWidth = `${w}px`; });
      return c;
    };

    const canvases = [];
    for (const item of selectedItems) {
      const block = item.block, combinedBlock = item.combinedWith?.block || null;
      let meta = {}; try { meta = JSON.parse(block.getAttribute('data-pdf-meta') || '{}'); } catch(e) {}
      const hdr = document.createElement('div');
      hdr.style.cssText = `padding:14px 20px 10px;border-bottom:2px solid #e5e7eb;width:${renderW}px;box-sizing:border-box;background:#fff;font-family:sans-serif;`;
      hdr.innerHTML = `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;"><div><div style="font-size:14px;font-weight:700;color:#1e293b;margin-bottom:3px;">${safe(meta.analysisName) || 'Analysis'}</div>${meta.periodLabel ? `<div style="font-size:11px;color:#6366f1;font-weight:600;margin-bottom:2px;">${safe(meta.periodLabel)}</div>` : ''}${meta.category ? `<div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">${safe(meta.category)}${combinedBlock ? ' — Table & Chart' : ''}</div>` : ''}</div><div style="text-align:right;flex-shrink:0;">${meta.periodStart && meta.periodEnd ? `<div style="font-size:10px;color:#64748b;margin-bottom:2px;"><b>Period:</b> ${safe(meta.periodStart)} → ${safe(meta.periodEnd)}</div>` : ''}${meta.productName ? `<div style="font-size:10px;color:#64748b;margin-bottom:2px;"><b>Product:</b> ${safe(meta.productName)}</div>` : ''}${meta.benchmarkName ? `<div style="font-size:10px;color:#64748b;"><b>Benchmark:</b> ${safe(meta.benchmarkName)}</div>` : ''}</div></div>`;
      const wrapper = document.createElement('div');
      wrapper.style.cssText = `position:fixed;top:-99999px;left:-99999px;width:${renderW}px;overflow:visible;background:#fff;font-family:sans-serif;`;
      wrapper.appendChild(hdr);
      if (combinedBlock) {
        const hw = Math.floor((renderW - 16) / 2);
        const row = document.createElement('div'); row.style.cssText = `display:flex;gap:16px;align-items:flex-start;width:${renderW}px;`;
        const lw = document.createElement('div'); lw.style.cssText = `flex:0 0 ${hw}px;overflow:visible;`; lw.appendChild(cloneBlock(block, hw));
        const rw = document.createElement('div'); rw.style.cssText = `flex:0 0 ${hw}px;overflow:visible;`; rw.appendChild(cloneBlock(combinedBlock, hw));
        row.appendChild(lw); row.appendChild(rw); wrapper.appendChild(row);
      } else {
        wrapper.appendChild(cloneBlock(block, renderW));
      }
      document.body.appendChild(wrapper);
      await new Promise(r => setTimeout(r, 250));
      const canvas = await html2canvas(wrapper, { scale: 2, useCORS: true, backgroundColor: '#ffffff', width: renderW, windowWidth: renderW, logging: false });
      document.body.removeChild(wrapper);
      canvases.push(canvas);
    }

    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
      const addCanvas = (canvas, pgW, pgH) => { const fs = Math.min((pgW-margin*2)/canvas.width, (pgH-margin*2)/canvas.height); pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pgW-canvas.width*fs)/2, margin, canvas.width*fs, canvas.height*fs); };
      addCanvas(coverCanvas, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
      canvases.forEach((canvas, i) => {
        const o = canvas.height/2 > canvas.width/2 ? 'portrait' : 'landscape';
        pdf.addPage('letter', o);
        const pgW = pdf.internal.pageSize.getWidth(), pgH = pdf.internal.pageSize.getHeight();
        addCanvas(canvas, pgW, pgH);
        pdf.setFontSize(8); pdf.setTextColor(150,150,150);
        pdf.text(`Page ${i+2} of ${totalPages}`, pgW - margin, pgH - 12, { align: 'right' });
      });
      drawMyKumpareBranding(pdf, { margin: 28 });
      pdf.save(`${analysis?.name || 'Analysis'}-Results.pdf`);
    } catch (error) { console.error('PDF generation failed:', error); }
    finally { document.body.style.cursor = 'default'; }
  };

  const analysisForCalc = useMemo(() => {
    if (!isMultiProduct || useProductDefaultBenchmark || !analysis) return analysis;
    const sharedBmIds = analysis.product_configs?.[0]?.benchmark_ids ?? [];
    const sharedBmNames = analysis.product_configs?.[0]?.benchmark_names ?? [];
    return { ...analysis, product_configs: (analysis.product_configs ?? []).map(cfg => ({ ...cfg, benchmark_ids: sharedBmIds, benchmark_names: sharedBmNames })) };
  }, [analysis, isMultiProduct, useProductDefaultBenchmark]);

  const results = useMemo(() => {
    if (!analysisForCalc || !returnSeries || !benchmarks) return [];
    return runAnalysis({ analysis: analysisForCalc, allSeries: returnSeries, allBenchmarks: benchmarks });
  }, [analysisForCalc, returnSeries, benchmarks]);

  const includeCloneProduct = analysis?.product_configs?.[0]?.include_clone_product ?? false;

  const hasAnyData = results.some(r => r.categories?.some(c => c.periodResults?.length > 0));
  if (!results.length || !hasAnyData) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm space-y-1">
        <p className="font-medium text-gray-600">No results to display</p>
        <p className="text-xs">Make sure the selected product has return data imported and the analysis period overlaps with that data.</p>
      </div>
    );
  }

  const buildMeta = (productResult, catResult, pr) => ({
    analysisName: analysis?.name || 'Analysis',
    periodStart: analysis?.period_start,
    periodEnd: analysis?.period_end,
    productName: productResult?.productName,
    firmName: productResult?.firmName,
    returnType: productResult?.returnType,
    benchmarkName: productResult?.benchmarkNames?.filter(Boolean).join(', ') || null,
    category: catResult ? (CATEGORY_LABELS[catResult.category] || catResult.category) : null,
    periodLabel: pr?.window?.label || null,
    attributes: pr && !pr.isHistorical && !pr.isRolling ? Object.keys(pr.attributeValues || {}) : (catResult?.attributes || []),
  });

  const getChartType = (key, pr) => chartTypes[key] ?? defaultChartType(pr);
  const toggleChartType = (key, pr) => setChartTypes(prev => { const cur = prev[key] ?? defaultChartType(pr); return { ...prev, [key]: cur === "line" ? "bar" : "line" }; });

  return (
    <div className="space-y-5">
      <ReportDownloadModal isOpen={downloadModalOpen} onClose={() => setDownloadModalOpen(false)} sections={downloadSections} onDownload={handleDownload} />
      <div id="analysis-results-content" className="space-y-5 bg-white p-6 rounded-xl border border-gray-200">
        <div className="pdf-block flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-bold text-gray-800">Analysis Results</h3>
            {analysis?.period_start && analysis?.period_end && (
              <p className="text-xs text-gray-500 mt-0.5">{analysis.period_start} → {analysis.period_end}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {isMultiProduct && (
              <button onClick={() => setUseProductDefaultBenchmark(v => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${useProductDefaultBenchmark ? "bg-amber-50 text-amber-700 border-amber-300" : "bg-indigo-50 text-indigo-700 border-indigo-200"}`}>
                {useProductDefaultBenchmark ? "Each product's benchmark" : "Shared benchmark"}
              </button>
            )}
            <button onClick={handleOpenDownloadModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:border-indigo-400 hover:text-indigo-600 transition-colors">
              <Printer className="w-3.5 h-3.5" /> Download / Print
            </button>
            {(viewMode === "table" || viewMode === "both") && (
              <div className="flex gap-1">
                <button onClick={() => setTableOrientation("vertical")}
                  className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors ${tableOrientation === "vertical" ? "bg-slate-700 text-white border-slate-700" : "bg-white text-gray-500 border-gray-300 hover:border-slate-400"}`}>
                  <AlignVerticalJustifyStart className="w-3.5 h-3.5" /> Vertical
                </button>
                <button onClick={() => setTableOrientation("horizontal")}
                  className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors ${tableOrientation === "horizontal" ? "bg-slate-700 text-white border-slate-700" : "bg-white text-gray-500 border-gray-300 hover:border-slate-400"}`}>
                  <AlignHorizontalJustifyStart className="w-3.5 h-3.5" /> Horizontal
                </button>
              </div>
            )}
            <div className="flex gap-1.5">
              {[
                { key: "table", icon: <LayoutList className="w-3.5 h-3.5" />, label: "Table" },
                { key: "chart", icon: <BarChart2 className="w-3.5 h-3.5" />, label: "Chart" },
                { key: "both", icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Both" },
              ].map(({ key, icon, label }) => (
                <button key={key} onClick={() => setViewMode(key)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${viewMode === key ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"}`}>
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isMultiProduct ? (
          <MultiProductResults
            results={results}
            analysis={analysis}
            viewMode={viewMode}
            tableOrientation={tableOrientation}
            getChartType={getChartType}
            toggleChartType={toggleChartType}
            buildMeta={buildMeta}
          />
        ) : (
          results.map((productResult, pi) => (
            <SingleProductResult
              key={pi}
              productResult={productResult}
              pi={pi}
              analysis={analysis}
              viewMode={viewMode}
              tableOrientation={tableOrientation}
              getChartType={getChartType}
              toggleChartType={toggleChartType}
              buildMeta={buildMeta}
              includeCloneProduct={includeCloneProduct}
              showProductHeader={results.length > 1}
            />
          ))
        )}
      </div>
      <ReportBrandingFooter />
    </div>
  );
}