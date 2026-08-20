import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Newspaper, Loader2 } from "lucide-react";
import { format, subDays, eachDayOfInterval, parseISO } from "date-fns";

const SENTIMENT_COLORS = {
  Positive: "#10b981",
  Negative: "#ef4444",
  Neutral: "#94a3b8",
};

/**
 * Stacked area chart showing the daily count of news articles by sentiment
 * (Positive / Negative / Neutral) over the last 30 days.
 */
export default function NewsSentimentTrendChart({ scope = "all", linkedFirmId = null }) {
  const { data: news = [], isLoading } = useQuery({
    queryKey: ["news_sentiment_trend", scope, linkedFirmId],
    queryFn: () => base44.entities.FirmNews.list("-news_date", 5000),
  });

  const chartData = useMemo(() => {
    const today = new Date();
    const start = subDays(today, 29);
    const days = eachDayOfInterval({ start, end: today });

    // Scope filter
    const scoped = news.filter((n) => {
      if (n.deleted_at) return false;
      if (scope === "my" && linkedFirmId && n.tenant_id !== linkedFirmId) return false;
      return true;
    });

    const counts = {};
    for (const n of scoped) {
      const d = n.news_date?.substring(0, 10);
      if (!d) continue;
      const sentiment = n.news_status || "Neutral";
      if (!counts[d]) counts[d] = { Positive: 0, Negative: 0, Neutral: 0 };
      counts[d][sentiment] = (counts[d][sentiment] || 0) + 1;
    }

    return days.map((day) => {
      const key = format(day, "yyyy-MM-dd");
      return {
        date: format(day, "MM/dd"),
        Positive: counts[key]?.Positive || 0,
        Negative: counts[key]?.Negative || 0,
        Neutral: counts[key]?.Neutral || 0,
      };
    });
  }, [news, scope, linkedFirmId]);

  const totalArticles = chartData.reduce(
    (sum, d) => sum + d.Positive + d.Negative + d.Neutral,
    0
  );

  const sentimentTotals = useMemo(() => {
    const t = { Positive: 0, Negative: 0, Neutral: 0 };
    for (const d of chartData) {
      t.Positive += d.Positive;
      t.Negative += d.Negative;
      t.Neutral += d.Neutral;
    }
    return t;
  }, [chartData]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-rose-600" />
          <h2 className="text-sm font-semibold text-gray-800">News Sentiment Trend — Last 30 Days</h2>
        </div>
        <div className="flex items-center gap-3">
          {Object.entries(sentimentTotals).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: SENTIMENT_COLORS[key] }}
              />
              <span className="text-xs text-gray-500">{key}: <span className="font-semibold text-gray-700">{val}</span></span>
            </div>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div className="h-72 flex items-center justify-center text-gray-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...
        </div>
      ) : totalArticles === 0 ? (
        <div className="h-72 flex items-center justify-center text-gray-400 text-sm">
          No news articles in the last 30 days
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="gradPositive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={SENTIMENT_COLORS.Positive} stopOpacity={0.35} />
                <stop offset="95%" stopColor={SENTIMENT_COLORS.Positive} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradNegative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={SENTIMENT_COLORS.Negative} stopOpacity={0.35} />
                <stop offset="95%" stopColor={SENTIMENT_COLORS.Negative} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradNeutral" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={SENTIMENT_COLORS.Neutral} stopOpacity={0.3} />
                <stop offset="95%" stopColor={SENTIMENT_COLORS.Neutral} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} interval={3} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
            <Area type="monotone" dataKey="Positive" stackId="1" stroke={SENTIMENT_COLORS.Positive} strokeWidth={2} fill="url(#gradPositive)" />
            <Area type="monotone" dataKey="Negative" stackId="1" stroke={SENTIMENT_COLORS.Negative} strokeWidth={2} fill="url(#gradNegative)" />
            <Area type="monotone" dataKey="Neutral" stackId="1" stroke={SENTIMENT_COLORS.Neutral} strokeWidth={2} fill="url(#gradNeutral)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}