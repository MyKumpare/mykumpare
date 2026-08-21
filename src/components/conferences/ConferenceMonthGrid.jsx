import React, { useMemo } from "react";
import {
  format, isSameMonth, isSameDay, parseISO,
} from "date-fns";

const PARTICP_COLORS = {
  Sponsoring: "bg-amber-100 text-amber-800 border-amber-300",
  Attending: "bg-blue-100 text-blue-800 border-blue-300",
  Speaking: "bg-purple-100 text-purple-800 border-purple-300",
  Exhibiting: "bg-emerald-100 text-emerald-800 border-emerald-300",
  Unknown: "bg-gray-100 text-gray-700 border-gray-300",
};

const ROW_HEIGHT = 88;      // px height of each week row
const DATE_NUM_HEIGHT = 18; // top space reserved for the date number
const LANE_H = 16;          // height of each event bar lane
const MAX_LANES = 3;        // max visible lanes per week

const DAY_MS = 24 * 60 * 60 * 1000;

export default function ConferenceMonthGrid({
  days, currentMonth, selectedDate, onSelectDate, conferences,
}) {
  // Chunk the flat day list into weeks of 7
  const weeks = useMemo(() => {
    const w = [];
    for (let i = 0; i < days.length; i += 7) w.push(days.slice(i, i + 7));
    return w;
  }, [days]);

  // Precompute parsed start/end dates for every conference
  const events = useMemo(() => {
    return conferences
      .filter(c => c.conference_date)
      .map(c => {
        const startStr = c.conference_date.substring(0, 10);
        const endStr = (c.end_date || c.conference_date).substring(0, 10);
        try {
          return { ...c, _start: parseISO(startStr), _end: parseISO(endStr) };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }, [conferences]);

  return (
    <div className="space-y-px">
      {weeks.map((week, wi) => {
        const weekStart = week[0];
        const weekEnd = week[6];

        // Events overlapping this week, sorted by start date
        const weekEvents = events
          .filter(e => e._end >= weekStart && e._start <= weekEnd)
          .sort((a, b) => a._start - b._start);

        // Greedy lane packing: assign each event to the first lane whose
        // last-occupied day is before this event's start.
        const laneEnds = []; // laneEnds[i] = last occupied Date in lane i
        const placed = weekEvents.map(e => {
          const evStart = e._start < weekStart ? weekStart : e._start;
          const evEnd = e._end > weekEnd ? weekEnd : e._end;
          const colStart = Math.round((evStart - weekStart) / DAY_MS); // 0-6
          const span = Math.round((evEnd - evStart) / DAY_MS) + 1;
          let lane = laneEnds.findIndex(last => last < evStart);
          if (lane === -1) { lane = laneEnds.length; laneEnds.push(evEnd); }
          else laneEnds[lane] = evEnd;
          return { ...e, colStart, span, lane };
        });

        const visible = placed.filter(p => p.lane < MAX_LANES);
        const hiddenIds = new Set(placed.filter(p => p.lane >= MAX_LANES).map(p => p.id));

        return (
          <div key={wi} className="relative">
            {/* Day cells (background) */}
            <div className="grid grid-cols-7 gap-px">
              {week.map(day => {
                const key = format(day, "yyyy-MM-dd");
                const inMonth = isSameMonth(day, currentMonth);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => onSelectDate(day)}
                    className={`rounded-md border p-1 text-left transition-colors ${
                      isSelected ? "border-indigo-400 bg-indigo-50"
                      : inMonth ? "border-gray-100 bg-white hover:bg-gray-50"
                      : "border-gray-50 bg-gray-50/50 text-gray-400"
                    }`}
                    style={{ height: ROW_HEIGHT }}
                  >
                    <div className={`text-[10px] font-medium ${inMonth ? "text-gray-600" : "text-gray-300"}`}>
                      {format(day, "d")}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Event bars overlay — same 7-col grid so bars align to day edges */}
            <div
              className="absolute inset-0 grid grid-cols-7 gap-px pointer-events-none"
              style={{
                paddingTop: DATE_NUM_HEIGHT + "px",
                gridTemplateRows: `repeat(${MAX_LANES}, ${LANE_H}px)`,
              }}
            >
              {visible.map(p => {
                const pColor = PARTICP_COLORS[p.participation_type] || PARTICP_COLORS.Unknown;
                const barStyle = { gridColumn: `${p.colStart + 1} / span ${p.span}`, gridRow: p.lane + 1 };
                const barCls = `text-[9px] leading-none px-1 py-0.5 rounded border truncate ${pColor} ${p.url ? "pointer-events-auto cursor-pointer hover:brightness-95" : "pointer-events-none"}`;
                const barTitle = p.url ? `${p.title} — open registration site` : p.title;
                return p.url ? (
                  <a
                    key={p.id}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className={barCls}
                    style={barStyle}
                    title={barTitle}
                  >
                    {p.title}
                  </a>
                ) : (
                  <div
                    key={p.id}
                    className={barCls}
                    style={barStyle}
                    title={barTitle}
                  >
                    {p.title}
                  </div>
                );
              })}
              {hiddenIds.size > 0 && (
                <div
                  className="text-[9px] text-gray-400 px-1"
                  style={{ gridColumn: "1 / -1", gridRow: MAX_LANES + 1 }}
                >
                  +{hiddenIds.size} more
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}