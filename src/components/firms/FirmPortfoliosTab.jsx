import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { Plus, CalendarIcon, Trash2, Pencil, X, Check } from "lucide-react";

export default function FirmPortfoliosTab({ firmId, firmName, onPortfolioClick }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [portfolioName, setPortfolioName] = useState("");
  const [inceptionDate, setInceptionDate] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [editCalendarOpen, setEditCalendarOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState(null);

  const { data: portfolios = [] } = useQuery({
    queryKey: ["portfolios", firmId],
    queryFn: () => base44.entities.Portfolio.filter({ firm_id: firmId }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Portfolio.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios", firmId] });
      setPortfolioName("");
      setInceptionDate(null);
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Portfolio.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios", firmId] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Portfolio.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios", firmId] });
    },
  });

  const handleCreate = () => {
    if (!portfolioName.trim() || !inceptionDate) return;
    createMutation.mutate({
      firm_id: firmId,
      allocator_name: firmName,
      portfolio_name: portfolioName.trim(),
      inception_date: format(inceptionDate, "yyyy-MM-dd"),
    });
  };

  const handleStartEdit = (portfolio) => {
    setEditingId(portfolio.id);
    setEditName(portfolio.portfolio_name);
    setEditDate(portfolio.inception_date ? parseISO(portfolio.inception_date) : null);
  };

  const handleSaveEdit = (id) => {
    if (!editName.trim() || !editDate) return;
    updateMutation.mutate({
      id,
      data: {
        portfolio_name: editName.trim(),
        inception_date: format(editDate, "yyyy-MM-dd"),
      },
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Portfolio
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="border border-indigo-100 rounded-xl p-3 bg-indigo-50/40 space-y-3">
          {/* Allocator Name (read-only) */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-600">Allocator Name</Label>
            <div className="h-8 px-3 flex items-center rounded-md border bg-gray-100 text-sm text-gray-700">
              {firmName}
            </div>
          </div>

          {/* Portfolio Name */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-600">Portfolio Name <span className="text-red-400">*</span></Label>
            <Input
              placeholder="Enter portfolio name..."
              value={portfolioName}
              onChange={(e) => setPortfolioName(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Inception Date */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-600">Inception Date <span className="text-red-400">*</span></Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full h-8 text-sm justify-start font-normal text-left"
                >
                  <CalendarIcon className="w-3.5 h-3.5 mr-2 text-gray-400" />
                  {inceptionDate ? format(inceptionDate, "MMM d, yyyy") : <span className="text-gray-400">Select date...</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={inceptionDate}
                  onSelect={(date) => { setInceptionDate(date); setCalendarOpen(false); }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setShowForm(false); setPortfolioName(""); setInceptionDate(null); }}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={!portfolioName.trim() || !inceptionDate || createMutation.isPending}
              onClick={handleCreate}
            >
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Portfolio list */}
      {portfolios.length === 0 && !showForm && (
        <div className="text-sm text-gray-400 italic py-2 text-center border border-dashed border-gray-200 rounded-xl">
          No portfolios added
        </div>
      )}

      <div className="space-y-2">
        {portfolios.map((p) =>
          editingId === p.id ? (
            <div key={p.id} className="border border-indigo-200 rounded-xl p-3 bg-indigo-50/40 space-y-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Portfolio Name</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Inception Date</Label>
                <Popover open={editCalendarOpen} onOpenChange={setEditCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-8 text-sm justify-start font-normal">
                      <CalendarIcon className="w-3.5 h-3.5 mr-2 text-gray-400" />
                      {editDate ? format(editDate, "MMM d, yyyy") : <span className="text-gray-400">Select date...</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editDate}
                      onSelect={(date) => { setEditDate(date); setEditCalendarOpen(false); }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                  <X className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                  disabled={!editName.trim() || !editDate || updateMutation.isPending}
                  onClick={() => handleSaveEdit(p.id)}
                >
                  <Check className="w-3 h-3 mr-1" /> Save
                </Button>
              </div>
            </div>
          ) : (
            <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 group">
              <div>
                <p className="text-sm font-medium text-gray-800">{p.portfolio_name}</p>
                <p className="text-xs text-gray-500">
                  Inception: {p.inception_date ? format(parseISO(p.inception_date), "MMM d, yyyy") : "—"}
                </p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-indigo-600" onClick={() => handleStartEdit(p)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => deleteMutation.mutate(p.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}