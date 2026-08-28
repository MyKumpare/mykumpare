import React, { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { BarChart3 } from "lucide-react";
import { FIRM_COLORS } from "./FirmMetricsTable";

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getLatestReturns(benchmark, n = 3) {
  return (benchmark?.monthly_returns || [])
    .filter((r) => r.date)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, n);
}

/**
 * Side-by-side benchmark comparison for multiple firms.
 * For each firm, shows their products' default benchmarks with recent monthly returns.
 */
export default function FirmBenchmarkComparison({
  firms = [],
  products = [],
  benchmarks = [],
}) {
  const firmBenchmarks = useMemo(() => {
    return firms.map((firm, idx) => {
      const firmProducts = products.filter(
        (p) => p.firm_id === firm.id && !p.deleted_at
      );
      const productBenchmarks = firmProducts
        .map((p) => {
          if (!p.default_benchmark_id) return null;
          const benchmark = benchmarks.find(
            (b) => b.id === p.default_benchmark_id
          );
          if (!benchmark) return null;
          return {
            product: p,
            benchmark,
            latestReturns: getLatestReturns(benchmark),
          };
        })
        .filter(Boolean);
      return { firm, productBenchmarks, colorIndex: idx };
    });
  }, [firms, products, benchmarks]);

  const hasAny = firmBenchmarks.some(
    (fb) => fb.productBenchmarks.length > 0
  );

  if (!hasAny) {
    return (
      <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl bg-white">
        No benchmark data for selected firms.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {firmBenchmarks.map(({ firm, productBenchmarks, colorIndex }) => (
        <div
          key={firm.id}
          className="border rounded-xl p-4 bg-white shadow-sm"
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-1 h-6 rounded-full"
              style={{
                backgroundColor: FIRM_COLORS[colorIndex % FIRM_COLORS.length],
              }}
            />
            <h4 className="text-sm font-semibold text-gray-800 truncate">
              {firm.name}
            </h4>
          </div>
          {productBenchmarks.length === 0 ? (
            <p className="text-xs text-gray-400 italic">
              No benchmarks assigned to products.
            </p>
          ) : (
            <div className="space-y-2">
              {productBenchmarks.map(({ product, benchmark, latestReturns }) => (
                <div
                  key={product.id}
                  className="px-3 py-2 rounded-lg border border-gray-100 bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {benchmark.name}
                    </p>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                      {benchmark.asset_class}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 truncate mb-2">
                    {product.name}
                  </p>
                  <div className="flex gap-1.5">
                    {latestReturns.length === 0 ? (
                      <span className="text-[11px] text-gray-400">
                        No returns data
                      </span>
                    ) : (
                      latestReturns.map((r) => {
                        const val = toNumber(r.return_value);
                        const netVal = toNumber(r.net_return_value);
                        return (
                          <div
                            key={r.date}
                            className="text-center px-2 py-1 rounded bg-white border border-gray-100 flex-1"
                          >
                            <p className="text-[9px] text-gray-400">
                              {(() => {
                                const dt = parseISO(r.date);
                                return isNaN(dt.getTime())
                                  ? r.date
                                  : format(dt, "MM/yy");
                              })()}
                            </p>
                            <p
                              className={`text-xs font-semibold ${
                                val >= 0 ? "text-emerald-600" : "text-red-600"
                              }`}
                            >
                              {val >= 0 ? "+" : ""}
                              {val.toFixed(2)}%
                            </p>
                            {r.net_return_value !== undefined &&
                              r.net_return_value !== null && (
                                <p className="text-[9px] text-gray-400">
                                  net {netVal >= 0 ? "+" : ""}
                                  {netVal.toFixed(2)}%
                                </p>
                              )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}