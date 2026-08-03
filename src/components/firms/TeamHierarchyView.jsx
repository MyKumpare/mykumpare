import React, { useMemo, useState } from "react";
import {
  User, ChevronDown, ChevronRight, Users, Layers,
  Crown, Briefcase, TrendingUp, BarChart3, Settings2, Building2,
} from "lucide-react";

// ─── Seniority classification ───
// Each level is an ordered tier. People are matched top-down; first match wins.
const LEVELS = [
  {
    id: "board",
    label: "Board & Trustees",
    icon: Crown,
    color: "border-amber-300 bg-amber-50",
    headerColor: "bg-amber-100 text-amber-800",
    patterns: ["board chair", "chair of the board", "vice chair", "board member", "trustee", "chairman", "chairperson"],
  },
  {
    id: "executive",
    label: "Executive Leadership",
    icon: Building2,
    color: "border-indigo-300 bg-indigo-50",
    headerColor: "bg-indigo-100 text-indigo-800",
    patterns: ["chief ", "ceo", "cio", "cfo", "coo", "cto", "ccio", "president", "executive director", "general counsel", "executive officer"],
  },
  {
    id: "senior_mgmt",
    label: "Senior Management",
    icon: Briefcase,
    color: "border-blue-300 bg-blue-50",
    headerColor: "bg-blue-100 text-blue-800",
    patterns: ["managing director", "senior managing director", "partner", "head of", "deputy ", "co-head", "svp", "senior vice president", "executive vice president", "evp"],
  },
  {
    id: "director",
    label: "Directors & VPs",
    icon: Layers,
    color: "border-purple-300 bg-purple-50",
    headerColor: "bg-purple-100 text-purple-800",
    patterns: ["director", "vice president", " vp", "vp ", "vp,", "vp.", "vp/", "deputy director"],
  },
  {
    id: "portfolio_manager",
    label: "Portfolio Managers",
    icon: TrendingUp,
    color: "border-teal-300 bg-teal-50",
    headerColor: "bg-teal-100 text-teal-800",
    patterns: ["portfolio manager", " pm ", " pm,", " pm.", "pm/", "lead pm", "co-pm", "investment manager", "fund manager"],
  },
  {
    id: "analyst",
    label: "Analysts & Associates",
    icon: BarChart3,
    color: "border-green-300 bg-green-50",
    headerColor: "bg-green-100 text-green-800",
    patterns: ["analyst", "associate", "research", "trader", "quant", "strategist"],
  },
  {
    id: "other",
    label: "Operations & Other",
    icon: Settings2,
    color: "border-gray-300 bg-gray-50",
    headerColor: "bg-gray-100 text-gray-700",
    patterns: [], // catch-all
  },
];

function classifyPerson(title) {
  if (!title) return LEVELS[LEVELS.length - 1];
  const lower = title.toLowerCase().trim();
  for (const level of LEVELS) {
    if (level.id === "other") continue;
    for (const pat of level.patterns) {
      if (lower.includes(pat)) return level;
    }
  }
  return LEVELS[LEVELS.length - 1];
}

function getFullName(person) {
  return [person.first_name, person.last_name].filter(Boolean).join(" ") || "Unknown";
}

// ─── Person card ───
function PersonCard({ person, isLast }) {
  const name = getFullName(person);
  return (
    <div className="flex flex-col items-center" style={{ minWidth: 130 }}>
      <div className={`flex flex-col items-center p-2.5 rounded-xl border-2 bg-white shadow-sm ${classifyPerson(person.title).color}`} style={{ width: 130, minHeight: 110 }}>
        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-white mb-1.5">
          {person.photo_url ? (
            <img src={person.photo_url} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = "none"; }} />
          ) : (
            <User className="w-4 h-4 text-indigo-400" />
          )}
        </div>
        <p className="text-[11px] font-semibold text-gray-800 text-center leading-tight break-words whitespace-normal" style={{ wordBreak: "break-word" }}>
          {name}
        </p>
        {person.title && (
          <p className="text-[10px] text-gray-500 text-center leading-tight mt-0.5 break-words whitespace-normal" style={{ wordBreak: "break-word" }}>
            {person.title}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Level row ───
function LevelRow({ level, people, levelIdx, total }) {
  const [collapsed, setCollapsed] = useState(false);
  const Icon = level.icon;
  const showConnector = levelIdx < total - 1;

  return (
    <div className="flex flex-col items-center w-full">
      {/* Level header */}
      <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${level.headerColor} mb-2`}>
        <Icon className="w-3.5 h-3.5" />
        {level.label}
        <span className="font-normal opacity-70">({people.length})</span>
        <button type="button" onClick={() => setCollapsed(c => !c)} className="ml-1 hover:opacity-70 transition-opacity">
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Person cards */}
      {!collapsed && (
        <div className="flex flex-wrap gap-4 justify-center mb-2">
          {people.map((person, i) => (
            <PersonCard key={i} person={person} />
          ))}
        </div>
      )}

      {/* Connector line to next level */}
      {showConnector && (
        <div className="w-px h-6 bg-gray-300 mb-2" />
      )}
    </div>
  );
}

// ─── Main component ───
export default function TeamHierarchyView({ people, firmName }) {
  const grouped = useMemo(() => {
    const buckets = LEVELS.map(l => ({ ...l, people: [] }));
    for (const person of people) {
      const level = classifyPerson(person.title);
      const bucket = buckets.find(b => b.id === level.id);
      if (bucket) bucket.people.push(person);
    }
    // Only show levels that have people
    return buckets.filter(b => b.people.length > 0);
  }, [people]);

  const totalPeople = people.length;
  const levelCount = grouped.length;

  if (totalPeople === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <Users className="w-10 h-10 mb-2 opacity-40" />
        <p className="text-sm">No contacts to organize</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Info banner */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100 mb-2">
        <Users className="w-4 h-4 text-indigo-500 flex-shrink-0" />
        <p className="text-xs text-indigo-700">
          <strong>{firmName}</strong> team structure — {totalPeople} {totalPeople === 1 ? "person" : "people"} across {levelCount} {levelCount === 1 ? "level" : "levels"}.
          Hierarchy inferred from job titles; adjust manually in the Org Chart tab after applying.
        </p>
      </div>

      {/* Hierarchy tree */}
      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 overflow-x-auto">
        <div className="flex flex-col items-center min-w-fit">
          {grouped.map((level, idx) => (
            <LevelRow
              key={level.id}
              level={level}
              people={level.people}
              levelIdx={idx}
              total={grouped.length}
            />
          ))}
        </div>
      </div>
    </div>
  );
}