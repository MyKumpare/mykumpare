import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Tags, Loader2, TrendingUp, LineChart as LineIcon, BarChart3 } from "lucide-react";
import { format, parseISO, eachMonthOfInterval, startOfMonth, endOfMonth, subMonths } from "date-fns";

const TAG_PALETTE = [
  "#7c3aed", "#2563eb", "#0891b2", "#059669",
  "#d97706", "#dc2626", "#db2777", "#9333ea",
  "#0d9488", "#ca8a04", "#4f46e5", "#e11d48",
];

/**
 * Deep-dive analytics for news content tags: trend lines per tag over the
 * last 12 months, a tag selector to focus on specific topics, and a "Top
 * Trending Tags" panel ranking which tags gained the most traction
 * (recent 3 months vs. prior 3 months).
 */
export default function NewsContentTagDeepDive({ scope = "all", linkedFirmId = null }) {
  const [view, setView] = useState("line"); // "line" | "bar"
  const [activeTags, setActiveTags] = useState(null); // null = all; Set = filtered

  const { data: news = [], isLoading } = useQuery({
    queryKey: ["news_content_tag_volume", scope, linkedFirmId],
    queryFn: () => base44.entities.FirmNews.list("-news_date", 5000),
  });

  const { chartData, tags, trending } = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 11, 1));
    const end = endOfMonth(now);
    const months = eachMonthOfInterval({ start, end });

    const scoped = news.filter((n) => {
      if (n.deleted_at) return false;
      if (scope === "my" && linkedFirmId && n.tenant_id !== linkedFirmId) return false;
      return true;
    });

    const tagSet = new Set();
    const counts = {};
    for (const n of scoped) {
      if (!n.news_date) continue;
      const d = parseISO(n.news_date);
      if (d < start || d > end) continue;
      const monthKey = format(d, "yyyy-MM");
      const itemTags = (n.content_tags || []).length ? n.content_tags : ["Untagged"];
      for (const t of itemTags) {
        tagSet.add(t);
        if (!counts[monthKey]) counts[monthKey] = {};
        counts[monthKey][t] = (counts[monthKey][t] || 0) + 1;
      }
    }

    const sortedTags = Array.from(tagSet).sort((a, b) => a.localeCompare(b));
    const data = months.map((m) => {
      const key = format(m, "yyyy-MM");
      const row = { month: format(m, "MMM yy") };
      for (const t of sortedTags) row[t] = counts[key]?.[t] || 0;
      return row;
    });

    // Trending: compare recent 3 months vs prior 3 months
    const recentMonths = months.slice(-3).map((m) => format(m, "yyyy-MM"));
    const priorMonths = months.slice(-6, -3).map((m) => format(m, "yyyy-MM"));
    const trendRows = sortedTags.map((t) => {
      const recent = recentMonths.reduce((s, k) => s + (counts[k]?.[t] || 0), 0);
      const prior = priorMonths.reduce((s, k) => s + (counts[k]?.[t] || 0), 0);
      const delta = recent - prior;
      const growthPct = prior > 0 ? Math.round((delta / prior) * 100) : (recent > 0 ? 100 : 0);
      return { tag: t, recent, prior, delta, growthPct };
    });
    // Rank by absolute delta (most gained first), then by growth %
    const trendingRanked = trendRows
      .filter((r) => r.recent > 0 || r.prior > 0)
      .sort((a, b) => b.delta - a.delta || b.growthPct - a.growthPct);

    return { chartData: data, tags: sortedTags, trending: trendingRanked };
  }, [news, scope, linkedFirmId]);

  const visibleTags = useMemo(() => {
    if (!activeTags || activeTags.size === 0) return tags;
    return tags.filter((t) => activeTags.has(t));
  }, [tags, activeTags]);

  const totalArticles = useMemo(
    () => chartData.reduce((sum, row) => sum + visibleTags.reduce((s, t) => s + (row[t] || 0), 0), 0),
    [chartData, visibleTags]
  );

  const toggleTag = (t) => {
    setActiveTags((prev) => {
      const next = new Set(prev || []);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };

  const selectAll = () => setActiveTags(null);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Tags className="w-5 h-5 text-violet-600" />
          <h2 className="text-sm font-semibold text-gray-800">Content Tag Deep-Dive — Last 12 Months</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("line")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              view === "line" ? "bg-violet-600 text-white border-violet-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <LineIcon className="w-3.5 h-3.5" /> Trend
          </button>
          <button
            onClick={() => setView("bar")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              view === "bar" ? "bg-violet-600 text-white border-violet-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Volume
          </button>
        </div>
      </div>

      {/* Tag selector chips */}
      {tags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-4">
          <button
            onClick={selectAll}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              !activeTags ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            All tags
          </button>
          {tags.map((t, i) => {
            const active = !activeTags || activeTags.has(t);
            return (
              <button
                key={t}
                onClick={() => toggleTag(t)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  active ? "text-gray-700 border-gray-300 bg-white" : "text-gray-400 border-gray-100 bg-gray-50"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: TAG_PALETTE[i % TAG_PALETTE.length] }}
                />
                {t}
              </button>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <div className="h-72 flex items-center justify-center text-gray-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...
        </div>
      ) : totalArticles === 0 ? (
        <div className="h-72 flex items-center justify-center text-gray-400 text-sm">
          No tagged news articles in the last 12 months
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={320}>
            {view === "line" ? (
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                  cursor={{ stroke: "rgba(124,58,237,0.2)", strokeWidth: 1 }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                {visibleTags.map((t, i) => {
                  const origIndex = tags.indexOf(t);
                  return (
                    <Line
                      key={t}
                      type="monotone"
                      dataKey={t}
                      stroke={TAG_PALETTE[origIndex % TAG_PALETTE.length]}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                    />
                  );
                })}
              </LineChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                  cursor={{ fill: "rgba(124,58,237,0.05)" }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                {visibleTags.map((t) => {
                  const origIndex = tags.indexOf(t);
                  return (
                    <Bar key={t} dataKey={t} stackId="1" fill={TAG_PALETTE[origIndex % TAG_PALETTE.length]} />
                  );
                })}
              </BarChart>
            )}
          </ResponsiveContainer>

          {/* Top trending tags panel */}
          {trending.length > 0 && (
            <div className="mt-5 border-t border-gray-100 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-semibold text-gray-700">Top Trending Tags — Recent 3 Months vs. Prior 3 Months</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {trending.slice(0, 6).map((r) => {
                  const origIndex = tags.indexOf(r.tag);
                  const color = TAG_PALETTE[origIndex % TAG_PALETTE.length];
                  const gaining = r.delta > 0;
                  const flat = r.delta === 0;
                  return (
                    <div key={r.tag} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-xs font-medium text-gray-700 truncate">{r.tag}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-500">{r.recent} <span className="text-gray-400">vs</span> {r.prior}</span>
                        <span
                          className={`text-xs font-semibold ${
                            flat ? "text-gray-400" : gaining ? "text-emerald-600" : "text-red-500"
                          }`}
                        >
                          {flat ? "—" : `${gaining ? "+" : ""}${r.delta}`}
                        </span>
                        {!flat && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                              gaining ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                            }`}
                          >
                            {gaining ? "+" : ""}{r.growthPct}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400 mt-2.5">
                Ranked by absolute volume change. Growth % compares recent 3-month total to the prior 3-month total.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}