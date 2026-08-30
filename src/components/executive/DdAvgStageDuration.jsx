import React, { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from "recharts";
import { Clock } from "lucide-react";
import { ChartCard, EmptyChart, TYPE_COLORS } from "./execDashboardModules";

/**
 * Average Time per DD Stage — bar chart showing the average number of days
 * spent on each due diligence stage across all active projects.
 *
 * For each stage in each active DD record:
 *  - Completed stage: end_date (or completed_date) − start_date
 *  - In-progress stage: today − start_date
 * Stages without a start_date are skipped. Durations are averaged per stage name.
 *
 * Props:
 *   ddRecords — array of DueDiligence records
 */
export default function DdAvgStageDuration({ ddRecords = [] }) {
  const data = useMemo(() => {
    const active = ddRecords.filter((r) => !r.deleted_at);
    const today = new Date();
    const stageMap = {}; // stageName -> { totalDays, count }

    for (const r of active) {
      if (!r.stages || !Array.isArray(r.stages)) continue;
      for (const stage of r.stages) {
        if (!stage.name || !stage.start_date) continue;

        const start = new Date(stage.start_date);
        if (isNaN(start.getTime())) continue;

        let end;
        if (stage.end_date) {
          end = new Date(stage.end_date);
        } else if (stage.completed_date) {
          end = new Date(stage.completed_date);
        } else if (stage.completed) {
          // Completed but no explicit end date — skip (can't compute duration)
          continue;
        } else {
          // In-progress: use today
          end = today;
        }

        if (isNaN(end.getTime())) continue;
        const days = Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
        if (days === 0) continue; // skip same-day (no meaningful duration)

        if (!stageMap[stage.name]) {
          stageMap[stage.name] = { totalDays: 0, count: 0 };
        }
        stageMap[stage.name].totalDays += days;
        stageMap[stage.name].count += 1;
      }
    }

    return Object.entries(stageMap)
      .map(([name, v]) => ({
        name,
        value: Math.round((v.totalDays / v.count) * 10) / 10,
        count: v.count,
      }))
      .sort((a, b) => b.value - a.value);
  }, [ddRecords]);

  const totalStages = data.length;

  return (
    <ChartCard
      title="Avg. Time per DD Stage"
      subtitle={`${totalStages} stage${totalStages !== 1 ? "s" : ""} across active projects`}
      icon={Clock}
      iconColor="text-blue-600"
    >
      {data.length === 0 ? (
        <EmptyChart label="No stage duration data" />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}d`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              width={130}
            />
            <Tooltip
              cursor={{ fill: "#f9fafb" }}
              contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
              formatter={(value, _name, props) => [
                `${value} days (avg of ${props.payload.count} project${props.payload.count !== 1 ? "s" : ""})`,
                "Avg Duration",
              ]}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
              {data.map((_, idx) => (
                <Cell key={idx} fill={TYPE_COLORS[idx % TYPE_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}