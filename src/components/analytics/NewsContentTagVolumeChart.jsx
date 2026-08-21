import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Tags, Loader2 } from "lucide-react";
import { format, parseISO, eachMonthOfInterval, startOfMonth, endOfMonth } from "date-fns";

const TAG_PALETTE = [
  "#7c3aed", "#2563eb", "#0891b2", "#059669",
  "#d97706", "#dc2626", "#db2777", "#9333ea",
  "#0d9488", "#ca8a04", "#4f46e5", "#e11d48",
];

/**
 * Stacked bar chart showing the monthly volume of news articles grouped by
 * custom content tags (e.g. 'Newsletter', 'Research Paper') over the last 12 months.
 */
export default function NewsContentTagVolumeChart({ scope = "all", linkedFirmId = null }) {
  const { data: news = [], isLoading } = useQuery({
    queryKey: ["news_content_tag_volume", scope, linkedFirmId],
    queryFn: () => base44.entities.FirmNews.list("-news_date", 5000),
  });

  const { chartData, tags } = useMemo(() => {
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
    return { chartData: data, tags: sortedTags };
  }, [news, scope, linkedFirmId]);

  const totalArticles = useMemo(
    () => chartData.reduce((sum, row) => sum + tags.reduce((s, t) => s + (row[t] || 0), 0), 0),
    [chartData, tags]
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Tags className="w-5 h-5 text-violet-600" />
          <h2 className="text-sm font-semibold text-gray-800">News Volume by Content Tag — Last 12 Months</h2>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {tags.slice(0, 6).map((t, i) => (
            <div key={t} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: TAG_PALETTE[i % TAG_PALETTE.length] }}
              />
              <span className="text-xs text-gray-500">{t}</span>
            </div>
          ))}
          {tags.length > 6 && <span className="text-xs text-gray-400">+{tags.length - 6}</span>}
        </div>
      </div>
      {isLoading ? (
        <div className="h-72 flex items-center justify-center text-gray-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...
        </div>
      ) : totalArticles === 0 ? (
        <div className="h-72 flex items-center justify-center text-gray-400 text-sm">
          No tagged news articles in the last 12 months
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
              cursor={{ fill: "rgba(124,58,237,0.05)" }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
            {tags.map((t, i) => (
              <Bar key={t} dataKey={t} stackId="1" fill={TAG_PALETTE[i % TAG_PALETTE.length]} radius={[0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}