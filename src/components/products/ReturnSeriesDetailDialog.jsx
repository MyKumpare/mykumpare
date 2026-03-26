import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Edit2, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

function toMMDDYYYY(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `${m}/${d}/${y}`;
}

function parseMMDDYYYY(str) {
  const trimmed = str.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, m, d, y] = match;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export default function ReturnSeriesDetailDialog({
  open,
  onOpenChange,
  series,
  onEdit,
  onDelete,
  onAddReturn,
  productName,
}) {
  const [newDate, setNewDate] = useState("");
  const [newReturn, setNewReturn] = useState("");
  const [returnType, setReturnType] = useState("gross");
  const [error, setError] = useState("");
  const [editingReturnId, setEditingReturnId] = useState(null);
  const [editingReturnData, setEditingReturnData] = useState({});

  const handleAddReturn = () => {
    setError("");
    
    if (!newDate.trim()) {
      setError("Date is required");
      return;
    }

    const isoDate = parseMMDDYYYY(newDate);
    if (!isoDate) {
      setError("Invalid date format. Use MM/DD/YYYY");
      return;
    }

    if (!newReturn.trim()) {
      setError("Return value is required");
      return;
    }

    const returnVal = parseFloat(newReturn);
    if (isNaN(returnVal)) {
      setError("Return must be a valid number");
      return;
    }

    // Check if date already exists
    if (series?.monthly_returns?.some(r => r.date === isoDate)) {
      setError(`Return for ${newDate} already exists`);
      return;
    }

    const newReturnData = { date: isoDate, return_value: returnVal };
    if (returnType === "gross") {
      newReturnData.gross_return = returnVal;
    } else {
      newReturnData.net_return = returnVal;
    }

    onAddReturn(newReturnData);
    setNewDate("");
    setNewReturn("");
    setReturnType("gross");
  };

  const sortedReturns = [...(series?.monthly_returns || [])]
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const getSeriesName = () => {
    return series?.composite_name || series?.paper_portfolio_name || series?.back_test_name || "Unnamed Series";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Return Series Details</DialogTitle>
          {productName && (
            <div className="pt-1 space-y-1">
              <p className="text-sm text-gray-500">{productName}</p>
              <p className="text-sm font-semibold text-gray-900">{getSeriesName()}</p>
            </div>
          )}
        </DialogHeader>

        {series && (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="overview" className="flex-1">
                Overview
              </TabsTrigger>
              <TabsTrigger value="returns" className="flex-1">
                Returns ({series.monthly_returns?.length || 0})
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">
                      Type
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {series.return_types?.join(", ")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">
                      Name
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {series.composite_name ||
                        series.paper_portfolio_name ||
                        series.back_test_name ||
                        "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">
                      Inception Date
                    </p>
                    <p className="text-sm text-gray-900 mt-1">
                      {toMMDDYYYY(series.inception_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">
                      Return Frequency
                    </p>
                    <p className="text-sm text-gray-900 mt-1">
                      {series.return_frequency}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">
                      Data Range
                    </p>
                    <p className="text-sm text-gray-900 mt-1">
                      {toMMDDYYYY(series.start_date)} to{" "}
                      {toMMDDYYYY(series.end_date)}
                    </p>
                  </div>
                  {series.gips_status && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase">
                        GIPS Status
                      </p>
                      <p className="text-sm text-gray-900 mt-1">
                        {series.gips_status}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Returns Tab */}
            <TabsContent value="returns" className="space-y-4">
              <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300">
                <p className="text-sm font-medium text-gray-900">Add Return</p>
                <div className="space-y-2">
                  {error && (
                    <div className="flex gap-2 p-2.5 bg-red-50 border border-red-200 rounded">
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700">{error}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Date (MM/DD/YYYY)</Label>
                      <Input
                        placeholder="e.g. 12/31/2024"
                        value={newDate}
                        onChange={(e) => {
                          setNewDate(e.target.value);
                          setError("");
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Return (%)</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        placeholder="e.g. 1.2500"
                        value={newReturn}
                        onChange={(e) => {
                          setNewReturn(e.target.value);
                          setError("");
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Type</Label>
                      <select
                        value={returnType}
                        onChange={(e) => setReturnType(e.target.value)}
                        className="h-8 text-sm border border-input rounded px-2"
                      >
                        {series.return_frequency?.includes("Gross") && (
                          <option value="gross">Gross</option>
                        )}
                        {series.return_frequency?.includes("Net") && (
                          <option value="net">Net</option>
                        )}
                      </select>
                    </div>
                  </div>
                  <Button
                    onClick={handleAddReturn}
                    size="sm"
                    className="w-full h-8 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Return
                  </Button>
                </div>
              </div>

              {/* Returns Table */}
              {sortedReturns.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400 border border-dashed rounded-lg">
                  No returns yet
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs uppercase tracking-wide">
                          Date
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600 text-xs uppercase tracking-wide">
                          Gross Return (%)
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600 text-xs uppercase tracking-wide">
                          Net Return (%)
                        </th>
                        <th className="text-center px-4 py-2.5 font-medium text-gray-600 text-xs uppercase tracking-wide">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedReturns.map((r) => (
                        <tr
                          key={r.date}
                          className={editingReturnId === r.date ? "bg-blue-50" : "hover:bg-gray-50"}
                        >
                          {editingReturnId === r.date ? (
                            <>
                              <td className="px-4 py-2.5">
                                <Input
                                  type="text"
                                  value={editingReturnData.date || ""}
                                  onChange={(e) =>
                                    setEditingReturnData({
                                      ...editingReturnData,
                                      date: e.target.value,
                                    })
                                  }
                                  placeholder="MM/DD/YYYY"
                                  className="h-8 text-sm"
                                  autoFocus
                                />
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <Input
                                  type="number"
                                  value={editingReturnData.gross_return ?? ""}
                                  onChange={(e) =>
                                    setEditingReturnData({
                                      ...editingReturnData,
                                      gross_return: e.target.value ? parseFloat(e.target.value) : undefined,
                                    })
                                  }
                                  placeholder="—"
                                  step="0.0001"
                                  className="h-8 text-sm text-right"
                                />
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <Input
                                  type="number"
                                  value={editingReturnData.net_return ?? ""}
                                  onChange={(e) =>
                                    setEditingReturnData({
                                      ...editingReturnData,
                                      net_return: e.target.value ? parseFloat(e.target.value) : undefined,
                                    })
                                  }
                                  placeholder="—"
                                  step="0.0001"
                                  className="h-8 text-sm text-right"
                                />
                              </td>
                              <td className="px-4 py-2.5 text-center space-x-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    const isoDate = parseMMDDYYYY(editingReturnData.date);
                                    if (!isoDate) {
                                      setError("Invalid date format");
                                      return;
                                    }
                                    const updatedReturns = series.monthly_returns.map((ret) =>
                                      ret.date === r.date
                                        ? {
                                            date: isoDate,
                                            gross_return: editingReturnData.gross_return,
                                            net_return: editingReturnData.net_return,
                                          }
                                        : ret
                                    );
                                    onEdit({
                                      ...series,
                                      monthly_returns: updatedReturns,
                                    });
                                    setEditingReturnId(null);
                                    setEditingReturnData({});
                                    setError("");
                                  }}
                                  className="h-6 w-6 text-green-600 hover:bg-green-50"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingReturnId(null);
                                    setEditingReturnData({});
                                    setError("");
                                  }}
                                  className="h-6 w-6 text-gray-400 hover:bg-gray-100"
                                >
                                  <AlertCircle className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td
                                className="px-4 py-2.5 text-gray-800 font-medium cursor-pointer hover:text-indigo-600"
                                onClick={() => {
                                  setEditingReturnId(r.date);
                                  setEditingReturnData({
                                    ...r,
                                    date: toMMDDYYYY(r.date),
                                  });
                                  setError("");
                                }}
                              >
                                {toMMDDYYYY(r.date)}
                              </td>
                              <td
                                className="px-4 py-2.5 text-right cursor-pointer hover:text-indigo-600"
                                onClick={() => {
                                  setEditingReturnId(r.date);
                                  setEditingReturnData(r);
                                  setError("");
                                }}
                              >
                                {r.gross_return !== undefined ? (
                                  <span
                                    className={`font-mono text-sm ${
                                      r.gross_return >= 0
                                        ? "text-green-700"
                                        : "text-red-600"
                                    }`}
                                  >
                                    {r.gross_return >= 0 ? "+" : ""}
                                    {Number(r.gross_return).toFixed(4)}%
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td
                                className="px-4 py-2.5 text-right cursor-pointer hover:text-indigo-600"
                                onClick={() => {
                                  setEditingReturnId(r.date);
                                  setEditingReturnData(r);
                                  setError("");
                                }}
                              >
                                {r.net_return !== undefined ? (
                                  <span
                                    className={`font-mono text-sm ${
                                      r.net_return >= 0
                                        ? "text-green-700"
                                        : "text-red-600"
                                    }`}
                                  >
                                    {r.net_return >= 0 ? "+" : ""}
                                    {Number(r.net_return).toFixed(4)}%
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    const updatedReturns = series.monthly_returns.filter(
                                      (ret) => ret.date !== r.date
                                    );
                                    onEdit({
                                      ...series,
                                      monthly_returns: updatedReturns,
                                    });
                                  }}
                                  className="h-6 w-6 text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onEdit && (
            <Button
              onClick={() => {
                onEdit(series);
                onOpenChange(false);
              }}
              className="gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              variant="outline"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </Button>
          )}
          {onDelete && (
            <Button
              onClick={() => {
                if (
                  window.confirm(
                    "Are you sure you want to delete this return series?"
                  )
                ) {
                  onDelete(series.id);
                  onOpenChange(false);
                }
              }}
              variant="outline"
              className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}