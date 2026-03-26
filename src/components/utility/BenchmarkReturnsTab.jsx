import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";

function formatReturn(val) {
  if (val === null || val === undefined || val === "") return "";
  return Number(val).toFixed(4);
}

export default function BenchmarkReturnsTab({ returns = [], onChange, isEditing }) {
  const [newDate, setNewDate] = useState(null);
  const [newReturn, setNewReturn] = useState("");
  const [calOpen, setCalOpen] = useState(false);

  const sorted = [...returns].sort((a, b) => a.date < b.date ? 1 : -1);

  const handleAdd = () => {
    if (!newDate || newReturn === "") return;
    const dateStr = format(newDate, "yyyy-MM-dd");
    // Replace if same date exists
    const filtered = returns.filter(r => r.date !== dateStr);
    onChange([...filtered, { date: dateStr, return_value: parseFloat(newReturn) }]);
    setNewDate(null);
    setNewReturn("");
  };

  const handleDelete = (date) => {
    onChange(returns.filter(r => r.date !== date));
  };

  const handleReturnEdit = (date, val) => {
    onChange(returns.map(r => r.date === date ? { ...r, return_value: parseFloat(val) } : r));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Monthly gross returns stored as a percentage (e.g. 1.5000 = 1.5%).</p>
      </div>

      {/* Add row (edit mode only) */}
      {isEditing && (
        <div className="flex items-end gap-2 p-3 bg-gray-50 rounded-lg border">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-600">Date</Label>
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 w-44 justify-start text-left font-normal text-sm"
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5 text-gray-400" />
                  {newDate ? format(newDate, "MM/dd/yyyy") : <span className="text-gray-400">Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={newDate}
                  onSelect={(d) => { setNewDate(d); setCalOpen(false); }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-600">Return (%)</Label>
            <Input
              type="number"
              step="0.0001"
              placeholder="e.g. 1.2500"
              value={newReturn}
              onChange={(e) => setNewReturn(e.target.value)}
              className="h-9 w-36 text-sm"
            />
          </div>

          <Button
            type="button"
            onClick={handleAdd}
            disabled={!newDate || newReturn === ""}
            className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </Button>
        </div>
      )}

      {/* Returns table */}
      {sorted.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400 border border-dashed rounded-lg">
          No returns data yet.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs uppercase tracking-wide">Date</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600 text-xs uppercase tracking-wide">Gross Return (%)</th>
                {isEditing && <th className="w-10" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((r) => (
                <tr key={r.date} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-800 font-medium">
                    {format(parseISO(r.date), "MM/dd/yyyy")}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.0001"
                        defaultValue={formatReturn(r.return_value)}
                        onBlur={(e) => handleReturnEdit(r.date, e.target.value)}
                        className="w-28 text-right border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    ) : (
                      <span className={`font-mono ${r.return_value >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {r.return_value >= 0 ? "+" : ""}{formatReturn(r.return_value)}%
                      </span>
                    )}
                  </td>
                  {isEditing && (
                    <td className="px-2 py-2.5 text-right">
                      <button
                        onClick={() => handleDelete(r.date)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}